import { notifyAdmins } from './services/notificationService.js';
import { query } from './config/db.js';

async function testNotifications() {
  try {
    console.log('🔍 Checking current notifications in database...');

    // Get all notifications
    const allNotifications = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10');
    console.log('📋 Recent notifications:');
    allNotifications.forEach(notif => {
      console.log(`- ${notif.notification_type}: ${notif.title.substring(0, 50)}... (User: ${notif.user_id}, Read: ${notif.is_read})`);
    });

    console.log('\n🧪 Testing notification creation...');

    // Send a test notification
    const result = await notifyAdmins('booking_created', 'TEST NOTIFICATION: Real-time test from backend');
    console.log('📢 Notification sent result:', result);

    // Check notifications after
    const after = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5');
    console.log('📋 After test notification:');
    after.forEach(notif => {
      console.log(`- ${notif.notification_type}: ${notif.title.substring(0, 50)}... (User: ${notif.user_id}, Read: ${notif.is_read})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

testNotifications();
