import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Hook to fetch and manage notifications from backend
 * @param {boolean} isAdmin - Whether to fetch admin notifications or personal notifications
 * @param {number} refreshInterval - Interval in milliseconds to refresh notifications (default: 10000ms = 10 seconds for admin, 30 seconds for users)
 * @returns {object} - { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, refreshNotifications }
 */
export const useNotifications = (isAdmin = false, refreshInterval = null) => {
  // Use faster polling for both admin and user notifications
  // Admin: 5 seconds, User: 8 seconds (faster for better real-time feel)
  const interval = refreshInterval !== null ? refreshInterval : (isAdmin ? 5000 : 8000);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch notifications from backend
  const refreshNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      setIsLoading(true);
      setError(null);

      // Use admin endpoint if admin, otherwise use personal notifications
      const endpoint = isAdmin
        ? `${API_BASE_URL}/notifications/admin/system`
        : `${API_BASE_URL}/notifications`;

      console.log('📡 Fetching notifications:', { isAdmin, endpoint, hasToken: !!token });

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔗 Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('❌ Notification fetch failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📦 Notification response:', result);

      const notificationsData = result.data?.notifications || [];
      const unreadCountData = result.data?.unreadCount || 0;

      console.log('✅ Setting notifications:', { count: notificationsData.length, unread: unreadCountData });

      setNotifications(notificationsData);
      setUnreadCount(unreadCountData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Fetch notifications on component mount and set up polling
  useEffect(() => {
    refreshNotifications();
    
    if (interval > 0) {
      const pollInterval = setInterval(refreshNotifications, interval);
      return () => clearInterval(pollInterval);
    }
  }, [refreshNotifications, interval]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(notifications.map(notif =>
          notif.notification_id === notificationId ? { ...notif, is_read: true } : notif
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [notifications, unreadCount]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(notifications.map(notif => ({ ...notif, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications
  };
};

export default useNotifications;
