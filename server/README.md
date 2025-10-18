# Backend Server Setup

This directory contains the Node.js/Express backend that handles Twilio WhatsApp webhooks and processes SF 311 service requests using Gemini AI.

## Quick Start

1. **Install dependencies** (from project root):
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```

3. **Run the server**:
   ```bash
   npm run server
   ```

4. **Expose to the internet** (for Twilio webhooks):
   ```bash
   ngrok http 3001
   ```

## Twilio Webhook Configuration

Once you have ngrok running, configure your Twilio WhatsApp Sandbox:

1. Go to [Twilio Console > Messaging > Settings > WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox)

2. Configure webhooks:

   **When a message comes in:**
   - URL: `https://your-ngrok-url.ngrok.io/twilio/webhook`
   - Method: `POST`

   **Status callback URL (optional):**
   - URL: `https://your-ngrok-url.ngrok.io/twilio/status`
   - Method: `POST`

3. Save your changes

## Testing the Bot

1. Join the Twilio WhatsApp Sandbox by sending the join code to the sandbox number

2. Send a test message like:
   ```
   There's a pothole on Market Street near 5th Street. It's pretty big and dangerous for bikes.
   ```

3. The bot should:
   - Analyze the message with Gemini AI
   - Extract the request type, location, and details
   - Simulate submitting to SF 311
   - Reply with a confirmation and mock case ID

## Server Endpoints

- `GET /health` - Health check endpoint
- `POST /twilio/webhook` - Main webhook for incoming WhatsApp messages
- `POST /twilio/status` - Status callback for message delivery tracking

## Architecture

```
server/
├── index.js              # Express server setup
├── routes/
│   └── twilio-webhook.js # Twilio webhook handlers
└── services/
    ├── gemini.js         # Gemini AI integration
    └── sf311.js          # SF 311 submission (simulated)
```

## Production Deployment

For production deployment to services like Railway, Render, or Heroku:

1. Set environment variables on your hosting platform
2. Update Twilio webhook URLs to your production domain
3. Optionally implement real SF 311 submission using:
   - Browser automation (Playwright/Puppeteer)
   - SF 311 API if available
   - Open311 API standard

See comments in `services/sf311.js` for production implementation guidance.
