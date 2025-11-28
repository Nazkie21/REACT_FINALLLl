import { query } from '../config/db.js';
import { verifyToken } from '../utils/jwt.js';
import { markAsRead, markAllAsRead, getUnreadCount, getAdminUnreadCount } from '../services/notificationService.js';

/**
 * Get notifications for authenticated user (personal notifications only)
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Only get personal notifications (not admin system notifications)
    const notifications = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ?
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );

    // Get only personal notification count (not admin system notifications)
    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

/**
 * Get admin system notifications (admin only - for admin dashboard)
 */
export const getAdminNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log('📡 Admin notifications request:', { userId, userRole, hasUser: !!req.user });
    const limit = parseInt(req.query.limit) || 10;

    console.log('getAdminNotifications - User ID:', userId, 'Role:', userRole);

    if (userRole !== 'admin') {
      console.warn('Access denied for user', userId, 'with role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
        userRole: userRole
      });
    }

    // Get system-wide admin notifications (only admin-specific notification types)
    const adminNotificationTypes = [
      'booking_created',
      'booking_confirmed',
      'booking_cancelled',
      'booking_rescheduled',
      'payment_received',
      'payment_reminder',
      'payment_overdue'
    ];
    
    const placeholders = adminNotificationTypes.map(() => '?').join(',');
    const notifications = await query(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND notification_type IN (${placeholders})
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, ...adminNotificationTypes, limit]
    );

    // For admin view, show unread count for this admin (their notifications)
    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin notifications'
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    await markAsRead(notificationId, userId);

    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

/**
 * Mark all notifications as read (personal notifications only)
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    await markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    });
  }
};

/**
 * Get unread notification count (personal notifications only)
 */
export const getNotificationCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Only count personal notifications, not admin system notifications
    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification count'
    });
  }
};

/**
 * Get user registration notifications (admin only)
 */
export const getUserRegistrationNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const limit = parseInt(req.query.limit) || 10;

    console.log('getUserRegistrationNotifications - User ID:', userId, 'Role:', userRole);

    if (userRole !== 'admin') {
      console.warn('Access denied for user', userId, 'with role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
        userRole: userRole
      });
    }

    const notifications = await query(
      `SELECT * FROM notifications 
       WHERE notification_type IN ('booking_confirmation', 'payment_received', 'level_up', 'badge_earned') AND user_id IS NOT NULL
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: {
        notifications,
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching user registration notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration notifications'
    });
  }
};