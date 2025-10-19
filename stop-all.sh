#!/bin/bash

# Guardian Agent - Stop All Services

echo "🛑 Stopping Guardian Agent Services..."
echo ""

# Stop Frontend (port 3000)
echo "Stopping Frontend..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Stop Backend (port 3001)
echo "Stopping Backend..."
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Stop Python Service (port 5001)
echo "Stopping Python Service..."
lsof -ti:5001 | xargs kill -9 2>/dev/null

sleep 2

echo ""
echo "✅ All services stopped!"
