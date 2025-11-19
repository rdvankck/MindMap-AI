import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { conversationService } from '@/services/conversationService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

interface ConversationRoom {
  threadId: string;
  participants: Set<string>;
}

// Store for active conversation rooms
const conversationRooms = new Map<string, ConversationRoom>();

/**
 * WebSocket authentication middleware
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

    logger.info(`WebSocket authenticated for user: ${socket.userId}`);
    next();
  } catch (error) {
    logger.error('WebSocket authentication failed:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Setup WebSocket event handlers
 */
const setupSocketHandlers = (io: SocketIOServer) => {
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`WebSocket client connected: ${socket.id} (User: ${socket.userId})`);

    // Join conversation room
    socket.on('join-conversation', (threadId: string) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      // Validate user has access to this conversation
      conversationService.getUserConversations(socket.userId, { limit: 1000 })
        .then(({ conversations }) => {
          const hasAccess = conversations.some(c => c.id === threadId);
          
          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied to conversation' });
            return;
          }

          const roomName = `conversation:${threadId}`;
          socket.join(roomName);

          // Track room membership
          if (!conversationRooms.has(roomName)) {
            conversationRooms.set(roomName, {
              threadId,
              participants: new Set(),
            });
          }

          const room = conversationRooms.get(roomName)!;
          room.participants.add(socket.userId);

          logger.debug(`User ${socket.userId} joined conversation room ${threadId}`);
          
          // Notify others in the room
          socket.to(roomName).emit('user-joined', {
            userId: socket.userId,
            timestamp: new Date().toISOString(),
          });

          // Send current room state to the user
          socket.emit('room-state', {
            threadId,
            participants: Array.from(room.participants),
            userCount: room.participants.size,
          });
        })
        .catch(error => {
          logger.error('Error validating conversation access:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        });
    });

    // Leave conversation room
    socket.on('leave-conversation', (threadId: string) => {
      const roomName = `conversation:${threadId}`;
      socket.leave(roomName);

      // Update room membership
      const room = conversationRooms.get(roomName);
      if (room) {
        room.participants.delete(socket.userId!);
        
        if (room.participants.size === 0) {
          conversationRooms.delete(roomName);
        }

        // Notify others
        socket.to(roomName).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(`User ${socket.userId} left conversation room ${threadId}`);
    });

    // Handle typing indicators
    socket.on('typing-start', (data: { threadId: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('user-typing', {
        userId: socket.userId,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('typing-stop', (data: { threadId: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('user-typing', {
        userId: socket.userId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle real-time message events
    socket.on('message-sent', (data: { threadId: string; message: any }) => {
      const roomName = `conversation:${data.threadId}`;
      
      // Broadcast to all participants in the room (except sender)
      socket.to(roomName).emit('new-message', {
        threadId: data.threadId,
        message: data.message,
        senderId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle conversation branch events
    socket.on('branch-created', (data: { threadId: string; branch: any }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('conversation-branched', {
        threadId: data.threadId,
        branch: data.branch,
        createdBy: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle context updates
    socket.on('context-updated', (data: { threadId: string; context: any }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('context-changed', {
        threadId: data.threadId,
        context: data.context,
        updatedBy: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle conversation status changes
    socket.on('status-changed', (data: { threadId: string; status: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('conversation-status', {
        threadId: data.threadId,
        status: data.status,
        changedBy: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle LLM response streaming
    socket.on('llm-response-start', (data: { threadId: string; messageId: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('llm-response-starting', {
        threadId: data.threadId,
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('llm-response-chunk', (data: { threadId: string; messageId: string; chunk: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('llm-response-chunk', {
        threadId: data.threadId,
        messageId: data.messageId,
        chunk: data.chunk,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('llm-response-complete', (data: { threadId: string; messageId: string; content: string }) => {
      const roomName = `conversation:${data.threadId}`;
      socket.to(roomName).emit('llm-response-complete', {
        threadId: data.threadId,
        messageId: data.messageId,
        content: data.content,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`WebSocket error for client ${socket.id}:`, error);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id} (${reason})`);
      
      // Clean up room memberships
      conversationRooms.forEach((room, roomName) => {
        if (room.participants.has(socket.userId!)) {
          room.participants.delete(socket.userId!);
          
          if (room.participants.size === 0) {
            conversationRooms.delete(roomName);
          } else {
            // Notify remaining participants
            io.to(roomName).emit('user-left', {
              userId: socket.userId,
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

  // Error handling
  io.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  // Set up ping interval for connection health
  const pingInterval = setInterval(() => {
    const connectedClients = io.sockets.sockets.size;
    logger.debug(`Ping: ${connectedClients} connected WebSocket clients`);
  }, config.ws.heartbeatInterval);

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(pingInterval);
    io.close(() => {
      logger.info('WebSocket server closed');
    });
  });
};

/**
 * Setup WebSocket server
 */
export const setupWebSocket = (io: SocketIOServer): void => {
  setupSocketHandlers(io);
  
  console.log('WebSocket server configured');
  
  // Log periodic statistics
  setInterval(() => {
    const roomCount = conversationRooms.size;
    const totalParticipants = Array.from(conversationRooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);
    
    logger.debug(`WebSocket stats: ${roomCount} active rooms, ${totalParticipants} total participants`);
  }, 60000); // Every minute
};

/**
 * Utility function to broadcast to conversation room
 */
export const broadcastToConversation = (
  io: SocketIOServer,
  threadId: string,
  event: string,
  data: any
): void => {
  const roomName = `conversation:${threadId}`;
  io.to(roomName).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Get conversation room statistics
 */
export const getConversationStats = (): {
  roomCount: number;
  totalParticipants: number;
  rooms: Array<{ threadId: string; participantCount: number }>;
} => {
  const rooms = Array.from(conversationRooms.values()).map(room => ({
    threadId: room.threadId,
    participantCount: room.participants.size,
  }));

  return {
    roomCount: conversationRooms.size,
    totalParticipants: rooms.reduce((sum, room) => sum + room.participantCount, 0),
    rooms,
  };
};