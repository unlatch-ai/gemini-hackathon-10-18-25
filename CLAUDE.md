# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Live Video Safety Application** that uses Gemini Live API for real-time panic codeword detection and automated emergency response. The system provides a discreet way for users to exit dangerous situations through AI-powered audio/video monitoring and a web-based fake call interface with voice agent.

**Core Functionality:**
1. User accesses app on smartphone via ngrok URL
2. Starts recording video/audio which streams to Gemini Live API
3. Multi-agent Gemini system analyzes conversation every 10 seconds (4 specialized agents)
4. When dangerous situation detected (70%+ confidence), triggers fake call UI
5. iPhone-style call interface appears with ringtone
6. User accepts call and converses with ElevenLabs-powered voice agent (Mom/Friend/Sister)
7. Agent provides believable excuse to leave the situation immediately

AI Studio App: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## Development Commands

**Install dependencies:**
```bash
npm install
pip install google-genai elevenlabs gtts
```

**Run frontend dev server only:**
```bash
npm run dev
```
Starts Vite dev server on http://localhost:3000

**Run backend server only:**
```bash
npm run server
```
Starts Express server on http://localhost:3001

**Run both frontend and backend concurrently:**
```bash
npm run dev:all
```
Runs both servers simultaneously for full-stack development

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Environment Setup

Create a `.env.local` file with the following:
```
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key (optional, for TTS fallback)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
PORT=3001
PANIC_CODEWORD=danger
BASE_URL=https://your-ngrok-url.ngrok-free.dev
PYTHON_SERVICE_URL=http://localhost:5001
```

**Note:** The system has multiple TTS fallbacks:
1. **Primary:** ElevenLabs (high quality, natural voices)
2. **Secondary:** Google Cloud TTS (if ElevenLabs fails)
3. **Tertiary:** gTTS (free, always works)

