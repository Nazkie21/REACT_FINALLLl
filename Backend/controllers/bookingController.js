import { query, getConnection } from '../config/db.js';
import { verifyToken } from '../utils/jwt.js';
import qrService from '../services/qrService.js';
import bookingEmailService from '../services/bookingEmailService.js';
import { notifyUser, notifyAdmins } from '../services/notificationService.js';
import {
  notifyBookingCancelled,
  notifyBookingRescheduled
} from '../services/userNotificationService.js';
import { scheduleBookingReminders, cancelBookingReminders, rescheduleBookingReminders } from '../services/reminderService.js';
import { createInvoice, getInvoiceStatus } from '../utils/xendit.js';
import crypto from 'crypto';

/**
 * Booking Controller
 * Handles all booking-related operations
 */

// Pricing per hour (in PHP)
const PRICING = {
  music_lesson: 500,
  recording: 1500,
  rehearsal: 800,
  dance: 600,
  arrangement: 2000,
  voiceover: 1000
};

/**
 * Generate unique booking ID
 */
function generateBookingId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MIX-${timestamp}-${random}`;
}

/**
 * Calculate booking amount
 */
function calculateAmount(serviceType, hours) {
  const rate = PRICING[serviceType] || PRICING.rehearsal;
  return rate * parseInt(hours);
}

/**
 * Check for time conflicts — UPDATED VERSION
 * Fixed to match actual database schema (start_time, end_time, duration_minutes, status)
 */
async function checkTimeConflict(bookingDate, startTime, durationMinutes, excludeBookingId = null) {
  try {
    // Calculate end time
    const [timeHours, timeMinutes] = startTime.split(':').map(Number);
    const startMinutes = timeHours * 60 + timeMinutes;
    const endMinutes = startMinutes + durationMinutes;

    // Convert to time strings for comparison
    const startTimeStr = `${Math.floor(startMinutes / 60).toString().padStart(2, '0')}:${(startMinutes % 60).toString().padStart(2, '0')}:00`;
    const endTimeStr = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}:00`;

    // Check for overlapping bookings
    // Two time ranges overlap if: existing_start < new_end AND existing_end > new_start
    let conflictQuery = `
      SELECT * FROM bookings 
      WHERE booking_date = ?
      AND status NOT IN ('cancelled')
      AND start_time < ?
      AND end_time > ?
    `;

    const params = [
      bookingDate,
      endTimeStr,      // new booking end time
      startTimeStr     // new booking start time
    ];

    if (excludeBookingId) {
      conflictQuery += ' AND booking_id != ?';
      params.push(excludeBookingId);
    }

    const conflicts = await query(conflictQuery, params);
    return conflicts.length > 0;
  } catch (error) {
    console.error('Error checking time conflict:', error);
    return false;
  }
}

/**
 * Helper: Notify admins
 */
// Using `notifyAdmins` imported from notificationService.js

/**
 * Create booking from landing page input
 */
