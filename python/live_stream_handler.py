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
from elevenlabs.client import ElevenLabs
from gtts import gTTS

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
        self.google_cloud_api_key = os.getenv('GOOGLE_CLOUD_API_KEY', self.api_key)
        self.elevenlabs_api_key = os.getenv('ELEVENLABS_API_KEY')
        self.elevenlabs_client = None
        if self.elevenlabs_api_key:
            self.elevenlabs_client = ElevenLabs(api_key=self.elevenlabs_api_key)

        self.panic_codeword = os.getenv('PANIC_CODEWORD', 'help me mom')
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
        # Initialize Gemini client for conversation AI
        self.client = None
        if self.api_key:
            try:
                logger.info(f"🔧 Initializing Gemini client with API key: {self.api_key[:10]}...")
                self.client = genai.Client(api_key=self.api_key)
                logger.info("✅ Gemini client initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Gemini client: {e}")
                logger.info("   Will use fallback responses for conversations")
        else:
            logger.warning("⚠️ No GEMINI_API_KEY found - conversation will use fallbacks")
        self.model = "gemini-2.5-flash-native-audio-preview-09-2025"
        self.active_sessions = {}
        self.transcript_buffers = {}  # Store 10-second buffers per session
        self.buffer_tasks = {}  # Background tasks for buffer processing

        logger.info(f"Initialized with codeword: {self.panic_codeword}")
        logger.info(f"Backend URL: {self.backend_url}")

    def text_to_speech(self, text, voice_id="pNInz6obpgDQGcFmaJgB"):
        """
        Convert text to speech with ElevenLabs (primary) and Google TTS (fallback)

        Args:
            text: The text to convert to speech
            voice_id: ElevenLabs voice ID (default: Adam)

        Returns:
            bytes: Audio data in MP3 format
        """
        # Try ElevenLabs first
        if self.elevenlabs_client:
            try:
                logger.info("🎙️ Trying ElevenLabs TTS...")
                audio_generator = self.elevenlabs_client.text_to_speech.convert(
                    text=text,
                    voice_id=voice_id,
                    model_id="eleven_multilingual_v2"
                )
                audio_bytes = b"".join(audio_generator)
                logger.info("✅ ElevenLabs TTS successful")
                return audio_bytes
            except Exception as e:
                logger.warning(f"⚠️ ElevenLabs TTS failed: {e}, falling back to Google TTS")

        # Try Google Cloud TTS with the new API key
        try:
            logger.info("🎙️ Trying Google Cloud TTS (official)...")
            import requests
            import base64

            url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.google_cloud_api_key}"

            data = {
                "input": {"text": text},
                "voice": {
                    "languageCode": "en-US",
                    "name": "en-US-Neural2-D",  # Male voice
                    "ssmlGender": "MALE"
                },
                "audioConfig": {
                    "audioEncoding": "MP3"
                }
            }

            response = requests.post(url, json=data, timeout=10)
            response.raise_for_status()

            audio_content = base64.b64decode(response.json()['audioContent'])
            logger.info("✅ Google Cloud TTS successful")
            return audio_content
        except Exception as e:
            logger.warning(f"⚠️ Google Cloud TTS failed: {e}, falling back to gTTS")

        # Final fallback to gTTS (free Google TTS)
        try:
            logger.info("🎙️ Using gTTS (Google Text-to-Speech)...")
            import io

            # Create gTTS object - using slow=False for natural speed
            tts = gTTS(text=text, lang='en', slow=False, tld='us')

            # Save to bytes buffer
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)

            logger.info("✅ gTTS successful")
            return audio_buffer.read()
        except Exception as e:
            logger.error(f"❌ gTTS failed: {e}")
            raise Exception(f"All TTS services failed: {e}")

    async def notify_backend(self, session_id, data):
        """Notify Node.js backend about codeword detection"""
        import aiohttp
        try:
            timeout = aiohttp.ClientTimeout(total=5)  # 5 second timeout
            async with aiohttp.ClientSession(timeout=timeout) as session:
                logger.debug(f"Sending notification to backend: {data.get('type', 'unknown')}")
                async with session.post(
                    f'{self.backend_url}/api/live/codeword-detected',
                    json=data
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Successfully notified backend: {data.get('type', 'unknown')}")
                    else:
                        logger.error(f"❌ Backend returned status {response.status} for {data.get('type', 'unknown')}")
        except asyncio.TimeoutError:
            logger.error(f"❌ Timeout notifying backend for {data.get('type', 'unknown')}")
        except Exception as e:
            logger.error(f"❌ Error notifying backend for {data.get('type', 'unknown')}: {e}")

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
            # Clean up any partial session data
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
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
            # Clean up the session if there's an error
            if session_id in self.active_sessions:
                logger.info(f"Cleaning up failed session {session_id}")
                await self.stop_session(session_id)
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

        # IMMEDIATE keyword detection for "danger"
        if self.panic_codeword.lower() in text.lower():
            logger.warning(f"🚨 INSTANT KEYWORD MATCH! '{self.panic_codeword}' detected in: '{text}'")
            # Trigger immediately without waiting for multi-agent analysis
            await self.notify_backend(session_id, {
                'type': 'codeword_detected',
                'session_id': session_id,
                'detected_phrase': text[:100],
                'confidence': 1.0,  # 100% confidence for exact keyword match
                'timestamp': '',
                'agentScores': {
                    'transcript': 100,
                    'emotional': 100,
                    'context': 100,
                    'final': 100
                }
            })

        # Add to transcript buffer for multi-agent analysis
        if session_id not in self.transcript_buffers:
            self.transcript_buffers[session_id] = []
            # Start background task to process buffer every 10 seconds
            task = asyncio.create_task(self._process_buffer_periodically(session_id))
            self.buffer_tasks[session_id] = task

        self.transcript_buffers[session_id].append(text)
        return True

    async def _process_buffer_periodically(self, session_id):
        """Process transcript buffer every 10 seconds with Gemini analysis"""
        # Process immediately on first call, then every 10 seconds
        first_run = True

        while session_id in self.active_sessions:
            if not first_run:
                await asyncio.sleep(10)  # Wait 10 seconds between analyses
            first_run = False

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
                logger.info(f"📊 Final danger score: {danger_score}/100 (type: {type(danger_score)})")

                # Always send agent scores back to frontend (even if not dangerous)
                logger.info(f"Sending analysis_complete notification...")
                await self.notify_backend(session_id, {
                    'type': 'analysis_complete',
                    'session_id': session_id,
                    'danger_score': danger_score,
                    'agent_scores': agent_scores
                })

                logger.info(f"Checking danger threshold: {danger_score} >= 70? {danger_score >= 70}")
                if danger_score >= 70:  # Threshold: 70%
                    logger.warning(f"🚨 DANGEROUS SITUATION DETECTED! Score: {danger_score}")
                    await self.notify_backend(session_id, {
                        'type': 'codeword_detected',
                        'session_id': session_id,
                        'detected_phrase': conversation[:100],  # First 100 chars
                        'confidence': danger_score / 100,
                        'timestamp': '',
                        'agentScores': agent_scores  # Include multi-agent breakdown
                    })
                else:
                    logger.info(f"Danger score {danger_score} below threshold 70, not triggering alert")
            except Exception as e:
                logger.error(f"Error analyzing conversation: {e}")
                import traceback
                logger.error(traceback.format_exc())

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
        if session_id not in self.active_sessions:
            logger.warning(f"⚠️  Attempted to stop non-existent session {session_id}")
            return  # Early return, session already stopped

        logger.info(f"🛑 Stopping session {session_id}")
        session_data = self.active_sessions.get(session_id)

        if not session_data:
            logger.warning(f"⚠️  Session data already cleared for {session_id}")
            return

        # Cancel the listening task
        if session_data.get('task'):
            session_data['task'].cancel()
            logger.debug(f"  Cancelled listening task for {session_id}")

        # Cancel the buffer processing task
        if session_id in self.buffer_tasks:
            self.buffer_tasks[session_id].cancel()
            del self.buffer_tasks[session_id]
            logger.debug(f"  Cancelled buffer task for {session_id}")

        # Clear transcript buffer
        if session_id in self.transcript_buffers:
            del self.transcript_buffers[session_id]
            logger.debug(f"  Cleared transcript buffer for {session_id}")

        # Close the session using the context manager
        try:
            await session_data['context_manager'].__aexit__(None, None, None)
            logger.debug(f"  Closed Gemini connection for {session_id}")
        except Exception as e:
            logger.error(f"❌ Error closing Gemini connection for {session_id}: {e}")

        # Remove from active sessions (check again to avoid KeyError)
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]

        logger.info(f"✅ Session {session_id} stopped and cleaned up")


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

