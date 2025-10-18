# Implementation Roadmap

## Overview

This document outlines the step-by-step implementation plan for converting the SF 311 WhatsApp Bot into a Live Video Safety Application with panic codeword detection.

## Current State (✅ Complete)

- ✅ React frontend with dashboard
- ✅ Node.js/Express backend
- ✅ Gemini AI integration (text-based)
- ✅ Twilio integration (WhatsApp messaging)
- ✅ Real-time data flow (polling)
- ✅ Documentation updated (README, CLAUDE.md, ARCHITECTURE.md)

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Python Microservice Setup
**Priority**: HIGH
**Estimated Time**: 2-3 days

- [ ] Create `python/` directory structure
- [ ] Set up Python virtual environment
- [ ] Install dependencies (`google-genai`, `asyncio`, `websockets`)
- [ ] Create `live_stream_handler.py` base class
- [ ] Implement Gemini Live API connection
- [ ] Test basic audio streaming with Gemini

**Files to Create**:
- `python/live_stream_handler.py`
- `python/requirements.txt`
- `python/config.py`
- `python/test_connection.py`

**Success Criteria**:
- Python service can connect to Gemini Live API
- Can send test audio and receive responses
- Proper error handling and logging

### 1.2 WebSocket Proxy Layer
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Install `ws` library in Node.js
- [ ] Create WebSocket server in `server/index.js`
- [ ] Implement client connection handling
- [ ] Create proxy to Python service (HTTP or IPC)
- [ ] Add session state management

**Files to Create/Modify**:
- `server/routes/gemini-live.js`
- `server/services/websocket-manager.js`
- Modify `server/index.js`

**Success Criteria**:
- Frontend can establish WebSocket connection
- Audio data proxies through Node.js to Python
- Responses flow back to frontend

### 1.3 Audio Processing Pipeline
**Priority**: HIGH
**Estimated Time**: 3 days

- [ ] Research browser audio capture APIs
- [ ] Implement MediaRecorder in frontend
- [ ] Convert browser audio to 16-bit PCM, 16kHz
- [ ] Create audio chunking (100-200ms chunks)
- [ ] Implement audio buffering for network issues

**Files to Create**:
- `utils/audio-processor.ts`
- `utils/pcm-converter.ts`
- `hooks/useAudioRecorder.ts`

**Success Criteria**:
- Can capture audio from smartphone microphone
- Audio properly formatted for Gemini Live API
- Smooth streaming without dropouts

## Phase 2: Panic Detection System (Week 2)

### 2.1 Gemini Function Calling Setup
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Define `trigger_emergency_call()` function declaration
- [ ] Configure system instruction for codeword monitoring
- [ ] Implement function call detection in Python service
- [ ] Create event notification system to Node.js

**Files to Modify**:
- `python/live_stream_handler.py`
- `server/services/codeword-detector.js`

**Success Criteria**:
- Gemini detects configured codeword
- Function call triggered within 2-3 seconds
- Backend receives notification

### 2.2 Codeword Configuration
**Priority**: MEDIUM
**Estimated Time**: 1 day

- [ ] Create codeword management UI
- [ ] Allow multiple codewords per user
- [ ] Implement case-sensitive/insensitive options
- [ ] Add partial match vs exact match
- [ ] Test with various accents and speech patterns

**Files to Create**:
- `components/CodewordSettings.tsx`
- `server/routes/codewords.js`

**Success Criteria**:
- Users can configure custom codewords
- Settings persist across sessions
- Works with natural speech variations

### 2.3 Real-time Status Updates
**Priority**: MEDIUM
**Estimated Time**: 1 day

- [ ] Implement WebSocket events for status
- [ ] Show "Monitoring..." indicator
- [ ] Display "Codeword Detected!" alert
- [ ] Add audio/visual feedback

**Files to Modify**:
- `components/SessionDashboard.tsx`
- `App.tsx`

**Success Criteria**:
- User sees clear status indicators
- Instant feedback when codeword detected
- No UI lag during streaming

## Phase 3: Twilio Voice Integration (Week 3)

### 3.1 Voice Call Trigger
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Create Twilio voice call service
- [ ] Implement call initiation endpoint
- [ ] Configure call parameters (from/to numbers)
- [ ] Add call status tracking

**Files to Create**:
- `server/services/twilio-caller.js`
- `server/routes/twilio-voice.js`

**Success Criteria**:
- Call triggers within 2-3 seconds of codeword
- Proper error handling if call fails
- Status updates to frontend

### 3.2 TwiML Script System
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Create multiple fake call scenarios
- [ ] Implement dynamic TwiML generation
- [ ] Add voice selection (male/female, different accents)
- [ ] Configure call duration and pauses

