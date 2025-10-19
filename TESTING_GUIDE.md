# Testing Guide - ElevenLabs Voice Agent System

## Prerequisites

Before testing, ensure all services are running:

```bash
# Terminal 1: Node.js Backend
npm run server
# Should see: Server running on http://localhost:3001

# Terminal 2: Python Service
python3 python/live_stream_handler.py
# Should see: Starting Gemini Live Stream Handler on port 5001

# Terminal 3: Frontend (optional for local testing)

npm run dev
# Should see: Vite dev server on http://localhost:3000
```

## Test Suite

### 1. Audio Generation Test

**Purpose**: Verify ElevenLabs TTS is working

```bash
# Test default voice (Adam)
curl "http://localhost:3001/api/live/elevenlabs-audio?text=Hello+this+is+a+test" --output test_adam.mp3

# Test Rachel voice (Mom)
curl "http://localhost:3001/api/live/elevenlabs-audio?text=Hey+sweetie,+it's+mom&voice=Rachel" --output test_rachel.mp3

# Test Bella voice (Sister)
curl "http://localhost:3001/api/live/elevenlabs-audio?text=Hey+sis,+I+need+help&voice=Bella" --output test_bella.mp3

# Play audio to verify
# Mac: afplay test_adam.mp3
# Linux: mpg123 test_adam.mp3
```

**Expected**: MP3 files play natural-sounding speech

**Troubleshooting**:
- If files are empty: Check Python logs for ElevenLabs API key errors
- If voice sounds robotic: Fallback to gTTS is active (check ElevenLabs API quota)
- Check Python logs for TTS service being used (ElevenLabs/Google/gTTS)

---

### 2. Multi-Agent Analysis Test

**Purpose**: Verify danger detection system

**Steps**:
1. Access app via ngrok URL on smartphone
2. Click "Start Safety Recording"
3. Grant camera/microphone permissions
4. Wait for WebSocket connection (green status)
5. Say test phrases and observe agent scores

**Test Cases**:

| Phrase | Expected Transcript Score | Expected Emotional Score | Expected Context Score | Expected Final Score |
|--------|--------------------------|-------------------------|------------------------|---------------------|
| "What a beautiful day" | 0-10 | 0-10 | 0-10 | <30 (safe) |
| "I'm really uncomfortable right now" | 30-50 | 40-60 | 30-50 | 40-60 (moderate) |
| "Help me, I feel scared" | 60-80 | 70-90 | 60-80 | **≥70 (DANGER)** |
| "danger" (panic keyword) | 100 | 100 | 100 | **100 (INSTANT)** |

**Expected Behavior**:
- Analysis runs every 10 seconds
- "🤖 4 Gemini Agents Analyzing..." appears
- Agent scores display after analysis
- If final score ≥70%, FakeCallUI appears with ringtone

**Troubleshooting**:
- No analysis: Check Python service logs for Gemini API errors
- Low scores for dangerous phrases: Multi-agent prompts may need tuning
- No fake call trigger: Check console for `setShowFakeCall(true)` log

---

### 3. Fake Call UI Test

**Purpose**: Verify iPhone-style call interface

**Steps**:
1. Trigger danger detection (say "help me" or "danger")
2. Verify FakeCallUI appears
3. Check ringtone plays automatically
4. Verify caller info displays correctly

**Expected**:
- Full-screen black interface appears
- Ringtone plays and loops (requires user interaction first on iOS)
- Shows "Alex" or persona name
- Shows "iPhone" / "Mobile" / etc.
- "Accept" (green) and "Decline" (red) buttons visible

**Test Different Personas**:
Currently defaults to "Adam" (Alex). To test others, modify SafetyRecorder.tsx:348:
```tsx
{showFakeCall && <FakeCallUI onAccept={handleAcceptCall} onDecline={handleDeclineCall} persona="rachel" />}
```

**Troubleshooting**:
- No ringtone: Check `public/sounds/ringtone.mp3` exists (it does)
- UI doesn't appear: Check browser console for errors
- Accept button doesn't work: Check `onAccept` callback is defined

---

### 4. Voice Agent Conversation Test

**Purpose**: Verify bidirectional voice conversation

**Steps**:
1. Trigger fake call
2. Click "Accept" button
3. Wait for initial greeting to play
4. Speak when status shows "Connected" (not "Speaking...")
5. Wait for agent response
6. Continue conversation

**Expected Flow**:
```
1. Accept call
2. Agent greeting plays: "Hey! I'm almost at the ferry building..."
3. Status: "Speaking..." (agent talking)
4. Status: "Connected" (waiting for you)
5. You speak: "Okay, where exactly are you?"
6. Audio uploads to /api/live/converse
7. Agent responds: "I'm at the main entrance..."
8. Repeat until you click "End"
```

**Test Each Persona**:

**Adam (Friend Alex):**
- Greeting: "Hey! I'm almost at the ferry building. Can you come meet me right now?"
- Scenarios: Car trouble, meeting urgency, friend emergency

**Rachel (Mom):**
- Greeting: "Hey sweetie, something urgent came up with your dad..."
- Scenarios: Family emergency, need help at home

**Bella (Sister Sarah):**
- Greeting: "Hey sis! Emergency with the apartment. Can you come help me?"
- Scenarios: Apartment issues, lost keys, pet emergency

**Troubleshooting**:
- No initial greeting: Check elevenlabs-audio endpoint logs
- Can't hear yourself: Microphone access not granted
- No agent response: Check /api/live/converse endpoint logs
- Robotic voice: Fallback to gTTS active (check ElevenLabs quota)
- Speech recognition ends too soon: Browser's SpeechRecognition API issue (known limitation)