async def handle_generate_audio(request):

    """HTTP endpoint to generate audio from text using ElevenLabs"""

    try:
        # Get the raw body for debugging
        raw_body = await request.text()
        logger.info(f"Received request body: {raw_body}")

        # Parse JSON from the raw body
        import json
        data = json.loads(raw_body)

        text = data.get('text')

        # Map voice names to ElevenLabs voice IDs
        voice_name = data.get('voice', 'Rachel')
        voice_map = {
            'Rachel': '21m00Tcm4TlvDq8ikWAM',
            'Adam': 'pNInz6obpgDQGcFmaJgB',
            'Antoni': 'ErXwobaYiN019PkySvjV',
            'Arnold': 'VR6AewLTigWG4xSOukaG',
            'Bella': 'EXAVITQu4vr4xnSDxMaL',
            'Domi': 'AZnzlk1XvdvUeBnXmlld',
            'Elli': 'MF3mGyEYCl7XYWbV9V6O',
            'Josh': 'TxGEqnHWrfWFTfGW9XjX',
            'Sam': 'yoZ06aMxZJJ28mfd3POQ'
        }
        voice = voice_map.get(voice_name, '21m00Tcm4TlvDq8ikWAM')  # Default to Rachel



        if not text:
            return web.json_response({'error': 'text is required'}, status=400)

        # Use the TTS helper with automatic fallback
        audio_bytes = handler_instance.text_to_speech(text=text, voice_id=voice)

        return web.Response(body=audio_bytes, content_type='audio/mpeg')



    except Exception as e:

        logger.error(f"Error generating audio: {e}")

        return web.json_response({'error': 'Failed to generate audio'}, status=500)



