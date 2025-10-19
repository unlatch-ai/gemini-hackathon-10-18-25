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
from aiohttp_cors import setup as cors_setup, ResourceOptions
import logging
import subprocess
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s'
)
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
        self.transcript_buffers = {}  # Store 10-second buffers per session
        self.buffer_tasks = {}  # Background tasks for buffer processing

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
        return f"""You are a safety monitoring assistant. Your ONLY job is to detect when someone says EXACTLY the phrase: "{self.panic_codeword}"

CRITICAL RULES:
- ONLY call trigger_emergency_call if you hear the EXACT phrase "{self.panic_codeword}"
- Do NOT trigger on similar phrases or partial matches
- Do NOT trigger on random phrases
- Do NOT respond with audio or text at all
- If unsure, DO NOT TRIGGER

The exact phrase is: "{self.panic_codeword}"

Only trigger if you are 100% certain the user said this exact phrase."""

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

    async def start_session(self, session_id):
        """Start a Gemini Live session for audio/video monitoring"""
        logger.info(f"Starting Gemini Live session {session_id}")

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],  # Gemini Live requires audio response
            system_instruction=self.get_system_instruction(),
            tools=self.get_function_declarations(),
            input_audio_transcription={},  # Enable input transcription for debugging
        )

        try:
            # Create the live session connection (keep reference to context manager)
            context_manager = self.client.aio.live.connect(model=self.model, config=config)
            session = await context_manager.__aenter__()

            self.active_sessions[session_id] = {
                'session': session,
                'context_manager': context_manager,
                'task': None
            }
            logger.info(f"✅ Session {session_id} connected to Gemini Live API")

            # Start background task to listen for responses
            task = asyncio.create_task(self._listen_for_responses(session_id, session))
            self.active_sessions[session_id]['task'] = task

            return True
        except Exception as e:
            logger.error(f"Error starting session {session_id}: {e}")
            return False

    async def _listen_for_responses(self, session_id, session):
        """Background task to listen for Gemini responses"""
        try:
            async for response in session.receive():
                # Log input transcription (what Gemini heard)
                if response.server_content and response.server_content.input_transcription:
                    transcript = response.server_content.input_transcription.text
                    logger.info(f"🎙️  TRANSCRIPT [{session_id}]: {transcript}")

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
            logger.error(f"Error listening to session {session_id}: {e}")
        finally:
            logger.info(f"Stopped listening to session {session_id}")

    async def send_audio(self, session_id, audio_data):
        """Send audio data to active Gemini session"""
        if session_id not in self.active_sessions:
            logger.error(f"Session {session_id} not found")
            return False

        # For hackathon MVP: Audio streaming is complex with WebM chunks
        # Accepting audio but not processing it yet
        # The text-based trigger (send_text) will be used for demo
        logger.debug(f"Received audio chunk for session {session_id}")
        return True

    async def send_text(self, session_id, text):
        """Buffer speech transcripts and analyze every 10 seconds with Gemini"""
        if session_id not in self.active_sessions:
            logger.error(f"Session {session_id} not found")
            return False

        logger.info(f"📝 Heard: '{text}'")

        # Add to transcript buffer
        if session_id not in self.transcript_buffers:
            self.transcript_buffers[session_id] = []
            # Start background task to process buffer every 10 seconds
            task = asyncio.create_task(self._process_buffer_periodically(session_id))
            self.buffer_tasks[session_id] = task

        self.transcript_buffers[session_id].append(text)
        return True

    async def _process_buffer_periodically(self, session_id):
        """Process transcript buffer every 10 seconds with Gemini analysis"""
        while session_id in self.active_sessions:
            await asyncio.sleep(10)  # Wait 10 seconds

            if session_id not in self.transcript_buffers or len(self.transcript_buffers[session_id]) == 0:
                continue

            # Get all transcripts from the last 10 seconds
            transcripts = self.transcript_buffers[session_id]
            conversation = " ".join(transcripts)

            logger.info(f"🤖 Analyzing 10-second buffer ({len(transcripts)} phrases): '{conversation}'")

            # Clear buffer
            self.transcript_buffers[session_id] = []

            # Notify frontend that analysis is starting
            await self.notify_backend(session_id, {
                'type': 'analysis_started',
                'session_id': session_id
            })

            # Analyze with Gemini multi-agent system
            try:
                danger_score, agent_scores = await self._analyze_conversation_safety(conversation)
                logger.info(f"📊 Final danger score: {danger_score}/100")

                # Always send agent scores back to frontend (even if not dangerous)
                await self.notify_backend(session_id, {
                    'type': 'analysis_complete',
                    'session_id': session_id,
                    'danger_score': danger_score,
                    'agent_scores': agent_scores
                })

                if danger_score >= 70:  # Threshold: 70%
                    logger.warning(f"🚨 DANGEROUS SITUATION DETECTED! Score: {danger_score}")
                    await self.notify_backend(session_id, {
                        'session_id': session_id,
                        'detected_phrase': conversation[:100],  # First 100 chars
                        'confidence': danger_score / 100,
                        'timestamp': '',
                        'agentScores': agent_scores  # Include multi-agent breakdown
                    })
            except Exception as e:
                logger.error(f"Error analyzing conversation: {e}")

    async def _analyze_conversation_safety(self, conversation):
        """
        Multi-agent collaborative analysis system
        Multiple specialized Gemini agents work together to assess danger level
        """
        logger.info("🤝 Starting multi-agent collaborative analysis...")

        # Run all agents in parallel for efficiency
        results = await asyncio.gather(
            self._agent_transcript_analyzer(conversation),
            self._agent_emotional_detector(conversation),
            self._agent_context_interpreter(conversation),
            return_exceptions=True
        )

        # Extract scores from each agent
        transcript_score, emotional_score, context_score = results

        # Handle any errors
        if isinstance(transcript_score, Exception):
            logger.error(f"Transcript analyzer error: {transcript_score}")
            transcript_score = 0
        if isinstance(emotional_score, Exception):
            logger.error(f"Emotional detector error: {emotional_score}")
            emotional_score = 0
        if isinstance(context_score, Exception):
            logger.error(f"Context interpreter error: {context_score}")
            context_score = 0

        logger.info(f"📊 Agent Scores - Transcript: {transcript_score}, Emotional: {emotional_score}, Context: {context_score}")

        # Threat Assessor Agent: Synthesizes all agent inputs
        final_score = await self._agent_threat_assessor(
            conversation,
            transcript_score,
            emotional_score,
            context_score
        )

        logger.info(f"🎯 Final Threat Assessment: {final_score}/100")

        # Return both final score and individual agent scores for frontend display
        agent_breakdown = {
            'transcript': transcript_score,
            'emotional': emotional_score,
            'context': context_score,
            'final': final_score
        }
        return final_score, agent_breakdown

    async def _agent_transcript_analyzer(self, conversation):
        """
        Agent 1: Transcript Analyzer
        Analyzes literal content and keywords for concerning language
        """
        prompt = f"""You are a TRANSCRIPT ANALYSIS AGENT. Your job is to analyze the literal words spoken.

Conversation: "{conversation}"

Analyze ONLY the literal content:
- Explicit threats or aggressive language
- Direct requests for help
- Mentions of danger, fear, or discomfort
- Attempts to leave or end the conversation

Rate danger based on LITERAL CONTENT ONLY from 0-100.

IMPORTANT: Respond with ONLY a single number between 0 and 100. No explanation, no text, just the number.
Examples: "0" or "45" or "88"

Your response:"""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            response_text = response.text.strip()
            logger.debug(f"  📝 Transcript Agent raw response: '{response_text}'")

            # Extract number from response (handle cases like "Score: 75" or just "75")
            import re
            numbers = re.findall(r'\d+', response_text)
            if numbers:
                score = int(numbers[0])
            else:
                logger.warning(f"  📝 Transcript Agent: No number found in '{response_text}', defaulting to 0")
                score = 0

            logger.info(f"  📝 Transcript Agent: {score}/100")
            return min(100, max(0, score))
        except Exception as e:
            logger.error(f"Transcript agent error: {e}")
            raise

    async def _agent_emotional_detector(self, conversation):
        """
        Agent 2: Emotional State Detector
        Detects emotional distress, fear, anxiety through language patterns
        """
        prompt = f"""You are an EMOTIONAL ANALYSIS AGENT. Your job is to detect emotional state through language.

Conversation: "{conversation}"

Analyze ONLY emotional indicators:
- Signs of stress, fear, or anxiety
- Nervousness or hesitation in speech
- Passive-aggressive or coded language
- Emotional distress signals

Rate danger based on EMOTIONAL STATE from 0-100.

IMPORTANT: Respond with ONLY a single number between 0 and 100. No explanation, no text, just the number.
Examples: "0" or "45" or "88"

Your response:"""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            response_text = response.text.strip()
            logger.debug(f"  😰 Emotional Agent raw response: '{response_text}'")

            import re
            numbers = re.findall(r'\d+', response_text)
            if numbers:
                score = int(numbers[0])
            else:
                logger.warning(f"  😰 Emotional Agent: No number found in '{response_text}', defaulting to 0")
                score = 0

            logger.info(f"  😰 Emotional Agent: {score}/100")
            return min(100, max(0, score))
        except Exception as e:
            logger.error(f"Emotional agent error: {e}")
            raise

    async def _agent_context_interpreter(self, conversation):
        """
        Agent 3: Context Interpreter
        Understands social dynamics, power imbalances, situational context
        """
        prompt = f"""You are a CONTEXT ANALYSIS AGENT. Your job is to understand social dynamics and situational context.

Conversation: "{conversation}"

Analyze ONLY contextual factors:
- Power dynamics between speakers
- Signs of coercion or manipulation
- Social pressure or uncomfortable situations
- Situational red flags

Rate danger based on CONTEXTUAL ANALYSIS from 0-100.

IMPORTANT: Respond with ONLY a single number between 0 and 100. No explanation, no text, just the number.
Examples: "0" or "45" or "88"

Your response:"""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            response_text = response.text.strip()
            logger.debug(f"  🔍 Context Agent raw response: '{response_text}'")

            import re
            numbers = re.findall(r'\d+', response_text)
            if numbers:
                score = int(numbers[0])
            else:
                logger.warning(f"  🔍 Context Agent: No number found in '{response_text}', defaulting to 0")
                score = 0

            logger.info(f"  🔍 Context Agent: {score}/100")
            return min(100, max(0, score))
        except Exception as e:
            logger.error(f"Context agent error: {e}")
            raise

    async def _agent_threat_assessor(self, conversation, transcript_score, emotional_score, context_score):
        """
        Agent 4: Threat Assessor
        Meta-agent that synthesizes inputs from other agents to make final decision
        """
        prompt = f"""You are the THREAT ASSESSMENT COORDINATOR. You synthesize analysis from specialist agents.

Conversation: "{conversation}"

Specialist Agent Reports:
- Transcript Analysis Agent: {transcript_score}/100 (literal content)
- Emotional State Agent: {emotional_score}/100 (emotional distress)
- Context Analysis Agent: {context_score}/100 (situational factors)

Your job: Synthesize these three perspectives into a final threat assessment.
Consider:
- Are all agents in agreement? (high confidence)
- Is one agent detecting something others missed?
- What's the overall pattern across all dimensions?

Provide final danger score 0-100.

IMPORTANT: Respond with ONLY a single number between 0 and 100. No explanation, no text, just the number.
Examples: "0" or "45" or "88"

Your response:"""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            response_text = response.text.strip()
            logger.debug(f"  ⚖️  Threat Assessor raw response: '{response_text}'")

            import re
            numbers = re.findall(r'\d+', response_text)
            if numbers:
                score = int(numbers[0])
            else:
                logger.warning(f"  ⚖️  Threat Assessor: No number found in '{response_text}', defaulting to average")
                score = int((transcript_score + emotional_score + context_score) / 3)

            logger.info(f"  ⚖️  Threat Assessor (Meta-Agent): {score}/100")
            return min(100, max(0, score))
        except Exception as e:
            logger.error(f"Threat assessor error: {e}")
            # Fallback: average of available agent scores
            return int((transcript_score + emotional_score + context_score) / 3)

    async def send_video(self, session_id, video_data):
        """Send audio from WebM container to Gemini session"""
        # This function is now just an alias for send_audio since we're receiving audio/webm
        return await self.send_audio(session_id, video_data)

    async def stop_session(self, session_id):
        """Stop an active session"""
        if session_id in self.active_sessions:
            logger.info(f"Stopping session {session_id}")
            session_data = self.active_sessions[session_id]

            # Cancel the listening task
            if session_data['task']:
                session_data['task'].cancel()

            # Cancel the buffer processing task
            if session_id in self.buffer_tasks:
                self.buffer_tasks[session_id].cancel()
                del self.buffer_tasks[session_id]

            # Clear transcript buffer
            if session_id in self.transcript_buffers:
                del self.transcript_buffers[session_id]

            # Close the session using the context manager
            try:
                await session_data['context_manager'].__aexit__(None, None, None)
            except Exception as e:
                logger.error(f"Error closing session {session_id}: {e}")

            # Remove from active sessions
            del self.active_sessions[session_id]


