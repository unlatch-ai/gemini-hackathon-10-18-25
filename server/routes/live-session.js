import express from 'express';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import { config } from '../config.js';

const router = express.Router();

// New route to proxy audio generation with ElevenLabs
router.get('/elevenlabs-audio', async (req, res) => {
  try {
    const { text, voice } = req.query;
    console.log(`🎙️ ElevenLabs audio request - Text: "${text}", Voice: ${voice || 'default'}`);

    if (!text) {
      console.error('❌ Missing text parameter');
      return res.status(400).send('Missing text parameter');
    }

    console.log(`📡 Forwarding to Python service: ${config.PYTHON_SERVICE_URL}/api/generate-audio`);

    const response = await axios.post(
      `${config.PYTHON_SERVICE_URL}/api/generate-audio`,
      { text, voice },
      {
        responseType: 'stream',
        timeout: 60000 // 60 second timeout for audio generation (ElevenLabs can be slow)
      }
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);

    console.log(`✅ Audio stream sent successfully`);

  } catch (error) {
    console.error('❌ Error proxying audio:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`   Python service not running at ${config.PYTHON_SERVICE_URL}`);
      res.status(503).send('Python service unavailable. Please start it with: python3 python/live_stream_handler.py');
    } else {
      res.status(500).send('Error generating audio: ' + error.message);
    }
  }
});

// Store active WebSocket connections
const activeConnections = new Map();

// Track video frames for periodic analysis
const frameCounters = new Map();
const ANALYZE_EVERY_N_FRAMES = 3;  // Analyze every 3rd frame (~4.5 seconds)

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

          case 'video_frame':
            // Broadcast video frame to all connected clients IMMEDIATELY (no blocking)
            broadcastToAll(data);

            // Analyze frame periodically with Gemini Vision (ASYNC - non-blocking)
            const counter = (frameCounters.get(sessionId) || 0) + 1;
            frameCounters.set(sessionId, counter);

            if (counter % ANALYZE_EVERY_N_FRAMES === 0) {
              // Fire and forget - don't await, don't block the video stream
              setImmediate(() => {
                analyzeFrame(data.sessionId, data.frame).catch(err => {
                  console.error(`Error analyzing frame: ${err.message}`);
                });
              });
            }
            break;

          case 'location_update':
            // Broadcast location update to all connected clients
            broadcastToAll(data);
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

// Analyze video frame with Gemini Vision API
async function analyzeFrame(sessionId, frameData) {
  try {
    console.log(`🔍 Analyzing frame for session ${sessionId}...`);

    const response = await axios.post(
      `${config.PYTHON_SERVICE_URL}/api/analyze-frame`,
      {
        sessionId,
        frame: frameData
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000  // 15 second timeout for AI analysis
      }
    );

    const analysis = response.data;
    console.log(`✅ Frame analysis: ${analysis.analysis.substring(0, 80)}...`);

    // Broadcast analysis results to all connected clients
    broadcastToAll({
      type: 'vision_analysis',
      sessionId,
      analysis: analysis.analysis,
      analyzed: analysis.analyzed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error analyzing frame: ${error.message}`);
  }
}

// Broadcast message to all connected clients
function broadcastToAll(data) {
  const message = JSON.stringify(data);
  let sentCount = 0;

  activeConnections.forEach((client, clientSessionId) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(message);
      sentCount++;
    }
  });

  // Only log occasionally to avoid spam (every 10th frame for video_frame)
  if (data.type !== 'video_frame' || Math.random() < 0.1) {
    console.log(`📤 Broadcast ${data.type} to ${sentCount} clients`);
  }
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

  console.log(`📥 Received codeword-detected notification:`, { type, session_id, detected_phrase, confidence });
  console.log(`   Active connections:`, Array.from(activeConnections.keys()));

  // Get the WebSocket connection for this session
  const ws = activeConnections.get(session_id);

  if (!ws || ws.readyState !== 1) {
    console.error(`❌ WebSocket not found or not open! ws exists: ${!!ws}, readyState: ${ws?.readyState}`);
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
  console.log(`   WebSocket exists: ${!!ws}`);
  console.log(`   WebSocket readyState: ${ws ? ws.readyState : 'N/A'}`);

  if (ws && ws.readyState === 1) {  // 1 = OPEN
    // Notify frontend immediately
    const message = JSON.stringify({
      type: 'codeword_detected',
      sessionId: session_id,
      phrase: detected_phrase,
      confidence: confidence,
      timestamp: timestamp || new Date().toISOString(),
      agentScores: agent_scores  // Include agent breakdown
    });
    console.log(`📤 SENDING WebSocket message to frontend:`, message);
    ws.send(message);
    console.log(`✅ WebSocket message SENT successfully!`);

    // Twilio call triggering disabled - using web-based voice agent instead
    // See /converse endpoint for ElevenLabs voice agent interaction
  }

  res.json({ status: 'processed', session_id });
});

// Twilio routes disabled - using web-based voice agent instead

router.post('/converse', async (req, res) => {
  try {
    const audioBlob = req.body;
    const persona = req.query.persona || 'adam'; // Default to Adam persona

    console.log(`🎙️ Converse request - Persona: ${persona}`);

    const response = await axios.post(
      `${config.PYTHON_SERVICE_URL}/api/converse?persona=${persona}`,
      audioBlob,
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      }
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);

  } catch (error) {
    console.error('Error in converse proxy:', error.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(503).send('Python service unavailable');
    } else {
      res.status(500).send('Error processing conversation');
    }
  }
});

// NEW: Text-based conversation endpoint (no audio transcription needed)
router.get('/converse-text', async (req, res) => {
  try {
    const { persona = 'adam', text } = req.query;

    console.log(`💬 Converse-text request - Persona: ${persona}, Text: "${text}"`);

    if (!text) {
      return res.status(400).send('Missing text parameter');
    }

    const response = await axios.get(
      `${config.PYTHON_SERVICE_URL}/api/converse-text`,
      {
        params: { persona, text },
        responseType: 'stream',
        timeout: 30000
      }
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);

  } catch (error) {
    console.error('Error in converse-text proxy:', error.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(503).send('Python service unavailable');
    } else {
      res.status(500).send('Error processing conversation: ' + error.message);
    }
  }
});

export default router;
