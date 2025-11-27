import { verifyToken } from '../utils/jwt.js';
import { query } from '../config/db.js';

/**
 * Optional authentication - doesn't fail if no token
 * Use for endpoints that support both authenticated and guest users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      token = req.cookies?.token;
    }

    // If no token, allow as guest
    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      req.user = null;
      return next();
    }

    // Get user from database
    const users = await query(
      'SELECT id, username, email, role, is_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!users || users.length === 0) {
      req.user = null;
      return next();
    }

    // Attach user to request
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

/**
 * Required authentication - fails if no valid token
 * Use for endpoints that require authenticated users only
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      token = req.cookies?.token;
    }

    if (!token) {
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

    // Get user from database
    const users = await query(
      'SELECT id, username, email, role, is_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!users || users.length === 0) {
      // User not found in database, but token is valid
      // Attach minimal user info from token for guest/fallback handling
      console.warn(`User ID ${decoded.id} from token not found in database`);
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role || 'student',
        is_verified: false
      };
      return next();
    }

    const user = users[0];

    // Optional: Check if verified (comment out if you don't require email verification)
    // if (!user.is_verified) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Please verify your email address'
    //   });
    // }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};