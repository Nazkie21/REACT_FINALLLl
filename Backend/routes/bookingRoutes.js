import express from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

// Import only what exists in your bookingController
import {
  createBooking,
  getAvailableSlots,
  getAvailableSlotsV2,
  getBookingById,
  getUserBookings,
  getBooking,
  updatePaymentStatus,
  cancelBooking,
  rescheduleBooking,
  confirmPayment
} from '../controllers/bookingController.js';

const router = express.Router();

/**
 * User Booking Routes
 * These routes are for regular users to manage their bookings
 */

// Get available time slots (no auth required) - SPECIFIC ROUTES FIRST
router.get('/available-slots', getAvailableSlots);

// Get available time slots v2 - for new admin form (no auth required)
router.get('/available-slots-v2', getAvailableSlotsV2);

// Get user's bookings (requires auth) - SPECIFIC ROUTE
router.get('/user/my-bookings', requireAuth, getUserBookings);

// Create new booking (REQUIRES AUTH - user must be logged in)
router.post('/create', requireAuth, createBooking);

// Update payment status (optional - for webhook)
router.post('/update-payment', updatePaymentStatus);

// Cancel a booking (requires auth or token) - PARAMETERIZED ROUTES LAST
router.post('/:bookingId/cancel', cancelBooking);

// Reschedule a booking (requires auth or token)
router.post('/:bookingId/reschedule', rescheduleBooking);

// Confirm payment manually (for testing/admin)
router.post('/:bookingId/confirm-payment', confirmPayment);

// Get specific booking by ID (public - no auth required for returning from payment) - CATCH-ALL LAST
router.get('/:bookingId', getBookingById);

export default router;