async def handle_converse(request):

    """HTTP endpoint for conversational turn with persona support"""

    try:

        audio_data = await request.read()

        # Get persona from query params (default to 'adam')
        persona = request.rel_url.query.get('persona', 'adam')

        logger.info(f"🎤 Received audio for conversation (persona: {persona})")

        # 1. Speech-to-Text with Gemini (using audio-capable model)
        # Convert webm audio to format Gemini can process
        import tempfile
        import subprocess

        logger.info(f"📊 Received audio data: {len(audio_data)} bytes")

        # Save audio to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_webm:
            temp_webm.write(audio_data)
            webm_path = temp_webm.name

        logger.info(f"💾 Saved to temp file: {webm_path}")

        # Convert to WAV for Gemini
        wav_path = webm_path.replace('.webm', '.wav')
        try:
            result = subprocess.run(
                ['ffmpeg', '-i', webm_path, '-ar', '16000', '-ac', '1', wav_path],
                check=True,
                capture_output=True,
                text=True
            )
            logger.info(f"✅ FFmpeg conversion successful")
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ FFmpeg conversion failed with exit code {e.returncode}")
            logger.error(f"   stdout: {e.stdout}")
            logger.error(f"   stderr: {e.stderr}")
            # Fallback: use simple prompt
            user_text = "I need help getting out of here"
        except Exception as e:
            logger.error(f"❌ FFmpeg error: {e}")
            user_text = "I need help getting out of here"
        else:
            # Read converted audio
            with open(wav_path, 'rb') as f:
                audio_bytes = f.read()

            logger.info(f"🎵 Converted audio: {len(audio_bytes)} bytes")

            # Use Gemini Pro with audio support - use the correct API
            try:
                response = handler_instance.client.models.generate_content(
                    model='gemini-2.0-flash-exp',
                    contents=[
                        types.Part.from_bytes(data=audio_bytes, mime_type='audio/wav'),
                        types.Part.from_text(text='Transcribe what the user is saying in this audio. Return ONLY the transcription text, nothing else.')
                    ]
                )

                user_text = response.text.strip()
                logger.info(f"📝 Transcribed: {user_text}")
            except Exception as e:
                logger.error(f"❌ Gemini transcription error: {e}")
                user_text = "I need help getting out of here"

            # Cleanup temp files
            import os
            try:
                os.unlink(webm_path)
                os.unlink(wav_path)
            except:
                pass

        if not user_text:
            # Return empty audio if transcription fails
            return web.Response(body=b'', content_type='audio/mpeg')

        # 2. Get Gemini Response with persona-specific system prompt
        personas_config = {
            'rachel': {
                'name': 'Mom',
                'voice_id': '21m00Tcm4TlvDq8ikWAM',  # Rachel
                'prompt': """You are the user's mother calling to help them escape an uncomfortable or dangerous situation.
Your goal is to provide a believable motherly excuse for them to leave immediately.

Context: You're on a phone call. Your child picked up because they need to escape their current situation.

Use scenarios like:
- Emergency with dad/family member
- Need help at home urgently
- Health concern with a relative
- Important family matter that can't wait

Be loving but firm, and create urgency that gives them a legitimate reason to leave."""
            },
            'adam': {
                'name': 'Alex',
                'voice_id': 'pNInz6obpgDQGcFmaJgB',  # Adam
                'prompt': """You are Alex, a close friend calling to help rescue someone from an uncomfortable or dangerous situation.
Your goal is to provide a believable excuse for them to leave immediately.

Context: You're on a phone call. The person picked up because they need to escape their current situation.

Use scenarios like:
- Car broke down and you need them right now
- Meeting them somewhere important in 10 minutes
- Emergency situation requiring their help
- Time-sensitive favor that requires immediate attention

Be convincing, casual, and create a sense of urgency that gives them a legitimate reason to leave."""
            },
            'bella': {
                'name': 'Sarah (sister)',
                'voice_id': 'EXAVITQu4vr4xnSDxMaL',  # Bella
                'prompt': """You are Sarah, the user's sister calling to help them escape an uncomfortable or dangerous situation.
Your goal is to provide a believable sibling excuse for them to leave immediately.

Context: You're on a phone call. Your sibling picked up because they need to escape their current situation.

Use scenarios like:
- Apartment/house emergency
- Need immediate help with something broken
- Lost keys and locked out
- Pet emergency
- Important package/delivery issue

Be casual but urgent, like a real sibling would be."""
            }
        }

        persona_config = personas_config.get(persona, personas_config['adam'])

        prompt = f"""You are {persona_config['name']}, calling to help rescue someone from an uncomfortable or dangerous situation.
{persona_config['prompt']}

The user just said: "{user_text}"

Respond naturally and urgently as if you're really on a phone call. Keep it brief (1-2 sentences max).
Be convincing and create urgency."""

        # Use simple Gemini Flash for text generation
        from google.generativeai import GenerativeModel
        import google.generativeai as genai
        genai.configure(api_key=handler_instance.api_key)
        model = GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        agent_text = response.text.strip()
        logger.info(f"🤖 {persona_config['name']} response: {agent_text}")

        # 3. Text-to-Speech with persona-specific voice
        audio = handler_instance.text_to_speech(
            text=agent_text,
            voice_id=persona_config['voice_id']
        )

        # 4. Return audio
        return web.Response(body=audio, content_type='audio/mpeg')



    except Exception as e:

        logger.error(f"Error in conversational turn: {e}")

        return web.json_response({'error': 'Failed to process conversational turn'}, status=500)


