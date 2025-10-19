import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config.js';
import liveSessionRoutes, { setupWebSocket } from './routes/live-session.js';

const app = express();
const PORT = config.PORT;

// Create HTTP server for WebSocket
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/live', liveSessionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup WebSocket server
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Live Safety Monitor - Server running on http://localhost:${PORT}`);
  console.log(`🎥 WebSocket URL: ws://localhost:${PORT}/ws/live-session`);
  console.log(`🤖 Multi-Agent AI System: 4 Gemini agents analyzing conversations`);
  console.log(`📊 Danger threshold: 70% confidence for emergency call trigger`);
});
