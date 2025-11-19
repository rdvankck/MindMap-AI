#!/bin/bash

# LLM Node Interface Startup Script
# This script starts both the frontend and backend services

set -e

echo "🚀 Starting LLM Node Interface..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}Waiting for $service to be ready on port $port...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if check_port $port; then
            echo -e "${GREEN}✓ $service is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}Attempt $attempt/$max_attempts: $service not ready yet...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $service failed to start within timeout period${NC}"
    return 1
}

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install --legacy-peer-deps && cd ..
fi

if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install --legacy-peer-deps && cd ..
fi

echo -e "${BLUE}🔧 Starting services...${NC}"

# Start backend in background
echo -e "${YELLOW}Starting backend server...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
if wait_for_service 3001 "Backend"; then
    echo -e "${GREEN}✓ Backend is running on http://localhost:3001${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Check logs/backend.log for details.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend in background
echo -e "${YELLOW}Starting frontend development server...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
if wait_for_service 5173 "Frontend"; then
    echo -e "${GREEN}✓ Frontend is running on http://localhost:5173${NC}"
else
    echo -e "${RED}✗ Frontend failed to start. Check logs/frontend.log for details.${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 LLM Node Interface is now running!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:3001"
echo -e "${BLUE}📊 Logs:${NC} ./logs/"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    kill $BACKEND_PID 2>/dev/null && echo -e "${GREEN}✓ Backend stopped${NC}"
    kill $FRONTEND_PID 2>/dev/null && echo -e "${GREEN}✓ Frontend stopped${NC}"
    echo -e "${GREEN}👋 Goodbye!${NC}"
    exit 0
}

# Set up trap to cleanup on SIGINT (Ctrl+C)
trap cleanup SIGINT

# Keep script running
while true; do
    sleep 1
done