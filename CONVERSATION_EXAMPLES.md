# 🗣️ Alex Voice Agent - Natural Conversation Examples

## How It Works
1. **You speak** → Web Speech API captures your words
2. **After 2 seconds of silence** → Your speech is sent to Alex
3. **Alex responds** → Natural, context-aware response
4. **Alex finishes** → Automatically starts listening again
5. **Loop continues** → Natural back-and-forth conversation!

---

## Sample Conversations

### 🔍 Asking Where Alex Is
**YOU SAY**: "Where are you?" / "Where are you located?" / "What's your location?"

**ALEX RESPONDS** (one of):
- "I'm at the ferry building main entrance. My car died and I'm stranded!"
- "Right at the ferry building plaza. Can you come now? My phone's dying."
- "Ferry building by the water. I really need you to leave and come get me right now."

---

### ⏰ Asking to Wait
**YOU SAY**: "Can you wait?" / "I'm busy" / "Give me a minute" / "Can it wait?"

**ALEX RESPONDS** (one of):
- "No dude, I can't wait. It's getting dark and sketchy here. Please come NOW."
- "I know you're busy but this is urgent. I wouldn't call unless I really needed help. Please?"
- "Come on, just leave what you're doing. This is serious, I'm stuck here alone."

---

### ❓ Asking What Happened
**YOU SAY**: "What happened?" / "What's wrong?" / "Why do you need help?"

**ALEX RESPONDS** (one of):
- "My car completely died, won't start. Triple A can't come for hours. Can you leave and pick me up?"
- "Engine just gave out. I'm stranded and it's getting late. Need you to come get me right now!"
- "Everything went wrong with the car. I need you to drop everything and come help me, okay?"

---

### ✅ Agreeing to Help
**YOU SAY**: "Okay I'm coming" / "Yes I'll be there" / "Sure, on my way" / "Alright"

**ALEX RESPONDS** (one of):
- "Thank you so much! Hurry please, I'll be at the main entrance waiting for you!"
- "Yes! Thank you. I'm right by the entrance, you'll see me. Come quick!"
- "Awesome, you're the best. I'm waiting right outside the main building."

---

### 💬 Other Phrases
**YOU SAY**: Anything else

**ALEX RESPONDS** (one of):
- "Look, I really need your help right now. Can you please just leave and come meet me?"
- "This is urgent. Can you drop what you're doing and come help me? Please?"
- "I wouldn't ask if it wasn't important. I need you to come right now, okay?"

---

## Tips for Natural Conversation

✅ **DO**:
- Speak clearly and at normal volume
- Wait for the "🎧 Listening..." indicator
- Pause for 2 seconds after you finish speaking
- Let Alex finish speaking before responding

❌ **DON'T**:
- Interrupt Alex while speaking
- Speak too quietly
- Rush your words
- Expect instant response (2-second pause needed)

---

## Visual Indicators

| Status | What It Means | What To Do |
|--------|---------------|------------|
| 🗣️ Speaking... | Alex is talking | Wait and listen |
| 🎧 Listening... | Waiting for you | Speak now! |
| ✅ Connected | Ready to chat | - |

---

## Troubleshooting

**Alex doesn't respond?**
- Make sure you see "🎧 Listening..."
- Speak clearly
- Wait 2 seconds of silence after speaking
- Check browser console for errors

**Can't hear Alex?**
- Check phone volume is up
- Check browser didn't mute the tab
- Try tapping screen to ensure audio is active

**Speech recognition not working?**
- Use Chrome, Edge, or Safari (required)
- Allow microphone permissions
- Check microphone is not muted

---

## The Magic Behind It

1. **Speech Recognition**: Browser's built-in Web Speech API
2. **Smart Responses**: Context-aware pre-scripted responses (no API delays!)
3. **Text-to-Speech**: gTTS (Google Text-to-Speech) with Adam's voice
4. **Auto-Loop**: Automatically restarts listening after each response

---

**Result**: Feels like a real phone conversation! 📞✨
