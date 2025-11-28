import { notifyUser } from './notificationService.js';

/**
 * User Notification Helpers
 * Centralized functions for sending user-specific notifications
 */

/**
 * Notify user of successful booking
 */
export async function notifyBookingConfirmed(userId, bookingData) {
  try {
    await notifyUser(
      userId,
      'booking_confirmed',
      `Your ${bookingData.service_type} booking on ${bookingData.booking_date} has been confirmed!`
    );
  } catch (error) {
    console.warn('Warning: Failed to send booking confirmation notification:', error.message);
  }
}

/**
 * Notify user of booking cancellation
 */
export async function notifyBookingCancelled(userId, bookingId) {
  try {
    // Get booking reference for better user experience
    const { query } = await import('../config/db.js');
    const bookingData = await query('SELECT booking_reference FROM bookings WHERE booking_id = ?', [bookingId]);
    const bookingRef = bookingData[0]?.booking_reference || bookingId;

    await notifyUser(
      userId,
      'booking_cancelled',
      `Your booking ${bookingRef} has been successfully cancelled.`
    );
  } catch (error) {
    console.warn('Warning: Failed to send booking cancellation notification:', error.message);
  }
}

/**
 * Notify user of booking rescheduling
 */
export async function notifyBookingRescheduled(userId, bookingId, newDate, newTime) {
  try {
    // Get booking reference for better user experience
    const { query } = await import('../config/db.js');
    const bookingData = await query('SELECT booking_reference FROM bookings WHERE booking_id = ?', [bookingId]);
    const bookingRef = bookingData[0]?.booking_reference || bookingId;

    await notifyUser(
      userId,
      'booking_rescheduled',
      `Your booking ${bookingRef} has been rescheduled to ${newDate} at ${newTime}.`
    );
  } catch (error) {
    console.warn('Warning: Failed to send booking rescheduled notification:', error.message);
  }
}

/**
 * Notify user of upcoming booking reminder (1 day before)
 */
export async function notifyBookingReminder(userId, bookingId, bookingDate, bookingTime, serviceType) {
  try {
    await notifyUser(
      userId,
      'booking_reminder',
      `Don't forget! Your ${serviceType} booking is scheduled for tomorrow at ${bookingTime}.`
    );
  } catch (error) {
    console.warn('Warning: Failed to send booking reminder notification:', error.message);
  }
}

/**
 * Notify user of badge/achievement unlocked
 */
export async function notifyAchievementUnlocked(userId, badgeTitle, badgeDescription) {
  try {
    await notifyUser(
      userId,
      'achievement_unlocked',
      badgeDescription || `You've earned the "${badgeTitle}" badge!`
    );
  } catch (error) {
    console.warn('Warning: Failed to send achievement notification:', error.message);
  }
}

/**
 * Notify user of streak milestone
 */
export async function notifyStreakMilestone(userId, streakDays) {
  try {
    await notifyUser(
      userId,
      'streak_milestone',
      `Amazing! You've maintained a ${streakDays}-day learning streak. Keep it up!`
    );
  } catch (error) {
    console.warn('Warning: Failed to send streak notification:', error.message);
  }
}

/**
 * Notify user of new lesson available
 */
export async function notifyNewLesson(userId, lessonTitle, moduleTitle) {
  try {
    await notifyUser(
      userId,
      'new_lesson',
      `A new lesson "${lessonTitle}" is now available in ${moduleTitle}.`
    );
  } catch (error) {
    console.warn('Warning: Failed to send new lesson notification:', error.message);
  }
}

/**
 * Notify user of new module available
 */
export async function notifyNewModule(userId, moduleName, moduleDescription) {
  try {
    await notifyUser(
      userId,
      'new_module',
      moduleDescription || `A new module "${moduleName}" is now available for you to explore!`
    );
  } catch (error) {
    console.warn('Warning: Failed to send new module notification:', error.message);
  }
}

export default {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingRescheduled,
  notifyBookingReminder,
  notifyAchievementUnlocked,
  notifyStreakMilestone,
  notifyNewLesson,
  notifyNewModule
};
