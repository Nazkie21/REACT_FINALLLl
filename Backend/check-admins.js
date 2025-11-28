import { query } from './config/db.js';

async function checkAdmins() {
  try {
    const admins = await query('SELECT id, username, email, role FROM users WHERE role = ?', ['admin']);
    console.log('Admin users found:', admins.length);
    admins.forEach(admin => {
      console.log('- ID:', admin.id, 'Username:', admin.username, 'Email:', admin.email);
    });

    if (admins.length === 0) {
      console.log('No admin users found! Creating a test admin...');

      // Create a test admin user
      const result = await query(
        'INSERT INTO users (username, first_name, last_name, email, role, hashed_password, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['admin', 'System', 'Administrator', 'admin@mixlabstudio.com', 'admin', '$2a$10$example_hashed_password', 1]
      );

      console.log('Created admin user with ID:', result.insertId);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkAdmins();
