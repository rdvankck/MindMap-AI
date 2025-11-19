# LLM Node Interface - Project Structure

## Overview

This is a comprehensive, production-ready project structure for a node-based LLM interface built with React Flow, TypeScript, Node.js, and PostgreSQL. The project enables users to create visual workflows using drag-and-drop nodes to interact with various LLM providers.

## 🏗️ Architecture

```
LLM/
├── frontend/           # React frontend application
├── backend/            # Node.js backend API
├── shared/             # Shared types and utilities
├── docker/             # Docker configuration
├── docs/               # Documentation
├── scripts/            # Utility scripts
└── tests/              # Test files
```

## 📁 Directory Structure

### Frontend (`/frontend`)
```
frontend/
├── public/                    # Static assets
├── src/
│   ├── assets/               # Images, icons, etc.
│   ├── components/           # React components
│   │   ├── Canvas/          # React Flow canvas components
│   │   │   ├── WorkflowEditor.tsx
│   │   │   ├── NodeTypes/   # Custom node components
│   │   │   └── EdgeTypes/   # Custom edge components
│   │   ├── Chat/            # Chat interface
│   │   ├── Settings/        # Settings page
│   │   ├── Auth/            # Authentication components
│   │   └── ui/              # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   │   ├── api/             # API hooks
│   │   └── websocket/       # WebSocket hooks
│   ├── store/               # State management (Zustand)
│   ├── services/            # API services
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   ├── styles/              # CSS and styling
│   └── test/                # Test utilities
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```

### Backend (`/backend`)
```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── index.ts         # Main config
│   │   ├── database.ts      # Database config
│   │   └── redis.ts         # Redis config
│   ├── database/            # Database related
│   │   ├── migrations/      # Prisma migrations
│   │   └── seeds/           # Database seeds
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # Authentication
│   │   ├── errorHandler.ts  # Error handling
│   │   └── validation.ts    # Request validation
│   ├── routes/              # API routes
│   │   ├── api/             # API endpoints
│   │   ├── auth/            # Authentication routes
│   │   ├── chat/            # Chat routes
│   │   ├── workflows/       # Workflow routes
│   │   └── files/           # File upload routes
│   ├── services/            # Business logic
│   │   ├── LLMProviders/    # LLM provider integrations
│   │   │   ├── openai.ts    # OpenAI integration
│   │   │   ├── ollama.ts    # Ollama integration
│   │   │   └── index.ts     # Provider factory
│   │   ├── Workflow/        # Workflow management
│   │   ├── Chat/            # Chat services
│   │   ├── NodeExecution/   # Node execution logic
│   │   └── Storage/         # File storage
│   ├── utils/               # Utility functions
│   │   ├── logger.ts        # Logging
│   │   ├── crypto.ts        # Cryptography
│   │   └── validation.ts    # Validation
│   ├── websocket/           # WebSocket handlers
│   │   ├── handlers/        # Event handlers
│   │   └── index.ts         # Socket setup
│   ├── types/               # TypeScript types
│   └── index.ts             # Application entry
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Migration files
├── package.json
└── tsconfig.json
```

### Shared (`/shared`)
```
shared/
├── src/
│   ├── types.ts             # Shared TypeScript types
│   ├── schemas.ts           # Zod validation schemas
│   ├── utils.ts             # Shared utilities
│   └── index.ts             # Entry point
├── package.json
└── tsconfig.json
```

### Docker (`/docker`)
```
docker/
├── backend.Dockerfile       # Backend Dockerfile
├── frontend.Dockerfile      # Frontend Dockerfile
├── nginx.conf              # Nginx configuration
└── init.sql                # Database initialization
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)

### Installation

1. **Clone and setup:**
```bash
cd LLM
chmod +x scripts/setup.sh
./scripts/setup.sh setup
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start development:**
```bash
# With Docker (recommended)
./scripts/setup.sh deploy

# Or manual development
./scripts/setup.sh dev
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Checks:
  - Frontend: http://localhost:3000/health
  - Backend: http://localhost:3001/health

## 🧩 Core Features

### 1. Visual Workflow Editor
- Drag-and-drop node-based interface
- React Flow for canvas
- Custom node types
- Real-time collaboration
- Auto-save and version control

### 2. Node Types
- **LLM Nodes**: Connect to OpenAI, Ollama, Anthropic, etc.
- **Prompt Template**: Dynamic prompt generation
- **Condition**: Conditional logic
- **Code**: JavaScript execution
- **Input/Output**: Data flow management
- **File Processing**: Handle file uploads
- **HTTP Request**: API integration
- **Wait**: Delay execution

### 3. LLM Provider Support
- OpenAI (GPT-3.5, GPT-4, etc.)
- Ollama (local models)
- Anthropic Claude
- Cohere
- Custom providers

### 4. Real-time Features
- WebSocket-based updates
- Live workflow execution
- Chat interface
- Collaboration support

### 5. Database Schema
- Users & authentication
- Workflows & executions
- Chat sessions & messages
- File management
- Caching layer

### 6. API Design
- RESTful API design
- JWT authentication
- WebSocket events
- File upload handling
- Rate limiting

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Flow** - Node-based editor
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Socket.io Client** - Real-time updates
- **Vite** - Build tool

### Backend
- **Node.js 18** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM
- **PostgreSQL** - Database
- **Redis** - Caching
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **Zod** - Validation

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container
- **Nginx** - Reverse proxy
- **PM2** - Process management
- **Winston** - Logging

## 📊 Development Workflow

### 1. Development Commands
```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Docker commands
npm run docker:up
npm run docker:down
```

### 2. Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# View database
npm run db:studio
```

### 3. Testing
```bash
# Run all tests
npm test

# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend

# Coverage reports
npm run test:coverage
```

## 🔧 Configuration

### Environment Variables
```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/llm_interface

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key

# LLM Providers
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434
```

### Configuration Files
- `backend/src/config/index.ts` - Main configuration
- `frontend/vite.config.ts` - Vite configuration
- `docker-compose.yml` - Docker services
- `tailwind.config.js` - Tailwind configuration

## 🚦 Production Deployment

### Docker Deployment (Recommended)
```bash
# Build and deploy
make prod-build
make prod-start

# Or using script
./scripts/setup.sh deploy
```

### Manual Deployment
1. Build frontend: `cd frontend && npm run build`
2. Build backend: `cd backend && npm run build`
3. Setup nginx reverse proxy
4. Configure SSL certificates
5. Set up monitoring and logging

## 🧪 Testing

### Test Structure
```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
└── fixtures/          # Test data
```

### Test Frameworks
- **Vitest** - Frontend testing
- **Jest** - Backend testing
- **Supertest** - API testing
- **Testing Library** - React testing

## 📈 Monitoring & Logging

### Logging
- Structured logging with Winston
- Different log levels
- File and console outputs
- Request/response logging

### Health Checks
- Application health endpoint
- Database connectivity
- Redis connectivity
- LLM provider status

### Metrics
- Request duration
- Workflow execution time
- Error rates
- Resource usage

## 🔒 Security

### Authentication
- JWT-based authentication
- Secure password hashing
- Session management
- Rate limiting

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection

### File Security
- File type validation
- Size limits
- Virus scanning
- Secure storage

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

### Code Standards
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Conventional commits

## 📚 Documentation

- `docs/API.md` - API documentation
- `docs/DEPLOYMENT.md` - Deployment guide
- `README.md` - General information
- Code comments - inline documentation

## 🎯 Next Steps

This project structure provides a solid foundation for building a scalable LLM node interface. You can extend it by:

1. Adding more node types
2. Integrating additional LLM providers
3. Implementing user management features
4. Adding workflow templates
5. Building analytics and reporting
6. Creating mobile applications
7. Setting up CI/CD pipelines

The architecture is designed to be modular and extensible, making it easy to add new features and scale the application as needed.