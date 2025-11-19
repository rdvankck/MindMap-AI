# Dependency Tracking and Invalidation System

This document provides a comprehensive guide to the dependency tracking and invalidation system for the node-based LLM interface.

## Overview

The dependency tracking system automatically manages relationships between workflow nodes, detects changes, and intelligently invalidates and recomputes affected nodes. This ensures that when you modify a node, all dependent nodes are automatically updated to maintain consistency.

## Key Features

### 1. **Dependency Graph Engine**
- Automatic dependency detection from workflow connections
- Circular dependency detection and reporting
- Topological sorting for optimal execution order
- Real-time graph updates and validation

### 2. **Change Detection System**
- Content hashing for efficient change detection
- Multiple change types: content, configuration, connections, deletion
- Granular change scope determination
- Automatic invalidation cascading

### 3. **Intelligent Invalidation**
- Cascade invalidation through dependency chains
- Selective invalidation based on change impact
- Visual indicators for invalidated nodes
- Bulk invalidation support

### 4. **Recomputation Planning**
- Optimized execution order calculation
- Parallel execution grouping
- Cost estimation and priority management
- Progress tracking and rollback support

### 5. **Real-time Updates**
- WebSocket integration for live updates
- Visual status indicators
- Progress notifications
- Collaboration support

## API Endpoints

### Dependency Graph Management

#### Build Dependency Graph
```http
POST /api/dependencies/{workflowId}/graph
Content-Type: application/json
Authorization: Bearer {token}

{
  "enableCircularDependencyDetection": true,
  "enableChangeHashing": true,
  "enableCacheInvalidation": true,
  "maxDependencyDepth": 50,
  "changeDetectionSensitivity": "medium"
}
```

#### Get Dependency Statistics
```http
GET /api/dependencies/{workflowId}/statistics
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNodes": 15,
    "totalDependencies": 23,
    "maxDependencyDepth": 4,
    "circularDependencyCount": 0,
    "averageDependents": 1.5,
    "criticalPathLength": 6,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Change Detection

#### Detect Node Changes
```http
POST /api/dependencies/{workflowId}/{nodeId}/detect-changes
Content-Type: application/json
Authorization: Bearer {token}

{
  "currentNodeData": {
    "id": "node-123",
    "type": "llm",
    "data": { "prompt": "Updated prompt text" },
    "config": { "model": "gpt-4" }
  },
  "previousNodeData": {
    "id": "node-123",
    "type": "llm",
    "data": { "prompt": "Original prompt text" },
    "config": { "model": "gpt-4" }
  }
}
```

### Invalidation Management

#### Invalidate Dependent Nodes
```http
POST /api/dependencies/{workflowId}/{nodeId}/invalidate
Content-Type: application/json
Authorization: Bearer {token}

