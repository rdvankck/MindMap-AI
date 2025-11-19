# Re-computation System Documentation

This document provides a comprehensive overview of the re-computation functionality implemented for the node-based LLM interface.

## Overview

The re-computation system provides automatic re-execution of invalidated nodes when their dependencies change. It handles the complete workflow from dependency tracking to execution with real-time progress monitoring and optimization features.

## Core Components

### 1. Re-computation Engine (`recomputationEngine.ts`)

The core engine responsible for managing and executing re-computation plans.

#### Key Features:
- **Queue-based Processing**: Uses Bull queue for scalable job processing
- **Parallel Execution**: Executes independent nodes concurrently
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Progress Tracking**: Real-time progress updates with WebSocket support
- **Resource Management**: Throttling and concurrent execution limits

#### Main Methods:
```typescript
// Create and execute re-computation plan
async createRecomputation(workflowId: string, invalidationEventId: string, options?: RecomputationOptions): Promise<RecomputationPlan>

// Get plan status and progress
async getPlanStatus(planId: string): Promise<RecomputationProgress | null>

// Control operations
async cancelPlan(planId: string, userId?: string): Promise<boolean>
async pausePlan(planId: string): Promise<boolean>
async resumePlan(planId: string): Promise<boolean>

// Batch operations
async cleanupOldPlans(): Promise<void>
async getQueueStatistics(): Promise<QueueStatistics>
```

### 2. Smart Cache Manager (`smartCacheManager.ts`)

Intelligent caching system for optimizing re-computation performance.

#### Features:
- **Multi-tier Caching**: Redis (hot) + Database (warm) storage
- **Intelligent Key Generation**: Consistent hashing based on inputs and configuration
- **Cache Optimization**: LRU eviction, compression, and promotion strategies
- **Performance Monitoring**: Hit rate tracking and analytics
- **Pre-warming**: Intelligent cache population based on usage patterns

#### Cache Operations:
```typescript
// Store execution results
async set(keyData: CacheKey, value: any, options?: CacheOptions): Promise<boolean>

// Retrieve cached results
async get(keyData: CacheKey): Promise<any | null>

// Cache invalidation
async invalidate(pattern: InvalidationPattern): Promise<number>

// Performance optimization
async optimize(): Promise<OptimizationResult>

// Pre-warm cache
async preWarm(workflowId: string, nodeIds: string[]): Promise<void>
```

### 3. Dependency Graph Engine (Enhanced)

Extended dependency tracking with re-computation support.

#### Enhanced Features:
- **Change Detection**: Hash-based change detection with configurable sensitivity
- **Invalidation Cascading**: Automatic dependent node invalidation
- **Execution Planning**: Optimal execution order computation
- **Cost Estimation**: Token and time estimation for re-computation planning
- **Parallel Grouping**: Identification of parallel execution opportunities

### 4. WebSocket Integration (`recomputationWebSocket.ts`)

Real-time progress updates and control via WebSocket.

#### WebSocket Events:
```javascript
// Join re-computation plan room
socket.emit('join-plan', planId);

// Progress updates
socket.on('progress-update', (data) => {
  console.log('Progress:', data.progress);
});

// Plan control
socket.emit('control-plan', { planId, action: 'pause' });

// Real-time subscriptions
socket.emit('subscribe-plans', [planId1, planId2]);
```

### 5. Background Service (`recomputationBackgroundService.ts`)

Automated maintenance and optimization tasks.

#### Scheduled Tasks:
- **Daily Cleanup**: Removal of old completed/failed plans
- **Weekly Optimization**: Cache performance analysis and optimization
- **Intelligent Pre-warming**: Cache population based on usage patterns
- **Health Monitoring**: Detection of stuck plans and automatic recovery

## API Endpoints

### Plan Management
```
POST   /api/recomputation/plans                    # Create re-computation plan
GET    /api/recomputation/plans                    # List plans with filtering
GET    /api/recomputation/plans/:id                # Get plan details
POST   /api/recomputation/plans/batch              # Batch re-computation
DELETE /api/recomputation/plans/cleanup            # Cleanup old plans
```

### Plan Control
```
POST   /api/recomputation/plans/:id/cancel         # Cancel plan
POST   /api/recomputation/plans/:id/pause          # Pause plan
POST   /api/recomputation/plans/:id/resume         # Resume plan
POST   /api/recomputation/plans/:id/retry          # Retry failed plan
GET    /api/recomputation/plans/:id/progress       # Get progress
```

