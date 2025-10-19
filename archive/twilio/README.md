# Twilio Integration Archive

**Archived on:** October 19, 2025
**Reason:** Replaced with web-based ElevenLabs voice agent

## What Was This?

This folder contains the original Twilio phone call integration that was used to trigger real phone calls when the panic codeword was detected.

### Original Architecture

```
Codeword Detected → Node.js Backend → Twilio API → Real Phone Call → TwiML → Audio Playback
```

### Files Archived

- `services/twilio-caller.js` - Service for triggering Twilio voice calls and serving TwiML

## Why Was It Replaced?

The system was migrated to a **pure web-based voice agent** using ElevenLabs for several reasons:

1. **No External Phone Service Required** - Works entirely in the browser
2. **Faster Response Time** - No phone network latency
3. **Better Privacy** - No third-party phone service involved
4. **More Natural Conversations** - Real-time bidirectional voice agent
5. **Cost Effective** - No phone call charges
6. **Cross-Platform** - Works on any device with a browser

## New Architecture

```
Codeword Detected → Browser FakeCallUI → ElevenLabs Conversational Agent → In-Browser Audio
```

### New Components

- `components/FakeCallUI.tsx` - iPhone-style fake call interface
- `python/live_stream_handler.py` - ElevenLabs TTS integration with conversational agent
- `/api/live/converse` - Bidirectional voice conversation endpoint
- `/api/live/elevenlabs-audio` - TTS audio generation endpoint

## If You Need to Restore Twilio

1. Copy `services/twilio-caller.js` back to `server/services/`
2. Uncomment Twilio environment variables in `.env.local`
3. Restore Twilio config exports in `server/config.js`
4. Re-enable call triggering in `server/routes/live-session.js`
5. Add voice routes back to Express router
6. Install dependencies: `npm install twilio`

## References

- Original implementation: See git history before October 19, 2025
- Twilio Voice API: https://www.twilio.com/docs/voice
- TwiML Reference: https://www.twilio.com/docs/voice/twiml
