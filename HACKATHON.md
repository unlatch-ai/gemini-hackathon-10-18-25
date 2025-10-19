# Live Safety Monitor - Gemini Hackathon 2025 Submission

## Project Overview

**Live Safety Monitor** is a real-time personal safety application that uses a **multi-agent Gemini AI system** to detect dangerous situations and automatically trigger emergency response through fake phone calls.

**Problem:** People in uncomfortable or dangerous situations (bad dates, harassment, coercion) often can't explicitly ask for help without escalating the danger.

**Solution:** Our multi-agent AI continuously monitors conversations, detects danger through context and emotion analysis, and automatically triggers a fake phone call as a natural escape route.

## Multi-Agent Architecture

### Why Multi-Agent?

Instead of a single AI making all decisions, we use **4 specialized Gemini 2.5 Flash agents** that collaborate to analyze different dimensions of danger:

```
User Conversation (10-second buffer)
          ↓
┌─────────────────────────────────────┐
│   Multi-Agent Collaborative System   │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Agent 1: Transcript Analyzer    │ │ → 📝 Literal content
│  │ Agent 2: Emotional Detector     │ │ → 😰 Emotional state
│  │ Agent 3: Context Interpreter    │ │ → 🔍 Social dynamics
│  └─────────────────────────────────┘ │
│           ↓        ↓        ↓          │
│  ┌─────────────────────────────────┐ │
│  │ Agent 4: Threat Assessor        │ │ → ⚖️  Final decision
│  │ (Meta-Agent Coordinator)        │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
          ↓
   Danger Score (0-100)
          ↓
   If ≥70% → Emergency Call
```

### Agent Specializations

#### Agent 1: Transcript Analyzer 📝
**Role:** Analyzes literal words and explicit content

**Detects:**
- Explicit threats or aggressive language
- Direct requests for help
- Attempts to leave or end conversation
- Mentions of danger, fear, discomfort

**Gemini Prompt:**
```
You are a TRANSCRIPT ANALYSIS AGENT. Analyze ONLY literal content:
- Explicit threats or aggressive language
- Direct requests for help
Rate danger based on LITERAL CONTENT ONLY from 0-100.
```

#### Agent 2: Emotional State Detector 😰
**Role:** Detects emotional distress through language patterns

**Detects:**
- Signs of stress, fear, anxiety
- Nervousness or hesitation in speech
- Passive-aggressive language
- Coded distress signals

**Gemini Prompt:**
```
You are an EMOTIONAL ANALYSIS AGENT. Analyze ONLY emotional indicators:
- Signs of stress, fear, or anxiety
- Nervousness or hesitation
- Emotional distress signals
Rate danger based on EMOTIONAL STATE from 0-100.
```

#### Agent 3: Context Interpreter 🔍
**Role:** Understands social dynamics and situational context

**Detects:**
- Power dynamics between speakers
- Signs of coercion or manipulation
- Social pressure or uncomfortable situations
- Situational red flags

**Gemini Prompt:**
```
You are a CONTEXT ANALYSIS AGENT. Analyze ONLY contextual factors:
- Power dynamics between speakers
- Signs of coercion or manipulation
- Social pressure or uncomfortable situations
Rate danger based on CONTEXTUAL ANALYSIS from 0-100.
```

#### Agent 4: Threat Assessor (Meta-Agent) ⚖️
**Role:** Synthesizes all agent inputs to make final decision

**Process:**
- Receives scores from all 3 specialist agents
- Analyzes agreement/disagreement patterns
- Considers which dimensions are triggering
- Makes final threat assessment (0-100)
- Triggers emergency response if ≥70%

**Gemini Prompt:**
```
You are the THREAT ASSESSMENT COORDINATOR. Synthesize analysis from:
- Transcript Analysis Agent: X/100 (literal content)
- Emotional State Agent: Y/100 (emotional distress)
- Context Analysis Agent: Z/100 (situational factors)

Synthesize into final danger score considering:
- Are all agents in agreement? (high confidence)
- Is one agent detecting something others missed?
- What's the overall pattern?
```

