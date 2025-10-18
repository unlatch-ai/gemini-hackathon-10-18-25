# Quick Start Guide - Hackathon MVP

This guide will get you up and running with the Live Safety Monitor in under 10 minutes!

## Prerequisites

- Node.js 18+ installed
- Python 3.8+ installed
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Twilio account ([Sign up here](https://www.twilio.com/try-twilio))
- ngrok installed ([Download here](https://ngrok.com/download))

## Step 1: Install Dependencies

### Node.js Dependencies
```bash
npm install
```

### Python Dependencies
```bash
cd python
pip install -r requirements.txt
cd ..
```

## Step 2: Configure Environment

Create `.env.local` in the project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
USER_PHONE_NUMBER=+1234567890

# Optional (has defaults)
PANIC_CODEWORD=help me mom
PORT=3001
```

**Where to get these:**
- `GEMINI_API_KEY`: https://aistudio.google.com/app/apikey
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`: https://console.twilio.com/
- `TWILIO_PHONE_NUMBER`: Buy a phone number from Twilio console
- `USER_PHONE_NUMBER`: Your personal phone number (to receive the fake call)

## Step 3: Start ngrok

```bash
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and add it to `.env.local`:

```env
BASE_URL=https://abc123.ngrok.io
```

## Step 4: Start the Services

You'll need **3 terminal windows**:

### Terminal 1: Python Service
```bash
cd python
python live_stream_handler.py
```

You should see:
```
🚀 Starting Gemini Live Stream Handler
📝 Monitoring for codeword: 'help me mom'
```

### Terminal 2: Node.js Backend
```bash
npm run server
```

You should see:
```
✅ Configuration loaded successfully
🚀 Server running on http://localhost:3001
📱 Twilio webhook URL: http://localhost:3001/twilio/webhook
🎥 WebSocket URL: ws://localhost:3001/ws/live-session
🔑 Panic codeword: "help me mom"
```

### Terminal 3: Frontend
```bash
npm run dev
```

You should see:
```
VITE v6.2.0  ready in XXX ms
➜  Local:   http://localhost:3000/
```

## Step 5: Test the App

1. **Open your browser** to http://localhost:3000

2. **Allow microphone permissions** when prompted

3. **Click "Start Safety Recording"**

4. **Say the panic codeword**: "help me mom"

5. **Watch for the alert** - You should see:
   - "🚨 Codeword Detected!" on screen
   - "📞 Call triggered!" message
   - Your phone should ring within 2-3 seconds!

6. **Answer the phone** - You'll hear a pre-recorded fake conversation

## Troubleshooting

### "WebSocket connection failed"
- Make sure the Node.js server is running on port 3001
- Check that no firewall is blocking WebSocket connections

### "Python service not responding"
- Verify Python service is running: `curl http://localhost:5000/health`
- Check Python logs for errors

### "No phone call received"
- Verify Twilio credentials in `.env.local`
- Check that `USER_PHONE_NUMBER` is correct
- Look for errors in Node.js server logs

### "Microphone not working"
- Make sure you allowed microphone permissions in your browser
- Try using Chrome or Firefox (best WebRTC support)
- Check browser console for errors

### "Codeword not detected"
- Speak clearly and at normal volume
- Try saying the exact phrase: "help me mom"
- Check Python service logs to see if audio is being received

## Demo Tips for Hackathon

1. **Practice the flow** a few times before demoing
2. **Have backup audio** ready in case of mic issues
3. **Explain the use case** before showing the tech (safety/exit strategy)
4. **Show the logs** - they're impressive and show the AI working
5. **Mention production improvements** (video, multiple codewords, etc.)

## What to Show in Your Demo

1. **The Problem**: Sometimes you need a discreet way to exit a situation
2. **The Solution**: AI monitors your conversation, triggers fake call
3. **Live Demo**:
   - Start recording
   - Say codeword
   - Show instant detection
   - Answer the fake call
4. **Technical Stack**: Gemini Live API + Twilio + React
5. **Future Vision**: Video support, custom voices, wearable integration

## Quick Commands Reference

```bash
# Start everything (requires 3 terminals)
cd python && python live_stream_handler.py   # Terminal 1
npm run server                               # Terminal 2
npm run dev                                  # Terminal 3

# Check service health
curl http://localhost:5000/health  # Python service
curl http://localhost:3001/health  # Node.js server

# View logs
# Python logs show in Terminal 1
# Node.js logs show in Terminal 2
# Frontend logs in browser console (F12)
```

## Next Steps After MVP

- [ ] Add video recording support
- [ ] Implement multiple codeword options
- [ ] Create custom TwiML scenarios
- [ ] Add post-recording analysis
- [ ] Deploy to production (Railway/Render)
- [ ] Add user authentication
- [ ] Implement session persistence

## Need Help?

- Check the full documentation in [ARCHITECTURE.md](ARCHITECTURE.md)
- Review implementation details in [CLAUDE.md](CLAUDE.md)
- See the full roadmap in [ROADMAP.md](ROADMAP.md)

Good luck with your hackathon! 🚀
