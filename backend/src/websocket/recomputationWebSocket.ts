import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { recomputationEngine } from '@/services/recomputationEngine';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface RecomputationRoom {
  planId: string;
  participants: Set<string>;
  progressUpdates: any[];
}

// Store for active re-computation rooms
const recomputationRooms = new Map<string, RecomputationRoom>();

/**
 * WebSocket authentication middleware for re-computation
 */
const authenticateRecomputationSocket = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    socket.userId = decoded.sub || decoded.userId;
    socket.userEmail = decoded.email;

    logger.debug(`Re-computation WebSocket authenticated for user: ${socket.userId}`);
    next();
  } catch (error) {
    logger.error('Re-computation WebSocket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Setup re-computation WebSocket event handlers
 */
export const setupRecomputationWebSocket = (io: SocketIOServer): void => {
  // Create namespace for re-computation
  const recomputeNamespace = io.of('/recomputation');
  
  // Apply authentication
  recomputeNamespace.use(authenticateRecomputationSocket);

  recomputeNamespace.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Re-computation WebSocket client connected: ${socket.id} (User: ${socket.userId})`);

    // Join re-computation plan room
    socket.on('join-plan', async (planId: string) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      try {
        // Verify user has access to this plan
        const progress = await recomputationEngine.getPlanStatus(planId);
        if (!progress) {
          socket.emit('error', { message: 'Re-computation plan not found' });
          return;
        }

        const roomName = `recomputation:${planId}`;
        socket.join(roomName);

        // Track room membership
        if (!recomputationRooms.has(roomName)) {
          recomputationRooms.set(roomName, {
            planId,
            participants: new Set(),
            progressUpdates: []
          });
        }

        const room = recomputationRooms.get(roomName)!;
        room.participants.add(socket.userId);

        logger.debug(`User ${socket.userId} joined re-computation room ${planId}`);
        
        // Send current progress to the user
        if (progress) {
          socket.emit('progress-update', {
            planId,
            progress,
            timestamp: new Date().toISOString()
          });
        }

        // Send room state
        socket.emit('room-state', {
          planId,
          participants: Array.from(room.participants),
          participantCount: room.participants.size,
          timestamp: new Date().toISOString()
        });

        // Notify others in the room
        socket.to(roomName).emit('user-joined', {
          planId,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error joining re-computation plan room:', error);
        socket.emit('error', { message: 'Failed to join re-computation plan' });
      }
    });

    // Leave re-computation plan room
    socket.on('leave-plan', (planId: string) => {
      const roomName = `recomputation:${planId}`;
      socket.leave(roomName);

      // Update room membership
      const room = recomputationRooms.get(roomName);
      if (room) {
        room.participants.delete(socket.userId!);
        
        if (room.participants.size === 0) {
          recomputationRooms.delete(roomName);
        } else {
          // Notify remaining participants
          socket.to(roomName).emit('user-left', {
            planId,
            userId: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      }

      logger.debug(`User ${socket.userId} left re-computation room ${planId}`);
    });

    // Request current progress
    socket.on('get-progress', async (planId: string) => {
      try {
        const progress = await recomputationEngine.getPlanStatus(planId);
        
        if (progress) {
          socket.emit('progress-update', {
            planId,
            progress,
            timestamp: new Date().toISOString()
          });
        } else {
          socket.emit('error', { message: 'Re-computation plan not found' });
        }
      } catch (error) {
        logger.error('Error getting re-computation progress:', error);
        socket.emit('error', { message: 'Failed to get re-computation progress' });
      }
    });

    // Subscribe to real-time updates for multiple plans
    socket.on('subscribe-plans', (planIds: string[]) => {
      if (!Array.isArray(planIds) || planIds.length === 0) {
        socket.emit('error', { message: 'Invalid plan IDs' });
        return;
      }

      planIds.forEach(planId => {
        const roomName = `recomputation:${planId}`;
        socket.join(roomName);
        
        logger.debug(`User ${socket.userId} subscribed to plan ${planId}`);
      });

      socket.emit('subscription-confirmed', {
        planIds,
        timestamp: new Date().toISOString()
      });
    });

    // Unsubscribe from multiple plans
    socket.on('unsubscribe-plans', (planIds: string[]) => {
      if (!Array.isArray(planIds) || planIds.length === 0) {
        return;
      }

      planIds.forEach(planId => {
        const roomName = `recomputation:${planId}`;
        socket.leave(roomName);
        
        logger.debug(`User ${socket.userId} unsubscribed from plan ${planId}`);
      });

      socket.emit('unsubscription-confirmed', {
        planIds,
        timestamp: new Date().toISOString()
      });
    });

    // Handle re-computation control commands
    socket.on('control-plan', async (data: { planId: string; action: string; reason?: string }) => {
      try {
        const { planId, action, reason } = data;
        
        let result = false;
        
        switch (action) {
          case 'pause':
            result = await recomputationEngine.pausePlan(planId);
            break;
          case 'resume':
            result = await recomputationEngine.resumePlan(planId);
            break;
          case 'cancel':
            result = await recomputationEngine.cancelPlan(planId, socket.userId);
            break;
          default:
            socket.emit('error', { message: 'Invalid action' });
            return;
        }

        // Broadcast control action result to all participants
        const roomName = `recomputation:${planId}`;
        recomputeNamespace.to(roomName).emit('plan-controlled', {
          planId,
          action,
          result,
          controlledBy: socket.userId,
          reason,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error controlling re-computation plan:', error);
        socket.emit('error', { message: 'Failed to control re-computation plan' });
      }
    });

    // Handle re-computation plan retry
    socket.on('retry-plan', async (planId: string) => {
      try {
        // This would need to be implemented in the recomputationEngine
        // For now, just acknowledge the request
        const roomName = `recomputation:${planId}`;
        recomputeNamespace.to(roomName).emit('plan-retry-requested', {
          planId,
          requestedBy: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error retrying re-computation plan:', error);
        socket.emit('error', { message: 'Failed to retry re-computation plan' });
      }
    });

    // Get queue statistics
    socket.on('get-queue-stats', async () => {
      try {
        const stats = await recomputationEngine.getQueueStatistics();
        socket.emit('queue-stats', {
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error getting queue statistics:', error);
        socket.emit('error', { message: 'Failed to get queue statistics' });
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`Re-computation WebSocket error for client ${socket.id}:`, error);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Re-computation WebSocket client disconnected: ${socket.id} (${reason})`);
      
      // Clean up room memberships
      recomputationRooms.forEach((room, roomName) => {
        if (room.participants.has(socket.userId!)) {
          room.participants.delete(socket.userId!);
          
          if (room.participants.size === 0) {
            recomputationRooms.delete(roomName);
          } else {
            // Notify remaining participants
            recomputeNamespace.to(roomName).emit('user-left', {
              planId: room.planId,
              userId: socket.userId,
              timestamp: new Date().toISOString()
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

  // Listen to re-computation engine events
  recomputationEngine.on('progress-updated', (planId: string, progress: any) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('progress-update', {
      planId,
      progress,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-created', (plan: any) => {
    const roomName = `recomputation:${plan.id}`;
    recomputeNamespace.to(roomName).emit('plan-created', {
      planId: plan.id,
      plan,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-completed', (planId: string, success: boolean, progress: any) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('plan-completed', {
      planId,
      success,
      progress,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-failed', (planId: string, error: any) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('plan-failed', {
      planId,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-cancelled', (planId: string) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('plan-cancelled', {
      planId,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-paused', (planId: string) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('plan-paused', {
      planId,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('plan-resumed', (planId: string) => {
    const roomName = `recomputation:${planId}`;
    recomputeNamespace.to(roomName).emit('plan-resumed', {
      planId,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('job-completed', (jobId: string, result: any) => {
    recomputeNamespace.emit('job-completed', {
      jobId,
      result,
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('job-failed', (jobId: string, error: any) => {
    recomputeNamespace.emit('job-failed', {
      jobId,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  });

  recomputationEngine.on('job-stalled', (jobId: string) => {
    recomputeNamespace.emit('job-stalled', {
      jobId,
      timestamp: new Date().toISOString()
    });
  });

  // Error handling
  recomputeNamespace.on('error', (error) => {
    logger.error('Re-computation WebSocket namespace error:', error);
  });

  // Set up ping interval for connection health
  const pingInterval = setInterval(() => {
    const connectedClients = recomputeNamespace.sockets.sockets.size;
    logger.debug(`Re-computation ping: ${connectedClients} connected WebSocket clients`);
  }, config.ws.heartbeatInterval);

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(pingInterval);
    recomputeNamespace.close(() => {
      logger.info('Re-computation WebSocket namespace closed');
    });
  });

  logger.info('Re-computation WebSocket namespace configured');
  
  // Log periodic statistics
  setInterval(() => {
    const roomCount = recomputationRooms.size;
    const totalParticipants = Array.from(recomputationRooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);
    
    logger.debug(`Re-computation WebSocket stats: ${roomCount} active rooms, ${totalParticipants} total participants`);
  }, 60000); // Every minute
};

/**
 * Utility function to broadcast re-computation events
 */
export const broadcastRecomputationEvent = (
  io: SocketIOServer,
  planId: string,
  event: string,
  data: any
): void => {
  const roomName = `recomputation:${planId}`;
  io.of('/recomputation').to(roomName).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get re-computation room statistics
 */
export const getRecomputationStats = (): {
  roomCount: number;
  totalParticipants: number;
  rooms: Array<{ planId: string; participantCount: number }>;
} => {
  const rooms = Array.from(recomputationRooms.values()).map(room => ({
    planId: room.planId,
    participantCount: room.participants.size,
  }));

  return {
    roomCount: recomputationRooms.size,
    totalParticipants: rooms.reduce((sum, room) => sum + room.participantCount, 0),
    rooms,
  };
};