### Benefits of Multi-Agent Approach

1. **Reduced False Positives**: Each agent specializes → more accurate than single general-purpose AI
2. **Higher Accuracy**: Meta-agent synthesizes multiple perspectives → catches danger signals across dimensions
3. **Explainable AI**: Users see individual agent scores → build trust through transparency
4. **Robust Detection**: Can't miss danger if it shows up in ANY dimension (emotional, literal, or contextual)
5. **Parallel Processing**: All 3 specialist agents run simultaneously → fast analysis

## Technical Implementation

### System Architecture

```
Smartphone Browser
    ↓ Web Speech API (Speech-to-Text)
Frontend (React + Vite)
    ↓ WebSocket (via ngrok)
Node.js Backend
    ↓ HTTP API
Python Service (aiohttp)
    ↓ 4 Parallel API Calls
Gemini 2.5 Flash Multi-Agent System
    ↓ If danger ≥70%
Twilio Voice API (Fake Call)
```

### Code Walkthrough

**Multi-Agent Implementation** ([python/live_stream_handler.py:231-396](python/live_stream_handler.py#L231-L396))

```python
async def _analyze_conversation_safety(self, conversation):
    """Multi-agent collaborative analysis system"""
    logger.info("🤝 Starting multi-agent collaborative analysis...")

    # Run all 3 specialist agents IN PARALLEL for efficiency
    results = await asyncio.gather(
        self._agent_transcript_analyzer(conversation),
        self._agent_emotional_detector(conversation),
        self._agent_context_interpreter(conversation),
        return_exceptions=True
    )

    transcript_score, emotional_score, context_score = results

    logger.info(f"📊 Agent Scores - Transcript: {transcript_score}, "
                f"Emotional: {emotional_score}, Context: {context_score}")

    # Meta-agent synthesizes all inputs
    final_score = await self._agent_threat_assessor(
        conversation,
        transcript_score,
        emotional_score,
        context_score
    )

    return final_score, agent_breakdown
```

**Frontend Multi-Agent Display** ([components/SafetyRecorder.tsx:342-369](components/SafetyRecorder.tsx#L342-L369))

Shows all 4 agent scores in real-time for transparency:
- Transcript Agent: X%
- Emotional Agent: Y%
- Context Agent: Z%
- **Threat Assessor: FINAL%** (highlighted)

### Technology Stack

- **AI:** Gemini 2.5 Flash (4 instances per analysis)
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + WebSocket
- **Python:** aiohttp + google-genai SDK
- **Voice:** Twilio Voice API
- **Speech:** Web Speech API (browser-native)
- **Infrastructure:** ngrok for phone access

## Gemini API Usage

### 4 Gemini Instances Per Analysis

Every 10 seconds, we make **4 parallel Gemini API calls**:

1. **Transcript Analyzer**: `gemini-2.5-flash` with transcript analysis prompt
2. **Emotional Detector**: `gemini-2.5-flash` with emotional analysis prompt
3. **Context Interpreter**: `gemini-2.5-flash` with context analysis prompt
4. **Threat Assessor**: `gemini-2.5-flash` with meta-analysis prompt (receives other 3 scores)

### Why Gemini 2.5 Flash?

- **Speed**: Sub-second response time for real-time safety monitoring
- **Accuracy**: Excellent at nuanced language understanding
- **Cost-Effective**: Flash model allows 4 concurrent calls every 10s
- **Context Window**: Large enough for conversation buffer analysis

### Prompt Engineering

Each agent has a **highly specialized system instruction** that:
- Clearly defines its specific role
- Limits its analysis to one dimension only
- Requires numeric output (0-100) for meta-agent synthesis
- Prevents overlap with other agents

Example: Emotional Agent is told to **ONLY** analyze emotions, not literal content. This specialization improves accuracy.

## Demo Scenario

### Use Case: Bad Date

**Situation:** User is on a date that becomes uncomfortable. They can't explicitly say "I need help" without escalating.

**Conversation (10-second buffer):**
> "Um, I'm not really comfortable with this... can we maybe slow down? I think I should probably go soon..."

**Multi-Agent Analysis:**

| Agent | Score | Reasoning |
|-------|-------|-----------|
| 📝 Transcript | 45% | Mentions wanting to leave, but polite |
| 😰 Emotional | 75% | High nervousness, hesitation, discomfort |
| 🔍 Context | 80% | Power imbalance, pressure situation |
| ⚖️ Assessor | **78%** | **Emotional + Context high → TRIGGER** |

**Result:** Emergency call triggered at 78% confidence (≥70% threshold)

**Why Multi-Agent Wins:**
- Single AI might miss this (no explicit threats)
- Transcript agent alone: 45% (below threshold)
- But emotional + context agents caught the danger
- Meta-agent synthesized: "2 out of 3 agents agree = high confidence"

## Innovation & Impact

### Novel Contributions

1. **First Multi-Agent Safety System**: No existing panic button uses collaborative AI agents
2. **Emotional Intelligence**: Goes beyond keyword detection to understand feelings
3. **Context-Aware**: Understands social dynamics and power imbalances
4. **Explainable AI**: Users see exactly why the system made its decision
5. **Privacy-First**: 10-second buffers, no permanent storage

### Real-World Impact

**Target Users:**
- People on first dates (especially from dating apps)
- Individuals in uncomfortable social situations
- Anyone experiencing harassment or pressure
- People in situations where explicit help requests escalate danger

**Why It Matters:**
- **1 in 3 women** experience harassment or violence
- Traditional panic buttons are too obvious
- Many victims can't explicitly ask for help
- AI can detect danger even when victims can't say it

## Hackathon Requirements Checklist

✅ **Uses Gemini 2.5 Flash**: All 4 agents use latest Gemini model
✅ **Multi-Agent System**: 4 specialized agents + meta-agent coordinator
✅ **Real-Time Processing**: Analyzes conversations every 10 seconds
✅ **Practical Use Case**: Solves real personal safety problem
✅ **Advanced Prompting**: Specialized system instructions per agent
✅ **API Integration**: Twilio voice triggered by AI decisions
✅ **Innovative Architecture**: First collaborative multi-agent safety system
✅ **Code Quality**: Clean, documented, production-ready architecture
✅ **Demo-Ready**: Works on smartphone via ngrok, visual agent scores

## Future Enhancements

- **Video Analysis Agent**: 5th agent analyzing facial expressions via Gemini multimodal
- **Location Agent**: Detects unsafe locations and shares with emergency contacts
- **Historical Pattern Agent**: Learns from past incidents to improve detection
- **Multi-Language Support**: Agents analyze conversations in any language
- **Emergency Services Integration**: Auto-contact 911 in high-danger situations (95%+)

## Conclusion

**Live Safety Monitor** demonstrates the power of **multi-agent AI collaboration** to solve a critical real-world problem. By using **4 specialized Gemini agents** working together, we achieve:

- Higher accuracy than single-agent systems
- Transparent, explainable AI decisions
- Real-time danger detection across multiple dimensions
- A practical tool that could save lives

The multi-agent approach is the future of AI safety systems - and we built it with Gemini 2.5 Flash.

---

## Running the Demo

```bash
# 1. Install dependencies
npm install
cd python && pip install -r requirements.txt && cd ..

# 2. Configure .env.local with your API keys
# 3. Start all services
./start-all.sh

# 4. Access via ngrok for phone testing
ngrok http 3000
```

**Demo Flow:**
1. Open ngrok URL on smartphone
2. Start recording
3. Say something concerning (e.g., "I'm really uncomfortable and want to leave")
4. Watch multi-agent analysis appear in real-time
5. Receive emergency call when danger ≥70%

---

**Built with ❤️ and 4 Gemini Agents for Gemini Hackathon 2025**