export const createInitialBooking = async (req, res) => {
  try {
    const { name, birthday, hours } = req.body;

    if (!name || !birthday || !hours) {
      return res.status(400).json({
        success: false,
        message: 'Name, birthday, and hours are required'
      });
    }

    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 8) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be between 1 and 8'
      });
    }

    res.json({
      success: true,
      message: 'Booking data saved',
      data: { name, birthday, hours: hoursNum }
    });
  } catch (error) {
    console.error('Error creating initial booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user data for auto-fill
 */
export const getUserData = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const user = await query(
      'SELECT id, first_name, last_name, email, birthday, contact, home_address FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = user[0];

    res.json({
      success: true,
      data: {
        name: `${userData.first_name} ${userData.last_name}`,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        birthday: userData.birthday,
        contact: userData.contact,
        homeAddress: userData.home_address
      }
    });
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create new booking
 * Maps frontend data to correct database schema
 */
export const createBooking = async (req, res) => {
  try {
    const {
      name,
      birthday,
      email,
      contact,
      address,
      service,
      date,
      timeSlot,
      duration,
      people,
      payment,
      confirmationId,
      totalAmount,
      instructor_id
    } = req.body;

    // Map frontend field names to database column names
    const serviceType = service;
    const bookingDate = date;
    const startTime = timeSlot; // New field name
    const paymentMethod = payment;
    const durationMinutes = parseInt(duration) || 60; // Duration is already in minutes
    const bookingHours = Math.round((parseInt(duration) || 60) / 60); // Convert to hours for display

    if (!email || !contact || !serviceType || !bookingDate || !startTime) {
      console.log('Validation failed. Received:', { email, contact, serviceType, bookingDate, startTime });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (bookingHours < 1 || bookingHours > 12) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be between 1 and 12'
      });
    }

    // Get or create user
    let userId = req.user?.id || null;
    
    if (!userId && email) {
      // Check if user exists by email
      const existingUserResult = await query('SELECT id FROM users WHERE email = ?', [email]);
      const existingUser = existingUserResult && existingUserResult[0];
      
      if (!existingUser) {
        // Create new user for guest booking
        const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);
        try {
          const result = await query(
            `INSERT INTO users (username, first_name, last_name, email, contact, home_address, role, is_verified)
             VALUES (?, ?, ?, ?, ?, ?, 'student', 0)`,
            [username, name?.split(' ')[0] || 'Guest', name?.split(' ')[1] || '', email, contact, address || null]
          );
          userId = result.insertId;
        } catch (err) {
          console.error('Error creating guest user:', err);
          // Continue anyway with null user_id
        }
      } else {
        userId = existingUser.id;
      }
    }

    // CONFIRM NO TIME CONFLICT
    const hasConflict = await checkTimeConflict(bookingDate, startTime, durationMinutes);
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    const totalPrice = totalAmount || calculateAmount(serviceType, bookingHours);

    // Calculate end time
    const [hh, mm] = startTime.split(':');
    const endMinutes = (parseInt(hh) * 60 + parseInt(mm)) + durationMinutes;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;

    // Get service_id from services table based on service name/type
    let serviceId = null;
    try {
      const serviceResult = await query(
        'SELECT service_id FROM services WHERE service_name = ? OR instrument = ? LIMIT 1',
        [serviceType, serviceType]
      );
      const service = serviceResult && serviceResult[0];
      if (service) {
        serviceId = service.service_id;
      } else {
        const fallbackResult = await query(
          `SELECT service_id FROM services 
           WHERE LOWER(service_name) = LOWER(?) 
           OR LOWER(instrument) = LOWER(?) 
           OR service_name LIKE ? 
           LIMIT 1`,
          [serviceType, serviceType, `%${serviceType}%`]
        );
        const fallbackService = fallbackResult && fallbackResult[0];
        if (fallbackService) {
          serviceId = fallbackService.service_id;
        } else {
          const lastResortResult = await query(
            'SELECT service_id FROM services WHERE is_active = 1 LIMIT 1'
          );
          serviceId = lastResortResult?.[0]?.service_id || null;
        }
      }
    } catch (err) {
      console.error('Error fetching service:', err);
    }

    if (!serviceId) {
      try {
        const availableServices = await query(
          'SELECT service_id, service_name, instrument FROM services'
        );
        console.error('Service lookup failed for:', serviceType);
        console.error('Available services:', availableServices);
      } catch (logErr) {
        console.error('Failed to log available services:', logErr);
      }

      return res.status(400).json({
        success: false,
        message: `Service "${serviceType}" not found. Please contact support.`
      });
    }

    // Create booking reference
    const bookingReference = `REF-${Date.now()}`;
    
    // Insert booking (let database auto-generate booking_id)
    const result = await query(
      `INSERT INTO bookings 
       (booking_reference, user_id, customer_name, customer_email, customer_contact, customer_address, 
        service_id, instructor_id, booking_date, start_time, end_time, duration_minutes, status, 
        qr_code, user_notes, total_amount, payment_status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        bookingReference,
        userId,
        name || null,
        email || null,
        contact || null,
        address || null,
        serviceId,
        instructor_id || null,
        bookingDate,
        startTime,
        endTime,
        durationMinutes,
        'pending',
        null,
        JSON.stringify({ original_service: serviceType, payment_method: paymentMethod }),
        totalPrice,
        'pending'
      ]
    );
    
    const bookingId = result.insertId;

    // If payment method is Cash, keep as pending and generate QR code
    if (paymentMethod === 'Cash') {
      try {
        // Keep payment status as pending (will be marked paid when cash is received)
        // No need to update - already set to 'pending' in INSERT

        // Generate QR code for this booking if qrService is available
        if (qrService && typeof qrService.generateBookingQR === 'function') {
          const qrResult = await qrService.generateBookingQR({
            booking_id: bookingId,
            booking_date: bookingDate,
            booking_time: startTime,
            service_type: serviceType,
          }, bookingId, bookingReference);

          if (qrResult && qrResult.success) {
            await query(
              'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
              [qrResult.qrPath, qrResult.qrDataUrl, bookingId]
            );
          } else {
            console.warn('QR generation failed for cash booking', bookingId, qrResult?.error);
          }
        }
      } catch (qrCashErr) {
        console.warn('Error handling cash payment QR generation:', qrCashErr.message);
      }
    }

    let paymentUrl = null;
    let invoiceCreated = false;

    // For ONLINE payments: Create invoice and Xendit link
    if (paymentMethod === 'GCash' || paymentMethod === 'Credit Card' || paymentMethod === 'PayMaya') {
      try {
        const invoiceResult = await createInvoice({
          externalId: bookingId.toString(),
          amount: totalPrice,
          payerEmail: email,
          description: `MixLab Studio - ${serviceType} Booking`,
          metadata: {
            booking_id: bookingId,
            service_type: serviceType,
            booking_date: bookingDate,
            start_time: startTime
          }
        });

        if (invoiceResult?.success) {
          paymentUrl = invoiceResult.data.invoice_url;
          invoiceCreated = true;
          
          // Store invoice reference in bookings table
          try {
            await query(
              'UPDATE bookings SET xendit_invoice_id = ? WHERE booking_id = ?',
              [invoiceResult.data.id, bookingId]
            );
            console.log(`Stored Xendit invoice ID ${invoiceResult.data.id} for booking ${bookingId}`);
          } catch (invoiceErr) {
            console.warn('Could not store invoice ID:', invoiceErr.message);
          }
          
          // Also store in transactions table
          try {
            await query(
              'INSERT INTO transactions (transaction_reference, booking_id, user_id, amount, payment_method, status) VALUES (?, ?, ?, ?, ?, "pending")',
              [`TXN-${bookingId}`, bookingId, userId, totalPrice, paymentMethod]
            );
          } catch (txErr) {
            console.warn('Could not create transaction record:', txErr.message);
          }
        }
      } catch (error) {
        console.error('Xendit error:', error);
      }
    }

    // Send confirmation email
    try {
      const bookingData = {
        booking_id: bookingId,
        name,
        email,
        service_type: serviceType,
        booking_date: bookingDate,
        start_time: startTime,
        duration_minutes: durationMinutes,
        payment_method: paymentMethod,
        total_price: totalPrice
      };
      
      await bookingEmailService.sendBookingConfirmation(bookingData);
    } catch (emailErr) {
      console.warn('Email send failed:', emailErr.message);
    }

    // Send notification to admin about new booking
    try {
      const endTimeStr = endTime ? ` - ${endTime}` : '';
      await notifyAdmins(
        'booking_created',
        `NEW BOOKING CREATED\nName: ${name}\nEmail: ${email}\nContact: ${contact}\nService: ${serviceType}\nDate: ${bookingDate} at ${startTime}${endTimeStr}\nDuration: ${bookingHours} hour(s)\nAmount: ₱${totalPrice}\nRef: ${bookingReference}`,
        `/admin/bookings?ref=${bookingReference}`
      );
    } catch (notifErr) {
      console.warn('Failed to send admin notification:', notifErr.message);
    }

    if (userId) {
      try {
        await notifyUser(
          userId,
          'booking_confirmation',
          `Your ${serviceType} booking (${bookingReference}) on ${bookingDate} at ${startTime} has been successfully created!`
        );
      } catch (userNotifErr) {
        console.warn('Failed to send user booking notification:', userNotifErr.message);
      }

      // Schedule booking reminders (1 day and 1 hour before)
      try {
        await scheduleBookingReminders(
          bookingId,
          userId,
          bookingDate,
          startTime,
          serviceType,
          bookingReference
        );
      } catch (reminderErr) {
        console.warn('Failed to schedule booking reminders:', reminderErr.message);
      }
    }

    // Log activity
    try {
      await query(
        'INSERT INTO activity_logs (user_id, action, entity_type, description, success) VALUES (?, ?, ?, ?, ?)',
        [userId || null, 'booking_created', 'booking', JSON.stringify({ booking_id: bookingId, booking_reference: bookingReference, service_type: serviceType }), 1]
      );
    } catch (logErr) {
      console.warn('Warning: Failed to log activity:', logErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking: {
          booking_id: bookingId,
          booking_reference: bookingReference,
          status: 'pending',
          total_price: totalPrice,
          service_type: serviceType,
          booking_date: bookingDate,
          start_time: startTime,
          duration_minutes: durationMinutes
        },
        paymentUrl,
        redirectUrl: paymentUrl || `/?booking=success&id=${bookingId}`
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  }
};

/**
 * Get user's bookings
 */
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await query(
      `SELECT 
        b.booking_id,
        b.booking_reference,
        b.booking_date,
        b.start_time,
        b.duration_minutes,
        b.status,
        b.payment_status,
        b.user_notes,
        b.instructor_id,
        b.qr_code_data,
        b.qr_code_path,
        s.service_name,
        s.instrument,
        i.first_name as instructor_first_name,
        i.last_name as instructor_last_name,
        i.specialization
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.service_id
       LEFT JOIN users i ON b.instructor_id = i.id
       WHERE b.user_id = ? 
       ORDER BY b.booking_date DESC, b.start_time DESC`,
      [userId]
    );

    // Format bookings with service type and instructor info
    const formattedBookings = bookings.map(booking => {
      let notes = {};
      try {
        notes = booking.user_notes ? JSON.parse(booking.user_notes) : {};
      } catch (e) {
        notes = {};
      }

      const serviceType = notes.original_service || booking.instrument || booking.service_name || 'N/A';
      const hours = booking.duration_minutes ? Math.ceil(booking.duration_minutes / 60) : 1;

      let instructor = null;
      if (booking.instructor_id && booking.instructor_first_name) {
        instructor = {
          instructor_id: booking.instructor_id,
          instructor_name: `${booking.instructor_first_name} ${booking.instructor_last_name || ''}`.trim(),
          specialization: booking.specialization || 'General'
        };
      }

      return {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        booking_date: booking.booking_date,
        booking_time: booking.start_time,
        service_type: serviceType,
        status: booking.status,
        payment_status: booking.payment_status,
        hours,
        instructor,
        qr_code_url: booking.qr_code_data || booking.qr_code_path
      };
    });

    res.json({
      success: true,
      data: { bookings: formattedBookings }
    });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

/**
 * Get specific booking by ID (for public access - after payment)
 * Used by landing page to display booking details with QR code
 */
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    console.log(`Fetching booking with ID: ${bookingId}`);

    const bookings = await query(
      `SELECT 
         b.booking_id,
         b.booking_reference,
         b.booking_date,
         b.start_time,
         b.duration_minutes,
         b.status,
         b.payment_status,
         b.qr_code,
         b.qr_code_path,
         b.qr_code_data,
         b.user_notes,
         b.created_at,
         b.customer_name,
         b.customer_email,
         b.customer_contact,
         b.customer_address,
         b.instructor_id,
         u.first_name,
         u.last_name,
         u.email,
         u.contact,
         s.service_name,
         s.instrument,
         i.first_name as instructor_first_name,
         i.last_name as instructor_last_name,
         i.specialization
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN services s ON b.service_id = s.service_id
       LEFT JOIN users i ON b.instructor_id = i.id AND i.role = 'instructor'
       WHERE b.booking_id = ?
       LIMIT 1`,
      [bookingId]
    );

    console.log(`Query result for booking ${bookingId}:`, bookings ? `Found ${bookings.length} booking(s)` : 'No result');

    if (!bookings || bookings.length === 0) {
      console.warn(`Booking ${bookingId} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Fallback: generate QR code if paid booking has no QR yet (for manually inserted rows)
    if (booking.payment_status === 'paid' && !booking.qr_code_data && qrService && typeof qrService.generateBookingQR === 'function') {
      try {
        console.log(`🔄 Generating missing QR for booking ${booking.booking_id}...`);
        const qrResult = await qrService.generateBookingQR({
          booking_id: booking.booking_id,
          booking_date: booking.booking_date,
          booking_time: booking.start_time,
          service_type: booking.service_name || booking.instrument,
        }, booking.booking_id, booking.booking_reference);
        if (qrResult && qrResult.success) {
          await query(
            'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
            [qrResult.qrPath, qrResult.qrDataUrl, booking.booking_id]
          );
          booking.qr_code_path = qrResult.qrPath;
          booking.qr_code_data = qrResult.qrDataUrl;
          console.log(`✅ QR generated and saved for booking ${booking.booking_id}`);
        } else {
          console.warn(`⚠️ QR generation failed for booking ${booking.booking_id}:`, qrResult?.error);
        }
      } catch (err) {
        console.warn('QR fallback error:', err.message);
      }
    }

    let notes = {};
    try {
      notes = booking.user_notes ? JSON.parse(booking.user_notes) : {};
    } catch (e) {
      notes = {};
    }

    const serviceKey = notes.original_service || booking.instrument || booking.service_name || null;
    const hours = booking.duration_minutes ? Math.ceil(booking.duration_minutes / 60) : 1;
    let totalPrice = 0;
    
    try {
      totalPrice = serviceKey ? calculateAmount(serviceKey, hours) : 0;
    } catch (calcErr) {
      console.warn(`Warning: Could not calculate price for service ${serviceKey}:`, calcErr.message);
      totalPrice = 0;
    }

    // Use customer_name from bookings table, fallback to user name if needed
    const fullName = booking.customer_name 
      ? booking.customer_name 
      : (booking.first_name || booking.last_name)
        ? `${booking.first_name || ''} ${booking.last_name || ''}`.trim()
        : null;

    // Use customer contact info from bookings table, fallback to user info if needed
    const email = booking.customer_email || booking.email || null;
    const contact = booking.customer_contact || booking.contact || null;

    const bookingDateStr = booking.booking_date instanceof Date
      ? booking.booking_date.toISOString().split('T')[0]
      : booking.booking_date;

    // Build instructor info if available
    let instructorInfo = null;
    if (booking.instructor_id && booking.instructor_first_name) {
      instructorInfo = {
        instructor_id: booking.instructor_id,
        instructor_name: `${booking.instructor_first_name} ${booking.instructor_last_name || ''}`.trim(),
        specialization: booking.specialization || null
      };
    }

    res.json({
      success: true,
      data: {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        name: fullName,
        email: email,
        contact: contact,
        service_type: serviceKey,
        booking_date: bookingDateStr,
        booking_time: booking.start_time,
        hours,
        payment_method: notes.payment_method || null,
        payment_status: booking.payment_status,
        total_price: totalPrice,
        qr_code_url: booking.qr_code_data || booking.qr_code_path || booking.qr_code,
        instructor: instructorInfo,
        created_at: booking.created_at
      }
    });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get specific booking
 */
export const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const bookings = await query(
      `SELECT * FROM bookings 
       WHERE id = ? AND user_id = ?`,
      [bookingId, userId]
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking: bookings[0] }
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking'
    });
  }
};

