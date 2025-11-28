import { query } from './config/db.js';

async function debugNotifications() {
  try {
    console.log('🔍 Checking notifications in database...');

    // Get all notifications
    const allNotifications = await query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10');
    console.log('📋 Recent notifications:');
    allNotifications.forEach(notif => {
      console.log(`- ${notif.notification_type}: ${notif.title.substring(0, 50)}... (User: ${notif.user_id}, Read: ${notif.is_read})`);
    });

    // Check for admin users
    const admins = await query('SELECT id, username FROM users WHERE role = ?', ['admin']);
    console.log('👥 Admin users:');
    admins.forEach(admin => {
      console.log(`- ID: ${admin.id}, Username: ${admin.username}`);
    });

    // Check notifications for admin users
    if (admins.length > 0) {
      const adminId = admins[0].id;
      const adminNotifications = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [adminId]);
      console.log(`🔔 Notifications for admin ${adminId}:`);
      adminNotifications.forEach(notif => {
        console.log(`- ${notif.notification_type}: ${notif.title.substring(0, 50)}... (Read: ${notif.is_read})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

debugNotifications();