---

### 5. Full End-to-End Test

**Purpose**: Complete safety scenario simulation

**Scenario**: User is in uncomfortable date situation

**Steps**:
1. Access app via ngrok on smartphone
2. Start recording
3. Simulate conversation: "So yeah, I'm not really feeling this..."
4. Wait 10 seconds for first analysis
5. Escalate: "I really need to go, I'm uncomfortable"
6. Wait for analysis (should show moderate scores)
7. Say panic word: "danger"
8. **Fake call should trigger immediately**
9. Accept call
10. Have natural conversation with voice agent
11. Use excuse to "leave"
12. End call
13. Stop recording
14. Review agent scores in UI

**Success Criteria**:
- ✅ All 4 agent scores displayed after each 10-second interval
- ✅ Danger score increases with escalation
- ✅ Panic word triggers instant fake call (100% score)
- ✅ Ringtone plays
- ✅ Voice agent sounds natural and convincing
- ✅ Conversation flows smoothly
- ✅ Can end call anytime
- ✅ Recording stops cleanly

---

## Performance Benchmarks

**Audio Generation:**
- ElevenLabs: 250-500ms for 1-2 sentences
- Google TTS: 300-600ms
- gTTS: 400-800ms

**Multi-Agent Analysis:**
- 4 agents run in parallel: ~2-4 seconds total
- Transcript Agent: ~500ms
- Emotional Agent: ~500ms
- Context Agent: ~500ms
- Threat Assessor: ~1s

**Conversational Turn:**
- User speaks → Transcription: 1-2s
- Gemini response generation: 1-2s
- TTS conversion: 250-500ms
- **Total latency: 3-5 seconds** (feels natural in conversation)

---

## Known Issues & Limitations

### 1. Speech Recognition Auto-Stop
**Issue**: Browser's SpeechRecognition API stops recording after detecting silence
**Impact**: May cut off user mid-sentence
**Workaround**: User can speak again to trigger new recording
**Future Fix**: Implement custom VAD (Voice Activity Detection)

### 2. iOS Autoplay Restrictions
**Issue**: iOS doesn't allow ringtone autoplay without user gesture
**Impact**: Ringtone may not play on first trigger
**Workaround**: Ringtone plays after user interaction (tap screen)
**Current Status**: Working as designed (security feature)

### 3. ElevenLabs API Rate Limits
**Issue**: Free tier has character limits
**Impact**: Falls back to Google TTS or gTTS
**Workaround**: Monitor Python logs, upgrade ElevenLabs plan
**Current Status**: Triple fallback ensures system always works

### 4. WebRTC Audio Format
**Issue**: Browser sends WebM, need to convert to WAV for Gemini
**Impact**: Requires ffmpeg on server
**Workaround**: Ensure ffmpeg installed: `brew install ffmpeg` (Mac) or `apt install ffmpeg` (Linux)
**Current Status**: Working

---

## Debug Commands

**Check service health:**
```bash
curl http://localhost:3001/health
curl http://localhost:5001/health
```

**Monitor Python logs:**
```bash
# In python/ directory
tail -f logs/live_stream_handler.log  # if logging to file
# Or just watch terminal output
```

**Monitor Node logs:**
```bash
# Watch terminal where `npm run server` is running
```

**Test WebSocket connection:**
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001/ws/live-session');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('📥', e.data);
ws.send(JSON.stringify({ type: 'start_recording' }));
```

---

## Success Indicators

### Green Flags ✅
- Python service starts without errors
- Node server starts on port 3001
- WebSocket connects (green status in UI)
- Agent scores appear every 10 seconds
- Fake call triggers at 70%+ danger
- Ringtone plays
- Voice agent responds naturally
- Conversation feels smooth

### Red Flags ❌
- "ECONNREFUSED" errors → Python service not running
- "401 Unauthorized" → API keys invalid
- Empty audio files → TTS not working
- No agent scores → Gemini API issues
- Silent voice agent → Check microphone permissions
- Robotic voice → ElevenLabs quota exceeded (fallback active)

---

## Mobile Testing Checklist

- [ ] Access via ngrok URL on smartphone
- [ ] Grant camera permission
- [ ] Grant microphone permission
- [ ] Record 30+ second conversation
- [ ] Verify analysis runs every 10 seconds
- [ ] Say danger keyword
- [ ] Fake call UI appears
- [ ] Ringtone plays
- [ ] Accept call works
- [ ] Voice agent greeting plays
- [ ] Speak to agent
- [ ] Agent responds appropriately
- [ ] End call works
- [ ] Stop recording works
- [ ] Agent scores displayed correctly

---

## Next Steps

After successful testing:
1. ✅ All systems working → Ready for demo!
2. ⚠️ Issues found → Check troubleshooting sections above
3. 📝 Need custom personas → Edit `python/live_stream_handler.py:831-880`
4. 🎨 Want to customize UI → Edit `components/FakeCallUI.tsx`
5. 🔧 Tweak danger threshold → Change `live_stream_handler.py:355` (currently 70%)

---

## Support

**Documentation:**
- Main guide: `CLAUDE.md`
- Architecture: `ARCHITECTURE.md`
- Archive: `archive/twilio/README.md`

**Logs to check:**
- Python service terminal
- Node.js server terminal
- Browser console (F12)
- Network tab for failed requests

**Common fixes:**
```bash
# Restart Python service
pkill -f live_stream_handler.py
python3 python/live_stream_handler.py

# Restart Node server
# Ctrl+C in terminal
npm run server

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```