/**
 * Update payment status
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { bookingId, paymentStatus } = req.body;

    if (!bookingId || !paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Get booking details
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Update payment status
    await query(
      'UPDATE bookings SET payment_status = ? WHERE booking_id = ?',
      [paymentStatus, bookingId]
    );

    // If payment is confirmed/paid AND QR code hasn't been generated yet, generate it
    if (paymentStatus === 'paid' && !booking.qr_code_data) {
      try {
        console.log(`🔄 Generating QR code for online payment ${bookingId}...`);
        const qrResult = await qrService.generateBookingQR({
          booking_id: bookingId,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          service_type: booking.service_type
        });

        if (qrResult.success) {
          console.log(`✅ QR code generated successfully for online payment ${bookingId}`);
          
          // Update booking with QR code data
          await query(
            'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
            [qrResult.qrPath, qrResult.qrDataUrl, bookingId]
          );

          // Send booking confirmation notification
          if (booking.user_id) {
            try {
              await notifyUser(booking.user_id, 'booking_confirmed', `Your ${booking.service_type} booking on ${booking.booking_date} has been confirmed!`);
            } catch (error) {
              console.warn('Warning: Failed to send confirmation notification:', error.message);
            }
          }

          // Send admin notification about confirmed booking
          try {
            const userName = booking.name || (booking.user_id ? 'User #' + booking.user_id : 'Guest');
            await notifyAdmins(
              'booking_confirmed',
              `BOOKING CONFIRMED\nName: ${userName}\nService: ${booking.service_type}\nDate: ${booking.booking_date}\nRef: ${booking.booking_reference}`,
              `/admin/bookings?ref=${booking.booking_reference}`
            );
          } catch (error) {
            console.warn('Warning: Failed to send admin confirmation notification:', error.message);
          }

          // Send confirmation email with QR code
          try {
            await bookingEmailService.sendBookingConfirmation(booking, qrResult.qrDataUrl);
          } catch (error) {
            console.warn('Warning: Failed to send confirmation email:', error.message);
          }
        } else {
          console.warn(`⚠️ QR code generation failed for ${bookingId}: ${qrResult.error}`);
        }
      } catch (error) {
        console.warn('Warning: Failed to generate QR code for online payment:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Payment status updated'
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
};

/**
 * Format service type
 */
