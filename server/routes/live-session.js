import express from 'express';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import { config } from '../config.js';
import twilioCaller from '../services/twilio-caller.js';
import { addMessage, addRequest } from '../storage.js';

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
    ws.send(JSON.dumps({
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

          case 'stop_recording':
            await handleStopRecording(sessionId);
            break;

          default:
            console.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.dumps({
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

    ws.send(JSON.dumps({
      type: 'recording_started',
      sessionId: sessionId,
      message: 'Recording started - monitoring for panic codeword'
    }));
  } catch (error) {
    console.error('Error starting Python session:', error.message);
    ws.send(JSON.dumps({
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

// Webhook endpoint for Python to notify when codeword is detected
router.post('/codeword-detected', async (req, res) => {
  const { session_id, detected_phrase, confidence, timestamp } = req.body;

  console.log(`🚨 CODEWORD DETECTED! Session: ${session_id}`);
  console.log(`   Phrase: "${detected_phrase}"`);
  console.log(`   Confidence: ${confidence}`);

  // Get the WebSocket connection for this session
  const ws = activeConnections.get(session_id);

  if (ws && ws.readyState === 1) {  // 1 = OPEN
    // Notify frontend immediately
    ws.send(JSON.dumps({
      type: 'codeword_detected',
      sessionId: session_id,
      phrase: detected_phrase,
      confidence: confidence,
      timestamp: timestamp || new Date().toISOString()
    }));

    // Trigger Twilio call
    try {
      const callResult = await twilioCaller.triggerFakeCall(session_id, 'mom');

      if (callResult.success) {
        console.log(`✅ Emergency call triggered! Call SID: ${callResult.callSid}`);

        ws.send(JSON.dumps({
          type: 'call_triggered',
          sessionId: session_id,
          callSid: callResult.callSid,
          scenario: callResult.scenario
        }));

        // Store the event
        const message = {
          id: session_id,
          from: 'safety_system',
          timestamp: new Date().toISOString(),
          text: `Panic codeword detected: "${detected_phrase}"`,
          analysis: {
            requestType: 'Safety Alert',
            location: 'Unknown',
            details: `Codeword "${detected_phrase}" triggered emergency call`,
            confidence: confidence
          },
          automationLog: [
            `[${timestamp}] Codeword detected: "${detected_phrase}"`,
            `[${timestamp}] Confidence: ${confidence}`,
            `[${timestamp}] Triggering emergency call...`,
            `[${timestamp}] Call initiated: ${callResult.callSid}`
          ]
        };

        addMessage(message);

        const request = {
          id: `req_${Date.now()}`,
          messageId: session_id,
          requestType: 'Emergency Call Triggered',
          status: 'Submitted',
          submittedAt: new Date().toISOString(),
          sf311CaseId: callResult.callSid
        };

        addRequest(request);
      } else {
        console.error(`❌ Failed to trigger call: ${callResult.error}`);
        ws.send(JSON.dumps({
          type: 'call_failed',
          sessionId: session_id,
          error: callResult.error
        }));
      }
    } catch (error) {
      console.error('Error triggering call:', error);
      ws.send(JSON.dumps({
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
