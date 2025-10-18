# ngrok Setup Guide for Phone Demo

This guide shows you how to set up ngrok so you can access the app on your phone.

## Prerequisites

- ngrok installed ([Download here](https://ngrok.com/download))
- ngrok account (free tier works fine)

## Step 1: Install ngrok (if not already installed)

### macOS (Homebrew)
```bash
brew install ngrok/ngrok/ngrok
```

### Manual Installation
1. Download from https://ngrok.com/download
2. Unzip and move to `/usr/local/bin/`

## Step 2: Authenticate ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken

## Step 3: Start All Services

Open **4 terminal windows**:

### Terminal 1: Python Service
```bash
cd python
source venv/bin/activate
python live_stream_handler.py
```

### Terminal 2: Node.js Backend
```bash
npm run server
```

### Terminal 3: Frontend Dev Server
```bash
npm run dev
```

### Terminal 4: ngrok Tunnel
```bash
ngrok http 3000
```

**Important**: We're tunneling port **3000** (frontend), not 3001 (backend). The frontend will connect to the backend via WebSocket on the same domain.

## Step 4: Update WebSocket URL

You'll see ngrok output like this:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

Now update the WebSocket connection in the frontend to use a **relative path**:

Open [components/SafetyRecorder.tsx](components/SafetyRecorder.tsx) and change:

```typescript
// ❌ OLD (localhost only):
const ws = new WebSocket('ws://localhost:3001/ws/live-session');

// ✅ NEW (works with ngrok):
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.host;
const ws = new WebSocket(`${protocol}//${host}/ws/live-session`);
```

**Wait, this won't work yet!** We need to configure Vite to proxy WebSocket connections.

## Step 5: Configure Vite Proxy

Update [vite.config.ts](vite.config.ts) to proxy backend requests:

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    proxy: {
      '/ws': {
        target: 'http://localhost:3001',
        ws: true, // Enable WebSocket proxying
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});
```

## Alternative: Tunnel Backend Directly (Simpler for Hackathon)

Instead of proxying, you can tunnel the backend and update the frontend URL:

### Option A: Tunnel Backend on Port 3001

**Terminal 4:**
```bash
ngrok http 3001
```

Get the ngrok URL (e.g., `https://xyz789.ngrok-free.app`)

**Update SafetyRecorder.tsx:**
```typescript
const ws = new WebSocket('wss://xyz789.ngrok-free.app/ws/live-session');
```

**Access frontend on phone:**
- Still use localhost frontend on computer, OR
- Deploy frontend to Vercel and point to ngrok backend

### Option B: Use ngrok for Both (Recommended)

**Terminal 4:**
```bash
ngrok http 3001 --host-header=rewrite
```

**Terminal 5:**
```bash
ngrok http 3000
```

Then:
- Frontend URL (for phone): `https://abc123.ngrok-free.app` (from Terminal 5)
- Backend URL: Update in SafetyRecorder.tsx to use ngrok URL from Terminal 4

## Step 6: Test on Your Phone

1. Open Safari or Chrome on your phone
2. Go to the ngrok HTTPS URL
3. Allow camera + microphone permissions
4. Click "Start Safety Recording"
5. You should see your video feed!
6. Say the panic codeword to test

## Troubleshooting

### "Invalid Host Header" Error
Add to `.env.local`:
```
VITE_ALLOWED_HOSTS=.ngrok-free.app
```

### WebSocket Connection Failed
- Make sure you're using `wss://` (not `ws://`) for HTTPS ngrok URLs
- Check that backend is running on port 3001
- Verify ngrok is forwarding correctly

### Camera/Mic Not Working
- Must use HTTPS (ngrok provides this automatically)
- Browser needs to trust the connection
- Grant permissions when prompted

### ngrok Free Tier Limits
- Sessions expire after 2 hours
- New random URL each time (update code each restart)
- Limited to 1 tunnel at a time (free tier)
  - Consider ngrok paid plan ($10/month) for multiple tunnels

## Recommended Flow for Hackathon Demo

**Simplest setup:**

1. Start all 3 services (Python, Node.js, Frontend)
2. Run: `ngrok http 3001`
3. Update SafetyRecorder.tsx with ngrok WebSocket URL (hardcode it for demo)
4. Open frontend on laptop: `http://localhost:3000`
5. Open frontend on phone: Go to ngrok URL in browser
6. Demo works on both devices!

**For going outside:**
- Keep laptop connected to WiFi/Ethernet (stable connection)
- Phone uses cellular data to reach ngrok URL
- ngrok URL is publicly accessible from anywhere

## Production Alternative (Post-Hackathon)

For a more permanent solution, deploy to:
- **Backend + Python**: Railway or Render
- **Frontend**: Vercel or Netlify
- No ngrok needed!

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide (coming soon).
