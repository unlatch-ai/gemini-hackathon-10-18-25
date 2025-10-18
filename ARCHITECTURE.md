# Architecture Documentation

## System Overview

The Live Video Safety Application is a real-time monitoring system that detects panic codewords in audio streams and triggers emergency phone calls. The system uses Gemini Live API for continuous audio/video analysis and Twilio for voice call orchestration.

## High-Level Architecture

```
┌─────────────────┐
│  Smartphone     │
│  (Mobile Web)   │
└────────┬────────┘
         │ HTTPS/WSS (via ngrok)
         ▼
┌─────────────────┐
│  Node.js Proxy  │
│  (Express +     │
│   WebSocket)    │
└────────┬────────┘
         │ IPC/HTTP
         ▼
┌─────────────────┐         ┌──────────────┐
│  Python Service │◄────────┤  Gemini Live │
│  (Live Stream   │  WSS    │  API         │
│   Handler)      │         └──────────────┘
└────────┬────────┘
         │ Function Call Event
         ▼
┌─────────────────┐         ┌──────────────┐
│  Twilio Service │────────►│  Twilio API  │
│  (Voice Calls)  │  HTTPS  │  (Voice)     │
└─────────────────┘         └──────────────┘
```

## Component Details

### 1. Frontend (React + TypeScript)

**Technology**: React 19, Vite, Tailwind CSS

**Key Components**:

- **VideoRecorder Component**
  - Uses `MediaRecorder API` to capture audio/video
  - Streams via WebSocket to backend
  - Audio format: 16-bit PCM, 16kHz (converted from browser default)
  - Video format: WebM or H.264 (depending on browser support)
  - Real-time status indicators (recording, analyzing, codeword detected)

- **Session Dashboard**
  - Shows live transcription (if enabled)
  - Displays Gemini model status
  - Shows call trigger status
  - Session timer

- **Incident Reports**
  - Post-recording analysis results
  - Categorized reports (Police/311/Safety)
  - Downloadable transcripts and summaries

**WebSocket Protocol**:
```javascript
// Client sends audio chunks
{
  type: 'audio_chunk',
  data: ArrayBuffer, // 16-bit PCM audio
  timestamp: number
}

// Client receives status updates
{
  type: 'codeword_detected',
  phrase: string,
  confidence: number,
  timestamp: number
}

{
  type: 'call_triggered',
  callSid: string
}
```

### 2. Backend (Node.js + Express)

**Technology**: Express, WebSocket (ws library), CORS

**Main Server** (`server/index.js`):
- HTTP server for REST API endpoints
- WebSocket server for client connections
- Proxy layer between client and Python service
- Session management and storage

**REST API Endpoints**:
```
POST   /api/sessions/start        - Start new recording session
POST   /api/sessions/:id/stop     - Stop recording session
GET    /api/sessions/:id          - Get session details
GET    /api/sessions              - List all sessions
POST   /api/codewords             - Configure panic codewords
GET    /api/twiml/:scenario       - Get TwiML script for fake call
```

**WebSocket Routes** (`server/routes/gemini-live.js`):
- Accepts WebSocket connections from frontend
- Proxies audio/video data to Python service
- Handles reconnection and session resumption
- Forwards Gemini responses back to client

**Twilio Routes** (`server/routes/twilio-voice.js`):
- `POST /twilio/call` - Trigger outbound call
- `POST /twilio/voice` - TwiML handler for call flow
- `POST /twilio/status` - Call status callbacks

### 3. Python Service (Gemini Live Integration)

**Technology**: Python 3.8+, google-genai SDK, asyncio

**Main Handler** (`python/live_stream_handler.py`):