function formatServiceType(type) {
  const types = {
    'recording': 'Recording Studio',
    'voiceover': 'Voiceover/Podcast',
    'arrangement': 'Music Arrangement'
  };
  return types[type] || type;
}

/**
 * Get available time slots — UPDATED VERSION
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { date, hours, service } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Service type is required'
      });
    }

    const startHour = 10;
    const endHour = 20;
    const hoursNeeded = parseInt(hours) || 1;

    // Query bookings for THIS SERVICE ONLY on the selected date
    const bookings = await query(
      `SELECT booking_time, hours FROM bookings 
       WHERE booking_date = ?
       AND service_type = ?
       AND payment_status IN ('pending', 'paid', 'cash')
       AND check_in_status NOT IN ('cancelled')`,
      [date, service]
    );

    const occupiedSlots = new Set();
    const bookedSlots = [];

    bookings.forEach(booking => {
      const [timeHours, timeMinutes] = booking.booking_time.split(':').map(Number);
      const startMinutes = timeHours * 60 + timeMinutes;
      const endMinutes = startMinutes + (booking.hours * 60);

      for (let min = startMinutes; min < endMinutes; min += 30) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        occupiedSlots.add(timeStr);
        bookedSlots.push(timeStr);
      }
    });

    const availableSlots = [];

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        let isAvailable = true;

        for (let h = 0; h < hoursNeeded; h++) {
          const checkHour = hour + h;
          const checkTime = `${checkHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

          if (occupiedSlots.has(checkTime) || checkHour >= endHour) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          availableSlots.push(slotTime);
        }
      }
    }

    res.json({
      success: true,
      data: { date, availableSlots, hours: hoursNeeded, service },
      bookedSlots: bookedSlots
    });

  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get available time slots v2 - New Admin Booking Form Logic
 * Accepts: service, duration (in minutes), date (YYYY-MM-DD)
 * Returns: formatted time slots in 12-hour format with conflict detection
 * Operating hours: 8:00 AM - 7:00 PM (08:00 - 19:00)
 */
