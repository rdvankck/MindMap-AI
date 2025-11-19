import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
// import { logger } from '@/utils/logger';
import { dependencyGraphEngine } from '@/services/dependencyGraphEngine';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface DependencyRoom {
  workflowId: string;
  participants: Set<string>;
}

// Store for active dependency monitoring rooms
const dependencyRooms = new Map<string, DependencyRoom>();

/**
 * WebSocket dependency tracking middleware
 */
const authenticateSocket = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    socket.userId = decoded.sub || decoded.userId;
    socket.userEmail = decoded.email;

    logger.debug(`Dependency WebSocket authenticated for user: ${socket.userId}`);
    next();
  } catch (error) {
    console.error('Dependency WebSocket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Setup WebSocket dependency tracking handlers
 */
const setupDependencySocketHandlers = (io: SocketIOServer) => {
  const dependencyNamespace = io.of('/dependencies');
  
  dependencyNamespace.use(authenticateSocket);

  dependencyNamespace.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Dependency WebSocket client connected: ${socket.id} (User: ${socket.userId})`);

    // Join workflow dependency monitoring
    socket.on('join-workflow', (workflowId: string) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      const roomName = `workflow-dependencies:${workflowId}`;
      socket.join(roomName);

      // Track room membership
      if (!dependencyRooms.has(roomName)) {
        dependencyRooms.set(roomName, {
          workflowId,
          participants: new Set(),
        });
      }

      const room = dependencyRooms.get(roomName)!;
      room.participants.add(socket.userId);

      logger.debug(`User ${socket.userId} joined dependency monitoring for workflow ${workflowId}`);
      
      // Notify others in the room
      socket.to(roomName).emit('user-joined-monitoring', {
        userId: socket.userId,
        workflowId,
        timestamp: new Date().toISOString(),
      });

      // Send current room state to the user
      socket.emit('monitoring-room-state', {
        workflowId,
        participants: Array.from(room.participants),
        participantCount: room.participants.size,
      });
    });

    // Leave workflow dependency monitoring
    socket.on('leave-workflow', (workflowId: string) => {
      const roomName = `workflow-dependencies:${workflowId}`;
      socket.leave(roomName);

      // Update room membership
      const room = dependencyRooms.get(roomName);
      if (room) {
        room.participants.delete(socket.userId!);
        
        if (room.participants.size === 0) {
          dependencyRooms.delete(roomName);
        }

        // Notify others
        socket.to(roomName).emit('user-left-monitoring', {
          userId: socket.userId,
          workflowId,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(`User ${socket.userId} left dependency monitoring for workflow ${workflowId}`);
    });

    // Subscribe to node invalidation events
    socket.on('subscribe-node-invalidation', (data: { workflowId: string; nodeId: string }) => {
      const { workflowId, nodeId } = data;
      const roomName = `node-invalidation:${workflowId}:${nodeId}`;
      socket.join(roomName);

      logger.debug(`User ${socket.userId} subscribed to invalidation events for node ${nodeId}`);
    });

    // Unsubscribe from node invalidation events
    socket.on('unsubscribe-node-invalidation', (data: { workflowId: string; nodeId: string }) => {
      const { workflowId, nodeId } = data;
      const roomName = `node-invalidation:${workflowId}:${nodeId}`;
      socket.leave(roomName);

      logger.debug(`User ${socket.userId} unsubscribed from invalidation events for node ${nodeId}`);
    });

    // Subscribe to recomputation plan updates
    socket.on('subscribe-recomputation', (planId: string) => {
      const roomName = `recomputation-updates:${planId}`;
      socket.join(roomName);

      logger.debug(`User ${socket.userId} subscribed to recomputation updates for plan ${planId}`);
    });

    // Unsubscribe from recomputation plan updates
    socket.on('unsubscribe-recomputation', (planId: string) => {
      const roomName = `recomputation-updates:${planId}`;
      socket.leave(roomName);

      logger.debug(`User ${socket.userId} unsubscribed from recomputation updates for plan ${planId}`);
    });

    // Request dependency graph updates
    socket.on('request-graph-update', async (data: { workflowId: string; force?: boolean }) => {
      try {
        const { workflowId, force = false } = data;
        
        if (force) {
          // Force rebuild the dependency graph
          await dependencyGraphEngine.buildDependencyGraph(workflowId);
        }

        // Get the latest graph
        const graph = await dependencyGraphEngine.buildDependencyGraph(workflowId);

        // Send updates to all clients monitoring this workflow
        const roomName = `workflow-dependencies:${workflowId}`;
        dependencyNamespace.to(roomName).emit('graph-updated', {
          workflowId,
          graph: {
            workflowId: graph.workflowId,
            totalNodes: graph.nodes.size,
            totalEdges: Array.from(graph.edges.values()).reduce((sum, edges) => sum + edges.size, 0),
            topologicalOrder: graph.topologicalOrder,
            circularDependencies: graph.circularDependencies,
            lastComputed: graph.lastComputed,
            nodes: Array.from(graph.nodes.entries()).map(([id, node]) => ({
              id,
              nodeId: node.nodeId,
              dependencies: node.dependencies,
              dependents: node.dependents,
              lastUpdated: node.lastUpdated,
              hash: node.hash
            }))
          },
          requestedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error handling graph update request:', error);
        socket.emit('error', { 
          message: 'Failed to update dependency graph',
          error: error.message 
        });
      }
    });

    // Handle node change detection requests
    socket.on('detect-node-changes', async (data: { 
      workflowId: string; 
      nodeId: string; 
      currentNodeData: any; 
      previousNodeData?: any 
    }) => {
      try {
        const changeResult = await dependencyGraphEngine.detectNodeChanges(
          data.workflowId,
          data.nodeId,
          data.currentNodeData,
          data.previousNodeData
        );

        // Send change detection result back to the requesting client
        socket.emit('node-changes-detected', {
          workflowId: data.workflowId,
          nodeId: data.nodeId,
          changeResult,
          timestamp: new Date().toISOString()
        });

        // If there are changes, broadcast to workflow monitoring room
        if (changeResult.hasChanges) {
          const roomName = `workflow-dependencies:${data.workflowId}`;
          socket.to(roomName).emit('node-changes-detected', {
            workflowId: data.workflowId,
            nodeId: data.nodeId,
            changeType: changeResult.changeType,
            scope: changeResult.scope,
            changedBy: socket.userId,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.error('Error detecting node changes:', error);
        socket.emit('error', { 
          message: 'Failed to detect node changes',
          error: error.message 
        });
      }
    });

    // Handle manual invalidation requests
    socket.on('invalidate-dependencies', async (data: { 
      workflowId: string; 
      nodeId: string; 
      changeType: string; 
      reason: string 
    }) => {
      try {
        const invalidationEvent = await dependencyGraphEngine.invalidateDependents(
          data.workflowId,
          data.nodeId,
          data.changeType as any,
          data.reason,
          { requestedBy: socket.userId, via: 'websocket' }
        );

        // Broadcast invalidation to all relevant rooms
        const workflowRoom = `workflow-dependencies:${data.workflowId}`;
        const nodeRoom = `node-invalidation:${data.workflowId}:${data.nodeId}`;

        dependencyNamespace.to(workflowRoom).emit('dependencies-invalidated', {
          workflowId: data.workflowId,
          nodeId: data.nodeId,
          changeType: data.changeType,
          reason: data.reason,
          invalidationEvent,
          invalidatedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

        dependencyNamespace.to(nodeRoom).emit('node-invalidated', {
          workflowId: data.workflowId,
          nodeId: data.nodeId,
          invalidationEvent,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error invalidating dependencies:', error);
        socket.emit('error', { 
          message: 'Failed to invalidate dependencies',
          error: error.message 
        });
      }
    });

    // Handle recomputation plan creation requests
    socket.on('create-recomputation-plan', async (data: { 
      workflowId: string; 
      invalidationEvent: any; 
      options?: any 
    }) => {
      try {
        const plan = await dependencyGraphEngine.createRecomputationPlan(
          data.workflowId,
          data.invalidationEvent,
          data.options
        );

        // Notify client about plan creation
        socket.emit('recomputation-plan-created', {
          workflowId: data.workflowId,
          plan,
          requestedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

        // Broadcast to workflow room
        const workflowRoom = `workflow-dependencies:${data.workflowId}`;
        socket.to(workflowRoom).emit('recomputation-plan-created', {
          workflowId: data.workflowId,
          planId: plan.id,
          priority: plan.priority,
          estimatedNodes: plan.executionOrder.length,
          requestedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error creating recomputation plan:', error);
        socket.emit('error', { 
          message: 'Failed to create recomputation plan',
          error: error.message 
        });
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Dependency WebSocket error for client ${socket.id}:`, error);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Dependency WebSocket client disconnected: ${socket.id} (${reason})`);
      
      // Clean up room memberships
      dependencyRooms.forEach((room, roomName) => {
        if (room.participants.has(socket.userId!)) {
          room.participants.delete(socket.userId!);
          
          if (room.participants.size === 0) {
            dependencyRooms.delete(roomName);
          } else {
            // Notify remaining participants
            dependencyNamespace.to(roomName).emit('user-left-monitoring', {
              userId: socket.userId,
              workflowId: room.workflowId,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });

  // Error handling for namespace
  dependencyNamespace.on('error', (error) => {
    console.error('Dependency WebSocket namespace error:', error);
  });

  console.log('Dependency WebSocket handlers configured');
};

/**
 * Setup dependency WebSocket server
 */
export const setupDependencyWebSocket = (io: SocketIOServer): void => {
  setupDependencySocketHandlers(io);
  
  console.log('Dependency WebSocket server configured');
  
  // Log periodic statistics
  setInterval(() => {
    const roomCount = dependencyRooms.size;
    const totalParticipants = Array.from(dependencyRooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);
    
    logger.debug(`Dependency WebSocket stats: ${roomCount} active monitoring rooms, ${totalParticipants} total participants`);
  }, 60000); // Every minute
};

/**
 * Utility functions for broadcasting dependency events
 */

export const broadcastDependencyInvalidation = (
  io: SocketIOServer,
  workflowId: string,
  invalidationEvent: any
): void => {
  const dependencyNamespace = io.of('/dependencies');
  const workflowRoom = `workflow-dependencies:${workflowId}`;
  const nodeRoom = `node-invalidation:${workflowId}:${invalidationEvent.nodeId}`;

  dependencyNamespace.to(workflowRoom).emit('dependencies-invalidated', {
    workflowId,
    invalidationEvent,
    timestamp: new Date().toISOString()
  });

  dependencyNamespace.to(nodeRoom).emit('node-invalidated', {
    workflowId,
    nodeId: invalidationEvent.nodeId,
    invalidationEvent,
    timestamp: new Date().toISOString()
  });
};

export const broadcastRecomputationProgress = (
  io: SocketIOServer,
  planId: string,
  progress: any
): void => {
  const dependencyNamespace = io.of('/dependencies');
  const recomputationRoom = `recomputation-updates:${planId}`;

  dependencyNamespace.to(recomputationRoom).emit('recomputation-progress', {
    planId,
    progress,
    timestamp: new Date().toISOString()
  });
};

export const broadcastGraphUpdate = (
  io: SocketIOServer,
  workflowId: string,
  graphUpdate: any
): void => {
  const dependencyNamespace = io.of('/dependencies');
  const workflowRoom = `workflow-dependencies:${workflowId}`;

  dependencyNamespace.to(workflowRoom).emit('graph-updated', {
    workflowId,
    graphUpdate,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get dependency WebSocket statistics
 */
export const getDependencyWebSocketStats = (): {
  roomCount: number;
  totalParticipants: number;
  rooms: Array<{ workflowId: string; participantCount: number }>;
} => {
  const rooms = Array.from(dependencyRooms.values()).map(room => ({
    workflowId: room.workflowId,
    participantCount: room.participants.size,
  }));

  return {
    roomCount: dependencyRooms.size,
    totalParticipants: rooms.reduce((sum, room) => sum + room.participantCount, 0),
    rooms,
  };
};