# HTTP server for communication with Node.js
handler_instance = LiveStreamHandler()

async def handle_start_session(request):
    """HTTP endpoint to start a new session"""
    data = await request.json()
    session_id = data.get('session_id')

    if not session_id:
        return web.json_response({'error': 'session_id required'}, status=400)

    # Actually start the Gemini Live session
    success = await handler_instance.start_session(session_id)

    if success:
        return web.json_response({
            'status': 'session_started',
            'session_id': session_id
        })
    else:
        return web.json_response({
            'status': 'error',
            'error': 'Failed to start session'
        }, status=500)

async def handle_send_audio(request):
    """HTTP endpoint to send audio data"""
    session_id = request.match_info.get('session_id')
    audio_data = await request.read()

    success = await handler_instance.send_audio(session_id, audio_data)

    return web.json_response({
        'status': 'success' if success else 'error',
        'session_id': session_id
    })

async def handle_send_video(request):
    """HTTP endpoint to send video data"""
    session_id = request.match_info.get('session_id')
    video_data = await request.read()

    success = await handler_instance.send_video(session_id, video_data)

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

async def handle_send_text(request):
    """HTTP endpoint to send text data"""
    session_id = request.match_info.get('session_id')
    data = await request.json()
    text = data.get('text', '')

    success = await handler_instance.send_text(session_id, text)

    return web.json_response({
        'status': 'success' if success else 'error',
        'session_id': session_id
    })

def create_app():
    app = web.Application()

    # Add routes
    app.router.add_post('/session/start', handle_start_session)
    app.router.add_post('/session/{session_id}/audio', handle_send_audio)
    app.router.add_post('/session/{session_id}/video', handle_send_video)
    app.router.add_post('/session/{session_id}/text', handle_send_text)
    app.router.add_post('/session/{session_id}/stop', handle_stop_session)
    app.router.add_get('/health', handle_health)

    # Setup CORS
    cors = cors_setup(app, defaults={
        "*": ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*"
        )
    })

    # Configure CORS for all routes
    for route in list(app.router.routes()):
        cors.add(route)

    return app

if __name__ == '__main__':
    logger.info("🚀 Starting Gemini Live Stream Handler")
    logger.info(f"📝 Monitoring for codeword: '{handler_instance.panic_codeword}'")

    app = create_app()
    web.run_app(app, host='127.0.0.1', port=5001)
