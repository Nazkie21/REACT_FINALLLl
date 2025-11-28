import { query } from "../config/db.js";
import { getIO } from "../config/socket.js";
import { notifyAdmins, notifyUser } from "../services/notificationService.js";

/**
 * Get all bookings with comprehensive filtering
 * GET /api/admin/bookings?page=1&limit=10&status=confirmed&service=piano&instructor=5&dateStart=2024-02-01&dateEnd=2024-02-28&search=john&paymentStatus=paid
 */
export const getBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      date,
      dateStart,
      dateEnd,
      service_type,
      service,
      instructor_id,
      instructor,
      status,
      paymentStatus,
      search,
      participants,
      ref
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT b.booking_id, b.booking_reference, b.user_id, b.instructor_id, b.service_id,
      b.customer_name, b.customer_email, b.customer_contact, b.customer_address,
      b.booking_date, b.start_time, b.end_time, b.duration_minutes,
      b.service_type, b.service_name, b.status, b.payment_status,
      b.qr_code, b.qr_code_path, b.qr_code_data, b.checked_in, b.checked_in_at,
      b.room_location, b.number_of_people, b.total_amount, b.created_at, b.updated_at,
      u.first_name,
      u.last_name,
      u.email AS customer_email,
      u.contact AS customer_contact,
      i.first_name AS instructor_first_name,
      i.last_name AS instructor_last_name,
      i.specialization,
      s.service_name,
      s.instrument
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN users i ON b.instructor_id = i.id
      LEFT JOIN services s ON b.service_id = s.service_id
      WHERE 1=1
    `;

    const params = [];

    // Date filters
    if (date) {
      sql += " AND DATE(b.booking_date) = ?";
      params.push(date);
    }
    if (dateStart) {
      sql += " AND DATE(b.booking_date) >= ?";
      params.push(dateStart);
    }
    if (dateEnd) {
      sql += " AND DATE(b.booking_date) <= ?";
      params.push(dateEnd);
    }

    // Service filter (check both old column and new schema)
    if (service_type || service) {
      const serviceVal = service_type || service;
      sql += " AND (s.instrument = ? OR s.service_name = ? OR b.service_id IN (SELECT service_id FROM services WHERE instrument = ? OR service_name = ?))";
      params.push(serviceVal, serviceVal, serviceVal, serviceVal);
    }

    // Instructor filter
    if (instructor_id || instructor) {
      const instrId = instructor_id || instructor;
      if (!isNaN(instrId)) {
        sql += " AND b.instructor_id = ?";
        params.push(parseInt(instrId));
      }
    }

    // Status filter
    if (status) {
      sql += " AND b.status = ?";
      params.push(status);
    }

    // Payment status filter (derived from transactions/invoices)
    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        sql += ` AND b.booking_id IN (
          SELECT booking_id FROM transactions 
          WHERE status = 'completed' AND refunded_amount IS NULL
        )`;
      } else if (paymentStatus === 'pending') {
        sql += ` AND (
          b.booking_id NOT IN (SELECT booking_id FROM transactions WHERE status = 'completed')
          OR b.booking_id IN (SELECT booking_id FROM transactions WHERE refunded_amount > 0)
        )`;
      } else if (paymentStatus === 'refunded') {
        sql += ` AND b.booking_id IN (
          SELECT booking_id FROM transactions 
          WHERE refunded_amount > 0
        )`;
      }
    }

    // Search (name, email, service, booking_id)
    if (search) {
      const searchTerm = `%${search}%`;
      sql += ` AND (
        u.first_name LIKE ? OR
        u.last_name LIKE ? OR
        u.email LIKE ? OR
        s.service_name LIKE ? OR
        b.booking_reference LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filter by booking reference (for direct links from notifications)
    if (ref) {
      sql += " AND b.booking_reference = ?";
      params.push(ref);
    }

    // Count total matching records
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(DISTINCT b.booking_id) AS count FROM");
    const countResult = await query(countSql, params);
    const total = countResult[0]?.count || 0;

    // Fetch paginated records
    sql += " ORDER BY b.booking_date DESC, b.start_time DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    const bookings = await query(sql, params);

    // Enrich bookings with payment status
    const enrichedBookings = bookings.map((booking) => {
      // Use the payment_status directly from bookings table
      const paymentStatus = booking.payment_status || 'pending';

      // Build instructor name - only show if instructor_id exists
      let instructorName = 'Unassigned';
      if (booking.instructor_id && booking.instructor_first_name) {
        instructorName = `${booking.instructor_first_name} ${booking.instructor_last_name || ''}`.trim();
      }

      return {
        ...booking,
        customer_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim(),
        instructor_name: instructorName,
        instructor_id: booking.instructor_id || null,
        specialization: booking.specialization || null,
        payment_status: paymentStatus,
        qr_code: booking.qr_code_data || booking.qr_code_path || null
      };
    });

    res.json({
      success: true,
      data: {
        bookings: enrichedBookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create new booking
 * POST /api/admin/bookings
 */
export const createBooking = async (req, res) => {
  try {
    const { user_id, booking_date, start_time, service_id, duration_minutes, instructor_id } = req.body;

    if (!user_id || !booking_date || !start_time || !service_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user_id, booking_date, start_time, service_id",
      });
    }

    // Calculate end time
    const durationMin = duration_minutes || 60;
    const [hh, mm] = start_time.split(':');
    const endMinutes = (parseInt(hh) * 60 + parseInt(mm)) + durationMin;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;
    const end_time = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;

    const result = await query(
      `INSERT INTO bookings (booking_reference, user_id, service_id, instructor_id, booking_date, start_time, end_time, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [`REF-${Date.now()}`, user_id, service_id, instructor_id || null, booking_date, start_time, end_time, durationMin]
    );

    // Notify admins
    await notifyAdmins(
      "booking",
      `New booking created for ${booking_date} at ${start_time}`,
      `/admin/bookings`
    );

    res.json({
      success: true,
      message: "Booking created successfully",
      data: { bookingId: result.insertId },
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
};

/**
 * Update booking
 * PUT /api/admin/bookings/:id
 */
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_date, start_time, service_id, duration_minutes, status } = req.body;

    const updates = [];
    const params = [];

    if (booking_date !== undefined) {
      updates.push("booking_date = ?");
      params.push(booking_date);
    }
    if (start_time !== undefined) {
      updates.push("start_time = ?");
      params.push(start_time);
      
      // If start_time is updated, recalculate end_time
      if (duration_minutes !== undefined || true) {
        const durationMin = duration_minutes || 60;
        const [hh, mm] = start_time.split(':');
        const endMinutes = (parseInt(hh) * 60 + parseInt(mm)) + durationMin;
        const endHour = Math.floor(endMinutes / 60) % 24;
        const endMin = endMinutes % 60;
        const end_time = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
        updates.push("end_time = ?");
        params.push(end_time);
      }
    }
    if (duration_minutes !== undefined) {
      updates.push("duration_minutes = ?");
      params.push(duration_minutes);
    }
    if (service_id !== undefined) {
      updates.push("service_id = ?");
      params.push(service_id);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    params.push(id);

    await query(`UPDATE bookings SET ${updates.join(", ")} WHERE booking_id = ?`, params);

    // Notify admins about rescheduling
    const bookingDetails = await query('SELECT * FROM bookings WHERE booking_id = ?', [id]);
    const booking = bookingDetails && bookingDetails[0];
    await notifyAdmins(
      "booking_rescheduled",
      `BOOKING RESCHEDULED\nBooking ID: ${id}\nNew Date: ${booking_date || booking?.booking_date}\nNew Time: ${start_time || booking?.start_time}`,
      `/admin/bookings?id=${id}`
    );

    res.json({
      success: true,
      message: "Booking updated successfully",
    });
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update booking",
    });
  }
};

/**
 * Delete booking
 * DELETE /api/admin/bookings/:id
 */
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details BEFORE deletion for notification
    const bookingDetails = await query('SELECT * FROM bookings WHERE booking_id = ?', [id]);
    const booking = bookingDetails && bookingDetails[0];

    await query("DELETE FROM bookings WHERE booking_id = ?", [id]);
    
    await notifyAdmins(
      "booking_cancelled",
      `BOOKING DELETED\nBooking ID: ${id}\nClient: ${booking?.customer_name || 'Unknown'}\nDate: ${booking?.booking_date}\nTime: ${booking?.start_time}`,
      `/admin/bookings`
    );

    res.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Delete booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
    });
  }
};

/**
 * Confirm a pending booking
 * POST /api/admin/bookings/:id/confirm
 */
export const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Get booking details
    const bookings = await query(
      `SELECT b.*, u.email, u.first_name, u.last_name, s.service_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN services s ON b.service_id = s.service_id
       WHERE b.booking_id = ?`,
      [id]
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const booking = bookings[0];

    if (booking.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: "Booking is already confirmed",
      });
    }

    // Update booking status
    await query(
      "UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE booking_id = ?",
      [id]
    );

    // Notify admins about confirmation (use booking_received type for admin notifications)
    try {
      await notifyAdmins(
        'booking_received',
        `BOOKING CONFIRMED\nClient: ${booking.first_name} ${booking.last_name}\nService: ${booking.service_name}\nDate: ${booking.booking_date} at ${booking.start_time}`,
        `/admin/bookings?id=${id}`
      );
    } catch (e) {
      console.warn('Warning: Failed to send admin notification:', e.message);
    }

    // Send confirmation notification to student
    try {
      if (booking.user_id) {
        await notifyUser(
          booking.user_id,
          'booking_confirmation',
          `Your ${booking.service_name} booking on ${booking.booking_date} at ${booking.start_time} has been confirmed!`
        );
      }
    } catch (e) {
      console.warn('Warning: Failed to send user notification:', e.message);
    }

    res.json({
      success: true,
      message: "Booking confirmed successfully",
      data: { bookingId: id, status: 'confirmed' },
    });
  } catch (error) {
    console.error("Confirm booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm booking",
    });
  }
};

/**
 * Check-in a booking
 * POST /api/admin/bookings/:id/checkin
 */
export const checkInBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get booking
    const bookings = await query(
      `SELECT * FROM bookings WHERE booking_id = ?`,
      [id]
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const booking = bookings[0];

    // Check if already checked in
    if (booking.checked_in) {
      return res.status(400).json({
        success: false,
        message: "Booking already checked in",
      });
    }

    // Check if booking is today (optional validation)
    const today = new Date().toISOString().split('T')[0];
    const bookingDate = booking.booking_date.toISOString ? booking.booking_date.toISOString().split('T')[0] : booking.booking_date;
    
    if (bookingDate !== today) {
      return res.status(400).json({
        success: false,
        message: "Can only check in bookings for today",
      });
    }

    // Update booking
    await query(
      "UPDATE bookings SET checked_in = 1, checked_in_at = NOW(), status = 'in_progress' WHERE booking_id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Booking checked in successfully",
      data: { bookingId: id, checkedInAt: new Date() },
    });
  } catch (error) {
    console.error("Check-in booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check in booking",
    });
  }
};

/**
 * Complete a booking and award XP
 * POST /api/admin/bookings/:id/complete
 */
export const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, xpAwarded } = req.body;

    // Get booking
    const bookings = await query(
      `SELECT b.*, s.service_name FROM bookings b
       LEFT JOIN services s ON b.service_id = s.service_id
       WHERE b.booking_id = ?`,
      [id]
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const booking = bookings[0];

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Booking is already completed",
      });
    }

    // Update booking to completed
    await query(
      "UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE booking_id = ?",
      [id]
    );

    // Award XP to student (if applicable)
    const xpToAward = xpAwarded || 100; // Default 100 XP per lesson
    if (booking.user_id) {
      try {
        // user_xp table uses student_id as the foreign key (see lessonController)
        const xpRecords = await query(
          "SELECT * FROM user_xp WHERE student_id = ? LIMIT 1",
          [booking.user_id]
        );

        if (xpRecords && xpRecords.length > 0) {
          // Update existing XP record
          await query(
            "UPDATE user_xp SET total_xp = total_xp + ?, last_earned_at = NOW() WHERE student_id = ?",
            [xpToAward, booking.user_id]
          );
        } else {
          // Create new XP record
          await query(
            "INSERT INTO user_xp (student_id, total_xp, last_earned_at) VALUES (?, ?, NOW())",
            [booking.user_id, xpToAward]
          );
        }

        // Send completion notification
        try {
          await getIO().emit('notification', {
            userId: booking.user_id,
            type: 'booking_completed',
            title: 'Lesson Completed!',
            message: `Your ${booking.service_name} lesson has been completed. You earned ${xpToAward} XP!`,
            bookingId: id,
            xpAwarded: xpToAward
          });
        } catch (e) {
          console.warn('Warning: Failed to send completion notification:', e.message);
        }
      } catch (error) {
        console.warn('Warning: Failed to award XP:', error.message);
      }
    }

    res.json({
      success: true,
      message: "Booking completed successfully",
      data: { 
        bookingId: id, 
        status: 'completed',
        xpAwarded: xpToAward
      },
    });
  } catch (error) {
    console.error("Complete booking error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete booking",
    });
  }
};

/**
 * Get available time slots
 * GET /api/admin/bookings/slots
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { date, instructor_id } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required",
      });
    }

    let bookingQuery = `SELECT start_time, duration_minutes FROM bookings 
                        WHERE booking_date = ? AND status != 'cancelled'`;
    const bookingParams = [date];

    if (instructor_id) {
      bookingQuery += " AND instructor_id = ?";
      bookingParams.push(instructor_id);
    }

    const booked = await query(bookingQuery, bookingParams);

    // Generate 10 AM – 8 PM slots in 30-minute intervals
    const allSlots = [];
    for (let hour = 10; hour < 20; hour++) {
      allSlots.push(`${hour.toString().padStart(2, "0")}:00`);
      allSlots.push(`${hour.toString().padStart(2, "0")}:30`);
    }

    // Calculate occupied time slots
    const occupiedSlots = new Set();
    booked.forEach(booking => {
      const [bHour, bMin] = booking.start_time.split(':').map(Number);
      const startMinutes = bHour * 60 + bMin;
      const endMinutes = startMinutes + (booking.duration_minutes || 60);

      for (let min = startMinutes; min < endMinutes; min += 30) {
        const slotHour = Math.floor(min / 60);
        const slotMin = min % 60;
        const slotStr = `${slotHour.toString().padStart(2, '0')}:${slotMin.toString().padStart(2, '0')}`;
        occupiedSlots.add(slotStr);
      }
    });

    const availableSlots = allSlots.filter(slot => !occupiedSlots.has(slot));

    res.json({
      success: true,
      data: { 
        availableSlots, 
        bookedSlots: Array.from(occupiedSlots),
        date 
      },
    });
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch time slots",
    });
  }
};