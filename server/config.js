import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Verify API key is loaded
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables!');
  console.error('   Please make sure .env.local exists in the project root with GEMINI_API_KEY set.');
  process.exit(1);
}

export const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PORT: process.env.PORT || 3001,
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  USER_PHONE_NUMBER: process.env.USER_PHONE_NUMBER,
  PANIC_CODEWORD: process.env.PANIC_CODEWORD || 'help me mom',
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:5000',
};

console.log('✅ Configuration loaded successfully');