{
  "changeType": "content",
  "reason": "Updated LLM prompt parameters",
  "metadata": {
    "user": "user-123",
    "source": "ui-edit"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invalidationId": "inv-abc123",
    "workflowId": "workflow-456",
    "nodeId": "node-123",
    "changeType": "content",
    "affectedNodes": ["node-123"],
    "cascadeNodes": ["node-456", "node-789", "node-012"],
    "totalAffected": 4,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Bulk Invalidation
```http
POST /api/dependencies/{workflowId}/bulk-invalidate
Content-Type: application/json
Authorization: Bearer {token}

{
  "nodeIds": ["node-123", "node-456", "node-789"],
  "changeType": "config",
  "reason": "Batch model configuration update",
  "metadata": {
    "batchOperation": true,
    "source": "config-panel"
  }
}
```

### Recomputation Planning

#### Create Recomputation Plan
```http
POST /api/dependencies/{workflowId}/recomputation-plan
Content-Type: application/json
Authorization: Bearer {token}

{
  "invalidationEvent": {
    "id": "inv-abc123",
    "workflowId": "workflow-456",
    "nodeId": "node-123",
    "changeType": "content",
    "reason": "Updated prompt",
    "affectedNodes": ["node-123"],
    "cascadeNodes": ["node-456", "node-789"],
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "options": {
    "prioritizeCritical": true,
    "enableParallelExecution": true,
    "maxParallelNodes": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "planId": "plan-def456",
    "workflowId": "workflow-456",
    "rootCauseNodeId": "node-123",
    "executionOrder": ["node-123", "node-456", "node-789"],
    "parallelGroups": [
      ["node-123"],
      ["node-456", "node-789"]
    ],
    "estimatedCost": {
      "nodes": 3,
      "tokens": 15000,
      "timeMs": 12000
    },
    "priority": "medium",
    "createdAt": "2024-01-15T10:30:05Z"
  }
}
```

#### Execute Recomputation Plan
```http
POST /api/dependencies/recomputation/{planId}/execute
Content-Type: application/json
Authorization: Bearer {token}

{
  "plan": {
    "id": "plan-def456",
    "workflowId": "workflow-456",
    "rootCauseNodeId": "node-123",
    "executionOrder": ["node-123", "node-456", "node-789"],
    "parallelGroups": [["node-123"], ["node-456", "node-789"]],
    "estimatedCost": { "nodes": 3, "tokens": 15000, "timeMs": 12000 },
    "priority": "medium",
    "createdAt": "2024-01-15T10:30:05Z"
  },
  "options": {
    "enableProgressTracking": true,
    "enableRollback": true,
    "batchSize": 10
  }
}
```

### Graph Validation and Optimization

#### Validate Dependency Graph
```http
GET /api/dependencies/{workflowId}/validate
Authorization: Bearer {token}
```

#### Optimize Dependency Graph
```http
POST /api/dependencies/{workflowId}/optimize
Content-Type: application/json
Authorization: Bearer {token}

{
  "optimizationLevel": "medium"
}
```

## WebSocket Events

### Connection and Room Management

#### Join Workflow Monitoring
```javascript
const socket = io('/dependencies', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('join-workflow', 'workflow-456');
```

#### Subscribe to Node Invalidation Events
```javascript
socket.emit('subscribe-node-invalidation', {
  workflowId: 'workflow-456',
  nodeId: 'node-123'
});
```

#### Subscribe to Recomputation Updates
```javascript
socket.emit('subscribe-recomputation', 'plan-def456');
```

### Real-time Events

#### Node Changes Detected
```javascript
socket.on('node-changes-detected', (data) => {
  console.log('Changes detected:', data);
  // Update UI to show changed nodes
  highlightChangedNodes([data.nodeId]);
  
  if (data.changeResult.hasChanges) {
    showChangeNotification({
      nodeId: data.nodeId,
      changeType: data.changeResult.changeType,
      scope: data.changeResult.scope
    });
  }
});
```

#### Dependencies Invalidated
```javascript
socket.on('dependencies-invalidated', (data) => {
  console.log('Dependencies invalidated:', data);
  
  // Update UI to show invalidated nodes
  const allAffected = [
    ...data.invalidationEvent.affectedNodes,
    ...data.invalidationEvent.cascadeNodes
  ];
  
  highlightInvalidatedNodes(allAffected);
  showInvalidationNotification({
    nodeId: data.nodeId,
    changeType: data.changeType,
    totalAffected: allAffected.length,
    reason: data.reason
  });
});
```

#### Recomputation Progress
```javascript
socket.on('recomputation-progress', (data) => {
  console.log('Recomputation progress:', data);
  
  updateProgressIndicator({
    planId: data.planId,
    completedNodes: data.progress.completedNodes,
    totalNodes: data.progress.totalNodes,
    currentGroup: data.progress.currentGroup,
    estimatedTimeRemaining: data.progress.estimatedTimeRemaining
  });
});
```

#### Graph Updated
```javascript
socket.on('graph-updated', (data) => {
  console.log('Graph updated:', data);
  
  // Refresh the dependency graph visualization
  refreshDependencyGraph(data.graph);
  
  if (data.graph.circularDependencies.length > 0) {
    showCircularDependencyWarning(data.graph.circularDependencies);
  }
});
```

## Integration Examples

### React Component Integration

```jsx
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const WorkflowDependencyManager = ({ workflowId, token }) => {
  const [dependencyGraph, setDependencyGraph] = useState(null);
  const [invalidatedNodes, setInvalidatedNodes] = useState(new Set());
  const [recomputationProgress, setRecomputationProgress] = useState({});
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io('/dependencies', {
      auth: { token }
    });

    newSocket.emit('join-workflow', workflowId);

    // Set up event listeners
    newSocket.on('graph-updated', (data) => {
      setDependencyGraph(data.graph);
    });

    newSocket.on('dependencies-invalidated', (data) => {
      const allAffected = [
        ...data.invalidationEvent.affectedNodes,
        ...data.invalidationEvent.cascadeNodes
      ];
      setInvalidatedNodes(new Set(allAffected));
    });

    newSocket.on('recomputation-completed', (data) => {
      // Clear invalidation for completed nodes
      setInvalidatedNodes(prev => {
        const next = new Set(prev);
        data.executedNodes.forEach(nodeId => next.delete(nodeId));
        return next;
      });
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [workflowId, token]);

  const handleNodeUpdate = async (nodeId, newData, oldData) => {
    try {
      // Detect changes
      const response = await fetch(
        `/api/dependencies/${workflowId}/${nodeId}/detect-changes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            currentNodeData: newData,
            previousNodeData: oldData
          })
        }
      );

      const result = await response.json();
      
      if (result.data.hasChanges) {
        // Invalidate dependencies
        await invalidateDependencies(nodeId, result.data.changeType);
      }
    } catch (error) {
      console.error('Error handling node update:', error);
    }
  };

  const invalidateDependencies = async (nodeId, changeType) => {
    try {
      const response = await fetch(
        `/api/dependencies/${workflowId}/${nodeId}/invalidate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            changeType,
            reason: 'Node content updated via UI'
          })
        }
      );

      const result = await response.json();
      
      // Optionally create and execute recomputation plan
      if (result.data.totalAffected > 0) {
        await createAndExecuteRecomputationPlan(result.data.invalidationId);
      }
    } catch (error) {
      console.error('Error invalidating dependencies:', error);
    }
  };

  const createAndExecuteRecomputationPlan = async (invalidationId) => {
    try {
      // Get invalidation details
      const invalidationResponse = await fetch(
        `/api/dependencies/${workflowId}/invalidation-history`
      );
      const invalidationData = await invalidationResponse.json();
      const invalidationEvent = invalidationData.data.invalidations
        .find(inv => inv.id === invalidationId);

      // Create plan
      const planResponse = await fetch(
        `/api/dependencies/${workflowId}/recomputation-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            invalidationEvent,
            options: {
              prioritizeCritical: true,
              enableParallelExecution: true
            }
          })
        }
      );

      const planData = await planResponse.json();

      // Execute plan
      await fetch(`/api/dependencies/recomputation/${planData.data.planId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: planData.data,
          options: {
            enableProgressTracking: true,
            enableRollback: true
          }
        })
      });
    } catch (error) {
      console.error('Error creating/executing recomputation plan:', error);
    }
  };

  return (
    <div className=\"workflow-dependency-manager\">
      <div className=\"dependency-graph\">
        {/* Render dependency graph visualization */}
        {dependencyGraph && (
          <DependencyGraphVisualization
            graph={dependencyGraph}
            invalidatedNodes={invalidatedNodes}
            onNodeUpdate={handleNodeUpdate}
          />
        )}
      </div>
      
      <div className=\"status-panel\">
        <h3>Invalidation Status</h3>
        {invalidatedNodes.size > 0 && (
          <div className=\"invalidation-alert\">
            {invalidatedNodes.size} nodes need recomputation
            <button onClick={() => createAndExecuteRecomputationPlan()}>
              Recompute All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowDependencyManager;
```

### Node.js Backend Integration

```javascript
// Automatic dependency tracking middleware
const express = require('express');
const { dependencyTrackingMiddleware } = require('./middleware/dependencyTracking');

const app = express();

// Apply dependency tracking to workflow routes
app.use('/api/workflows', dependencyTrackingMiddleware);

// Workflow update route with automatic dependency tracking
app.put('/api/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowData = req.body;
    
    // Update workflow in database
    const updatedWorkflow = await updateWorkflow(workflowId, workflowData);
    
    // Dependency tracking middleware will automatically:
    // 1. Detect changes
    // 2. Invalidate dependent nodes
    // 3. Optionally trigger recomputation
    
    res.json({
      success: true,
      data: updatedWorkflow,
      message: 'Workflow updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow'
    });
  }
});
```

## Performance Optimization

### Caching Strategy

The system uses multiple layers of caching for optimal performance:

1. **Memory Cache**: Frequently accessed dependency graphs
2. **Redis Cache**: Node dependencies and invalidation events
3. **Database Cache**: Long-term storage of optimization results

### Batch Processing

```javascript
// Configure batch processing for better performance
const batchOptions = {
  enableBatching: true,
  batchSize: 50,
  batchTimeout: 5000, // 5 seconds
  maxConcurrentBatches: 3
};

dependencyGraphEngine.configureBatchProcessing(batchOptions);
```

### Parallel Execution

```javascript
// Enable parallel execution for independent nodes
const parallelOptions = {
  enableParallelExecution: true,
  maxParallelNodes: 10,
  resourceThresholds: {
    memoryMB: 1024,
    cpuPercent: 80
  }
};

recomputationEngine.configureParallelExecution(parallelOptions);
```

## Monitoring and Analytics

### Dependency Health Metrics

```javascript
// Get dependency health metrics
const healthMetrics = await dependencyGraphEngine.getHealthMetrics(workflowId);

console.log('Dependency Health:', {
  totalNodes: healthMetrics.totalNodes,
  healthyNodes: healthMetrics.healthyNodes,
  issuesCount: healthMetrics.issues.length,
  optimizationScore: healthMetrics.optimizationScore,
  lastInvalidation: healthMetrics.lastInvalidation
});
```

### Performance Monitoring

```javascript
// Monitor recomputation performance
const performanceStats = await dependencyGraphEngine.getPerformanceStats(workflowId);

console.log('Performance Stats:', {
  avgExecutionTime: performanceStats.avgExecutionTime,
  avgTokenUsage: performanceStats.avgTokenUsage,
  cacheHitRate: performanceStats.cacheHitRate,
  parallelizationEfficiency: performanceStats.parallelizationEfficiency
});
```

## Best Practices

### 1. **Change Detection**
- Use specific change types for precise invalidation
- Implement debouncing for rapid node updates
- Cache node content hashes for efficient comparison

### 2. **Recomputation Planning**
- Prioritize critical nodes for faster feedback
- Use parallel execution for independent nodes
- Monitor and adjust batch sizes based on system performance

### 3. **UI Integration**
- Provide visual feedback for invalidation status
- Show real-time progress for long-running recomputations
- Allow users to cancel or pause recomputation when needed

### 4. **Performance Optimization**
- Enable caching for frequently accessed workflows
- Use batch processing for bulk operations
- Monitor memory usage and implement cleanup strategies

### 5. **Error Handling**
- Implement retry logic for failed recomputations
- Provide rollback capabilities for critical workflows
- Log and monitor invalidation patterns for optimization

## Troubleshooting

### Common Issues

1. **Circular Dependencies**
   ```javascript
   // Detect and resolve circular dependencies
   const validation = await validateDependencyGraph(workflowId);
   if (validation.issues.length > 0) {
     console.error('Circular dependencies found:', validation.issues);
   }
   ```

2. **Performance Issues**
   ```javascript
   // Optimize dependency graph
   const optimization = await optimizeDependencyGraph(workflowId);
   console.log('Optimization suggestions:', optimization.suggestions);
   ```

3. **Memory Leaks**
   ```javascript
   // Clean up old cache entries
   await dependencyGraphEngine.cleanupCache({
     maxAge: 24 * 60 * 60 * 1000, // 24 hours
     maxEntries: 1000
   });
   ```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```javascript
// Enable debug mode
process.env.LOG_LEVEL = 'debug';

// Get detailed dependency information
const debugInfo = await dependencyGraphEngine.getDebugInfo(workflowId);
console.log('Debug Info:', debugInfo);
```

This comprehensive dependency tracking system provides intelligent, automated management of workflow node dependencies, ensuring consistency and optimal performance for complex node-based LLM interfaces.