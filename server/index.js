import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import twilioWebhook from './routes/twilio-webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root (one level up from server/)
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Verify API key is loaded
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables!');
  console.error('   Please make sure .env.local exists in the project root with GEMINI_API_KEY set.');
  process.exit(1);
} else {
  console.log('✅ GEMINI_API_KEY loaded successfully');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false })); // Twilio sends form-urlencoded data
app.use(express.json());

// Routes
app.use('/twilio', twilioWebhook);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Twilio webhook URL: http://localhost:${PORT}/twilio/webhook`);
});