**Scenarios to Implement**:
- [ ] Mom/parent emergency
- [ ] Friend car breakdown
- [ ] Work emergency
- [ ] Doctor appointment reminder
- [ ] Custom user-defined scripts

**Files to Create**:
- `server/twiml-scenarios/*.xml`
- `server/services/twiml-generator.js`

**Success Criteria**:
- Realistic conversation flow
- Natural pauses and timing
- User can choose scenario in settings

### 3.3 Call Customization
**Priority**: MEDIUM
**Estimated Time**: 1 day

- [ ] UI for scenario selection
- [ ] Allow users to preview scenarios
- [ ] Enable custom script creation
- [ ] Voice customization options

**Files to Create**:
- `components/CallScenarioSelector.tsx`

**Success Criteria**:
- Easy scenario selection
- Preview before use
- Customizable scripts

## Phase 4: Video Integration (Week 4)

### 4.1 Video Capture
**Priority**: MEDIUM
**Estimated Time**: 2 days

- [ ] Implement video recording alongside audio
- [ ] Configure video quality settings
- [ ] Add video preview to UI
- [ ] Implement video/audio toggle

**Files to Create/Modify**:
- `components/VideoRecorder.tsx`
- `utils/video-processor.ts`

**Success Criteria**:
- Can capture video from smartphone camera
- Video streams to backend
- Option to disable video (audio-only mode)

### 4.2 Video Processing
**Priority**: LOW
**Estimated Time**: 2 days

- [ ] Convert video to supported format (WebM/H.264)
- [ ] Implement video chunking
- [ ] Send video frames to Gemini Live API
- [ ] Handle video in Python service

**Success Criteria**:
- Video properly formatted
- Smooth streaming
- Gemini can process video (optional feature)

## Phase 5: Post-Recording Analysis (Week 5)

### 5.1 Transcript Extraction
**Priority**: HIGH
**Estimated Time**: 1 day

- [ ] Enable transcript generation in Gemini
- [ ] Store transcript during session
- [ ] Display transcript in UI after recording

**Files to Create/Modify**:
- `server/services/transcript-manager.js`
- `components/TranscriptView.tsx`

**Success Criteria**:
- Accurate transcription
- Properly formatted output
- Viewable after session ends

### 5.2 Incident Categorization
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Create categorization prompt for Gemini
- [ ] Implement police/311/safety classification
- [ ] Generate structured reports
- [ ] Add severity assessment

**Files to Create**:
- `server/services/post-analysis.js`
- `components/IncidentReport.tsx`

**Success Criteria**:
- Accurate categorization (>90% accuracy)
- Useful recommendations
- Downloadable reports

### 5.3 Report Generation
**Priority**: MEDIUM
**Estimated Time**: 2 days

- [ ] Create report templates
- [ ] Generate PDF/JSON exports
- [ ] Email report option
- [ ] Share with authorities option

**Files to Create**:
- `server/services/report-generator.js`
- `utils/pdf-generator.ts`

**Success Criteria**:
- Professional-looking reports
- Multiple export formats
- Easy sharing

## Phase 6: UI/UX Polish (Week 6)

### 6.1 Mobile Optimization
**Priority**: HIGH
**Estimated Time**: 3 days

- [ ] Responsive design for all screen sizes
- [ ] Large touch targets
- [ ] Optimized for one-handed use
- [ ] Test on iOS and Android

**Success Criteria**:
- Works well on phones 5" - 7" screens
- No accidental taps
- Fast load times on mobile network

### 6.2 Recording Interface
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Create VideoRecorder component
- [ ] Add start/stop recording buttons
- [ ] Show recording duration timer
- [ ] Visual indicators for status

**Files to Create**:
- `components/VideoRecorder.tsx`
- `components/RecordingControls.tsx`

**Success Criteria**:
- Intuitive interface
- Clear visual feedback
- Minimal distractions

### 6.3 Dashboard Redesign
**Priority**: MEDIUM
**Estimated Time**: 2 days

- [ ] Update dashboard for safety monitoring
- [ ] Remove 311-specific components
- [ ] Add session history view
- [ ] Create incident reports list

**Files to Modify**:
- `App.tsx`
- `components/SessionDashboard.tsx`
- `components/IncidentReports.tsx`

**Success Criteria**:
- Clean, modern design
- Easy navigation
- Quick access to important features

## Phase 7: Testing & Security (Week 7)

### 7.1 End-to-End Testing
**Priority**: HIGH
**Estimated Time**: 3 days

- [ ] Test full recording flow
- [ ] Test codeword detection accuracy
- [ ] Test call trigger reliability
- [ ] Test on multiple devices/browsers

