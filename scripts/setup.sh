#!/bin/bash

# LLM Node Interface Setup Script
# This script sets up the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📦 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2)
        REQUIRED_NODE_VERSION="18.0.0"
        
        if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_NODE_VERSION') ? 0 : 1)" 2>/dev/null; then
            print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18 or higher."
            exit 1
        fi
        
        print_success "Node.js $NODE_VERSION found"
    else
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
}

# Check Docker
check_docker() {
    if command_exists docker; then
        print_success "Docker found"
    else
        print_warning "Docker is not installed. You can still run the project without Docker, but it's recommended."
    fi
}

# Check Docker Compose
check_docker_compose() {
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose found"
    else
        print_warning "Docker Compose is not installed. You can still run the project without it."
    fi
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies for all packages..."
    
    # Root package
    npm install
    
    # Shared package
    print_step "Installing shared dependencies..."
    cd shared && npm install && cd ..
    
    # Backend
    print_step "Installing backend dependencies..."
    cd backend && npm install && cd ..
    
    # Frontend
    print_step "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    
    print_success "All dependencies installed"
}

# Setup environment files
setup_environment() {
    print_step "Setting up environment files..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "Please edit .env file with your configuration"
    else
        print_success ".env file already exists"
    fi
    
    # Create necessary directories
    mkdir -p logs uploads
    print_success "Created necessary directories"
}

# Database setup with Docker
setup_docker_database() {
    if command_exists docker && (command_exists docker-compose || docker compose version >/dev/null 2>&1); then
        print_step "Starting database services with Docker..."
        
        # Start only database services
        docker-compose up -d postgres redis
        
        # Wait for databases to be ready
        print_step "Waiting for databases to be ready..."
        sleep 10
        
        # Run migrations
        print_step "Running database migrations..."
        cd backend
        npm run db:migrate
        
        # Seed database (optional)
        read -p "Do you want to seed the database with sample data? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_step "Seeding database..."
            npm run db:seed
        fi
        
        cd ..
        print_success "Database setup completed"
    else
        print_warning "Docker not available. Please set up PostgreSQL and Redis manually."
    fi
}

# Build shared package
build_shared() {
    print_step "Building shared package..."
    cd shared && npm run build && cd ..
    print_success "Shared package built"
}

# Run initial setup
run_setup() {
    print_step "Running initial setup..."
    
    # Check prerequisites
    print_step "Checking prerequisites..."
    check_nodejs
    check_docker
    check_docker_compose
    
    # Install dependencies
    install_dependencies
    
    # Build shared package
    build_shared
    
    # Setup environment
    setup_environment
    
    # Setup database
    read -p "Do you want to setup databases using Docker? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        setup_docker_database
    fi
    
    print_success "Setup completed successfully!"
}

# Development commands
start_dev() {
    print_step "Starting development servers..."
    
    # Check if .env exists
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your configuration before continuing."
        exit 1
    fi
    
    # Start development servers
    npm run dev
}

# Build for production
build_production() {
    print_step "Building for production..."
    
    # Build shared package
    cd shared && npm run build && cd ..
    
    # Build backend
    cd backend && npm run build && cd ..
    
    # Build frontend
    cd frontend && npm run build && cd ..
    
    print_success "Production build completed"
}

# Docker deployment
deploy_docker() {
    print_step "Deploying with Docker Compose..."
    
    # Build and start all services
    docker-compose up -d --build
    
    # Wait for services to be ready
    sleep 15
    
    # Run migrations
    docker-compose exec backend npm run db:migrate
    
    # Check health
    if curl -f http://localhost:3000/health >/dev/null 2>&1 && curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Deployment successful!"
        print_success "Frontend: http://localhost:3000"
        print_success "Backend: http://localhost:3001"
    else
        print_error "Deployment failed. Check logs with 'docker-compose logs'"
    fi
}

# Show help
show_help() {
    echo "LLM Node Interface Setup Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup       - Run initial setup (recommended for first-time users)"
    echo "  dev         - Start development servers"
    echo "  build       - Build for production"
    echo "  deploy      - Deploy with Docker Compose"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup    # Initial setup"
    echo "  $0 dev      # Start development"
    echo "  $0 deploy   # Deploy to production"
}

# Main script logic
case "${1:-setup}" in
    "setup")
        run_setup
        ;;
    "dev")
        start_dev
        ;;
    "build")
        build_production
        ;;
    "deploy")
        deploy_docker
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac