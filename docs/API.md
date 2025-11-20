# MindMap AI - API Documentation

## Base URL

- Development: `http://localhost:3002`
- Production: `https://your-domain.com`

## Overview

MindMap AI provides a simple REST API for creating visual thinking maps with AI-powered conversations. The API allows you to create conversation nodes, expand them with AI responses, and manage conversation branches.

## Endpoints

### Health Check

#### GET `/health`
Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 50331648,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "version": "1.0.0"
}
```

### API Info

#### GET `/api`
Get basic API information.

**Response:**
```json
{
  "message": "LLM Interface API is running"
}
```

### Chat

#### POST `/api/chat`
Send a message to AI and get a response with context awareness.

**Request Body:**
```json
{
  "message": "What is artificial intelligence?",
  "model": "llama-3.1-8b-instant",
  "conversationId": "conv-1234567890",
  "branchId": "main",
  "context": "--- İlgili Önceki Sorular ---\nKullanıcı: What is machine learning?\nAsistan: Machine learning is a subset of AI...\n--- Devam Edilen Konu ---\nKullanıcı: Tell me more about AI\nAsistan: AI is a broad field..."
}
```

**Response:**
```json
{
  "response": "Artificial Intelligence (AI) is a broad field of computer science focused on creating systems that can perform tasks that typically require human intelligence...",
  "model": "llama-3.1-8b-instant",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "conversationId": "conv-1234567890",
  "branchId": "main"
}
```

**Error Response:**
```json
{
  "response": "I'm sorry, but I'm having trouble connecting to the AI service. Please check your API key and try again.",
  "model": "llama-3.1-8b-instant",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "conversationId": "conv-1234567890",
  "branchId": "main",
  "error": "groq_connection_failed"
}
```

### Workflows

#### POST `/api/workflows`
Create a new workflow (currently creates mock workflows).

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "A sample workflow",
  "nodes": [
    {
      "id": "node-1",
      "type": "llm",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start Node" }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

**Response:**
```json
{
  "id": "demo-1234567890",
  "name": "My Workflow",
  "description": "A sample workflow",
  "nodes": [],
  "edges": [],
  "status": "draft",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Conversations

#### POST `/api/conversations`
Create a new conversation.

**Request Body:**
```json
{
  "title": "AI Learning Session",
  "userId": "user-123"
}
```

**Response:**
```json
{
  "id": "conv-1234567890",
  "title": "AI Learning Session",
  "userId": "user-123",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "branches": []
}
```

#### GET `/api/conversations/:conversationId`
Get a conversation with its branches (mock data).

**Response:**
```json
{
  "id": "conv-1234567890",
  "title": "Demo Conversation",
  "userId": "user-123",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "branches": [
    {
      "id": "main",
      "conversationId": "conv-1234567890",
      "name": "Main Branch",
      "parentId": null,
      "data": {
        "messages": [
          {
            "id": "1",
            "sender": "user",
            "text": "Hello!",
            "timestamp": "2024-01-01T00:00:00.000Z"
          },
          {
            "id": "2",
            "sender": "ai",
            "text": "Hi there! How can I help you today?",
            "timestamp": "2024-01-01T00:00:00.000Z"
          }
        ]
      },
      "isActive": true
    },
    {
      "id": "branch-1",
      "conversationId": "conv-1234567890",
      "name": "Alternative Path",
      "parentId": "main",
      "data": {
        "messages": [
          {
            "id": "1",
            "sender": "user",
            "text": "Hello!",
            "timestamp": "2024-01-01T00:00:00.000Z"
          },
          {
            "id": "2",
            "sender": "ai",
            "text": "Hello! What specific topic would you like to explore?",
            "timestamp": "2024-01-01T00:00:00.000Z"
          }
        ]
      },
      "isActive": false
    }
  ]
}
```

### Branches

#### POST `/api/conversations/:conversationId/branches`
Create a new branch in a conversation.

**Request Body:**
```json
{
  "name": "Deep Dive Branch",
  "parentId": "main",
  "data": {
    "description": "Exploring a specific aspect in detail"
  }
}
```

**Response:**
```json
{
  "id": "branch-1234567890",
  "conversationId": "conv-1234567890",
  "name": "Deep Dive Branch",
  "parentId": "main",
  "data": {
    "description": "Exploring a specific aspect in detail"
  },
  "isActive": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT `/api/conversations/:conversationId/branches/:branchId/activate`
Switch to a different branch in a conversation.

**Response:**
```json
{
  "success": true,
  "activeBranch": "branch-1234567890"
}
```

## Context System

The API features an advanced context system that maintains conversation coherence:

### Context Format

The `context` parameter in `/api/chat` should follow this format:

```
--- İlgili Önceki Sorular ---
Kullanıcı: [Previous question 1]
Asistan: [Previous answer 1]
Kullanıcı: [Previous question 2]
Asistan: [Previous answer 2]

--- Devam Edilen Konu ---
Kullanıcı: [Current question 1]
Asistan: [Current answer 1]
Soru: [Related question]
Cevap: [Related answer]
```

### Context Processing Rules

1. **System Message**: A Turkish system prompt is automatically added to provide context-aware responses
2. **Previous Questions**: Marked with `[Önceki Soru]` and `[Önceki Cevap]` prefixes
3. **Related Questions**: Marked with `[İlgili Soru]` and `[İlgili Cevap]` prefixes
4. **Current Messages**: Added without prefixes for the main conversation flow

## Error Handling

All errors return appropriate HTTP status codes and descriptive messages:

### Common Error Responses

```json
{
  "error": "Failed to process chat message"
}
```

```json
{
  "error": "Failed to create workflow"
}
```

```json
{
  "error": "Failed to create conversation"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `500` - Internal Server Error
- `404` - Not Found

## Technology Stack

- **Backend**: Node.js with Express
- **AI Provider**: Groq API (Llama 3.1-8b-instant)
- **Database**: PostgreSQL (optional for simple-server)
- **Language**: Turkish and English support

## Features

### AI Integration
- Free Groq API with Llama 3.1 model
- Intelligent conversation context awareness
- Fallback error handling
- Turkish language support

### Context Management
- Maintains conversation flow across questions and answers
- Remembers related questions from the same branch
- Provides topic coherence for intelligent responses
- Supports multi-branch conversations with independent contexts

### Visual Thinking Map
- Interactive canvas with draggable nodes
- SVG connections showing relationships
- Click-to-position for new nodes
- Real-time AI responses

## Usage Examples

### Basic Chat
```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is machine learning?",
    "model": "llama-3.1-8b-instant",
    "conversationId": "conv-demo",
    "branchId": "main"
  }'
```

### Chat with Context
```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you explain neural networks in more detail?",
    "model": "llama-3.1-8b-instant",
    "conversationId": "conv-demo",
    "branchId": "main",
    "context": "--- İlgili Önceki Sorular ---\nKullanıcı: What is machine learning?\nAsistan: Machine learning is a subset of AI that focuses on systems that learn from data...\n--- Devam Edilen Konu ---\nKullanıcı: Tell me about deep learning\nAsistan: Deep learning is a subfield of machine learning that uses neural networks..."
  }'
```

### Create Conversation
```bash
curl -X POST http://localhost:3002/api/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Learning Session",
    "userId": "user-demo"
  }'
```

## Rate Limiting

Currently, there are no strict rate limits implemented in the simple-server, but it's recommended to:

- Limit requests to reasonable frequency
- Implement client-side rate limiting
- Handle errors gracefully with retry logic

## Configuration

The API uses environment variables for configuration:

- `GROQ_API_KEY`: Groq API key for LLM integration
- `GROQ_API_URL`: Groq API endpoint (default: https://api.groq.com/openai/v1/chat/completions)
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `CORS_ORIGIN`: Allowed CORS origins

## Future Enhancements

Planned features for future releases:

- User authentication and authorization
- Workflow execution engine
- File upload support
- Real-time WebSocket connections
- Advanced node types and configurations
- Template system
- Collaboration features