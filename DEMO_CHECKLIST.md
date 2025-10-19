# 🎯 DEMO CHECKLIST - Gemini Hackathon

## ✅ PRE-DEMO SETUP (Do this NOW)

### 1. Verify Services Running
```bash
# Check Node.js server (port 3001)
lsof -i:3001

# Check Python service (port 5001)
lsof -i:5001

# If not running, start them:
npm run server > /tmp/node-server.log 2>&1 &
python3 python/live_stream_handler.py > /tmp/python-service.log 2>&1 &
```

### 2. Check ngrok URL
- Mobile URL: https://lilianna-sweltering-kristopher.ngrok-free.dev/mobile
- Desktop URL: https://lilianna-sweltering-kristopher.ngrok-free.dev/desktop

### 3. Open Both URLs BEFORE Demo
- **Laptop (Desktop View)**: Open desktop URL and keep visible for judges
- **Phone (Mobile View)**: Open mobile URL in browser

---

## 🎬 DEMO SCRIPT (5 minutes)

### **Act 1: The Setup** (30 seconds)
**SAY**: "Imagine Evangeline is going on a date. Her friend Kevin is monitoring her safety from his laptop."

**SHOW**:
- Point to laptop (desktop view)
- Point to phone (mobile view)

### **Act 2: Starting Protection** (30 seconds)
**DO**: On phone, click "Start" button

**SAY**: "Evangeline activates Guardian. The app starts tracking her location and listening for a danger keyword."

**SHOW**:
- Mobile shows "Guardian Active" with pulsing microphone
- Desktop shows session connected + location tracking

**EXPECT**:
- Mobile: Green "Guardian Active" screen
- Desktop: New session appears with location

### **Act 3: Danger Detected!** (1 minute)
**DO**: On phone, click "🧪 Test Emergency Call" button

**SAY**: "When Evangeline says 'danger' - or clicks this test button - the system immediately springs into action."

**EXPECT**:
- Mobile: Fake incoming call from "Alex" appears
- Desktop: Red danger banner appears

**DO**: On phone, click "Accept" button

**SAY**: "She receives a call from her 'friend' Alex - but it's really an AI creating a believable excuse to leave."

**EXPECT**:
- Mobile: Call interface appears, ringtone stops
- **Alex speaks INSTANTLY** (no lag!) - "Hey! I'm almost at the ferry building..."

### **Act 4: Live Monitoring** (1 minute)
**POINT TO DESKTOP**:

**SAY**: "While Evangeline is on the call, Kevin can see:"

**SHOW ON SCREEN**:
1. **Live Video Feed** - "🔴 LIVE" indicator with camera feed
2. **AI Safety Analysis** - Blue banner with Gemini AI analysis:
   - "1 person visible, indoor environment, appears safe"
3. **Location Updates** - Real-time GPS coordinates
4. **Activity Log** - All events timestamped

**DO**: On phone, talk to Alex
- YOU: "Where are you?"
- ALEX: "I'm at the ferry building, my car died!"

**SAY**: "The AI voice agent responds naturally, giving Evangeline a believable reason to leave."

### **Act 5: The Technology** (1 minute)
**EXPLAIN WHILE POINTING**:

1. **Speech-to-Text**: "Browser's built-in speech recognition captures what Evangeline says"
2. **Smart AI Responses**: "Context-aware responses from our persona system"
3. **Text-to-Speech**: "ElevenLabs converts responses to natural voice"
4. **Gemini Vision API**: "Analyzes video every 4 seconds for safety indicators"
5. **Real-time Streaming**: "WebSockets for instant updates to monitor"

### **Act 6: Key Features** (30 seconds)
**SAY**: "Key features:"
- ✅ **Zero latency** - Voice agent speaks instantly
- ✅ **Privacy-first** - Video only when danger detected
- ✅ **AI-powered** - Gemini Vision analyzes environment
- ✅ **No app install** - Works in any mobile browser
- ✅ **Real conversation** - Natural back-and-forth dialogue

### **Act 7: Use Cases** (30 seconds)
**SAY**: "Use cases:"
- 📅 First dates or meetups with strangers
- 🚶 Walking alone at night
- 🏠 Home service appointments
- 🚗 Ride shares with unfamiliar drivers

**END**: "Thank you! Questions?"

---

## 🔍 TROUBLESHOOTING

### If voice agent doesn't speak immediately:
- **Check**: Is "Accept" button showing "Loading..."? (Wait for it to say "Accept")
- **Check**: Browser console for audio preloading errors

### If video doesn't show on desktop:
- **Check**: Mobile browser console - should see "✅ Video frame sent successfully"
- **Check**: Desktop browser console - should see "📹 Video frame received"
- **Check**: Network tab - WebSocket should show "video_frame" messages

### If AI analysis doesn't appear:
- **Check**: Python service is running (`lsof -i:5001`)
- **Check**: `/tmp/python-service.log` for Gemini API errors
- **Note**: Analysis appears every 3rd frame (~4.5 seconds)

---

## 📊 EXPECTED CONSOLE OUTPUT

### Mobile Console:
```
🎥 Starting recording...
✅ Recording started
👂 Listening for "danger" keyword...
🚨 DANGER KEYWORD DETECTED!
📹 STARTING VIDEO STREAMING TO DESKTOP NOW!
✅ Video streaming started (fast mode: 500ms intervals for first 3s)
📤 Sending video frame to desktop (frame size: 45231 chars)
✅ Video frame sent successfully
```

### Desktop Console:
```
✅ Connected to monitoring system
📥 Desktop received: {type: "recording_started", ...}
📥 Desktop received: {type: "codeword_detected", ...}
📹 Video frame received for session: session_xxx
✅ Updated session with video frame, total sessions: 1
🤖 Vision analysis received: 1 person visible, indoor...
```

---

## ⏱️ TIMING

- **Total Demo**: 4-5 minutes
- **Setup**: 30 seconds
- **Main Flow**: 3 minutes
- **Q&A Buffer**: 1-2 minutes

---

## 🎯 KEY MESSAGES

1. **Safety without suspicion** - Looks like a normal phone call
2. **Friend can monitor live** - Video + AI analysis + location
3. **Powered by Gemini** - Vision API analyzes safety in real-time
4. **Instant response** - No lag in voice conversation
5. **Privacy-first** - Camera only activates when needed

---

## 🚨 COMMON MISTAKES TO AVOID

❌ **Don't** say "It's like Uber's safety feature" - emphasize it's MORE
❌ **Don't** skip showing the AI analysis - it's the Gemini differentiator
❌ **Don't** rush the video feed - make sure judges see it appear
✅ **Do** emphasize zero latency
✅ **Do** show the live video + AI analysis together
✅ **Do** mention this works in ANY browser (no app install)

---

## 📱 BACKUP PLAN

If phone demo fails:
1. Use localhost on laptop instead
2. Open mobile view in one browser window
3. Open desktop view in another window
4. Demo side-by-side on laptop screen

---

Good luck! 🍀
