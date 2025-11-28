import { notifyAdmins } from './services/notificationService.js';
import { query } from './config/db.js';

async function testNotifications() {
  try {
    console.log('Testing admin notifications...');

    // Check existing notifications
    const existing = await query('SELECT COUNT(*) as count FROM notifications WHERE notification_type LIKE "booking_%"');
    console.log('Existing booking notifications:', existing[0].count);

    // Send a test notification
    console.log('Sending test notification...');
    const result = await notifyAdmins('booking_created', 'This is a test notification for booking actions');

    console.log('Notification result:', result);

    // Check notifications after
    const after = await query('SELECT COUNT(*) as count FROM notifications WHERE notification_type LIKE "booking_%"');
    console.log('Booking notifications after:', after[0].count);

    // Show recent notifications
    const recent = await query('SELECT notification_type, title, created_at FROM notifications WHERE notification_type LIKE "booking_%" ORDER BY created_at DESC LIMIT 5');
    console.log('Recent booking notifications:');
    recent.forEach(notif => {
      console.log(`- ${notif.notification_type}: ${notif.title.substring(0, 50)}... (${notif.created_at})`);
    });

  } catch (error) {
    console.error('Test failed:', error.message);
  }
  process.exit(0);
}

testNotifications();