**Test Scenarios**:
- [ ] Happy path: Record → Say codeword → Receive call
- [ ] Network interruption during recording
- [ ] Multiple codewords in one session
- [ ] Background noise interference
- [ ] Low network bandwidth

### 7.2 Security Audit
**Priority**: HIGH
**Estimated Time**: 2 days

- [ ] Implement ephemeral tokens for Gemini
- [ ] Secure Twilio credentials
- [ ] Add rate limiting
- [ ] Encrypt stored data
- [ ] HTTPS/WSS everywhere

**Success Criteria**:
- No credentials exposed in frontend
- All connections encrypted
- Protection against abuse

### 7.3 Performance Testing
**Priority**: MEDIUM
**Estimated Time**: 1 day

- [ ] Test latency (codeword → call trigger)
- [ ] Test concurrent sessions
- [ ] Optimize audio buffering
- [ ] Profile CPU/memory usage

**Success Criteria**:
- Codeword detection < 3 seconds
- Handle 10+ concurrent sessions
- Low battery drain on mobile

## Phase 8: Deployment (Week 8)

### 8.1 Production Setup
**Priority**: HIGH
**Estimated Time**: 3 days

- [ ] Deploy to Railway/Render
- [ ] Configure environment variables
- [ ] Set up database (PostgreSQL)
- [ ] Configure Redis for sessions
- [ ] Set up S3 for recordings

### 8.2 Monitoring & Logging
**Priority**: HIGH
**Estimated Time**: 1 day

- [ ] Set up Sentry for error tracking
- [ ] Configure logging (Winston/Pino)
- [ ] Create monitoring dashboard
- [ ] Set up alerts

### 8.3 Documentation
**Priority**: MEDIUM
**Estimated Time**: 1 day

- [ ] User guide
- [ ] Admin documentation
- [ ] API documentation
- [ ] Troubleshooting guide

## Future Enhancements (Post-Launch)

### Phase 9: Advanced Features
- [ ] Multi-language support
- [ ] Custom voice cloning (ElevenLabs)
- [ ] Live location sharing
- [ ] Silent mode (vibration only)
- [ ] Wearable integration (Apple Watch)
- [ ] AI threat assessment
- [ ] End-to-end encryption
- [ ] Offline mode with local AI

### Phase 10: Enterprise Features
- [ ] Team/organization accounts
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Integration with security services
- [ ] Custom branding
- [ ] SSO/SAML support

## Resource Requirements

### Development Team
- 1 Full-stack developer (Node.js + React)
- 1 Python developer (Gemini Live API)
- 1 Mobile/frontend specialist
- 1 QA engineer

### Tools & Services
- Gemini API quota (estimate 10M tokens/month)
- Twilio account (estimate $100/month for testing)
- Cloud hosting (Railway/Render - $50-100/month)
- Database (PostgreSQL - included in hosting)
- Storage (S3 - $20/month)
- Monitoring (Sentry - free tier initially)

### Estimated Budget
- Development: 8 weeks
- Monthly operational costs: $200-300
- Launch marketing: $1000-2000

## Success Metrics

### Technical KPIs
- Codeword detection accuracy: >95%
- Detection latency: <3 seconds
- Call trigger success rate: >98%
- Session completion rate: >90%
- Uptime: >99.5%

### User Experience KPIs
- Time to start recording: <5 seconds
- User satisfaction: >4.5/5 stars
- Feature adoption: >70% use fake call feature
- Retention: >60% monthly active users

## Risk Mitigation

### Technical Risks
1. **Gemini API latency**: Implement fallback to faster model
2. **Network interruptions**: Offline recording buffer
3. **Twilio call failures**: Retry logic + SMS fallback
4. **Browser compatibility**: Polyfills for older devices

### Legal Risks
1. **Recording consent**: Clear user agreement + warnings
2. **Data privacy**: GDPR/CCPA compliance
3. **Emergency services**: Disclaimer about not replacing 911
4. **Liability**: Terms of service + insurance

### User Safety Risks
1. **False negatives**: Multiple codeword options
2. **Obvious phone use**: Discrete UI design
3. **Battery drain**: Power optimization
4. **Discovery by aggressor**: Camouflage mode

## Next Steps

1. **Review this roadmap** with the team
2. **Prioritize** features based on MVP requirements
3. **Set up development environment** (Phase 1.1)
4. **Create sprint plan** for first 2 weeks
5. **Begin implementation** with Python microservice

## Questions to Answer

- [ ] What's the target launch date?
- [ ] Are we building MVP first or full feature set?
- [ ] What's the budget for Gemini API usage?
- [ ] Do we need legal review before launch?
- [ ] What's the target user demographic?
- [ ] Are there competitors we should analyze?