### Queue and Statistics
```
GET    /api/recomputation/plans/queue/stats        # Queue statistics
```

## Configuration

### Environment Variables
```bash
# Re-computation settings
ENABLE_RECOMPUTATION=true
MAX_CONCURRENT_RECOMPUTATION_PLANS=5
RECOMPUTATION_BATCH_SIZE=20
RECOMPUTATION_TIMEOUT=600000
RECOMPUTATION_RETRY_ATTEMPTS=3
RECOMPUTATION_RETRY_DELAY=1000

# Queue settings
RECOMPUTATION_PRIORITY_QUEUE_SIZE=100
RECOMPUTATION_PROGRESS_INTERVAL=1000

# Cache settings
ENABLE_SMART_CACHING=true
ENABLE_PARALLEL_RECOMPUTATION=true
COST_ESTIMATION_CACHE_TTL=300
```

### Runtime Configuration
The system respects the following configuration options:

```typescript
// From config/index.ts
recomputation: {
  maxConcurrentPlans: 5,
  maxBatchSize: 20,
  defaultTimeout: 600000, // 10 minutes
  retryAttempts: 3,
  retryDelay: 1000,
  enableAutoRetry: true,
  enableSmartCaching: true,
  enableParallelExecution: true,
  priorityQueueSize: 100,
  progressUpdateInterval: 1000,
  costEstimationCacheTTL: 300
}
```

## Usage Examples

### Basic Re-computation

```typescript
// Create invalidation event
const invalidation = await dependencyGraphEngine.invalidateDependents(
  workflowId,
  nodeId,
  'content',
  'User updated node configuration'
);

// Create and execute re-computation plan
const plan = await recomputationEngine.createRecomputation(
  workflowId,
  invalidation.id,
  {
    priority: 'HIGH',
    enableParallelExecution: true,
    userId: 'user-123'
  }
);

// Monitor progress
const progress = await recomputationEngine.getPlanStatus(plan.id);
console.log('Progress:', progress);
```

### Batch Re-computation

```typescript
// Batch re-compute multiple nodes
const response = await fetch('/api/recomputation/plans/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workflowId: 'workflow-123',
    nodeIds: ['node-1', 'node-2', 'node-3'],
    reason: 'Bulk parameter update',
    priority: 'MEDIUM',
    enableParallelExecution: true
  })
});

const result = await response.json();
console.log('Created plans:', result.data.successfulPlans);
```

### WebSocket Integration

```typescript
import { io } from 'socket.io-client';

const socket = io('/recomputation', {
  auth: { token: 'your-jwt-token' }
});

// Join plan room for real-time updates
socket.emit('join-plan', 'plan-123');

// Listen to progress updates
socket.on('progress-update', (data) => {
  console.log('Plan progress:', data.progress);
});

// Listen to completion events
socket.on('plan-completed', (data) => {
  console.log('Plan completed:', data.success);
});

// Control plan execution
socket.emit('control-plan', {
  planId: 'plan-123',
  action: 'pause',
  reason: 'Manual pause for investigation'
});
```

### Cache Management

```typescript
// Store execution result in cache
await smartCacheManager.set({
  workflowId: 'workflow-123',
  nodeId: 'node-456',
  inputs: { prompt: 'Hello world' },
  config: { temperature: 0.7 },
  version: '1.0'
}, result, {
  ttl: 3600,
  tags: ['user-request', 'gpt-4'],
  priority: 'high'
});

// Retrieve from cache
const cached = await smartCacheManager.get({
  workflowId: 'workflow-123',
  nodeId: 'node-456',
  inputs: { prompt: 'Hello world' },
  config: { temperature: 0.7 },
  version: '1.0'
});

// Invalidate cache for workflow
await smartCacheManager.invalidate({
  workflowId: 'workflow-123'
});

// Optimize cache performance
const optimization = await smartCacheManager.optimize();
console.log('Performance improvements:', optimization.improvements);
```

## Node Types and Executors

The system includes specialized executors for different node types:

### LLM Node Executor
- Handles OpenAI, Anthropic, and Ollama integrations
- Token counting and usage tracking
- Error handling with retry logic
- Streaming response support

### API Node Executor
- HTTP/HTTPS API calls
- Authentication handling
- Rate limiting and timeout management
- Response parsing and validation

### Transform Node Executor
- Data transformation and manipulation
- JSON/YAML processing
- Custom function execution
- Type conversion and validation

### Control Flow Executors
- **Condition Node**: Boolean logic and branching
- **Loop Node**: Iteration and collection processing
- **Input/Output Nodes**: Data flow management

