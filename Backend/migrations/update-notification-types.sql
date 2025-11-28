-- Update notification types constraint to include booking_created and booking_confirmed
ALTER TABLE notifications
DROP CONSTRAINT chk_notification_type;

ALTER TABLE notifications
ADD CONSTRAINT chk_notification_type CHECK (notification_type IN (
    'booking_created',
    'booking_confirmed',
    'booking_confirmation',
    'booking_reminder_24h',
    'booking_reminder_1h',
    'booking_cancelled',
    'booking_rescheduled',
    'payment_received',
    'payment_reminder',
    'payment_overdue',
    'level_up',
    'badge_earned',
    'module_unlocked',
    'system_announcement',
    'instructor_message'
));
