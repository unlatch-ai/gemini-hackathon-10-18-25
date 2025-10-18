# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Live Video Safety Application** that uses Gemini Live API for real-time panic codeword detection and automated emergency response. The system provides a discreet way for users to exit dangerous situations through AI-powered audio/video monitoring and automated phone call triggers.

**Core Functionality:**
1. User accesses app on smartphone via ngrok URL
2. Starts recording video/audio which streams to Gemini Live API
3. Gemini monitors audio in real-time for panic codeword (e.g., "help me mom")
4. When detected, Twilio automatically initiates a fake phone call
5. User can use the call as an excuse to leave the situation
6. After recording stops, system analyzes and categorizes the incident

AI Studio App: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## Development Commands

**Install dependencies:**
```bash
npm install
pip install google-genai twilio
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
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
PORT=3001
PANIC_CODEWORD=help me mom
```

The Vite config ([vite.config.ts:14-15](vite.config.ts#L14-L15)) exposes environment variables to the frontend.

## Application Architecture

### System Flow

```
User Smartphone (via ngrok URL)
    ↓
Frontend: Video/Audio Capture (MediaRecorder API)
    ↓
WebSocket Connection
    ↓
Backend Proxy (Node.js Express)
    ↓
Python Service → Gemini Live API
    ↓
Real-time Analysis + Codeword Detection
    ↓
[If codeword detected] → Twilio Voice Call Trigger
```

### Component Structure

**Frontend Components:**
- [VideoRecorder.tsx](components/VideoRecorder.tsx) - Main recording interface with camera/mic access
- [SessionDashboard.tsx](components/SessionDashboard.tsx) - Real-time monitoring display
- [IncidentReports.tsx](components/IncidentReports.tsx) - Post-recording analysis view
- [ModelSelector.tsx](components/ModelSelector.tsx) - Gemini model configuration

**Backend Structure:**

[server/index.js](server/index.js) - Main Express server
- WebSocket proxy for Gemini Live connections
- REST API endpoints for session management
- Twilio voice call orchestration

[server/routes/gemini-live.js](server/routes/gemini-live.js) - Gemini Live API WebSocket proxy
- Handles client WebSocket connections
- Proxies to Python service for Gemini Live API
- Manages session state and reconnection

[server/routes/twilio-voice.js](server/routes/twilio-voice.js) - Twilio voice integration
- Triggers outbound calls when codeword detected
- Serves TwiML for fake conversation scripts
- Manages call state and hangup logic

**Services:**
- [server/services/codeword-detector.js](server/services/codeword-detector.js) - Monitors Gemini responses for panic codeword
- [server/services/twilio-caller.js](server/services/twilio-caller.js) - Orchestrates fake phone calls
- [server/services/post-analysis.js](server/services/post-analysis.js) - Categorizes incidents after recording ends

**Python Microservice:**
- [python/live_stream_handler.py](python/live_stream_handler.py) - Handles Gemini Live API streaming
  - Manages WebSocket connection to Gemini Live API
  - Converts audio/video to proper format (16-bit PCM, 16kHz for audio)
  - Processes responses and detects function calls
  - Uses `gemini-2.5-flash-native-audio-preview-09-2025` model

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

**Function Calling**:
- `trigger_emergency_call()` - Called when codeword detected
- Backend receives function call and initiates Twilio call

### Twilio Voice Integration

**Fake Call Flow**:
1. Codeword detected → Backend calls Twilio API
2. Twilio initiates call to user's phone number
3. User answers → TwiML script plays pre-recorded conversation
4. Conversation options:
   - Mom calling about dinner plans
   - Friend with car emergency
   - Work emergency
   - Customizable scripts

**TwiML Example**:
```xml
<Response>
  <Say voice="Polly.Joanna">
    Hey! It's mom. We're running late for dinner.
    Can you come over in the next 10 minutes?
  </Say>
  <Pause length="3"/>
  <Say>Okay great, see you soon!</Say>
  <Hangup/>
</Response>
```

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
- **Hybrid Tech Stack**: Node.js for server + Python for Gemini Live API integration (Python SDK more mature)
- **Real-time Requirements**: Codeword detection must happen within 2-3 seconds for effective emergency response
- **Mobile-First**: UI optimized for smartphone use, large touch targets, minimal interactions during recording
- **Privacy**: Sessions can be configured to not store video/audio, only metadata and transcripts
- **Offline Fallback**: If connection lost, local recording continues and uploads when reconnected

## Security Considerations

- Use **ephemeral tokens** for Gemini Live API authentication (not API keys in frontend)
- Twilio credentials stored server-side only
- Session data encrypted in transit (WSS/HTTPS)
- Optional: End-to-end encryption for stored recordings
- Rate limiting on fake call triggers to prevent abuse
- User authentication required for production deployment

## Development Workflow

1. **Local Development**: Use ngrok to test on real smartphone
2. **Testing Codeword Detection**: Start recording, say codeword, verify call triggers
3. **TwiML Testing**: Use Twilio console to test voice scripts
4. **Session Analysis**: Stop recording, verify categorization accuracy

## Migration Notes

This project was previously a SF 311 WhatsApp reporting bot. Key architectural changes:

- **From**: Text-based WhatsApp messages → Gemini analysis → 311 submission
- **To**: Live video/audio → Gemini Live monitoring → Emergency call trigger
- **Retained**: Gemini AI integration, Twilio integration, dashboard UI framework
- **New**: Real-time streaming, WebSocket architecture, Python microservice, voice calls
