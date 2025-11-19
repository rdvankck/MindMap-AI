# Conversation History Management System

This document describes the comprehensive conversation history management system implemented for the node-based LLM interface. The system provides advanced conversation context management, branching capabilities, and real-time collaboration features.

## Overview

The conversation system manages conversation threads associated with workflow nodes, allowing users to maintain context-rich dialogues with LLMs while supporting advanced features like conversation branching, context summarization, and real-time collaboration.

## Key Features

### 1. **Conversation Context Management**
- **Multiple Context Strategies**: Full, Sliding Window, Summarization, Selective, and Hybrid approaches
- **Token Management**: Automatic token counting and context window management
- **System Prompts**: Per-conversation system prompt support
- **Context Caching**: Redis-based caching for performance optimization

### 2. **Branching & Parallel Conversations**
- **Conversation Branches**: Create alternative conversation paths from any message
- **Merge Support**: Ability to merge or compare different conversation branches
- **Branch Metadata**: Track branch purpose and metadata
- **Visual Indicators**: WebSocket-based real-time branch updates

### 3. **History Storage & Retrieval**
- **Efficient Database Schema**: Optimized Prisma models for conversation data
- **Version Control**: Message versioning and change tracking
- **Soft Deletion**: Preserve conversation history with soft deletes
- **Full-text Search**: Search across conversation content (planned)

### 4. **Real-time Collaboration**
- **WebSocket Integration**: Real-time conversation updates
- **Typing Indicators**: Live typing status for collaborators
- **User Presence**: Track active participants in conversations
- **Live Updates**: Real-time message broadcasting

### 5. **Analytics & Insights**
- **Conversation Statistics**: Message counts, token usage, response times
- **Performance Metrics**: Track conversation efficiency
- **Export Options**: JSON, CSV, Markdown, and plain text formats
- **Context Snapshots**: Point-in-time conversation state preservation

## Database Schema

### Core Models

#### ConversationThread
- Manages conversation threads linked to workflow nodes
- Stores conversation metadata, settings, and status
- Supports conversation lifecycle management

#### ConversationMessage
- Individual messages within conversations
- Supports multiple roles (User, Assistant, System, Tool, Function)
- Includes token counts and metadata for rich message information
- Soft deletion support for conversation history preservation

#### ConversationBranch
- Manages conversation branching functionality
- Tracks branch points and maintains branch relationships
- Supports parallel conversation paths

#### ContextSnapshot
- Point-in-time conversation context snapshots
- Supports different context strategies and token management
- Expiration-based cleanup for storage optimization

#### LLMContextConfig
- Configuration templates for different LLM providers
- Supports context strategies and model-specific settings
- Reusable configurations across conversations

#### ConversationStats
- Analytics and metrics for conversations
- Tracks message counts, token usage, and performance data
- Supports conversation optimization insights

## API Endpoints

### Conversation Management

#### `POST /api/conversations`
Create a new conversation thread.

**Request Body:**
```json
{
  "nodeId": "uuid",
  "workflowId": "uuid", 
  "title": "Conversation Title",
  "systemPrompt": "Optional system prompt",
  "contextConfig": {
    "provider": "openai",
    "model": "gpt-4",
    "maxTokens": 4096,
    "contextStrategy": "FULL"
  }
}
```

#### `GET /api/conversations`
Retrieve conversations for the authenticated user.

**Query Parameters:**
- `status`: Filter by conversation status (ACTIVE, PAUSED, CLOSED, ARCHIVED)
- `workflowId`: Filter by workflow ID
- `nodeId`: Filter by node ID
- `limit`: Number of results to return (default: 50)
- `offset`: Pagination offset

#### `GET /api/conversations/:id`
Retrieve a specific conversation thread with optional message inclusion.

#### `PUT /api/conversations/:id`
Update conversation metadata and settings.

#### `DELETE /api/conversations/:id`
Archive a conversation (soft delete).

### Message Management

#### `POST /api/conversations/:id/messages`
Add a user message to the conversation.

**Request Body:**
```json
{
  "role": "USER",
  "content": "Message content",
  "metadata": {},
  "parentMessageId": "uuid" // Optional, for branching
}
```

#### `POST /api/conversations/:id/messages/assistant`
Add an assistant message.

#### `POST /api/conversations/:id/messages/system`
Add a system message.

#### `GET /api/conversations/:id/history`
Retrieve conversation history with pagination.

**Query Parameters:**
- `limit`: Number of messages to return
- `offset`: Pagination offset
- `includeDeleted`: Include deleted messages
- `branchId`: Filter by branch ID

### Context Management

#### `GET /api/conversations/:id/context`
Build and retrieve conversation context for LLM processing.