async def handle_converse_text(request):
    """
    Handle text-based conversation - MUCH SIMPLER!
    User text comes from browser SpeechRecognition, no audio transcription needed
    """
    try:
        persona = request.rel_url.query.get('persona', 'adam')
        user_text = request.rel_url.query.get('text', '')

        logger.info(f"💬 Received text conversation (persona: {persona}): \"{user_text}\"")

        if not user_text:
            return web.json_response({'error': 'No text provided'}, status=400)

        # Persona configurations with URGENT, NATURAL prompts
        personas_config = {
            'rachel': {
                'name': 'Mom',
                'voice_id': '21m00Tcm4TlvDq8ikWAM',  # Rachel
                'system_instruction': """You are a mother calling your child to help them escape a dangerous or uncomfortable situation.
Your goal: Get them to leave IMMEDIATELY with a believable, urgent family emergency.

CRITICAL RULES:
- Sound natural and conversational (like a real phone call)
- Create URGENCY - they need to leave NOW
- Keep responses SHORT (1-2 sentences max)
- Never break character
- Escalate urgency if they hesitate
- Use family emergencies (dad sick, house issue, etc)

Examples:
User: "What's wrong?"
You: "Your dad fell and hurt his ankle badly. I'm at the ER and I really need you here right now, can you come?"

User: "I'm kind of busy..."
You: "Honey this is serious, I wouldn't call unless it was urgent. Please just leave and come help me, okay?"
"""
            },
            'adam': {
                'name': 'Alex',
                'voice_id': 'pNInz6obpgDQGcFmaJgB',  # Adam
                'system_instruction': """You are Alex, a close friend calling to rescue someone from a dangerous or uncomfortable situation.
Your goal: Get them to leave IMMEDIATELY with a believable, urgent excuse.

CRITICAL RULES:
- Sound natural and casual like a real friend
- Create URGENCY - they need to leave NOW
- Keep responses SHORT (1-2 sentences max)
- Never break character
- Escalate urgency if they hesitate
- Use scenarios: car broke down, meeting them in 5 min, need help urgently

Examples:
User: "Where are you?"
You: "I'm at the ferry building main entrance, my car completely died. Can you come get me right now? I'm stranded."

User: "Can it wait?"
You: "Dude no, my phone's dying and it's getting dark. I really need you to come like NOW, please?"
"""
            },
            'bella': {
                'name': 'Sarah (sister)',
                'voice_id': 'EXAVITQu4vr4xnSDxMaL',  # Bella
                'system_instruction': """You are Sarah, calling your sibling to rescue them from a dangerous or uncomfortable situation.
Your goal: Get them to leave IMMEDIATELY with a believable, urgent excuse.

CRITICAL RULES:
- Sound natural like a real sibling call
- Create URGENCY - they need to leave NOW
- Keep responses SHORT (1-2 sentences max)
- Never break character
- Escalate urgency if they hesitate
- Use scenarios: apartment flooding, locked out, pet emergency

Examples:
User: "What happened?"
You: "The apartment's flooding from upstairs! Water's everywhere and I can't find the shutoff valve. Can you come help me NOW?"

User: "I'm out right now..."
You: "I KNOW but this is an emergency, the landlord's not answering and it's getting worse. Please just come!"
"""
            }
        }

        persona_config = personas_config.get(persona, personas_config['adam'])

        # Generate response with Gemini - OPTIMIZED FOR SPEED
        conversation_context = f"""You are {persona_config['name']} on a phone call.

{persona_config['system_instruction']}

Current conversation:
User: "{user_text}"

Respond naturally, urgently, and briefly (1-2 sentences max). Sound like a REAL phone call."""

        logger.info(f"🤖 Generating NATURAL response with Gemini 2.0 Flash for {persona_config['name']}...")

        # Use Gemini 2.0 Flash for ULTRA-FAST natural conversation
        if handler_instance.client:
            try:
                # Ultra-optimized prompt for speed
                response = handler_instance.client.models.generate_content(
                    model='gemini-2.0-flash-exp',  # Fastest Gemini model
                    contents=conversation_context,
                    config=types.GenerateContentConfig(
                        temperature=0.9,  # Natural variety
                        max_output_tokens=50,  # VERY short for speed (1-2 sentences)
                        top_p=0.95
                    )
                )

                agent_text = response.text.strip()
                logger.info(f"✅ Gemini response ({len(agent_text)} chars): {agent_text[:60]}...")

            except Exception as e:
                logger.warning(f"⚠️ Gemini failed ({e}), using fallback")
                # Ultra-fast fallback
                agent_text = "I really need you to come help me right now. Can you leave and meet me?"
        else:
            # No Gemini client - use fallback
            agent_text = "I need your help urgently. Can you come meet me right now?"

        logger.info(f"✅ {persona_config['name']} says: {agent_text}")

        # Convert to speech with persona-specific voice
        audio = handler_instance.text_to_speech(
            text=agent_text,
            voice_id=persona_config['voice_id']
        )

        # Return audio
        return web.Response(body=audio, content_type='audio/mpeg')

    except Exception as e:
        logger.error(f"❌ Error in text conversation: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return web.json_response({'error': str(e)}, status=500)


async def handle_analyze_frame(request):
    """
    Analyze a video frame with Gemini Vision API for safety indicators
    """
    try:
        data = await request.json()
        frame_data = data.get('frame')  # Base64 image
        session_id = data.get('sessionId')

        if not frame_data:
            return web.json_response({'error': 'No frame data provided'}, status=400)

        logger.info(f"🔍 Analyzing video frame for session {session_id}")

        # Use Gemini Vision API to analyze the image
        client = genai.Client(api_key=handler_instance.api_key)

        # Safety analysis prompt
        analysis_prompt = """Analyze this image for safety indicators. Provide:
1. Number of people visible
2. Environment type (indoor/outdoor)
3. Safety level (safe/concerning/danger)
4. Any red flags or concerning elements

Be very concise - 2-3 sentences max."""

        try:
            # Generate analysis with Gemini Vision
            response = client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=[
                    analysis_prompt,
                    {'mime_type': 'image/jpeg', 'data': frame_data.split(',')[1]}  # Remove data:image/jpeg;base64, prefix
                ],
                config=types.GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for factual analysis
                    max_output_tokens=100
                )
            )

            analysis_text = response.text.strip()
            logger.info(f"✅ Vision analysis: {analysis_text[:80]}...")

            return web.json_response({
                'sessionId': session_id,
                'analysis': analysis_text,
                'analyzed': True
            })

        except Exception as e:
            logger.warning(f"⚠️ Gemini Vision failed: {e}")
            return web.json_response({
                'sessionId': session_id,
                'analysis': 'Analysis in progress - monitoring situation.',
                'analyzed': False
            })

    except Exception as e:
        logger.error(f"❌ Error in frame analysis: {e}")
        return web.json_response({'error': str(e)}, status=500)


def create_app():

    app = web.Application()



    # Add routes

    app.router.add_post('/session/start', handle_start_session)

    app.router.add_post('/session/{session_id}/audio', handle_send_audio)

    app.router.add_post('/session/{session_id}/video', handle_send_video)

    app.router.add_post('/session/{session_id}/text', handle_send_text)

    app.router.add_post('/session/{session_id}/stop', handle_stop_session)

    app.router.add_get('/health', handle_health)

    app.router.add_post('/api/generate-audio', handle_generate_audio)

    app.router.add_post('/api/converse', handle_converse)

    app.router.add_get('/api/converse-text', handle_converse_text)

    app.router.add_post('/api/analyze-frame', handle_analyze_frame)

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
