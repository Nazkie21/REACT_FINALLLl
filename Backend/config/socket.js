import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';

/**
 * Socket.IO Configuration
 * Handles real-time communication with authentication
 */

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Enable connection state recovery
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true
    }
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      // Get token from handshake auth or query
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        // Allow connection without auth for public events
        // You can restrict this if needed
        return next();
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      if (decoded) {
        socket.user = decoded; // Attach user data to socket
        return next();
      } else {
        // Invalid token - still allow connection but mark as unauthenticated
        return next();
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      return next();
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`Socket.IO client connected: ${socket.id}`);
    
    // If user is authenticated, log their info
    if (socket.user) {
      console.log(`   Authenticated as: ${socket.user.username} (${socket.user.role})`);
    }

    // Join user to their personal room if authenticated
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      socket.join(`role:${socket.user.role}`);
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });

    // Handle admin notifications subscription
    socket.on('join-admin-notifications', () => {
      console.log('🔧 Join admin-notifications request:', {
        socketId: socket.id,
        hasUser: !!socket.user,
        userRole: socket.user?.role,
        userId: socket.user?.id
      });

      if (socket.user && socket.user.role === 'admin') {
        socket.join('admin-notifications');
        console.log(`✅ Socket ${socket.id} (admin ${socket.user.username}) joined admin-notifications room`);

        // Confirm to client
        socket.emit('joined-admin-room', { success: true });
      } else {
        console.warn(`❌ Socket ${socket.id} attempted to join admin-notifications without admin role`);
        socket.emit('joined-admin-room', { success: false, reason: 'not_admin' });
      }
    });

    socket.on('leave-admin-notifications', () => {
      socket.leave('admin-notifications');
      console.log(`Socket ${socket.id} left admin-notifications room`);
    });

    // Example: Handle payment update subscription
    socket.on('subscribe:payments', () => {
      socket.join('payments');
      console.log(`Socket ${socket.id} subscribed to payment updates`);
    });

    socket.on('unsubscribe:payments', () => {
      socket.leave('payments');
      console.log(`Socket ${socket.id} unsubscribed from payment updates`);
    });

    // Example: Handle authentication events
    socket.on('authenticate', (token) => {
      try {
        const decoded = verifyToken(token);
        if (decoded) {
          socket.user = decoded;
          socket.join(`user:${decoded.id}`);
          socket.join(`role:${decoded.role}`);
          socket.emit('authenticated', { success: true, user: decoded });
          console.log(`Socket ${socket.id} authenticated as ${decoded.username}`);
        } else {
          socket.emit('authenticated', { success: false, message: 'Invalid token' });
        }
      } catch (error) {
        socket.emit('authenticated', { success: false, message: 'Authentication failed' });
      }
    });

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to MixLab Studio',
      socketId: socket.id,
      authenticated: !!socket.user
    });
  });

  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Server} Socket.IO server instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
};

/**
 * Broadcast payment update to all clients in 'payments' room
 * @param {object} data - Payment data to broadcast
 */
export const broadcastPaymentUpdate = (data) => {
  if (!io) return;

  io.to('payments').emit('payment_update', {
    timestamp: new Date().toISOString(),
    data
  });

  console.log(` Broadcasted payment update to 'payments' room`);
};

/**
 * Send notification to specific user
 * @param {number} userId - User ID
 * @param {object} notification - Notification data
 */
export const sendUserNotification = (userId, notification) => {
  if (!io) return;

  io.to(`user:${userId}`).emit('notification', {
    timestamp: new Date().toISOString(),
    ...notification
  });

  console.log(` Sent notification to user ${userId}`);
};

/**
 * Broadcast to all users with specific role
 * @param {string} role - User role ('student', 'admin', 'instructor')
 * @param {string} event - Event name
 * @param {object} data - Data to send
 */
export const broadcastToRole = (role, event, data) => {
  if (!io) return;

  io.to(`role:${role}`).emit(event, {
    timestamp: new Date().toISOString(),
    ...data
  });

  console.log(` Broadcasted ${event} to role: ${role}`);
};

/**
 * Get connected clients count
 * @returns {number} Number of connected clients
 */
export const getConnectedClientsCount = () => {
  if (!io) return 0;
  return io.sockets.sockets.size;
};

