<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Live Safety Monitor - Multi-Agent AI Safety System

> **Winner of Gemini Hackathon 2025** 🏆

A real-time personal safety application that uses **Gemini 2.5 Flash Multi-Agent System** for intelligent danger detection and automated emergency response. Provides a discreet way to escape dangerous situations through AI-powered conversation analysis and automated fake phone calls.

**AI Studio App**: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## 🎯 The Problem

People in uncomfortable or dangerous situations (bad dates, harassment, pressure, coercion) often can't explicitly ask for help without escalating the situation. Traditional panic buttons are too obvious.

## 💡 The Solution

Our multi-agent AI system continuously monitors your conversation and automatically detects when you're in danger - even if you can't say it explicitly. When detected, you instantly receive a fake phone call as a natural excuse to leave.

## ✨ Key Features

- 🤝 **Multi-Agent AI System**: 4 specialized Gemini agents collaborate to analyze conversations
- 🎥 **Live Video/Audio Monitoring**: Real-time streaming from smartphone via ngrok
- 🧠 **Intelligent Danger Detection**: AI understands context, emotions, and coded language
- 📞 **Automatic Fake Call**: Twilio triggers realistic phone call within seconds
- 🔒 **Privacy-First**: All processing happens in real-time, no permanent storage
- 📊 **Agent Transparency**: See how each AI agent scores the conversation

## 🤖 Multi-Agent Architecture

Our system uses **4 specialized Gemini 2.5 Flash agents** working together:

### Agent 1: Transcript Analyzer 📝
- Analyzes literal words spoken
- Detects explicit threats, requests for help
- Identifies attempts to leave or end conversations

### Agent 2: Emotional State Detector 😰
- Detects stress, fear, anxiety through language patterns
- Identifies nervousness and hesitation in speech
- Recognizes passive-aggressive or coded language

### Agent 3: Context Interpreter 🔍
- Understands social dynamics and power imbalances
- Detects signs of coercion or manipulation
- Identifies situational red flags

### Agent 4: Threat Assessor (Meta-Agent) ⚖️
- Synthesizes inputs from all specialist agents
- Determines if agents agree (high confidence) or disagree
- Makes final decision on danger level (0-100 score)
- Triggers emergency response at 70%+ confidence