```python
import asyncio
from google import genai
from google.genai import types

class LiveStreamHandler:
    def __init__(self, api_key, panic_codeword):
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-2.5-flash-native-audio-preview-09-2025"
        self.panic_codeword = panic_codeword

    async def start_session(self, session_id):
        # Configure Gemini Live connection
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=self._get_system_instruction(),
            tools=[self._get_function_declarations()],
            speech_config={
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": "Kore"}
                }
            }
        )

        async with self.client.aio.live.connect(
            model=self.model,
            config=config
        ) as session:
            # Process audio stream
            await self._process_stream(session)

    def _get_system_instruction(self):
        return f"""You are a safety monitoring assistant.
        Listen carefully to all audio input.
        If you hear the phrase "{self.panic_codeword}",
        immediately call trigger_emergency_call().
        Otherwise, remain silent and continue monitoring."""

    def _get_function_declarations(self):
        return [{
            "function_declarations": [{
                "name": "trigger_emergency_call",
                "description": "Triggers an emergency phone call when panic codeword is detected",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "detected_phrase": {
                            "type": "string",
                            "description": "The exact phrase that was detected"
                        },
                        "confidence": {
                            "type": "number",
                            "description": "Confidence score 0-1"
                        }
                    }
                }
            }]
        }]
```

**Audio Processing**:
- Receives raw PCM audio from Node.js proxy
- Formats as `audio/pcm;rate=16000`
- Sends to Gemini Live API via WebSocket
- Processes responses and detects function calls

**Function Call Handling**:
```python
async for response in session.receive():
    if response.tool_call:
        for fc in response.tool_call.function_calls:
            if fc.name == "trigger_emergency_call":
                # Notify Node.js backend to trigger Twilio call
                await self.notify_backend({
                    'event': 'codeword_detected',
                    'session_id': session_id,
                    'phrase': fc.args.get('detected_phrase'),
                    'confidence': fc.args.get('confidence')
                })
```

### 4. Twilio Integration

**Service** (`server/services/twilio-caller.js`):

```javascript
const twilio = require('twilio');

class TwilioCaller {
  constructor(accountSid, authToken, fromNumber) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async triggerFakeCall(toNumber, scenario = 'mom') {
    const call = await this.client.calls.create({
      to: toNumber,
      from: this.fromNumber,
      url: `${process.env.BASE_URL}/twilio/voice?scenario=${scenario}`,
      statusCallback: `${process.env.BASE_URL}/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    return call.sid;
  }
}
```

**TwiML Scenarios**:

1. **Mom Scenario**:
```xml
<Response>
  <Say voice="Polly.Joanna">
    Hey sweetie! It's mom. I'm running late picking up dinner.
    Can you head over to the house in about 10 minutes?
    I need help with something.
  </Say>
  <Pause length="5"/>
  <Say>Oh perfect! Thanks honey, see you soon!</Say>
  <Hangup/>
</Response>
```

2. **Friend Emergency**:
```xml
<Response>
  <Say voice="Polly.Matthew">
    Hey! My car broke down on the highway.
    Can you come pick me up? I'm near the Market Street exit.
    Sorry for the trouble!
  </Say>
  <Pause length="5"/>
  <Say>Thanks! I'll send you the exact location. Hurry!</Say>
  <Hangup/>
</Response>
```

3. **Work Emergency**:
```xml
<Response>
  <Say voice="Polly.Amy">
    Hi, this is Sarah from the office. We have an urgent situation
    with the Johnson account. Can you come in right away?
    It's really important.
  </Say>
  <Pause length="5"/>
  <Say>Great, we'll see you in 15 minutes. Thanks!</Say>
  <Hangup/>
</Response>
```

### 5. Post-Recording Analysis

**Service** (`server/services/post-analysis.js`):

After recording stops, system performs comprehensive analysis:

```javascript
async function analyzeSession(sessionId) {
  // 1. Get full transcript from Gemini session
  const transcript = await getSessionTranscript(sessionId);

  // 2. Analyze with Gemini for categorization
  const analysis = await geminiClient.generateContent({
    model: 'gemini-2.0-flash-001',
    systemInstruction: `Analyze this safety recording transcript and categorize it:
      - POLICE: If there are threats, violence, harassment, or immediate danger
      - 311: If there are safety hazards, infrastructure issues, or environmental concerns
      - SAFETY_LOG: If it's a general safety concern with no immediate action needed

      Also provide:
      - Summary of the situation
      - Key events with timestamps
      - Recommended actions
      - Severity level (low/medium/high/critical)`,
    contents: transcript
  });

  // 3. Generate structured report
  return {
    sessionId,
    category: analysis.category,
    severity: analysis.severity,
    summary: analysis.summary,
    timeline: analysis.keyEvents,
    recommendations: analysis.recommendations,
    transcript: transcript,
    createdAt: new Date()
  };
}
```

## Data Flow Diagrams

### Recording Session Flow
```
1. User clicks "Start Recording"
   ↓
