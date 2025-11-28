import { useEffect } from 'react';
import { io } from 'socket.io-client';

// Shared Socket.IO client instance for this tab
let socket = null;

/**
 * Hook to integrate real-time Socket.io notifications with polling
 * Provides instant notification delivery when available, falls back to polling
 * @param {boolean} isAdmin - Whether to listen to admin notifications
 * @param {function} onNewNotification - Callback when new notification arrives
 * @returns {object} - Socket connection status
 */
export const useRealtimeNotifications = (isAdmin = false, onNewNotification = null) => {
  useEffect(() => {
    let currentToken = localStorage.getItem('token');
    let socketInstance = null;

    const connectSocket = (token) => {
      if (!token) return;

      // Disconnect existing socket if it exists
      if (socketInstance && socketInstance.connected) {
        socketInstance.disconnect();
      }

      // Create new socket connection
      socketInstance = io('http://localhost:5000', {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling']
      });

      // Set up event handlers
      const handleConnect = () => {
        console.log('✅ Real-time notification connection established');
        console.log('🔗 Socket ID:', socketInstance.id);
        console.log('👤 Is admin?', isAdmin);

        if (isAdmin) {
          console.log('🔧 Joining admin-notifications room...');
          socketInstance.emit('join-admin-notifications');
        } else {
          console.log('👤 User is not admin, skipping admin room join');
        }
      };

      const handleNewNotification = (notification) => {
        console.log('🔔 Real-time notification received:', notification);
        if (onNewNotification) {
          console.log('📢 Calling onNewNotification callback');
          onNewNotification(notification);
        } else {
          console.log('❌ Not calling callback - no handler provided');
        }
      };

      const handleAdminNotification = (notification) => {
        console.log('🔔 Admin notification received:', notification);
        console.log('Is admin?', isAdmin, 'Has callback?', !!onNewNotification);
        if (isAdmin && onNewNotification) {
          console.log('📢 Calling onNewNotification callback for admin');
          onNewNotification(notification);
        } else {
          console.log('❌ Not calling callback - isAdmin:', isAdmin, 'hasCallback:', !!onNewNotification);
        }
      };

      const handleUserNotification = (notification) => {
        console.log('🔔 User notification received:', notification);
        if (!isAdmin && onNewNotification) {
          onNewNotification(notification);
        }
      };

      const handleConnectError = (error) => {
        console.warn('Real-time notification connection error:', error.message);
      };

      const handleDisconnect = (reason) => {
        console.log('Real-time notification disconnected:', reason);
      };

      // Register listeners
      socketInstance.on('connect', handleConnect);
      socketInstance.on('new-notification', handleNewNotification);
      socketInstance.on('admin_notification', handleAdminNotification);
      socketInstance.on('notification', handleUserNotification);
      socketInstance.on('connect_error', handleConnectError);
      socketInstance.on('disconnect', handleDisconnect);

      // Store reference globally for cleanup
      socket = socketInstance;
    };

    const checkTokenAndConnect = () => {
      const newToken = localStorage.getItem('token');

      // If token changed, reconnect
      if (newToken !== currentToken) {
        currentToken = newToken;

        if (newToken) {
          console.log('🔑 Token found, connecting to real-time notifications');
          connectSocket(newToken);
        } else {
          console.log('🔒 No token, disconnecting real-time notifications');
          if (socketInstance && socketInstance.connected) {
            socketInstance.disconnect();
          }
        }
      }
    };

    // Initial connection attempt
    checkTokenAndConnect();

    // Listen for storage changes (login/logout)
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        checkTokenAndConnect();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also poll for token changes every 2 seconds (in case storage event doesn't fire)
    const tokenCheckInterval = setInterval(checkTokenAndConnect, 2000);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(tokenCheckInterval);

      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('new-notification');
        socketInstance.off('admin_notification');
        socketInstance.off('notification');
        socketInstance.off('connect_error');
        socketInstance.off('disconnect');
      }
    };
  }, [isAdmin, onNewNotification]);

  return {};
};

export default useRealtimeNotifications;
