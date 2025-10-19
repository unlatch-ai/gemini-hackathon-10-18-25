#!/bin/bash

# Guardian Agent - Start All Services
# Run this script to start frontend, backend, and Python service

echo "🚀 Starting Guardian Agent Services..."
echo ""

# Kill existing processes
echo "🧹 Cleaning up old processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 2

# Start Frontend (Vite on port 3000)
echo "📱 Starting Frontend (Vite on port 3000)..."
npm run dev > /tmp/frontend.log 2>&1 &
sleep 3

# Start Backend (Node.js on port 3001)
echo "🖥️  Starting Backend (Node.js on port 3001)..."
npm run server > /tmp/node-server.log 2>&1 &
sleep 3

# Start Python Service (port 5001)
echo "🐍 Starting Python Service (port 5001)..."
python3 python/live_stream_handler.py > /tmp/python-service.log 2>&1 &
sleep 3

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Service Status:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  Python:    http://localhost:5001"
echo ""
echo "🌐 Access via ngrok:"
echo "  Desktop:   https://lilianna-sweltering-kristopher.ngrok-free.dev/desktop"
echo "  Mobile:    https://lilianna-sweltering-kristopher.ngrok-free.dev/mobile"
echo ""
echo "📝 Logs:"
echo "  Frontend:  tail -f /tmp/frontend.log"
echo "  Backend:   tail -f /tmp/node-server.log"
echo "  Python:    tail -f /tmp/python-service.log"
echo ""
echo "🛑 To stop all services: ./stop-all.sh"
