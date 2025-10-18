# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based dashboard application that visualizes a conceptual WhatsApp bot for submitting SF 311 service requests. The bot is powered by Twilio and Gemini AI. This is a **frontend simulation** of the backend process - it displays mock data to demonstrate how the system would work in production.

AI Studio App: https://ai.studio/apps/drive/13ZxrTpztNKibK7zwxXn9Joto0oFEonoB

## Development Commands

**Install dependencies:**
```bash
npm install
```

**Run frontend dev server only:**
```bash
npm run dev
```
Starts Vite dev server on http://localhost:3000

**Run backend server only:**
```bash
npm run server
```
Starts Express server on http://localhost:3001

**Run both frontend and backend concurrently:**
```bash
npm run dev:all
```
Runs both servers simultaneously for full-stack development

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Environment Setup

Create a `.env.local` file and set your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

The Vite config ([vite.config.ts:14-15](vite.config.ts#L14-L15)) exposes this as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Application Architecture

### Data Flow
The app follows a unidirectional data flow pattern:
1. Mock data is defined in [constants.ts](constants.ts) (`MOCK_MESSAGES` and `MOCK_REQUESTS`)
2. [App.tsx](App.tsx) manages state and passes data down to child components
3. Components are presentational and receive data via props

### Component Structure

**Main App** ([App.tsx](App.tsx))
- Root component managing message and request state
- Uses a 3-column grid layout (1 column for message feed, 2 columns for details/status)
- Handles message selection state

**Components:**
- [Header.tsx](components/Header.tsx) - Title bar with "Simulation Mode" badge
- [MessageFeed.tsx](components/MessageFeed.tsx) - Scrollable list of incoming WhatsApp messages
- [MessageDetail.tsx](components/MessageDetail.tsx) - Shows selected message details including:
  - Original message text
  - Gemini AI analysis (request type, location, details, confidence)
  - Automation log showing the simulated submission process
- [RequestStatus.tsx](components/RequestStatus.tsx) - Table view of all 311 requests with status badges

### Type System

Core types are defined in [types.ts](types.ts):

- `RequestStatus` enum: PENDING, PROCESSING, SUBMITTED, FAILED
- `GeminiAnalysis` interface: Represents AI analysis output (requestType, location, details, confidence)
- `Message` interface: WhatsApp message with embedded analysis and automation log
- `Request` interface: 311 request linked to a message via `messageId`

### Styling

- Uses Tailwind CSS via CDN ([index.html:8](index.html#L8))
- Dark theme (gray-900 background)
- Color coding:
  - Blue for messages/WhatsApp data
  - Purple for Gemini analysis
  - Green for automation logs
  - Status-specific colors in request table (green=submitted, yellow=processing, red=failed, gray=pending)

### Path Aliases

TypeScript and Vite are configured with `@/*` alias pointing to project root ([tsconfig.json:21-24](tsconfig.json#L21-L24), [vite.config.ts:17-20](vite.config.ts#L17-L20)).

## Backend Architecture

The backend is a Node.js/Express server that handles Twilio webhooks and processes 311 requests.

### Server Structure

**Main Server** ([server/index.js](server/index.js))
- Express app running on port 3001
- Handles CORS for frontend communication
- Parses Twilio's form-urlencoded webhook data

**Routes** ([server/routes/twilio-webhook.js](server/routes/twilio-webhook.js))
- `POST /twilio/webhook` - Main webhook endpoint for incoming WhatsApp messages
- `POST /twilio/status` - Status callback endpoint for message delivery tracking
- Flow:
  1. Receives message from Twilio
  2. Analyzes with Gemini AI
  3. Validates confidence threshold (>0.7)
  4. Submits to SF 311 (simulated)
  5. Sends response back via Twilio

**Services:**
- [gemini.js](server/services/gemini.js) - Gemini AI integration for message analysis
  - Uses `gemini-1.5-flash` model
  - Extracts: requestType, location, details, confidence
  - Returns structured JSON analysis

- [sf311.js](server/services/sf311.js) - SF 311 submission logic
  - **Currently simulated** for demo purposes
  - Generates mock case IDs and automation logs
  - Production version would use browser automation (Playwright) or SF 311 API
  - See inline comments for production implementation reference

### Twilio Configuration

For the Twilio WhatsApp Sandbox, configure these webhook URLs:

**When a message comes in:**
```
https://your-domain.com/twilio/webhook
Method: POST
```

**Status callback URL (optional):**
```
https://your-domain.com/twilio/status
Method: POST
```

For local development, use [ngrok](https://ngrok.com/) to expose your local server:
```bash
ngrok http 3001
# Use the HTTPS URL provided (e.g., https://abc123.ngrok.io/twilio/webhook)
```

### Environment Variables

The backend requires these environment variables in `.env.local`:
- `GEMINI_API_KEY` - Your Gemini API key (required)
- `PORT` - Server port (optional, defaults to 3001)
- `TWILIO_ACCOUNT_SID` - Twilio account SID (optional, for validation)
- `TWILIO_AUTH_TOKEN` - Twilio auth token (optional, for validation)

## Key Implementation Notes

- The **frontend dashboard** is a simulation using mock data from [constants.ts](constants.ts)
- The **backend server** is functional and processes real Twilio webhooks with Gemini AI
- SF 311 submission is currently simulated - production would need browser automation or API integration
- Some messages intentionally show different scenarios (successful submission, API errors with retry, demo mode skip)
- React 19.2.0 is used with React.StrictMode enabled
