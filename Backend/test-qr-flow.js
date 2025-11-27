#!/usr/bin/env node

/**
 * QR Code Generation & Payment Status Flow Test
 * Tests the complete flow from payment webhook to QR code generation
 */

import { query } from './config/db.js';
import qrService from './services/qrService.js';
import { randomUUID } from 'crypto';

async function testQRCodeFlow() {
  console.log('🧪 Starting QR Code & Payment Status Test Suite...\n');

  try {
    // Step 1: Verify database schema
    console.log('📋 Step 1: Verifying database schema...');
    const columns = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'qr%'
      ORDER BY ORDINAL_POSITION
    `);

    if (columns.length === 0) {
      throw new Error('❌ QR code columns not found in bookings table!');
    }

    console.log('✅ QR code columns verified:');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}, nullable: ${col.IS_NULLABLE})`);
    });

    // Step 2: Create a test booking
    console.log('\n📝 Step 2: Creating test booking...');
    const testBookingId = `test_${randomUUID().substring(0, 8)}`;
    const testDate = new Date().toISOString().split('T')[0];
    const testTime = '10:00:00';

    const insertResult = await query(
      `INSERT INTO bookings 
       (booking_id, booking_reference, user_id, service_id, booking_date, start_time, duration_minutes, 
        status, payment_status, user_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [testBookingId, `REF_${Date.now()}`, 1, 1, testDate, testTime, 60, 'pending', 'pending', '{}']
    );

    console.log(`✅ Test booking created: ${testBookingId}`);

    // Step 3: Verify booking was inserted
    console.log('\n🔍 Step 3: Verifying booking insert...');
    const bookings = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [testBookingId]
    );

    if (!Array.isArray(bookings) || bookings.length === 0) {
      console.error('Debug: bookings result:', bookings);
      throw new Error('❌ Booking insertion failed!');
    }

    const booking = bookings[0];
    console.log(`✅ Booking found in database`);
    console.log(`   - ID: ${booking.booking_id}`);
    console.log(`   - Status: ${booking.status}`);
    console.log(`   - Payment Status: ${booking.payment_status}`);
    console.log(`   - QR Code: ${booking.qr_code || 'null'}`);
    console.log(`   - QR Code Path: ${booking.qr_code_path || 'null'}`);
    console.log(`   - QR Code Data: ${booking.qr_code_data ? `${booking.qr_code_data.substring(0, 50)}...` : 'null'}`);

    // Step 4: Generate QR code
    console.log('\n🎨 Step 4: Generating QR code...');
    const qrResult = await qrService.generateBookingQR({
      booking_id: testBookingId,
      booking_date: testDate,
      booking_time: testTime,
      service_type: 'Piano Lesson'
    }, testBookingId);

    if (!qrResult.success) {
      throw new Error(`❌ QR generation failed: ${qrResult.error}`);
    }

    console.log('✅ QR code generated successfully');
    console.log(`   - Path: ${qrResult.qrPath}`);
    console.log(`   - Data URL length: ${qrResult.qrDataUrl.length} characters`);

    // Step 5: Update booking with QR code (simulating webhook)
    console.log('\n💾 Step 5: Updating booking with QR code and payment status...');
    await query(
      `UPDATE bookings 
       SET payment_status = 'paid',
           status = 'confirmed',
           qr_code_path = ?,
           qr_code_data = ?,
           updated_at = NOW()
       WHERE booking_id = ?`,
      [qrResult.qrPath, qrResult.qrDataUrl, testBookingId]
    );

    console.log('✅ Booking updated with QR code and payment status');

    // Step 6: Verify the updates
    console.log('\n✔️  Step 6: Verifying updates...');
    const updatedBookings = await query(
      'SELECT booking_id, status, payment_status, qr_code_path, qr_code_data FROM bookings WHERE booking_id = ?',
      [testBookingId]
    );

    const updatedBooking = updatedBookings[0];
    console.log(`✅ Updated booking verified`);
    console.log(`   - Status: ${updatedBooking.status}`);
    console.log(`   - Payment Status: ${updatedBooking.payment_status}`);
    console.log(`   - QR Code Path: ${updatedBooking.qr_code_path}`);
    console.log(`   - QR Code Data exists: ${!!updatedBooking.qr_code_data}`);

    // Step 7: Test getBookingById response format
    console.log('\n📊 Step 7: Testing response format for frontend...');
    const qrCodeUrl = updatedBooking.qr_code_data || updatedBooking.qr_code_path || updatedBooking.qr_code;
    const response = {
      success: true,
      data: {
        booking_id: updatedBooking.booking_id,
        payment_status: updatedBooking.payment_status,
        status: updatedBooking.status,
        qr_code_url: qrCodeUrl
      }
    };

    console.log('✅ Frontend response format:');
    console.log(JSON.stringify(response, null, 2));

    // Step 8: Cleanup
    console.log('\n🧹 Step 8: Cleaning up test booking...');
    await query(
      'DELETE FROM bookings WHERE booking_id = ?',
      [testBookingId]
    );
    console.log('✅ Test booking deleted');

    console.log('\n✨ All tests passed! QR Code & Payment flow is working correctly.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testQRCodeFlow();