The Vite config ([vite.config.ts:14-15](vite.config.ts#L14-L15)) exposes environment variables to the frontend.

## Application Architecture

### System Flow

```
User Smartphone (via ngrok URL)
    ↓
Frontend: Video/Audio Capture (MediaRecorder API)
    ↓
WebSocket Connection to Backend
    ↓
Backend Proxy (Node.js Express)
    ↓
Python Service → Gemini Multi-Agent Analysis
    ├── Agent 1: Transcript Analyzer (literal content)
    ├── Agent 2: Emotional Detector (distress signals)
    ├── Agent 3: Context Interpreter (social dynamics)
    └── Agent 4: Threat Assessor (final decision)
    ↓
[If danger ≥70%] → Frontend Triggers FakeCallUI
    ↓
User Accepts Call → Bidirectional Voice Conversation
    ↓
ElevenLabs Voice Agent (Mom/Friend/Sister)
```

### Component Structure

**Frontend Components:**
- [SafetyRecorder.tsx](components/SafetyRecorder.tsx) - Main recording interface with camera/mic access
- [FakeCallUI.tsx](components/FakeCallUI.tsx) - iPhone-style fake call interface with voice agent
- [SessionDashboard.tsx](components/SessionDashboard.tsx) - Real-time monitoring display
- [IncidentReports.tsx](components/IncidentReports.tsx) - Post-recording analysis view

**Backend Structure:**

[server/index.js](server/index.js) - Main Express server
- WebSocket proxy for Gemini analysis
- REST API endpoints for session management

[server/routes/live-session.js](server/routes/live-session.js) - Main API routes
- Handles client WebSocket connections
- Proxies to Python service for Gemini multi-agent analysis
- `/elevenlabs-audio` - Text-to-speech endpoint
- `/converse` - Bidirectional voice conversation endpoint
- Manages session state and danger detection webhooks

**Python Microservice:**
- [python/live_stream_handler.py](python/live_stream_handler.py) - Core AI processing service
  - Multi-agent Gemini analysis system (4 specialized agents)
  - ElevenLabs TTS integration with fallback chain
  - Speech-to-text transcription
  - Conversational AI with persona support (Mom/Friend/Sister)
  - `/api/generate-audio` - Text-to-speech with ElevenLabs
  - `/api/converse` - Full conversational turn (STT → LLM → TTS)

### Type System

Core types are defined in [types.ts](types.ts):

- `SafetySession` interface: Represents an active or completed recording session
  - `id`, `userId`, `startTime`, `endTime`, `codewordDetected`, `callTriggered`
- `IncidentReport` interface: Post-recording analysis results
  - `sessionId`, `category` (police/311/safety), `summary`, `transcript`, `recommendations`
- `CodewordConfig` interface: User-configured panic codewords
  - `phrase`, `caseSensitive`, `partialMatch`, `enabled`

### Gemini Live API Integration

**Model**: `gemini-2.5-flash-native-audio-preview-09-2025`
- Native audio processing for natural conversation understanding
- Voice Activity Detection (VAD) for interruption handling
- System instruction configured for codeword monitoring

**Audio Format**:
- Input: 16-bit PCM, 16kHz, mono
- Output: 16-bit PCM, 24kHz, mono

**System Instruction Template**:
```
You are a safety monitoring assistant. Your job is to listen to conversations and detect when the user says the panic phrase "{PANIC_CODEWORD}".
When you detect this phrase, immediately call the function trigger_emergency_call().
Otherwise, remain silent and continue monitoring.
```

**Multi-Agent Analysis System**:
The system uses 4 specialized Gemini agents that analyze conversations in parallel:
- **Agent 1: Transcript Analyzer** - Analyzes literal content and keywords
- **Agent 2: Emotional Detector** - Detects stress, fear, anxiety signals
- **Agent 3: Context Interpreter** - Understands power dynamics and social context
- **Agent 4: Threat Assessor** - Meta-agent that synthesizes all inputs

### ElevenLabs Voice Agent Integration

**Voice Personas Available:**
- **Rachel (Mom)** - Warm, maternal voice with family emergency scenarios
- **Adam (Friend Alex)** - Casual, friendly voice with car/meeting emergencies
- **Bella (Sister Sarah)** - Sibling voice with apartment/pet emergencies

**Fake Call Flow:**
1. Danger detected (≥70% confidence) → Frontend triggers FakeCallUI
2. iPhone-style call interface appears with ringtone
3. User accepts call → Initial greeting plays via ElevenLabs TTS
4. User speaks → Audio captured and sent to `/api/live/converse`
5. Python service:
   - Transcribes speech with Gemini
   - Generates contextual response with persona
   - Converts to speech with ElevenLabs
6. Response audio plays → Conversation continues
7. User can end call anytime

**Conversational Flow Example:**
```
User accepts call
→ "Hey! I'm almost at the ferry building. Can you come meet me right now? It's urgent!"
User: "Okay, where are you exactly?"
→ "I'm at the main entrance by the clock tower. Can you come in the next 5 minutes?"
User: "Yeah I'll head out now"
→ "Perfect, see you soon!"
```

**TTS Fallback Chain:**
1. **ElevenLabs** (primary) - Natural, high-quality voices
2. **Google Cloud TTS** (secondary) - Reliable neural voices
3. **gTTS** (tertiary) - Free, always works

### Post-Recording Analysis

After recording stops, system analyzes full session:

**Categories**:
- **Police Report**: Threats, violence, harassment detected
- **311 Report**: Safety hazards, infrastructure issues
- **Safety Log**: General concern, no immediate action needed

**Analysis Process**:
1. Transcript extraction from Gemini session
2. Gemini analyzes full context with categorization prompt
3. Generates structured report with recommendations
4. Stores in database with session metadata

### Path Aliases

TypeScript and Vite are configured with `@/*` alias pointing to project root ([tsconfig.json:21-24](tsconfig.json#L21-L24), [vite.config.ts:17-20](vite.config.ts#L17-L20)).

## Key Implementation Notes

- **Client-to-Server Architecture**: Frontend connects directly to backend WebSocket proxy for optimal streaming performance
- **Hybrid Tech Stack**: Node.js for server + Python for Gemini/ElevenLabs integration (Python SDK more mature)
- **Real-time Requirements**: Multi-agent analysis runs every 10 seconds, danger detection triggers immediately
- **Mobile-First**: UI optimized for smartphone use, large touch targets, minimal interactions during recording
- **Privacy**: All voice processing happens in-browser, no external phone service involved
- **Offline Fallback**: If connection lost, local recording continues and uploads when reconnected
- **TTS Resilience**: Triple fallback system (ElevenLabs → Google → gTTS) ensures voice agent always works

## Security Considerations

- Use **ephemeral tokens** for Gemini API authentication (not API keys in frontend)
- ElevenLabs API key stored server-side only
- Session data encrypted in transit (WSS/HTTPS via ngrok)
- Optional: End-to-end encryption for stored recordings
- Rate limiting on danger detection to prevent false positives
- User authentication required for production deployment
- **Important**: See `archive/twilio/` for archived phone call integration (replaced with web-based agent)

## Development Workflow

1. **Local Development**: Use ngrok to test on real smartphone
2. **Start Services**: Run `npm run server` (port 3001) and `python3 python/live_stream_handler.py` (port 5001)
3. **Testing Danger Detection**: Start recording, say "gemini", verify FakeCallUI appears
4. **Testing Voice Agent**: Accept fake call, speak to agent, verify natural conversation
5. **Testing Personas**: Try different personas (rachel/adam/bella) for variety
6. **Session Analysis**: Stop recording, verify multi-agent scores displayed

## Architecture Evolution

**October 2025 - ElevenLabs Voice Agent Migration:**
- **Removed**: Twilio phone call integration (archived in `archive/twilio/`)
- **Added**: Web-based fake call UI with ElevenLabs conversational agent
- **Benefits**: No phone service needed, better privacy, natural conversations, faster response
- **Retained**: Multi-agent Gemini analysis, WebSocket architecture, Python microservice

**Previous Migrations:**
- **From**: SF 311 WhatsApp reporting bot → Live safety monitoring
- **Key Changes**: Text messages → Real-time video/audio analysis
- **Retained**: Gemini AI integration, dashboard UI framework
