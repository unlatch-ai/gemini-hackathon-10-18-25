"""
Gemini Live API handler for panic codeword detection
Runs as a standalone service that the Node.js backend communicates with
"""
import asyncio
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from aiohttp import web
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv('../.env.local')

class LiveStreamHandler:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        self.panic_codeword = os.getenv('PANIC_CODEWORD', 'help me mom')
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.5-flash-native-audio-preview-09-2025"
        self.active_sessions = {}

        logger.info(f"Initialized with codeword: {self.panic_codeword}")
        logger.info(f"Backend URL: {self.backend_url}")

    async def notify_backend(self, session_id, data):
        """Notify Node.js backend about codeword detection"""
        import aiohttp
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f'{self.backend_url}/api/live/codeword-detected',
                    json=data
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Successfully notified backend about codeword detection")
                    else:
                        logger.error(f"❌ Backend returned status {response.status}")
        except Exception as e:
            logger.error(f"❌ Error notifying backend: {e}")

    def get_system_instruction(self):
        return f"""You are a safety monitoring assistant. Your ONLY job is to listen carefully to the audio and detect when someone says the phrase "{self.panic_codeword}".

IMPORTANT:
- If you hear "{self.panic_codeword}" (or close variations), immediately call the trigger_emergency_call function.
- Do NOT respond with audio or text unless you detect the codeword.
- Be sensitive to different pronunciations, accents, and speaking speeds.
- Even if the phrase is part of a normal conversation, still trigger the call.

Remember: The user's safety depends on you detecting this phrase accurately."""

    def get_function_declarations(self):
        return [{
            "function_declarations": [{
                "name": "trigger_emergency_call",
                "description": "Triggers an emergency phone call when the panic codeword is detected in the audio stream",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "detected_phrase": {
                            "type": "string",
                            "description": "The exact phrase that was detected"
                        },
                        "confidence": {
                            "type": "number",
                            "description": "Confidence score between 0 and 1"
                        },
                        "timestamp": {
                            "type": "string",
                            "description": "ISO timestamp when detected"
                        }
                    },
                    "required": ["detected_phrase", "confidence", "timestamp"]
                }
            }]
        }]

    async def start_session(self, session_id, websocket):
        """Start a Gemini Live session for audio monitoring"""
        logger.info(f"Starting session {session_id}")

        config = types.LiveConnectConfig(
            response_modalities=["TEXT"],  # We don't need audio response
            system_instruction=self.get_system_instruction(),
            tools=self.get_function_declarations()
        )

        try:
            async with self.client.aio.live.connect(model=self.model, config=config) as session:
                self.active_sessions[session_id] = session
                logger.info(f"Session {session_id} connected to Gemini Live API")

                # Send initial status
                await websocket.send(json.dumps({
                    'type': 'status',
                    'message': 'Connected to Gemini Live API',
                    'session_id': session_id
                }))

                # Listen for responses from Gemini
                async for response in session.receive():
                    # Check for function calls (codeword detected!)
                    if response.tool_call:
                        for fc in response.tool_call.function_calls:
                            if fc.name == "trigger_emergency_call":
                                logger.warning(f"🚨 CODEWORD DETECTED in session {session_id}!")
                                logger.info(f"Function call args: {fc.args}")

                                # Notify Node.js backend immediately via HTTP
                                await self.notify_backend(session_id, {
                                    'session_id': session_id,
                                    'detected_phrase': fc.args.get('detected_phrase', self.panic_codeword),
                                    'confidence': fc.args.get('confidence', 1.0),
                                    'timestamp': fc.args.get('timestamp', '')
                                })

                                # Send function response back to Gemini
                                await session.send_tool_response(
                                    function_responses=[types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": "Emergency call triggered successfully"}
                                    )]
                                )

                    # Log any text responses (for debugging)
                    if response.text:
                        logger.debug(f"Gemini text response: {response.text}")

        except Exception as e:
            logger.error(f"Error in session {session_id}: {e}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': str(e),
                'session_id': session_id
            }))
        finally:
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            logger.info(f"Session {session_id} ended")

    async def send_audio(self, session_id, audio_data):
        """Send audio data to active Gemini session"""
        if session_id not in self.active_sessions:
            logger.error(f"Session {session_id} not found")
            return False

        session = self.active_sessions[session_id]

        try:
            # Send audio as realtime input
            await session.send_realtime_input(
                audio=types.Blob(
                    data=audio_data,
                    mime_type="audio/pcm;rate=16000"
                )
            )
            return True
        except Exception as e:
            logger.error(f"Error sending audio to session {session_id}: {e}")
            return False

    async def stop_session(self, session_id):
        """Stop an active session"""
        if session_id in self.active_sessions:
            logger.info(f"Stopping session {session_id}")
            # The session will close when we exit the context manager
            # Just remove it from active sessions
            del self.active_sessions[session_id]


# HTTP server for communication with Node.js
handler_instance = LiveStreamHandler()

async def handle_start_session(request):
    """HTTP endpoint to start a new session"""
    data = await request.json()
    session_id = data.get('session_id')

    if not session_id:
        return web.json_response({'error': 'session_id required'}, status=400)

    # Return immediately, actual session runs in background
    return web.json_response({
        'status': 'session_started',
        'session_id': session_id
    })

async def handle_send_audio(request):
    """HTTP endpoint to send audio data"""
    session_id = request.match_info.get('session_id')
    audio_data = await request.read()

    success = await handler_instance.send_audio(session_id, audio_data)

    return web.json_response({
        'status': 'success' if success else 'error',
        'session_id': session_id
    })

async def handle_stop_session(request):
    """HTTP endpoint to stop a session"""
    session_id = request.match_info.get('session_id')
    await handler_instance.stop_session(session_id)

    return web.json_response({
        'status': 'session_stopped',
        'session_id': session_id
    })

async def handle_health(request):
    """Health check endpoint"""
    return web.json_response({
        'status': 'healthy',
        'active_sessions': len(handler_instance.active_sessions),
        'codeword': handler_instance.panic_codeword
    })

def create_app():
    app = web.Application()
    app.router.add_post('/session/start', handle_start_session)
    app.router.add_post('/session/{session_id}/audio', handle_send_audio)
    app.router.add_post('/session/{session_id}/stop', handle_stop_session)
    app.router.add_get('/health', handle_health)
    return app

if __name__ == '__main__':
    logger.info("🚀 Starting Gemini Live Stream Handler")
    logger.info(f"📝 Monitoring for codeword: '{handler_instance.panic_codeword}'")

    app = create_app()
    web.run_app(app, host='127.0.0.1', port=5000)