export const getAvailableSlotsV2 = async (req, res) => {
  try {
    const { service, duration, date } = req.query;

    console.log('getAvailableSlotsV2 called with:', { service, duration, date });

    // Validation
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Service type is required'
      });
    }

    if (!duration) {
      return res.status(400).json({
        success: false,
        message: 'Duration is required'
      });
    }

    const durationMinutes = parseInt(duration);
    if (isNaN(durationMinutes) || durationMinutes < 60 || durationMinutes > 480) {
      return res.status(400).json({
        success: false,
        message: `Duration must be between 1 and 8 hours (in minutes). Received: ${duration}`
      });
    }

    // Operating hours: 8 AM to 7 PM (08:00 to 19:00)
    const OPEN_HOUR = 8;
    const CLOSE_HOUR = 19;
    const durationHours = durationMinutes / 60;

    // Calculate last possible start time
    // If closing at 19:00 and duration is 3 hours, last start is 16:00 (4 PM)
    const lastStartHour = CLOSE_HOUR - durationHours;

    // Query confirmed bookings for the selected date
    let bookings = [];
    try {
      bookings = await query(
        `SELECT booking_id, start_time, end_time, duration_minutes 
         FROM bookings 
         WHERE booking_date = ? 
         AND status = 'confirmed'`,
        [date]
      );
      if (!bookings) {
        bookings = [];
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Continue with empty bookings array if query fails
      bookings = [];
    }

    console.log(`Found ${bookings.length} existing bookings for date ${date}`);

    // Helper: Convert time string (HH:MM:SS) to minutes since midnight
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Helper: Check if time slot overlaps with existing booking
    const hasConflict = (slotStartMinutes, slotEndMinutes) => {
      return bookings.some(booking => {
        const existingStart = timeToMinutes(booking.start_time);
        const existingEnd = timeToMinutes(booking.end_time);
        // Overlap if: new_start < existing_end AND new_end > existing_start
        return slotStartMinutes < existingEnd && slotEndMinutes > existingStart;
      });
    };

    // Helper: Convert 24-hour format (minutes) to 12-hour display format
    const formatTime12Hour = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Generate available slots at 1-hour intervals
    const availableSlots = [];

    for (let startHour = OPEN_HOUR; startHour < lastStartHour; startHour++) {
      const slotStartMinutes = startHour * 60;
      const slotEndMinutes = slotStartMinutes + durationMinutes;

      // Check for conflicts
      if (!hasConflict(slotStartMinutes, slotEndMinutes)) {
        const startTime12 = formatTime12Hour(slotStartMinutes);
        const endTime12 = formatTime12Hour(slotEndMinutes);
        const displaySlot = `${startTime12} - ${endTime12}`;

        availableSlots.push({
          display: displaySlot,
          startTime: `${startHour.toString().padStart(2, '0')}:00`, // 24-hour format for storage
          startMinutes: slotStartMinutes,
          endTime: `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`, // 24-hour format for storage
          endMinutes: slotEndMinutes
        });
      }
    }

    res.json({
      success: true,
      data: {
        date,
        service,
        durationHours,
        operatingHours: { open: `${OPEN_HOUR}:00`, close: `${CLOSE_HOUR}:00` },
        availableSlots
      }
    });

  } catch (error) {
    console.error('Error getting available slots v2:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Cancel a booking with automatic refund calculation
 */
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Get booking details first for validation
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking or is admin
    if (token) {
      const decoded = verifyToken(token);
      const isAdmin = decoded?.role === 'admin';
      const isOwner = decoded?.id === booking.user_id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }
    }

    const cancelledBy = token ? verifyToken(token)?.id : null;
    const cancellationReason = reason || 'Cancelled by user';

    // Use the stored procedure to handle cancellation with refund calculation
    try {
      await query('CALL process_booking_cancellation(?, ?, ?)', [
        bookingId,
        cancelledBy,
        cancellationReason
      ]);
    } catch (procError) {
      // Check if it's a business rule violation
      if (procError.message && procError.message.includes('cannot be cancelled')) {
        return res.status(400).json({
          success: false,
          message: procError.message
        });
      }
      throw procError;
    }

    // Get updated booking details for notifications
    const updatedBookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    const updatedBooking = updatedBookings[0];

    // Send cancellation notification to admin
    try {
      const refundInfo = updatedBooking.refund_amount > 0 ?
        `\nRefund Amount: ₱${updatedBooking.refund_amount}` : '\nNo Refund';
      await notifyAdmins(
        'booking_cancelled',
        `BOOKING CANCELLED\nName: ${booking.customer_name}\nEmail: ${booking.customer_email}\nService: ${booking.service_type || 'Service'}\nDate: ${booking.booking_date}\nTime: ${booking.start_time}\nRef: ${booking.booking_reference}${refundInfo}`,
        `/admin/bookings?ref=${booking.booking_reference}`
      );
    } catch (error) {
      console.warn('Warning: Failed to send admin cancellation notification:', error.message);
    }

    // Send cancellation notification to user
    if (booking.user_id) {
      try {
        await notifyBookingCancelled(booking.user_id, bookingId);
      } catch (error) {
        console.warn('Warning: Failed to send cancellation notification:', error.message);
      }

      // Cancel scheduled reminders
      try {
        await cancelBookingReminders(bookingId);
      } catch (error) {
        console.warn('Warning: Failed to cancel booking reminders:', error.message);
      }
    }

    // Send cancellation email
    try {
      await bookingEmailService.sendBookingCancellationEmail({
        ...booking,
        refund_amount: updatedBooking.refund_amount
      });
    } catch (error) {
      console.warn('Warning: Failed to send cancellation email:', error.message);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        refund_amount: updatedBooking.refund_amount,
        cancellation_reason: cancellationReason
      }
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reschedule a booking with automatic fee calculation
 */
export const rescheduleBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { newDate, newTime, reason } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    // Validate input
    if (!bookingId || !newDate || !newTime) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, new date, and new time are required'
      });
    }

    // Get original booking details first for validation
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking or is admin
    if (token) {
      const decoded = verifyToken(token);
      const isAdmin = decoded?.role === 'admin';
      const isOwner = decoded?.id === booking.user_id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }
    }

    // Check for time conflicts on new date/time
    const durationMinutes = booking.duration_minutes || 60;
    const hasConflict = await checkTimeConflict(newDate, newTime, durationMinutes, bookingId);

    if (hasConflict) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is not available on the new date'
      });
    }

    const rescheduledBy = token ? verifyToken(token)?.id : null;
    const reschedulingReason = reason || 'Rescheduled by user';

    // Calculate new end time
    const [hh, mm] = newTime.split(':');
    const endMinutes = (parseInt(hh) * 60 + parseInt(mm)) + durationMinutes;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = endMinutes % 60;
    const newEndTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;

    // Use the stored procedure to handle rescheduling with fee calculation
    try {
      await query('CALL process_booking_rescheduling(?, ?, ?, ?, ?)', [
        bookingId,
        newDate,
        newTime,
        rescheduledBy,
        reschedulingReason
      ]);
    } catch (procError) {
      // Check if it's a business rule violation
      if (procError.message && procError.message.includes('not allowed')) {
        return res.status(400).json({
          success: false,
          message: procError.message
        });
      }
      throw procError;
    }

    // Get updated booking details for notifications
    const updatedBookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    const updatedBooking = updatedBookings[0];

    // Get the new booking ID
    const newBookingQuery = await query(
      'SELECT booking_id FROM bookings WHERE rescheduled_from = ? AND status = "confirmed"',
      [bookingId]
    );
    const newBookingId = newBookingQuery.length > 0 ? newBookingQuery[0].booking_id : null;

    // Send reschedule notification to admin
    try {
      const feeInfo = updatedBooking.rescheduling_fee > 0 ?
        `\nRescheduling Fee: ₱${updatedBooking.rescheduling_fee}` : '\nNo Fee';
      // Get the new booking reference for the notification
      const newBookingRef = newBookingId ? (await query('SELECT booking_reference FROM bookings WHERE booking_id = ?', [newBookingId]))[0]?.booking_reference : booking.booking_reference;

      await notifyAdmins(
        'booking_rescheduled',
        `BOOKING RESCHEDULED\nName: ${booking.customer_name}\nEmail: ${booking.customer_email}\nService: ${booking.service_type || 'Service'}\nRef: ${booking.booking_reference}\n\nOLD TIME:\n${booking.booking_date} at ${booking.start_time}\n\nNEW TIME:\n${newDate} at ${newTime}${feeInfo}`,
        `/admin/bookings?ref=${booking.booking_reference}`
      );
    } catch (error) {
      console.warn('Warning: Failed to send admin reschedule notification:', error.message);
    }

    // Send reschedule notification to user
    if (booking.user_id) {
      try {
        await notifyBookingRescheduled(
          booking.user_id,
          newBookingId || bookingId,
          newDate,
          newTime
        );
      } catch (error) {
        console.warn('Warning: Failed to send reschedule notification:', error.message);
      }

      // Reschedule reminders for new date/time
      try {
        await rescheduleBookingReminders(
          newBookingId || bookingId,
          booking.user_id,
          newDate,
          newTime,
          booking.service_type || 'Your booking',
          booking.booking_reference
        );
      } catch (error) {
        console.warn('Warning: Failed to reschedule booking reminders:', error.message);
      }
    }

    // Send reschedule email
    try {
      const newBooking = {
        ...booking,
        booking_id: newBookingId,
        booking_date: newDate,
        start_time: newTime,
        end_time: newEndTime,
        rescheduling_fee: updatedBooking.rescheduling_fee
      };
      await bookingEmailService.sendBookingRescheduleEmail(newBooking);
    } catch (error) {
      console.warn('Warning: Failed to send reschedule email:', error.message);
    }

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: {
        old_booking_id: bookingId,
        new_booking_id: newBookingId,
        newDate,
        newTime,
        rescheduling_fee: updatedBooking.rescheduling_fee,
        reason: reschedulingReason
      }
    });

  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Manual payment confirmation (for testing/admin)
 * POST /api/bookings/:bookingId/confirm-payment
 */
