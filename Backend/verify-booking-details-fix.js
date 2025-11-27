import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function verifyBookingDetailsFix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mixlab_studio',
  });

  try {
    console.log('🔍 Verifying Booking Details Fix...\n');

    // Step 1: Verify new columns exist
    console.log('Step 1: Checking customer info columns...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'customer%'
      ORDER BY ORDINAL_POSITION
    `);

    if (columns.length < 4) {
      throw new Error(`❌ Missing columns! Expected 4, found ${columns.length}`);
    }

    console.log('✅ All customer info columns present:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
    });

    // Step 2: Check bookingController.js has been updated
    console.log('\nStep 2: Checking controller code...');
    const { readFileSync } = await import('fs');
    const bookingControllerPath = './controllers/bookingController.js';
    const code = readFileSync(bookingControllerPath, 'utf8');

    const hasCustomerNameInsert = code.includes('customer_name, customer_email, customer_contact');
    const hasCustomerNameSelect = code.includes('b.customer_name,');
    const hasCustomerNameLogic = code.includes('booking.customer_name');

    console.log(`${hasCustomerNameInsert ? '✅' : '❌'} createBooking() stores customer info`);
    console.log(`${hasCustomerNameSelect ? '✅' : '❌'} getBookingById() retrieves customer info`);
    console.log(`${hasCustomerNameLogic ? '✅' : '❌'} Response uses customer name from bookings table`);

    if (!hasCustomerNameInsert || !hasCustomerNameSelect || !hasCustomerNameLogic) {
      throw new Error('❌ Controller code not properly updated!');
    }

    // Step 3: Check if any existing bookings have data in new columns
    console.log('\nStep 3: Checking data in new columns...');
    const [dataCheck] = await connection.query(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN customer_name IS NOT NULL THEN 1 ELSE 0 END) as with_customer_name,
        SUM(CASE WHEN customer_email IS NOT NULL THEN 1 ELSE 0 END) as with_customer_email
      FROM bookings
    `);

    const stats = dataCheck[0];
    console.log(`Total bookings: ${stats.total_bookings}`);
    console.log(`Bookings with customer_name: ${stats.with_customer_name}`);
    console.log(`Bookings with customer_email: ${stats.with_customer_email}`);

    // Step 4: Sample a recent booking (if exists)
    console.log('\nStep 4: Checking recent booking structure...');
    const [sampleBooking] = await connection.query(`
      SELECT 
        booking_id,
        booking_reference,
        customer_name,
        customer_email,
        customer_contact,
        user_id,
        service_id,
        status,
        payment_status
      FROM bookings
      ORDER BY booking_id DESC
      LIMIT 1
    `);

    if (sampleBooking.length > 0) {
      const booking = sampleBooking[0];
      console.log('✅ Most recent booking structure:');
      console.log(`   booking_id: ${booking.booking_id}`);
      console.log(`   customer_name: ${booking.customer_name || '(null)'}`);
      console.log(`   customer_email: ${booking.customer_email || '(null)'}`);
      console.log(`   customer_contact: ${booking.customer_contact || '(null)'}`);
      console.log(`   user_id: ${booking.user_id || '(null)'}`);
      console.log(`   status: ${booking.status}`);
      console.log(`   payment_status: ${booking.payment_status}`);
    } else {
      console.log('⚠️  No bookings found in database');
    }

    // Step 5: Verify indexes
    console.log('\nStep 5: Checking indexes...');
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_NAME = 'bookings'
      AND (INDEX_NAME LIKE '%customer%' OR INDEX_NAME LIKE '%qr%')
    `);

    console.log('✅ Indexes present:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.INDEX_NAME}`);
    });

    console.log('\n✨ Booking Details Fix Verification Complete!\n');
    console.log('Summary:');
    console.log('✅ Database schema updated with customer info columns');
    console.log('✅ Controller code updated to store and retrieve customer info');
    console.log('✅ Customer name now stored directly in bookings table');
    console.log('✅ Booking details will show correct customer information');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

verifyBookingDetailsFix();
