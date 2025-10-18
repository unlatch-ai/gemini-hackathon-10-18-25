<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Live Video Safety Application

A real-time video safety application that uses Gemini Live API for panic codeword detection and automated emergency response. The system provides a discreet way to get out of dangerous situations through AI-powered audio/video monitoring and automated phone call triggers.

View your app in AI Studio: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## Features

- 🎥 **Live Video/Audio Streaming**: Real-time streaming from smartphone camera and microphone to Gemini Live API
- 🔊 **Panic Codeword Detection**: AI monitors audio stream for customizable panic phrases/codewords
- 📞 **Fake Call Trigger**: Automatically initiates a realistic phone call via Twilio when codeword is detected
- 🤖 **AI-Powered Analysis**: Gemini 2.5 Flash with native audio processing for natural conversation understanding
- 📊 **Post-Recording Categorization**: Automatic analysis and categorization of incidents (police report, 311, safety log)
- 🔒 **Secure Streaming**: Client-to-server WebSocket connection with ephemeral token authentication

## Quick Start

**Prerequisites:** Node.js 18+, Python 3.8+ (for Gemini Live API), ngrok

1. **Install dependencies:**
   ```bash
   npm install
   pip install google-genai twilio
   ```

2. **Set up environment variables:**

   Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   PORT=3001
   PANIC_CODEWORD=help me mom
   ```

   - Get your Gemini API key from: https://aistudio.google.com/app/apikey
   - Get Twilio credentials from: https://console.twilio.com

3. **Expose your server with ngrok:**
   ```bash
   ngrok http 3001
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. **Run the application:**

   **Full stack (recommended):**
   ```bash
   npm run dev:all
   ```

   **Frontend only:**
   ```bash
   npm run dev
   ```
   Visit the ngrok URL on your smartphone

   **Backend only:**
   ```bash
   npm run server
   ```

## How to Use

### Starting a Safety Session

1. **Open the app on your smartphone** using the ngrok URL (e.g., `https://abc123.ngrok.io`)
2. **Allow camera and microphone permissions** when prompted
3. **Click "Start Recording"** to begin the safety session
4. The app will stream live video and audio to Gemini Live API
5. Gemini monitors the audio in real-time for the panic codeword

### Triggering Emergency Response

1. **Say your panic codeword** (default: "help me mom") during the recording
2. Gemini detects the codeword in real-time
3. **Twilio automatically calls your phone** within seconds
4. Answer the call to receive a pre-programmed fake conversation
5. Use this as an excuse to leave the situation safely

### Post-Recording Analysis

1. **Click "Stop Recording"** when safe
2. The system analyzes the entire session
3. **Automatic categorization:**
   - Police report (if threats/violence detected)
   - 311 report (if safety hazards detected)
   - General safety log (default)
4. View the analysis and generated reports in the dashboard

## Project Structure

```
.
├── components/                  # React components
│   ├── VideoRecorder.tsx        # Main recording interface
│   ├── SessionDashboard.tsx     # Real-time session monitoring
│   ├── IncidentReports.tsx      # Post-recording analysis view
│   └── ModelSelector.tsx        # AI model configuration
├── server/                      # Backend server
│   ├── index.js                 # Express server entry point
│   ├── config.js                # Environment configuration
│   ├── storage.js               # Session data storage
│   ├── routes/
│   │   ├── gemini-live.js       # Gemini Live API WebSocket proxy
│   │   └── twilio-voice.js      # Twilio voice call triggers
│   └── services/
│       ├── gemini-live.py       # Python service for Gemini Live API
│       ├── codeword-detector.js # Real-time codeword detection
│       ├── twilio-caller.js     # Fake call orchestration
│       └── post-analysis.js     # Incident categorization
├── python/                      # Python microservices
│   ├── live_stream_handler.py   # Handles Gemini Live streaming
│   └── requirements.txt         # Python dependencies
├── App.tsx                      # Main React application
├── types.ts                     # TypeScript type definitions
└── constants.ts                 # Configuration constants
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Detailed architecture and development guide
- [server/README.md](server/README.md) - Backend setup and API documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and data flow

## Current Status

- 🚧 **In Development**: Migrating from 311 reporting to live safety monitoring
- ✅ **Gemini Live Integration**: Real-time audio/video streaming capability
- ✅ **Panic Detection**: Codeword monitoring system
- 🚧 **Twilio Voice**: Fake call trigger implementation
- 🚧 **Post-Analysis**: Incident categorization engine

## Technical Architecture

### Real-Time Streaming
- **Client**: MediaRecorder API → WebSocket → Backend proxy
- **Backend**: Node.js proxy → Python service → Gemini Live API
- **Protocol**: WebSocket for bidirectional streaming
- **Format**: Audio (16-bit PCM, 16kHz), Video (WebM/H.264)

### Panic Detection Flow
1. Audio stream analyzed in real-time by Gemini
2. System instruction includes codeword monitoring
3. When detected: Function call triggered → Backend notified
4. Backend initiates Twilio call within 2-3 seconds
5. Pre-recorded conversation plays to user's phone

### Security
- Ephemeral tokens for client-to-server Gemini connections
- Twilio credentials stored server-side only
- Session data encrypted in transit
- Optional end-to-end encryption for recordings

## Production Deployment

For production:
- Deploy backend to Railway/Render with persistent WebSocket support
- Use Twilio production account with verified phone numbers
- Implement user authentication (Auth0/Firebase)
- Add database for session persistence (PostgreSQL/MongoDB)
- Configure CDN for frontend assets
- Set up monitoring and alerting (Sentry/DataDog)
