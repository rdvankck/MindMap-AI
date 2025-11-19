# API Documentation

## Base URL

- Development: `http://localhost:3001`
- Production: `https://your-domain.com/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 604800
    }
  }
}
```

#### POST `/auth/login`
Authenticate a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 604800
    }
  }
}
```

### Workflows

#### GET `/workflows`
Get all workflows for the authenticated user.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term
- `sortBy`: Sort field (default: "updatedAt")
- `sortOrder`: Sort order (asc/desc, default: "desc")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My Workflow",
      "description": "A sample workflow",
      "isPublic": false,
      "metadata": {
        "tags": ["ai", "automation"],
        "category": "productivity"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### POST `/workflows`
Create a new workflow.

**Request Body:**
```json
{
  "name": "New Workflow",
  "description": "Description",
  "isPublic": false,
  "nodes": [],
  "edges": [],
  "metadata": {
    "tags": ["tag1", "tag2"],
    "category": "productivity"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New Workflow",
    "description": "Description",
    "isPublic": false,
    "nodes": [],
    "edges": [],
    "metadata": {
      "tags": ["tag1", "tag2"],
      "category": "productivity",
      "version": "1.0.0"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/workflows/:id`
Get a specific workflow.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Workflow",
    "description": "Description",
    "isPublic": false,
    "nodes": [
      {
        "id": "node-uuid",
        "type": "llm",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "LLM Node",
          "config": {
            "provider": "openai",
            "model": "gpt-4",
            "temperature": 0.7
          }
        }
      }
    ],
    "edges": [],
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT `/workflows/:id`
Update a workflow.

**Request Body:** Same as POST `/workflows`

**Response:** Same as GET `/workflows/:id`

#### DELETE `/workflows/:id`
Delete a workflow.

**Response:**
```json
{
  "success": true,
  "message": "Workflow deleted successfully"
}
```

#### POST `/workflows/:id/execute`
Execute a workflow.

**Request Body:**
```json
{
  "inputs": {
    "input1": "value1",
    "input2": "value2"
  },
  "options": {
    "async": false,
    "webhookUrl": "https://example.com/webhook",
    "timeout": 300000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "uuid",
    "status": "running",
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Nodes

#### GET `/nodes/templates`
Get all available node templates.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "llm",
      "name": "LLM Node",
      "description": "Connect to language models",
      "category": "ai",
      "icon": "brain",
      "inputs": [
        {
          "id": "prompt",
          "name": "Prompt",
          "type": "string",
          "required": true
        }
      ],
      "outputs": [
        {
          "id": "response",
          "name": "Response",
          "type": "string",
          "required": false
        }
      ],
      "config": [
        {
          "key": "provider",
          "label": "Provider",
          "type": "select",
          "required": true,
          "options": [
            { "label": "OpenAI", "value": "openai" },
            { "label": "Ollama", "value": "ollama" }
          ]
        }
      ],
      "defaultConfig": {
        "provider": "openai",
        "model": "gpt-4",
        "temperature": 0.7
      }
    }
  ]
}
```

#### POST `/nodes/validate`
Validate node configuration.

**Request Body:**
```json
{
  "type": "llm",
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": []
  }
}
```

### Chat

#### GET `/chat/sessions`
Get all chat sessions for the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Chat Session 1",
      "workflowId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "messageCount": 10
    }
  ]
}
```

#### POST `/chat/sessions`
Create a new chat session.

**Request Body:**
```json
{
  "title": "New Chat Session",
  "workflowId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "New Chat Session",
    "workflowId": "uuid",
    "messages": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/chat/sessions/:id/messages`
Get messages for a specific chat session.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello!",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Hi there! How can I help you?",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST `/chat/sessions/:id/messages`
Send a message in a chat session.

**Request Body:**
```json
{
  "content": "What's the weather today?",
  "context": {
    "additionalData": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "uuid",
      "role": "user",
      "content": "What's the weather today?",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "response": {
      "id": "uuid",
      "role": "assistant",
      "content": "I'll help you check the weather...",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Files

#### POST `/files/upload`
Upload a file.

**Request:** `multipart/form-data`
- `file`: The file to upload

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "originalName": "document.pdf",
    "fileName": "uuid-document.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "url": "/uploads/uuid-document.pdf"
  }
}
```

#### GET `/files/:id`
Get file information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "originalName": "document.pdf",
    "fileName": "uuid-document.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "uploadedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### DELETE `/files/:id`
Delete a file.

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Settings

#### GET `/settings`
Get user settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": true,
      "push": true,
      "workflow": true,
      "chat": true
    },
    "llm": {
      "defaultProvider": "openai",
      "defaultModel": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2000
    },
    "ui": {
      "sidebarCollapsed": false,
      "showMinimap": true,
      "snapToGrid": true,
      "gridSpacing": 15
    }
  }
}
```

#### PUT `/settings`
Update user settings.

**Request Body:** Same structure as GET response

**Response:** Same as GET response

## WebSocket Events

### Client to Server

#### `workflow:execute`
Execute a workflow.
```json
{
  "workflowId": "uuid",
  "inputs": {},
  "options": {}
}
```

#### `workflow:pause`
Pause a workflow execution.
```json
{
  "executionId": "uuid"
}
```

#### `workflow:stop`
Stop a workflow execution.
```json
{
  "executionId": "uuid"
}
```

#### `chat:send`
Send a chat message.
```json
{
  "sessionId": "uuid",
  "content": "Hello!",
  "context": {}
}
```

### Server to Client

#### `workflow:started`
Workflow execution started.
```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "startedAt": "2024-01-01T00:00:00.000Z"
}
```

#### `workflow:progress`
Workflow execution progress update.
```json
{
  "executionId": "uuid",
  "nodeId": "uuid",
  "status": "running",
  "progress": 0.5,
  "message": "Processing..."
}
```

#### `workflow:completed`
Workflow execution completed.
```json
{
  "executionId": "uuid",
  "outputs": {},
  "completedAt": "2024-01-01T00:00:00.000Z",
  "duration": 5000
}
```

#### `workflow:error`
Workflow execution error.
```json
{
  "executionId": "uuid",
  "error": "Something went wrong",
  "nodeId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `chat:message`
New chat message received.
```json
{
  "sessionId": "uuid",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Response message",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {}
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid request data
- `AUTHENTICATION_ERROR`: Invalid or missing authentication
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Server error
- `WORKFLOW_EXECUTION_ERROR`: Workflow execution failed
- `LLM_PROVIDER_ERROR`: LLM provider error

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **File Upload**: 10 uploads per minute per user
- **Workflow Execution**: 20 executions per hour per user
- **WebSocket Events**: 1000 events per minute per connection

## File Upload Limits

- **Max File Size**: 10MB
- **Supported Formats**: Images (PNG, JPG, GIF, SVG), Documents (PDF, DOC, DOCX, TXT), Data (JSON, CSV)
- **Storage**: User-specific with configurable limits