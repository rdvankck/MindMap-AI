#!/bin/bash

# Setup script for LLM Node Interface
# This script installs all dependencies and generates package-lock.json files

set -e

echo "🔧 Setting up LLM Node Interface..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps
cd ..

# Install backend dependencies  
echo "Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps
cd ..

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}To start the application:${NC}"
echo "  ./start.sh"
echo ""
echo -e "${BLUE}Or start manually:${NC}"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""