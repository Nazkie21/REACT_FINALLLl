import { verifyToken } from '../utils/jwt.js';
import { query } from '../config/db.js';

/**
 * Admin authentication middleware
 * Verifies JWT token and checks if user has admin or instructor role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      token = req.cookies?.token;
    }

    // For development: Allow access without token for testing
    if (!token) {
      // Check environment - if in development, create a default test admin user
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔧 DEV MODE: Creating test admin user (no database check)');
        req.user = {
          id: 999,
          username: 'dev-admin',
          email: 'admin@dev.local',
          role: 'admin'
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token. Please login again.'
      });
    }

    // Special handling for development admin user
    if (process.env.NODE_ENV !== 'production' && decoded.id === 999) {
      console.log('🔧 DEV MODE: Using development admin user');
      req.user = {
        id: 999,
        username: 'dev-admin',
        email: 'admin@dev.local',
        role: 'admin'
      };
      return next();
    }

    // Check if user exists and has admin/instructor role
    // FIX: Remove array destructuring - query returns rows directly
    const users = await query(
      'SELECT id, username, email, role, is_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    // Check if users array exists and has results
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Verify user object has required properties
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User data not found'
      });
    }

    // Check if account is verified
    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address'
      });
    }

    // Check if user has admin or instructor role
    if (user.role !== 'admin' && user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or instructor privileges required.'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin-only middleware (excludes instructors)
 */
export const requireAdminOnly = async (req, res, next) => {
  try {
    // First check admin/instructor
    await requireAdmin(req, res, () => {
      // Then check if it's admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      next();
    });
  } catch (error) {
    console.error('Admin-only middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};