## Performance Optimization

### Parallel Execution
The system automatically identifies independent nodes that can be executed in parallel:

```typescript
// Parallel group example
const parallelGroups = [
  ['node-1', 'node-2'], // Can execute in parallel
  ['node-3'],           // Depends on node-1 and node-2
  ['node-4', 'node-5']  // Can execute in parallel
];
```

### Smart Caching
- **Hot Cache (Redis)**: Frequently accessed data
- **Warm Cache (Database)**: Persistent storage with TTL
- **Cold Cache**: Generated on-demand
- **Cache Promotion**: Automatic promotion based on access patterns

### Resource Management
- **Queue Prioritization**: Critical, High, Medium, Low priority levels
- **Concurrency Limits**: Configurable maximum concurrent executions
- **Memory Management**: Automatic cleanup and optimization
- **Token Usage Tracking**: LLM token usage monitoring and limits

## Monitoring and Analytics

### Performance Metrics
- Queue statistics (active, waiting, completed, failed)
- Cache hit rates and memory usage
- Execution times and token consumption
- Error rates and retry statistics

### Real-time Monitoring
- WebSocket-based progress updates
- Plan status changes
- Resource utilization
- Error notifications

### Background Analytics
- Usage pattern analysis
- Performance bottleneck identification
- Optimization recommendations
- Cache efficiency reports

## Error Handling and Recovery

### Automatic Recovery
- **Retry Logic**: Exponential backoff with configurable limits
- **Stuck Plan Detection**: Automatic timeout and recovery
- **Graceful Degradation**: Fallback strategies for failures
- **Error Categorization**: Systematic error classification

### Manual Recovery
- Plan pause, resume, and cancel operations
- Failed plan retry with updated parameters
- Batch retry operations
- Manual cache invalidation

## Security and Access Control

### Authentication
- JWT-based authentication for all operations
- User-specific plan ownership
- Workflow access permissions
- API rate limiting

### Authorization
- Role-based access control
- Public vs. private workflow handling
- Resource usage limits per user
- Audit logging for all operations

## Testing

The system includes comprehensive test coverage:

```bash
# Run re-computation tests
npm test -- recomputation.test.ts

# Run with coverage
npm run test:coverage

# Run specific test patterns
npm test -- --testNamePattern="Re-computation"
```

### Test Categories
- Unit tests for individual components
- Integration tests for API endpoints
- Performance tests for cache optimization
- Load tests for queue processing

## Deployment Considerations

### Scaling
- **Horizontal Scaling**: Multiple worker processes
- **Queue Processing**: Bull with Redis backend
- **Database Sharding**: PostgreSQL partitioning for large datasets
- **Cache Clustering**: Redis Cluster for high availability

### High Availability
- **Graceful Shutdown**: Proper cleanup on process termination
- **Health Checks**: Monitoring endpoints and service health
- **Backup Strategies**: Database and cache backup procedures
- **Disaster Recovery**: Automated failover mechanisms

### Performance Tuning
- **Memory Management**: JVM-like garbage collection for Node.js
- **Database Optimization**: Index tuning and query optimization
- **Network Optimization**: Connection pooling and request batching
- **Resource Allocation**: CPU and memory allocation based on workload

## Troubleshooting

### Common Issues

#### Plans Not Starting
- Check queue status with `/api/recomputation/plans/queue/stats`
- Verify Redis connection and Bull queue health
- Check background service status

#### Cache Performance Issues
- Monitor cache hit rates
- Check Redis memory usage
- Review cache TTL settings
- Run cache optimization

#### High Memory Usage
- Check for stuck plans
- Review cache size limits
- Monitor cleanup job execution
- Check for memory leaks in node executors

### Debugging Tools
- Comprehensive logging with Winston
- Performance metrics collection
- Error tracking and alerting
- Health check endpoints

## Future Enhancements

### Planned Features
- **Machine Learning Optimization**: Pattern recognition for cache pre-warming
- **Advanced Analytics**: Detailed performance dashboards
- **Multi-tenant Support**: Enhanced isolation and resource sharing
- **Workflow Templates**: Pre-built re-computation patterns
- **External Integrations**: Third-party monitoring and alerting

### API Evolution
- GraphQL endpoints for complex queries
- Streaming responses for large datasets
- WebSocket enhancements for bi-directional communication
- Enhanced filtering and search capabilities

This documentation provides a comprehensive guide to the re-computation system. For specific implementation details, refer to the individual component files and inline documentation.