<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SF 311 WhatsApp Bot Dashboard

A full-stack application that demonstrates an AI-powered WhatsApp bot for submitting San Francisco 311 service requests. The system uses Twilio for WhatsApp messaging and Gemini AI for intelligent message analysis.

View your app in AI Studio: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## Features

- 🤖 **AI-Powered Analysis**: Gemini AI analyzes WhatsApp messages to extract service request details
- 📱 **WhatsApp Integration**: Receive and respond to messages via Twilio WhatsApp
- 📊 **Real-time Dashboard**: React-based dashboard showing message processing and request status
- 🏙️ **311 Service Requests**: Automated submission of various SF 311 request types (potholes, graffiti, abandoned vehicles, etc.)

## Quick Start

**Prerequisites:** Node.js 18+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env.local` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```

   Get your Gemini API key from: https://aistudio.google.com/app/apikey

3. **Run the application:**

   **Frontend only (dashboard with mock data):**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000

   **Backend only (Twilio webhook server):**
   ```bash
   npm run server
   ```
   Server runs on http://localhost:3001

   **Both frontend and backend:**
   ```bash
   npm run dev:all
   ```

## Twilio WhatsApp Setup

To connect the backend to Twilio WhatsApp:

1. **Expose your local server to the internet:**
   ```bash
   ngrok http 3001
   ```

2. **Configure Twilio Sandbox:**

   Go to [Twilio WhatsApp Sandbox Settings](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox)

   **When a message comes in:**
   - URL: `https://your-ngrok-url.ngrok.io/twilio/webhook`
   - Method: `POST`

   **Status callback URL (optional):**
   - URL: `https://your-ngrok-url.ngrok.io/twilio/status`
   - Method: `POST`

3. **Test the bot:**

   Send a message to your Twilio WhatsApp number:
   ```
   There's a pothole on Market Street near 5th. It's dangerous for bikes.
   ```

## Project Structure

```
.
├── components/          # React components for dashboard
│   ├── Header.tsx
│   ├── MessageFeed.tsx
│   ├── MessageDetail.tsx
│   └── RequestStatus.tsx
├── server/              # Backend Express server
│   ├── index.js         # Server entry point
│   ├── routes/          # API routes
│   │   └── twilio-webhook.js
│   └── services/        # Business logic
│       ├── gemini.js    # Gemini AI integration
│       └── sf311.js     # SF 311 submission (simulated)
├── App.tsx              # Main React app
├── types.ts             # TypeScript types
└── constants.ts         # Mock data for dashboard
```

## Documentation

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation and [server/README.md](server/README.md) for backend-specific setup.

## Current Status

- ✅ **Frontend Dashboard**: Fully functional with mock data
- ✅ **Twilio Integration**: Receives and responds to WhatsApp messages
- ✅ **Gemini AI Analysis**: Extracts request details from natural language
- ⚠️ **SF 311 Submission**: Currently simulated (see production notes in code)

## Production Deployment

For production deployment, consider:
- Implementing real SF 311 submission via browser automation (Playwright) or API
- Deploying backend to Railway, Render, or similar platform
- Setting up proper Twilio account (not sandbox)
- Adding authentication and rate limiting