export const confirmPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    console.log(`Manually confirming payment for booking ${bookingId}`);
    
    // Get booking details
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    
    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    const booking = bookings[0];
    
    // Update payment status to paid
    await query(
      'UPDATE bookings SET payment_status = "paid", status = "confirmed", updated_at = NOW() WHERE booking_id = ?',
      [bookingId]
    );
    
    // Generate QR code if not already present
    if (!booking.qr_code_data && qrService && typeof qrService.generateBookingQR === 'function') {
      try {
        console.log(`Generating QR code for booking ${bookingId}...`);
        const hours = booking.duration_minutes ? Math.ceil(booking.duration_minutes / 60) : 1;
        
        // Parse notes to get service type
        let serviceType = 'Studio Session';
        try {
          const bookingNotes = booking.user_notes ? JSON.parse(booking.user_notes) : {};
          serviceType = bookingNotes.original_service || 'Studio Session';
        } catch (e) {
          // Use default if parsing fails
        }
        
        const qrResult = await qrService.generateBookingQR({
          name: booking.customer_name || 'Guest',
          service_type: serviceType,
          booking_date: booking.booking_date,
          booking_time: booking.start_time,
          hours: hours
        }, bookingId);
        
        if (qrResult && qrResult.success) {
          await query(
            'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
            [qrResult.qrPath, qrResult.qrDataUrl, bookingId]
          );
          console.log(`✅ QR code generated successfully for booking ${bookingId}`);
        } else {
          console.warn(`❌ QR generation failed for booking ${bookingId}:`, qrResult?.error);
        }
      } catch (qrErr) {
        console.error('❌ QR generation error:', qrErr.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: {
        booking_id: bookingId,
        payment_status: 'paid',
        status: 'confirmed'
      }
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Send booking confirmation email
 * POST /api/bookings/:bookingId/send-confirmation-email
 */
export const sendConfirmationEmail = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { email } = req.body;

    console.log(`📧 Sending confirmation email for booking ${bookingId} to ${email}`);

    // Fetch booking details
    const bookings = await query(
      `SELECT 
        b.booking_id,
        b.booking_reference,
        b.booking_date,
        b.start_time,
        b.duration_minutes,
        b.customer_name,
        b.customer_email,
        b.user_notes,
        b.payment_status,
        b.qr_code_data,
        b.qr_code_path,
        s.service_name
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.service_id
       WHERE b.booking_id = ?
       LIMIT 1`,
      [bookingId]
    );

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];
    let notes = {};
    try {
      notes = booking.user_notes ? JSON.parse(booking.user_notes) : {};
    } catch (e) {
      notes = {};
    }

    const hours = booking.duration_minutes ? Math.ceil(booking.duration_minutes / 60) : 1;
    const serviceType = notes.original_service || booking.service_name || 'Studio Session';
    const qrDataUrl = booking.qr_code_data || booking.qr_code_path || null;

    // Prepare booking data for email service
    const bookingData = {
      booking_id: booking.booking_id,
      name: booking.customer_name || 'Guest',
      email: email || booking.customer_email,
      service_type: serviceType,
      booking_date: booking.booking_date,
      booking_time: booking.start_time,
      hours: hours,
      payment_status: booking.payment_status || 'pending',
      total_price: '0.00' // TODO: fetch from invoice or calculate
    };

    // Send email using BookingEmailService
    let emailSent = false;
    if (qrDataUrl) {
      emailSent = await bookingEmailService.sendBookingConfirmation(bookingData, qrDataUrl);
    } else {
      console.warn('⚠️ No QR code available for email');
      emailSent = await bookingEmailService.sendBookingConfirmation(bookingData, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }

    if (emailSent) {
      console.log(`✅ Confirmation email sent successfully to ${email}`);
      res.json({
        success: true,
        message: 'Confirmation email sent successfully'
      });
    } else {
      console.warn(`⚠️ Email sending failed for booking ${bookingId}`);
      res.json({
        success: true,
        message: 'Booking confirmed but email sending failed'
      });
    }
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send confirmation email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get available instructors for music lessons
 * GET /api/bookings/instructors?date=YYYY-MM-DD&time=HH:MM&duration=minutes
 * Public endpoint - no auth required
 * Filters out instructors who are already booked at the requested time
 */
export const getAvailableInstructors = async (req, res) => {
  try {
    const { date, time, duration } = req.query;
    
    console.log('Fetching available instructors...', { date, time, duration });
    
    // Get all instructors
    const instructors = await query(
      `SELECT 
        id,
        first_name,
        last_name,
        COALESCE(specialization, 'General') as specialization,
        years_experience,
        bio,
        hourly_rate,
        available_for_booking
       FROM users 
       WHERE role = 'instructor' 
       AND (deleted_at IS NULL OR deleted_at = '')
       ORDER BY first_name ASC`
    );

    console.log(`Found ${instructors ? instructors.length : 0} instructors`);

    // If no date/time provided, return all instructors
    if (!date || !time || !duration) {
      res.json({
        success: true,
        data: instructors || []
      });
      return;
    }

    // Filter out instructors with conflicts
    const durationMinutes = parseInt(duration) || 60;
    const [hours, minutes] = time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;

    const availableInstructors = [];

    for (const instructor of instructors) {
      // Check if this instructor has any bookings at the requested time
      const conflicts = await query(
        `SELECT COUNT(*) as count FROM bookings 
         WHERE instructor_id = ? 
         AND booking_date = ? 
         AND status != 'cancelled'
         AND (
           (CAST(SUBSTRING_INDEX(start_time, ':', 1) AS UNSIGNED) * 60 + CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(start_time, ':', 2), ':', -1) AS UNSIGNED) < ?)
           AND (CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(start_time, ':', 2), ':', -1) AS UNSIGNED) + duration_minutes > ?)
         )`,
        [instructor.id, date, endMinutes, startMinutes]
      );

      if (conflicts && conflicts[0] && conflicts[0].count === 0) {
        availableInstructors.push(instructor);
      }
    }

    console.log(`Available instructors after filtering: ${availableInstructors.length}`);

    res.json({
      success: true,
      data: availableInstructors || []
    });
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get cancellation policies
 * GET /api/bookings/policies
 */
export const getCancellationPolicies = async (req, res) => {
  try {
    const policies = await query(
      'SELECT * FROM cancellation_policies WHERE is_active = TRUE ORDER BY policy_type, hours_before_booking'
    );

    res.json({
      success: true,
      data: { policies }
    });
  } catch (error) {
    console.error('Error fetching cancellation policies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cancellation policies'
    });
  }
};

/**
 * Calculate potential refund for a booking
 * GET /api/bookings/:bookingId/refund-calculation
 */
export const calculateRefund = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Get booking details
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking or is admin
    if (token) {
      const decoded = verifyToken(token);
      const isAdmin = decoded?.role === 'admin';
      const isOwner = decoded?.id === booking.user_id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }
    }

    // Calculate refund using stored function
    const refundAmount = await query('SELECT calculate_cancellation_refund(?) as refund_amount', [bookingId]);
    const refund = refundAmount[0]?.refund_amount || 0;

    // Get the applicable policy
    const hoursUntil = await query('SELECT calculate_hours_until_booking(?, ?) as hours_until',
      [booking.booking_date, booking.start_time]);
    const hours = hoursUntil[0]?.hours_until || 0;

    const policy = await query('SELECT * FROM cancellation_policies WHERE policy_id = get_cancellation_policy("cancellation", ?)', [hours]);
    const policyInfo = policy[0] || null;

    res.json({
      success: true,
      data: {
        booking_id: bookingId,
        total_amount: booking.total_amount,
        hours_until_booking: hours,
        refund_amount: refund,
        refund_percentage: policyInfo?.refund_percentage || 0,
        policy_description: policyInfo?.description || 'No refund policy found'
      }
    });
  } catch (error) {
    console.error('Error calculating refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate refund'
    });
  }
};