**Query Parameters:**
- `maxTokens`: Maximum tokens for context (default: 4096)
- `strategy`: Context strategy (FULL, SLIDING_WINDOW, SUMMARIZATION, SELECTIVE, HYBRID)
- `branchId`: Build context for specific branch

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [...],
    "systemPrompt": "System prompt content",
    "totalTokens": 1234,
    "contextWindow": 4096,
    "strategy": "FULL",
    "nodeId": "uuid",
    "workflowId": "uuid",
    "threadId": "uuid"
  }
}
```

### Branch Management

#### `POST /api/conversations/:id/branches`
Create a new conversation branch.

**Request Body:**
```json
{
  "branchPointId": "uuid",
  "branchName": "Alternative Response",
  "metadata": {}
}
```

### Snapshots & Analytics

#### `POST /api/conversations/:id/snapshots`
Create a context snapshot.

**Request Body:**
```json
{
  "messageId": "uuid", // Optional
  "strategy": "full"
}
```

#### `GET /api/conversations/:id/stats`
Retrieve conversation analytics and statistics.

#### `GET /api/conversations/:id/export`
Export conversation data in various formats.

**Query Parameters:**
- `format`: Export format (json, csv, markdown, txt)
- `includeContext`: Include conversation context in export

## Context Strategies

### Full Context
Includes all messages up to the token limit, starting from the beginning of the conversation.

**Use Case:** Short conversations where all context is important.

### Sliding Window
Maintains the most recent messages within the token limit, discarding older messages.

**Use Case:** Long conversations where recent context is most relevant.

### Summarization
Summarizes older messages and keeps recent messages in full context.

**Use Case:** Very long conversations where both overview and recent details are needed.

### Selective
Prioritizes important messages (system messages, recent exchanges) within token limits.

**Use Case:** Conversations with specific important instructions that must be preserved.

### Hybrid
Combines multiple strategies based on conversation characteristics and requirements.

**Use Case:** Complex conversations requiring adaptive context management.

## WebSocket Events

### Connection Events
- `join-conversation`: Join a conversation room
- `leave-conversation`: Leave a conversation room
- `user-joined`: User joined conversation
- `user-left`: User left conversation

### Real-time Updates
- `new-message`: New message added
- `message-sent`: Message sent by user
- `llm-response-starting`: LLM response starting
- `llm-response-chunk`: Streaming LLM response chunk
- `llm-response-complete`: LLM response complete

### Collaboration Features
- `user-typing`: User typing indicator
- `conversation-branched`: New branch created
- `context-changed`: Conversation context updated
- `conversation-status`: Conversation status changed

## Usage Examples

### Creating a Conversation with Custom Context

```javascript
const conversation = await fetch('/api/conversations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    nodeId: 'node-123',
    workflowId: 'workflow-456',
    title: 'Code Review Session',
    systemPrompt: 'You are an expert code reviewer...',
    contextConfig: {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      maxTokens: 4096,
      contextStrategy: 'SLIDING_WINDOW',
      summarizationConfig: {
        model: 'claude-3-haiku',
        maxSummaryTokens: 500
      }
    }
  })
});
```

### Building Context with Custom Strategy

```javascript
const context = await fetch(`/api/conversations/${threadId}/context?strategy=HYBRID&maxTokens=8192`, {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});

const contextData = await context.json();
// Use contextData.data.messages for LLM API call
```

### Creating a Conversation Branch

```javascript
const branch = await fetch(`/api/conversations/${threadId}/branches`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    branchPointId: 'message-789',
    branchName: 'Alternative Approach',
    metadata: {
      description: 'Exploring a different solution path',
      reason: 'User requested alternative'
    }
  })
});
```

### WebSocket Integration

```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Join conversation
socket.emit('join-conversation', threadId);

// Listen for new messages
socket.on('new-message', (data) => {
  console.log('New message:', data.message);
  // Update UI with new message
});

// Send typing indicator
socket.emit('typing-start', { threadId });
socket.emit('typing-stop', { threadId });
```

## Performance Considerations

### Database Optimization
- Indexed fields for efficient querying
- Soft deletion to preserve history
- Pagination for large conversation histories
- Context snapshots for expensive context building

### Caching Strategy
- Redis caching for frequently accessed contexts
- TTL-based cache invalidation
- Snapshot caching for expensive operations
- User-specific cache keys

### Memory Management
- Context window limits to prevent memory issues
- Automatic cleanup of expired snapshots
- Efficient token counting algorithms
- Lazy loading for conversation histories

## Security Considerations

### Authentication & Authorization
- JWT-based authentication for all endpoints
- User-specific conversation access control
- Ownership verification for conversation operations
- Rate limiting to prevent abuse

### Data Privacy
- Soft deletion instead of hard deletion
- Metadata sanitization in error responses
- Secure handling of sensitive conversation content
- Audit logging for conversation operations

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Context Management
DEFAULT_MAX_TOKENS=4096
DEFAULT_CONTEXT_WINDOW=8192
CONTEXT_CACHE_TTL=3600

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
MAX_CONVERSATION_ROOMS=1000
```

### Context Configuration
The system supports multiple LLM providers and context strategies through the `LLMContextConfig` model. Default configurations can be seeded and customized per deployment.

## Monitoring & Debugging

### Logging
- Structured logging with Winston
- Conversation operation tracking
- Performance metrics collection
- Error categorization and alerting

### Metrics
- Conversation creation and activity rates
- Context building performance
- Token usage statistics
- WebSocket connection metrics

### Health Checks
- Database connection health
- Redis connectivity
- WebSocket server status
- Memory and performance monitoring

## Future Enhancements

### Planned Features
1. **Full-text Search**: Advanced search across conversation content
2. **Conversation Templates**: Reusable conversation starter templates
3. **Advanced Analytics**: AI-powered conversation insights
4. **Integration Hooks**: Webhooks for conversation events
5. **Multi-language Support**: Internationalization for conversation content

### Performance Improvements
1. **Vector Database Integration**: Semantic search for conversation retrieval
2. **Advanced Caching**: Multi-level caching with CDN support
3. **Database Sharding**: Horizontal scaling for large deployments
4. **Streaming Responses**: Optimized streaming for large conversation histories

## Troubleshooting

### Common Issues

#### Context Building Slow
- Check Redis cache configuration
- Verify database indexes
- Consider reducing maxTokens
- Use summarization strategy for long conversations

#### WebSocket Connection Issues
- Verify JWT token format
- Check CORS configuration
- Ensure WebSocket port accessibility
- Monitor connection limits

#### Memory Usage High
- Implement context window limits
- Monitor conversation snapshot expiration
- Check for memory leaks in context building
- Optimize token counting algorithms

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

This will provide detailed logs for conversation operations, context building, and WebSocket events.