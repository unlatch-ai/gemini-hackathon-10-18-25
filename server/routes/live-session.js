import express from 'express';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import { config } from '../config.js';
import twilioCaller from '../services/twilio-caller.js';

const router = express.Router();

// Store active WebSocket connections
const activeConnections = new Map();

// Create WebSocket server (will be attached to HTTP server)
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/live-session' });

  console.log('📡 WebSocket server created at /ws/live-session');

  wss.on('connection', (ws, req) => {
    const sessionId = `session_${Date.now()}`;
    console.log(`🔌 New WebSocket connection: ${sessionId}`);

    activeConnections.set(sessionId, ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: sessionId,
      message: 'Connected to safety monitoring system'
    }));

    // Handle incoming messages from frontend
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'start_recording':
            await handleStartRecording(sessionId, ws);
            break;

          case 'audio_chunk':
            await handleAudioChunk(sessionId, data.audio);
            break;

          case 'video_chunk':
            await handleVideoChunk(sessionId, data.video);
            break;

          case 'trigger_codeword':
            await handleTriggerCodeword(sessionId, data.text);
            break;

          case 'stop_recording':
            await handleStopRecording(sessionId);
            break;

          default:
            console.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket disconnected: ${sessionId}`);
      activeConnections.delete(sessionId);
      // Clean up Python session
      handleStopRecording(sessionId).catch(console.error);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${sessionId}:`, error);
    });
  });

  return wss;
}

async function handleStartRecording(sessionId, ws) {
  console.log(`▶️  Starting recording session: ${sessionId}`);

  try {
    // Start Python Gemini Live session
    const response = await axios.post(`${config.PYTHON_SERVICE_URL}/session/start`, {
      session_id: sessionId
    });

    console.log(`✅ Python session started:`, response.data);

    // Start listening for codeword detections from Python
    startListeningForCodeword(sessionId, ws);

    ws.send(JSON.stringify({
      type: 'recording_started',
      sessionId: sessionId,
      message: 'Recording started - monitoring for panic codeword'
    }));
  } catch (error) {
    console.error('Error starting Python session:', error.message);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to start recording: ${error.message}`
    }));
  }
}

async function handleAudioChunk(sessionId, audioData) {
  try {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Forward to Python service
    await axios.post(
      `${config.PYTHON_SERVICE_URL}/session/${sessionId}/audio`,
      audioBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    );
  } catch (error) {
    console.error(`Error sending audio for ${sessionId}:`, error.message);
  }
}

async function handleVideoChunk(sessionId, videoData) {
  try {
    // For MVP: Extract audio from video chunk and send to Gemini
    // The video/webm container includes audio - we'll send it as-is
    // and let the Python service extract the audio track
    const videoBuffer = Buffer.from(videoData, 'base64');

    // Send to Python service (will extract audio and send to Gemini)
    await axios.post(
      `${config.PYTHON_SERVICE_URL}/session/${sessionId}/video`,
      videoBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      }
    );
  } catch (error) {
    console.error(`Error sending video for ${sessionId}:`, error.message);
  }
}

async function handleTriggerCodeword(sessionId, text) {
  console.log(`🚨 Manual codeword trigger for ${sessionId}: "${text}"`);

  try {
    // Send text to Python service
    await axios.post(
      `${config.PYTHON_SERVICE_URL}/session/${sessionId}/text`,
      { text },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Text sent to Gemini`);
  } catch (error) {
    console.error(`Error sending text for ${sessionId}:`, error.message);
  }
}

async function handleStopRecording(sessionId) {
  console.log(`⏹️  Stopping recording session: ${sessionId}`);

  try {
    await axios.post(`${config.PYTHON_SERVICE_URL}/session/${sessionId}/stop`);
    console.log(`✅ Python session stopped`);
  } catch (error) {
    console.error('Error stopping Python session:', error.message);
  }
}

// Poll Python service for codeword detections
function startListeningForCodeword(sessionId, ws) {
  // In a real implementation, the Python service would push events via WebSocket or HTTP callback
  // For MVP, we'll have Python call a webhook when codeword is detected
  // For now, this is a placeholder - the actual detection happens in Python
  console.log(`👂 Listening for codeword in session ${sessionId}`);
}

// Webhook endpoint for Python to notify about analysis events
router.post('/codeword-detected', async (req, res) => {
  const { type, session_id, detected_phrase, confidence, timestamp, danger_score, agent_scores } = req.body;

  // Get the WebSocket connection for this session
  const ws = activeConnections.get(session_id);

  if (!ws || ws.readyState !== 1) {
    return res.status(404).json({ error: 'WebSocket not found or not open' });
  }

  // Handle different event types
  if (type === 'analysis_started') {
    console.log(`🤖 Analysis started for session ${session_id}`);
    ws.send(JSON.stringify({
      type: 'analysis_started',
      sessionId: session_id
    }));
    return res.json({ status: 'notified' });
  }

  if (type === 'analysis_complete') {
    console.log(`📊 Analysis complete for session ${session_id}: ${danger_score}/100`);
    ws.send(JSON.stringify({
      type: 'analysis_complete',
      sessionId: session_id,
      dangerScore: danger_score,
      agentScores: agent_scores
    }));
    return res.json({ status: 'notified' });
  }

  // Original codeword detection (danger ≥70%)
  console.log(`🚨 CODEWORD DETECTED! Session: ${session_id}`);
  console.log(`   Phrase: "${detected_phrase}"`);
  console.log(`   Confidence: ${confidence}`);

  if (ws && ws.readyState === 1) {  // 1 = OPEN
    // Notify frontend immediately
    ws.send(JSON.stringify({
      type: 'codeword_detected',
      sessionId: session_id,
      phrase: detected_phrase,
      confidence: confidence,
      timestamp: timestamp || new Date().toISOString(),
      agentScores: agent_scores  // Include agent breakdown
    }));

    // Trigger Twilio call
    try {
      const callResult = await twilioCaller.triggerFakeCall(session_id, 'mom');

      if (callResult.success) {
        console.log(`✅ Emergency call triggered! Call SID: ${callResult.callSid}`);

        ws.send(JSON.stringify({
          type: 'call_triggered',
          sessionId: session_id,
          callSid: callResult.callSid,
          scenario: callResult.scenario
        }));

        // Log the emergency event (in production, save to database)
        console.log(`📋 Emergency Response Log:
          Session: ${session_id}
          Detected: "${detected_phrase}"
          Confidence: ${Math.round(confidence * 100)}%
          Call SID: ${callResult.callSid}
          Timestamp: ${timestamp}
        `);
      } else {
        console.error(`❌ Failed to trigger call: ${callResult.error}`);
        ws.send(JSON.stringify({
          type: 'call_failed',
          sessionId: session_id,
          error: callResult.error
        }));
      }
    } catch (error) {
      console.error('Error triggering call:', error);
      ws.send(JSON.stringify({
        type: 'call_failed',
        sessionId: session_id,
        error: error.message
      }));
    }
  }

  res.json({ status: 'processed', session_id });
});

// Twilio voice webhook (serves TwiML)
router.post('/voice', (req, res) => {
  const scenario = req.query.scenario || 'mom';
  console.log(`📞 Twilio voice webhook called with scenario: ${scenario}`);

  const twiml = twilioCaller.getTwiML(scenario);
  res.type('text/xml');
  res.send(twiml);
});

// Twilio status callback
router.post('/status', (req, res) => {
  const { CallSid, CallStatus, From, To } = req.body;
  console.log(`📊 Call ${CallSid} status: ${CallStatus} (${From} → ${To})`);
  res.sendStatus(200);
});

export default router;