/**
 * Calculate potential rescheduling fee for a booking
 * GET /api/bookings/:bookingId/reschedule-calculation
 */
export const calculateReschedulingFee = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Get booking details
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking or is admin
    if (token) {
      const decoded = verifyToken(token);
      const isAdmin = decoded?.role === 'admin';
      const isOwner = decoded?.id === booking.user_id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }
    }

    // Calculate fee using stored function
    const feeResult = await query('SELECT calculate_rescheduling_fee(?) as fee_amount', [bookingId]);
    const fee = feeResult[0]?.fee_amount || 0;

    // Check if rescheduling is allowed
    const isAllowed = fee !== -1;

    let policyInfo = null;
    let hours = 0;

    if (isAllowed) {
      // Get hours until booking
      const hoursUntil = await query('SELECT calculate_hours_until_booking(?, ?) as hours_until',
        [booking.booking_date, booking.start_time]);
      hours = hoursUntil[0]?.hours_until || 0;

      // Get the applicable policy
      const policy = await query('SELECT * FROM cancellation_policies WHERE policy_id = get_cancellation_policy("rescheduling", ?)', [hours]);
      policyInfo = policy[0] || null;
    }

    res.json({
      success: true,
      data: {
        booking_id: bookingId,
        total_amount: booking.total_amount,
        hours_until_booking: hours,
        rescheduling_allowed: isAllowed,
        fee_amount: isAllowed ? fee : 0,
        fee_percentage: policyInfo?.fee_percentage || 0,
        policy_description: isAllowed ?
          (policyInfo?.description || 'Rescheduling fee policy not found') :
          'Rescheduling not allowed within 8 hours of booking time'
      }
    });
  } catch (error) {
    console.error('Error calculating rescheduling fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate rescheduling fee'
    });
  }
};