2. Frontend requests camera/mic permissions
   ↓
3. MediaRecorder starts capturing
   ↓
4. Audio chunks converted to 16-bit PCM, 16kHz
   ↓
5. Chunks sent via WebSocket to Node.js
   ↓
6. Node.js proxies to Python service
   ↓
7. Python sends to Gemini Live API
   ↓
8. Gemini analyzes audio in real-time
   ↓
9. If codeword detected → Function call triggered
   ↓
10. Python notifies Node.js
   ↓
11. Node.js triggers Twilio call
   ↓
12. User receives phone call within 2-3 seconds
```

### Codeword Detection Flow
```
Audio Stream → Gemini Live API
                    ↓
              VAD Processing
                    ↓
              Speech Recognition
                    ↓
              Pattern Matching (System Instruction)
                    ↓
           Codeword Match? ─No→ Continue Monitoring
                    │
                   Yes
                    ↓
           trigger_emergency_call()
                    ↓
              Function Response
                    ↓
           Backend Notification
                    ↓
            Twilio API Call
                    ↓
           User Receives Call
```

## Security Architecture

### Authentication & Authorization
- **Frontend**: No authentication in MVP (access via unique ngrok URL)
- **Backend**: API key authentication for Python service
- **Gemini**: Ephemeral tokens for client-to-server (recommended)
- **Twilio**: Account SID + Auth Token (server-side only)

### Data Encryption
- **In Transit**: All connections use TLS/WSS
- **At Rest**: Optional encryption for stored recordings
- **Ephemeral**: Session data can be configured to not persist

### Privacy Controls
- User can disable video recording (audio only)
- Transcript-only mode (no audio storage)
- Automatic deletion after N days
- GDPR compliance options

## Performance Considerations

### Latency Requirements
- **Codeword Detection**: < 3 seconds from utterance to call trigger
- **WebSocket**: < 100ms round-trip time
- **Audio Buffering**: 100-200ms chunks for optimal streaming

### Scalability
- **Sessions**: Node.js can handle ~1000 concurrent WebSocket connections
- **Python Service**: Can run multiple instances behind load balancer
- **Gemini API**: Rate limits apply (check quota)
- **Twilio**: Concurrent call limits based on account type

### Optimization Strategies
- Audio compression before transmission
- Adaptive bitrate based on network conditions
- Session state persistence for reconnection
- CDN for frontend assets

## Deployment Architecture

### Development
```
Local Machine
├── npm run dev (Frontend - port 3000)
├── npm run server (Node.js - port 3001)
├── python live_stream_handler.py (Python service - port 5000)
└── ngrok http 3001 (Public URL)
```

### Production
```
┌─────────────────┐
│   CloudFront    │ (CDN for frontend)
│   or Netlify    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Railway/Render │ (Node.js + Python)
│  Load Balanced  │
└────────┬────────┘
         │
         ├──────► PostgreSQL (Sessions, Reports)
         ├──────► Redis (Session State)
         └──────► S3 (Recording Storage)
```

## Monitoring & Observability

### Metrics to Track
- Codeword detection latency
- WebSocket connection stability
- Twilio call success rate
- Gemini API response times
- Session completion rate

### Logging
- All codeword detections (with session ID)
- All Twilio call triggers
- WebSocket disconnections
- Gemini API errors
- User actions (start/stop recording)

### Alerts
- Failed codeword detection (should never happen)
- Twilio call failures
- High WebSocket disconnect rate
- Gemini API quota approaching limit

## Future Enhancements

1. **Multi-language Support**: Detect codewords in multiple languages
2. **Custom Voice Cloning**: Use ElevenLabs to clone user's contact voices
3. **Live Location Sharing**: Send location to emergency contacts
4. **Silent Mode**: Vibration-only alerts when codeword detected
5. **Wearable Integration**: Apple Watch trigger button
6. **AI-Powered Threat Assessment**: Auto-escalate based on conversation tone
7. **End-to-End Encryption**: Fully encrypted recordings
8. **Offline Mode**: Local processing with Whisper + LLaMA