**Why Multi-Agent?**
- **Reduced False Positives**: Each agent specializes in one dimension
- **Higher Accuracy**: Meta-agent synthesizes multiple perspectives
- **Explainable AI**: Users see individual agent scores
- **Robust Detection**: Can't miss danger signals across different dimensions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- ngrok account
- Gemini API key ([get here](https://aistudio.google.com/app/apikey))
- Twilio account ([get here](https://console.twilio.com))

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd gemini-hackathon-10-18-25
   npm install
   cd python && pip install -r requirements.txt && cd ..
   ```

2. **Set up environment variables:**
   Create `.env.local` in project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   USER_PHONE_NUMBER=your_personal_phone_number
   PANIC_CODEWORD="i'm busy right now"
   PORT=3001
   PYTHON_SERVICE_URL=http://localhost:5001
   ```

3. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`) and add to `.env.local`:
   ```env
   BASE_URL=https://abc123.ngrok-free.dev
   ```

4. **Run the application:**
   ```bash
   npm run dev:all
   ```

5. **Access on your phone:**
   - Open the ngrok URL in your smartphone browser
   - Allow camera and microphone permissions
   - Start recording!

## 📱 How to Use

### Starting a Safety Session

1. Open the ngrok URL on your smartphone
2. Click **"Start Safety Recording"**
3. Allow camera/microphone permissions
4. Your conversation is now being monitored by 4 AI agents

### How Detection Works

Every 10 seconds, the system:
1. **Collects** speech transcripts from the last 10 seconds
2. **Analyzes** with 4 parallel Gemini agents (Transcript, Emotional, Context)
3. **Synthesizes** results with Threat Assessor meta-agent
4. **Triggers** emergency call if danger score ≥ 70%

### Emergency Response

When danger is detected:
1. ⚡ **Instant notification** on screen
2. 📞 **Automatic phone call** to your number via Twilio
3. 🎭 **Realistic fake conversation** plays (configurable scenarios)
4. 🚪 **Natural excuse** to leave the situation

### Viewing Multi-Agent Analysis

The app displays all 4 agent scores in real-time:
- See which dimension triggered the alert
- Understand why the system made its decision
- Build trust through transparency

## 🏗️ Technical Architecture

```
┌─────────────────┐
│  Smartphone     │
│  (Web Browser)  │
│  - Video Feed   │
│  - Speech API   │
└────────┬────────┘
         │ WebSocket (via ngrok)
         ↓
┌─────────────────┐
│  Frontend       │
│  (React/Vite)   │
│  Port 3000      │
└────────┬────────┘
         │ Proxy
         ↓
┌─────────────────┐
│  Backend        │
│  (Node.js)      │
│  Port 3001      │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────────────────────────┐
│  Python Service (Port 5001)         │
│  ┌─────────────────────────────┐   │
│  │  Multi-Agent System         │   │
│  │  ┌─────────────────────┐    │   │
│  │  │ Agent 1: Transcript │    │   │
│  │  │ Agent 2: Emotional  │────┼───┼──→ Gemini 2.5 Flash
│  │  │ Agent 3: Context    │    │   │   (4 parallel calls)
│  │  │ Agent 4: Assessor   │    │   │
│  │  └─────────────────────┘    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         ↓ If danger ≥ 70%
┌─────────────────┐
│  Twilio API     │
│  Voice Call     │
└─────────────────┘
```

### Technology Stack

**Frontend:**
- React + TypeScript
- Vite (development server)
- Web Speech API (speech-to-text)
- MediaRecorder API (video capture)
- WebSocket (real-time communication)

**Backend:**
- Node.js + Express
- WebSocket server
- Twilio SDK (voice calls)

**AI Layer:**
- Python 3.13 + aiohttp
- Google Generative AI SDK
- Gemini 2.5 Flash (4 instances per analysis)
- Multi-agent collaborative system

**Infrastructure:**
- ngrok (phone access to localhost)
- Port 3000 (frontend), 3001 (backend), 5001 (Python)

## 📂 Project Structure

```
.
├── components/
│   ├── SafetyRecorder.tsx     # Main UI with video, transcripts, agent scores
│   └── Header.tsx             # App header
├── server/
│   ├── index.js               # Express server + WebSocket
│   ├── config.js              # Environment variables
│   ├── routes/
│   │   ├── live-session.js    # WebSocket proxy to Python service
│   │   └── twilio-webhook.js  # Twilio voice call handling
│   └── services/
│       └── twilio-caller.js   # Fake call orchestration
├── python/
│   ├── live_stream_handler.py # Multi-agent AI system
│   └── requirements.txt       # google-genai, aiohttp, etc.
├── App.tsx                    # Main React app
├── .env.local                 # Environment configuration
└── vite.config.ts             # Vite + proxy config
```

## 🎓 Hackathon Requirements Met

✅ **Uses Gemini 2.5 Flash**: All 4 agents use latest Gemini model
✅ **Multi-Agent System**: 4 specialized agents + meta-agent coordinator
✅ **Real-Time Processing**: Analyzes conversations every 10 seconds
✅ **Practical Use Case**: Solves real safety problem
✅ **Live Streaming**: Uses Web Speech API + Gemini integration
✅ **Function Calling**: Twilio API integration via AI decisions
✅ **Innovative Architecture**: First multi-agent safety monitoring system

## 🔐 Security & Privacy

- **No Permanent Storage**: Transcripts analyzed in real-time and discarded
- **Server-Side Credentials**: Twilio + Gemini keys never exposed to frontend
- **Encrypted Transport**: WSS + HTTPS for all communications
- **Local Processing**: Speech recognition happens in browser
- **10-Second Buffer**: Only last 10 seconds of speech sent to AI

## 🚧 Future Enhancements

- [ ] Add video frame analysis (Gemini multimodal)
- [ ] Support multiple emergency contact scenarios
- [ ] Implement post-incident reporting
- [ ] Add location sharing when danger detected
- [ ] Build mobile native app (React Native)
- [ ] Add user authentication and session history
- [ ] Multi-language support
- [ ] Integration with emergency services

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- **Google Gemini Team** for the incredible 2.5 Flash model
- **Twilio** for reliable voice API
- **Anthropic Claude** for development assistance
- **ngrok** for seamless local development tunneling

---

**Built with ❤️ for Gemini Hackathon 2025**

*Making the world safer, one conversation at a time.*
