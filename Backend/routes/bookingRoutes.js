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
  confirmPayment,
  getAvailableInstructors,
  sendConfirmationEmail,
  getCancellationPolicies,
  calculateRefund,
  calculateReschedulingFee
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

// Get available instructors for music lessons (no auth required)
router.get('/instructors', getAvailableInstructors);

// Get user's bookings (requires auth) - SPECIFIC ROUTES
router.get('/user', requireAuth, getUserBookings);
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

// Send confirmation email
router.post('/:bookingId/send-confirmation-email', sendConfirmationEmail);

// Get cancellation policies (public - no auth required)
router.get('/policies', getCancellationPolicies);

// Calculate refund for a booking (requires auth)
router.get('/:bookingId/refund-calculation', optionalAuth, calculateRefund);

// Calculate rescheduling fee for a booking (requires auth)
router.get('/:bookingId/reschedule-calculation', optionalAuth, calculateReschedulingFee);

// Get specific booking by ID (public - no auth required for returning from payment) - CATCH-ALL LAST
router.get('/:bookingId', getBookingById);

export default router;