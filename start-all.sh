#!/bin/bash

# Start all services for Live Safety Monitor
# This script starts Python, Node.js, and Frontend in separate processes

echo "🚀 Starting Live Safety Monitor..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local not found"
    echo "Please copy .env.local.example to .env.local and configure it"
    exit 1
fi

# Check if Python virtual environment exists
if [ ! -d python/venv ]; then
    echo "❌ Error: Python virtual environment not found"
    echo "Please run: cd python && ./setup.sh"
    exit 1
fi

# Start Python service
echo "📦 Starting Python service..."
cd python
source venv/bin/activate
python live_stream_handler.py &
PYTHON_PID=$!
cd ..

sleep 2

# Start Node.js backend
echo "🔧 Starting Node.js backend..."
npm run server &
NODE_PID=$!

sleep 2

# Start frontend
echo "⚛️  Starting Frontend..."
npm run dev &
VITE_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📝 Process IDs:"
echo "   Python:  $PYTHON_PID"
echo "   Node.js: $NODE_PID"
echo "   Vite:    $VITE_PID"
echo ""
echo "🌐 Access the app at: http://localhost:3000"
echo ""
echo "🛑 To stop all services, run:"
echo "   kill $PYTHON_PID $NODE_PID $VITE_PID"
echo ""
echo "💡 For phone access, run ngrok in another terminal:"
echo "   ngrok http 3001"
echo ""

# Wait for user to press Ctrl+C
trap "echo ''; echo '🛑 Stopping all services...'; kill $PYTHON_PID $NODE_PID $VITE_PID; exit" INT

# Keep script running
wait
