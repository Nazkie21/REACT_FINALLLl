import { query } from '../config/db.js';

/**
 * Get analytics data
 * GET /api/admin/analytics
 */
export const getAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Build date filter
    let dateFilter = '';
    const params = [];
    if (start_date && end_date) {
      dateFilter = ' AND created_at >= ? AND created_at <= ?';
      params.push(start_date, end_date);
    }

    // Revenue analytics (from transactions table, not bookings)
    const revenueData = await query(
      `SELECT 
       DATE(t.transaction_date) as date,
       COALESCE(SUM(t.amount), 0) as revenue,
       COUNT(*) as transaction_count
       FROM transactions t
       WHERE t.status = 'completed'
       ${dateFilter}
       GROUP BY DATE(t.transaction_date)
       ORDER BY date ASC`,
      params
    );

    // User engagement (lesson_progress table)
    const engagementData = await query(
      `SELECT 
       DATE(lp.completed_at) as date,
       COUNT(DISTINCT lp.student_id) as active_users,
       COUNT(*) as lessons_completed
       FROM lesson_progress lp
       WHERE lp.status = 'completed' ${dateFilter}
       GROUP BY DATE(lp.completed_at)
       ORDER BY date ASC`,
      params
    );

    // Top lessons
    const topLessons = await query(
      `SELECT l.id, l.title, m.name as module_name, COUNT(ump.id) as completion_count
       FROM lessons l
       LEFT JOIN modules m ON l.module_id = m.id
       LEFT JOIN user_module_progress ump ON l.id = ump.lesson_id
       WHERE 1=1 ${dateFilter.replace('created_at', 'ump.completed_at')}
       GROUP BY l.id
       ORDER BY completion_count DESC
       LIMIT 10`,
      params
    );

    // Top paying lessons/services
    const topPayingServices = await query(
      `SELECT service_type, 
       COALESCE(SUM(amount), 0) as total_revenue,
       COUNT(*) as booking_count
       FROM bookings
       WHERE payment_status IN ('paid', 'cash')
       ${dateFilter}
       GROUP BY service_type
       ORDER BY total_revenue DESC`
    );

    // Gamification stats
    const gamificationStats = await query(
      `SELECT 
       COUNT(DISTINCT ua.user_id) as users_with_achievements,
       COUNT(ua.id) as total_achievements_earned,
       COUNT(DISTINCT ua.achievement_id) as unique_achievements
       FROM user_achievements ua
       WHERE 1=1 ${dateFilter.replace('created_at', 'ua.earned_at')}`,
      params
    );

    // Quiz performance
    const quizStats = await query(
      `SELECT 
       AVG(score) as average_score,
       COUNT(*) as total_attempts,
       COUNT(DISTINCT user_id) as unique_participants
       FROM quiz_attempts
       WHERE 1=1 ${dateFilter.replace('created_at', 'completed_at')}`,
      params
    );

    res.json({
      success: true,
      data: {
        revenue: revenueData,
        engagement: engagementData,
        topLessons,
        topPayingServices,
        gamification: gamificationStats[0] || {},
        quizzes: quizStats[0] || {}
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};

/**
 * Get booking report
 * GET /api/admin/reports/bookings
 */
export const getBookingReport = async (req, res) => {
  try {
    const { start_date, end_date, student_id, service_type, status } = req.query;

    let sql = `
      SELECT 
        b.booking_id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as client_name,
        s.service_name,
        b.status,
        b.payment_status,
        COALESCE(t.amount, 0) as amount,
        b.created_at,
        b.user_id
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN services s ON b.service_id = s.service_id
      LEFT JOIN transactions t ON b.booking_id = t.booking_id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ' AND b.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND b.created_at <= ?';
      params.push(end_date);
    }
    if (student_id) {
      sql += ' AND b.user_id = ?';
      params.push(student_id);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.created_at DESC LIMIT 50';

    const bookings = await query(sql, params);

    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Get booking report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking report'
    });
  }
};

/**
 * Get lesson completion report
 * GET /api/admin/reports/lessons
 *
 * Note: The lesson_progress table does not have lp.id, lessons_completed, total_xp,
 * quizzes_passed, or last_accessed columns. Instead we aggregate over existing
 * fields (lesson_id, xp_earned, completed_at) for reporting.
 */
export const getLessonCompletionReport = async (req, res) => {
  try {
    const { start_date, end_date, student_id, module_id } = req.query;

    let sql = `
      SELECT 
        lp.lesson_id as lesson_id,
        u.id as student_id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name,
        COUNT(*) as lessons_completed,
        COALESCE(SUM(lp.xp_earned), 0) as total_xp,
        MAX(lp.completed_at) as last_accessed,
        MAX(lp.completed_at) as completed_at
      FROM lesson_progress lp
      LEFT JOIN users u ON lp.student_id = u.id
      WHERE lp.status = 'completed'
    `;
    const params = [];

    if (start_date) {
      sql += ' AND lp.completed_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND lp.completed_at <= ?';
      params.push(end_date);
    }
    if (student_id) {
      sql += ' AND lp.student_id = ?';
      params.push(student_id);
    }

    sql += ' GROUP BY lp.lesson_id, u.id ORDER BY completed_at DESC LIMIT 50';

    const completions = await query(sql, params);

    res.json({
      success: true,
      data: completions
    });
  } catch (error) {
    console.error('Get lesson completion report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lesson completion report'
    });
  }
};

/**
 * Get gamification report
 * GET /api/admin/reports/gamification
 */
export const getGamificationReport = async (req, res) => {
  try {
    const { start_date, end_date, student_id } = req.query;

    let sql = `
      SELECT u.id, u.first_name, u.last_name, u.email,
      COALESCE(up.total_points, 0) as total_points,
      COALESCE(up.learn_points, 0) as learn_points,
      COALESCE(up.play_points, 0) as play_points,
      (SELECT COUNT(*) FROM user_achievements ua WHERE ua.user_id = u.id) as badges_earned,
      (SELECT MAX(earned_at) FROM user_achievements ua WHERE ua.user_id = u.id) as last_activity
      FROM users u
      LEFT JOIN user_points up ON u.id = up.user_id
      WHERE u.role = 'student'
    `;
    const params = [];

    if (start_date) {
      sql += ' AND u.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND u.created_at <= ?';
      params.push(end_date);
    }
    if (student_id) {
      sql += ' AND u.id = ?';
      params.push(student_id);
    }

    sql += ' ORDER BY up.total_points DESC';

    const users = await query(sql, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get gamification report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gamification report'
    });
  }
};

/**
 * Get transactions report
 * GET /api/admin/reports/transactions
 */
export const getTransactionsReport = async (req, res) => {
  try {
    const { start_date, end_date, payment_method, status } = req.query;

    let sql = `
      SELECT 
        t.id as transaction_id,
        t.booking_id,
        b.amount,
        b.service_type,
        b.payment_status as status,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as client_name,
        t.created_at
      FROM transactions t
      LEFT JOIN bookings b ON t.booking_id = b.booking_id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ' AND t.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND t.created_at <= ?';
      params.push(end_date);
    }
    if (status) {
      sql += ' AND b.payment_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT 50';

    const transactions = await query(sql, params);

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions report'
    });
  }
};

