import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config.js';
import twilioWebhook from './routes/twilio-webhook.js';
import liveSessionRoutes, { setupWebSocket } from './routes/live-session.js';
import { GEMINI_MODELS } from './services/gemini.js';
import { getMessages, getRequests } from './storage.js';

const app = express();
const PORT = config.PORT;

// Create HTTP server for WebSocket
const server = http.createServer(app);

// Store current model selection (in production, use a database)
export let currentModel = GEMINI_MODELS.FLASH;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false })); // Twilio sends form-urlencoded data
app.use(express.json());

// Routes
app.use('/twilio', twilioWebhook);
app.use('/api/live', liveSessionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all messages
app.get('/api/messages', (req, res) => {
  const messages = getMessages();
  res.json(messages);
});

// Get all requests
app.get('/api/requests', (req, res) => {
  const requests = getRequests();
  res.json(requests);
});

// Get available models
app.get('/api/models', (req, res) => {
  res.json({
    available: Object.entries(GEMINI_MODELS).map(([key, value]) => ({
      id: value,
      name: key,
    })),
    current: currentModel,
  });
});

// Set current model
app.post('/api/models/select', (req, res) => {
  const { model } = req.body;

  if (!Object.values(GEMINI_MODELS).includes(model)) {
    return res.status(400).json({
      error: 'Invalid model',
      available: Object.values(GEMINI_MODELS)
    });
  }

  currentModel = model;
  console.log(`🔄 Model changed to: ${model}`);
  res.json({ success: true, model: currentModel });
});

// Setup WebSocket server
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Twilio webhook URL: http://localhost:${PORT}/twilio/webhook`);
  console.log(`🎥 WebSocket URL: ws://localhost:${PORT}/ws/live-session`);
  console.log(`🔑 Panic codeword: "${config.PANIC_CODEWORD}"`);
});