/**
 * Helper function to calculate date ranges based on period
 */
const getDateRange = (period) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate, endDate, prevStartDate, prevEndDate;

  if (period === 'today') {
    startDate = new Date(today);
    endDate = new Date(today);
    prevStartDate = new Date(today);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    prevEndDate = new Date(prevStartDate);
  } else if (period === 'week') {
    const day = today.getDay();
    startDate = new Date(today);
    startDate.setDate(today.getDate() - day);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    prevEndDate = new Date(prevStartDate);
    prevEndDate.setDate(prevEndDate.getDate() + 6);
  } else if (period === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    prevEndDate = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth() + 1, 0);
  } else if (period === 'lastMonth') {
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    startDate = new Date(lastMonthStart);
    endDate = new Date(lastMonthEnd);
    
    prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    prevEndDate = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth() + 1, 0);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    prevStartDate: prevStartDate.toISOString().split('T')[0],
    prevEndDate: prevEndDate.toISOString().split('T')[0]
  };
};

/**
 * GET /api/admin/dashboard/revenue
 * Revenue Card with period comparison
 * Calculates revenue from both transactions table and bookings table
 */
export const getDashboardRevenue = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(period);

    // Current period revenue from paid bookings
    const [currentRevenue] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE payment_status = 'paid' 
       AND DATE(booking_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Previous period revenue from paid bookings
    const [previousRevenue] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings 
       WHERE payment_status = 'paid' 
       AND DATE(booking_date) BETWEEN ? AND ?`,
      [prevStartDate, prevEndDate]
    );

    const current = parseFloat(currentRevenue?.total) || 0;
    const previous = parseFloat(previousRevenue?.total) || 0;
    const percentageChange = previous > 0 ? ((current - previous) / previous * 100).toFixed(2) : 0;

    console.log(`📊 Revenue - Current: ₱${current}, Previous: ₱${previous}, Change: ${percentageChange}%`);

    res.json({
      success: true,
      data: {
        current_revenue: current,
        previous_revenue: previous,
        percentage_change: parseFloat(percentageChange),
        period: startDate + ' to ' + endDate
      },
      meta: {
        timestamp: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('Get dashboard revenue error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'REVENUE_FETCH_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/appointments
 * Total Appointments with breakdown
 */
export const getDashboardAppointments = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(period);

    // Current period bookings
    const [currentData] = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed
       FROM bookings 
       WHERE DATE(booking_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Previous period bookings
    const [previousData] = await query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE DATE(booking_date) BETWEEN ? AND ?`,
      [prevStartDate, prevEndDate]
    );

    const current = currentData?.total || 0;
    const previous = previousData?.total || 0;
    const percentageChange = previous > 0 ? ((current - previous) / previous * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        total: current,
        completed: currentData?.completed || 0,
        pending: currentData?.pending || 0,
        confirmed: currentData?.confirmed || 0,
        percentage_change: parseFloat(percentageChange),
        previous_total: previous
      },
      meta: {
        timestamp: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('Get dashboard appointments error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'APPOINTMENTS_FETCH_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/students
 * Active Students count with new vs returning
 */
export const getDashboardStudents = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(period);

    // Active students (last login within 30 days or recent activity)
    const [activeData] = await query(
      `SELECT 
        COUNT(DISTINCT u.id) as total,
        SUM(CASE WHEN u.created_at >= ? AND u.created_at <= ? THEN 1 ELSE 0 END) as new_students,
        SUM(CASE WHEN u.created_at < ? AND u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as returning_students
       FROM users u
       WHERE u.role = 'student' AND u.deleted_at IS NULL`,
      [startDate, endDate, startDate]
    );

    // Previous period for comparison
    const [previousData] = await query(
      `SELECT COUNT(DISTINCT u.id) as total FROM users u
       WHERE u.role = 'student' AND u.deleted_at IS NULL
       AND (u.last_login BETWEEN DATE_SUB(?, INTERVAL 30 DAY) AND ? OR u.created_at BETWEEN ? AND ?)`,
      [prevStartDate, prevEndDate, prevStartDate, prevEndDate]
    );

    const current = activeData?.total || 0;
    const previous = previousData?.total || 0;
    const percentageChange = previous > 0 ? ((current - previous) / previous * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        total_active: current,
        new_students: activeData?.new_students || 0,
        returning_students: activeData?.returning_students || 0,
        percentage_change: parseFloat(percentageChange)
      },
      meta: {
        timestamp: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('Get dashboard students error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STUDENTS_FETCH_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/completion-rate
 * Lesson Completion Rate
 */
export const getDashboardCompletionRate = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);
    const targetRate = 85;

    const [stats] = await query(
      `SELECT 
        COUNT(*) as total_lessons,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_lessons
       FROM lesson_progress
       WHERE DATE(started_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const total = stats?.total_lessons || 1;
    const completed = stats?.completed_lessons || 0;
    const completionRate = (completed / total * 100).toFixed(2);

    res.json({
      success: true,
      data: {
        completion_rate: parseFloat(completionRate),
        target_rate: targetRate,
        total_lessons: total,
        completed_lessons: completed,
        meets_target: parseFloat(completionRate) >= targetRate
      },
      meta: {
        timestamp: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('Get completion rate error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'COMPLETION_RATE_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/revenue-trend
 * Revenue trend chart data
 * Combines revenue from both transactions and bookings tables
 */
export const getRevenueTrend = async (req, res) => {
  try {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    // Get booking revenue by date (include all bookings, not just paid)
    const trendData = await query(
      `SELECT 
        DATE(booking_date) as date,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM bookings
       WHERE DATE(booking_date) BETWEEN ? AND ?
       GROUP BY DATE(booking_date)
       ORDER BY date ASC`,
      [startDate, endDate]
    );

    // Calculate statistics
    const revenues = trendData.map(d => d.revenue);
    const peak = Math.max(...revenues, 0);
    const low = Math.min(...revenues.filter(r => r > 0), 0);
    const average = revenues.reduce((a, b) => a + b, 0) / trendData.length || 0;

    res.json({
      success: true,
      data: trendData,
      meta: {
        timestamp: new Date().toISOString(),
        statistics: {
          peak: parseFloat(peak.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          average: parseFloat(average.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Get revenue trend error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'REVENUE_TREND_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/bookings-by-service
 * Bookings breakdown by service type
 */
export const getBookingsByService = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);

    const [totalCount] = await query(
      `SELECT COUNT(*) as total FROM bookings 
       WHERE DATE(booking_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const serviceBreakdown = await query(
      `SELECT 
        s.service_name,
        s.instrument,
        COUNT(b.booking_id) as count,
        ROUND(COUNT(b.booking_id) / ? * 100, 2) as percentage
       FROM bookings b
       JOIN services s ON b.service_id = s.service_id
       WHERE DATE(b.booking_date) BETWEEN ? AND ?
       GROUP BY b.service_id, s.service_name, s.instrument
       ORDER BY count DESC`,
      [totalCount?.[0]?.total || 1, startDate, endDate]
    );

    res.json({
      success: true,
      data: serviceBreakdown,
      meta: {
        timestamp: new Date().toISOString(),
        total_bookings: totalCount?.[0]?.total || 0,
        period
      }
    });
  } catch (error) {
    console.error('Get bookings by service error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SERVICE_BREAKDOWN_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/user-segmentation
 * User activity segmentation
 */
export const getUserSegmentation = async (req, res) => {
  try {
    const segmentation = await query(
      `SELECT 
        CASE 
          WHEN u.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
               AND (SELECT COUNT(*) FROM bookings WHERE user_id = u.id AND status = 'completed') > 5
               OR (SELECT COUNT(*) FROM lesson_progress WHERE student_id = u.id AND status = 'completed') > 10
          THEN 'Highly Active'
          WHEN u.last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND (
               (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) > 0 OR
               (SELECT COUNT(*) FROM lesson_progress WHERE student_id = u.id) > 0
          )
          THEN 'Moderate'
          WHEN u.last_login >= DATE_SUB(NOW(), INTERVAL 90 DAY)
          THEN 'Low'
          ELSE 'Inactive'
        END as activity_level,
        COUNT(*) as count
       FROM users u
       WHERE u.role = 'student' AND u.deleted_at IS NULL
       GROUP BY activity_level
       ORDER BY count DESC`
    );

    res.json({
      success: true,
      data: segmentation,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get user segmentation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SEGMENTATION_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/daily-active-users
 * Daily active users chart
 */
export const getDailyActiveUsers = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const dauData = await query(
      `SELECT 
        DATE(last_login) as date,
        COUNT(DISTINCT id) as active_users
       FROM users
       WHERE role = 'student' AND deleted_at IS NULL
       AND last_login >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(last_login)
       ORDER BY date ASC`,
      [days]
    );

    const activeUsers = dauData.map(d => d.active_users).filter(x => x > 0);
    const peak = Math.max(...activeUsers, 0);
    const average = activeUsers.length > 0 ? (activeUsers.reduce((a, b) => a + b, 0) / activeUsers.length).toFixed(2) : 0;
    const lowest = Math.min(...activeUsers, 0);

    res.json({
      success: true,
      data: dauData,
      meta: {
        timestamp: new Date().toISOString(),
        statistics: {
          peak,
          average: parseFloat(average),
          lowest
        },
        days
      }
    });
  } catch (error) {
    console.error('Get daily active users error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DAU_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/top-students
 * Top students by XP with pagination
 */
export const getTopStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await query(
      `SELECT COUNT(DISTINCT ux.student_id) as total FROM user_xp ux
       JOIN users u ON ux.student_id = u.id WHERE u.deleted_at IS NULL`
    );
    const total = countResult?.total || 0;

    // Get top students
    const topStudents = await query(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY ux.total_xp DESC) as rank,
        u.id as user_id,
        u.first_name,
        u.last_name,
        ux.current_level as level,
        ux.total_xp,
        (SELECT COUNT(*) FROM lesson_progress lp 
         WHERE lp.student_id = u.id AND lp.status = 'completed') as modules_completed,
        (SELECT COUNT(*) FROM user_badges ub WHERE ub.student_id = u.id) as badges_count,
        u.last_login as last_active
       FROM user_xp ux
       JOIN users u ON ux.student_id = u.id
       WHERE u.deleted_at IS NULL
       ORDER BY ux.total_xp DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: topStudents,
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          per_page: limit,
          total_items: total
        }
      }
    });
  } catch (error) {
    console.error('Get top students error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TOP_STUDENTS_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/recent-users
 * Recently joined users
 */
export const getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;

    const recentUsers = await query(
      `SELECT 
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as user_name,
        COALESCE(ux.current_level, 1) as level,
        COALESCE(ux.total_xp, 0) as points,
        u.email,
        CASE WHEN u.is_verified = 1 THEN 'active' ELSE 'pending' END as status,
        u.created_at
       FROM users u
       LEFT JOIN user_xp ux ON u.id = ux.student_id
       WHERE u.role = 'student' AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: recentUsers,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get recent users error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RECENT_USERS_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/new-registrations
 * New registrations today/this week
 */
export const getNewRegistrations = async (req, res) => {
  try {
    const period = req.query.period || 'today';
    let dateFilter = 'DATE(created_at) = CURDATE()';

    if (period === 'week') {
      dateFilter = `YEARWEEK(created_at) = YEARWEEK(NOW())`;
    }

    const [countResult] = await query(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'student' AND ${dateFilter}`
    );

    const registrations = await query(
      `SELECT 
        id,
        CONCAT(first_name, ' ', COALESCE(last_name, '')) as name,
        email,
        created_at,
        role
       FROM users 
       WHERE role = 'student' AND ${dateFilter}
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: {
        count: countResult?.count || 0,
        registrations
      },
      meta: {
        timestamp: new Date().toISOString(),
        period
      }
    });
  } catch (error) {
    console.error('Get new registrations error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'NEW_REGISTRATIONS_ERROR'
    });
  }
};

/**
 * GET /api/admin/dashboard/todays-schedule
 * Upcoming bookings schedule (next 7 days)
 */
export const getTodaysSchedule = async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Get next 7 days of bookings
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('getTodaysSchedule - Querying from:', date, 'to:', endDateStr);

    let statusFilter = '';
    if (status !== 'all') {
      statusFilter = `AND b.status = '${status}'`;
    }

    const schedule = await query(
      `SELECT 
        b.booking_id,
        b.start_time,
        b.end_time,
        b.booking_date,
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as student_name,
        CONCAT(i.first_name, ' ', COALESCE(i.last_name, '')) as instructor_name,
        s.service_name,
        b.status,
        b.checked_in,
        b.checked_in_at
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN users i ON b.instructor_id = i.id
       JOIN services s ON b.service_id = s.service_id
       WHERE DATE(b.booking_date) BETWEEN ? AND ? ${statusFilter}
       ORDER BY b.booking_date ASC, b.start_time ASC`,
      [date, endDateStr]
    );

    console.log('getTodaysSchedule - Query result count:', schedule ? schedule.length : 0);

    res.json({
      success: true,
      data: schedule || [],
      meta: {
        timestamp: new Date().toISOString(),
        dateRange: { start: date, end: endDateStr },
        count: schedule ? schedule.length : 0
      }
    });
  } catch (error) {
    console.error('Get todays schedule error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SCHEDULE_ERROR',
      details: error.stack
    });
  }
};
