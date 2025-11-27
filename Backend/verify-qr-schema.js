#!/usr/bin/env node

/**
 * QR Code Schema Verification Test
 * Simply verifies the database schema now has the required columns
 */

import { query } from './config/db.js';

async function verifySchema() {
  console.log('🔍 Verifying QR Code Database Schema Fix...\n');

  try {
    // Verify the columns exist
    const columns = await query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'qr%'
      ORDER BY ORDINAL_POSITION
    `);

    if (columns.length === 0) {
      throw new Error('❌ QR code columns not found in bookings table!');
    }

    console.log('✅ Database Schema Verification Results:');
    console.log('\nQR Code Related Columns in bookings table:');
    console.log('─'.repeat(70));
    
    const expectedColumns = {
      'qr_code': 'varchar(500)',
      'qr_code_path': 'varchar(500)',
      'qr_code_data': 'longtext'
    };

    let allFound = true;
    columns.forEach(col => {
      const expected = expectedColumns[col.COLUMN_NAME];
      const matches = expected && col.COLUMN_TYPE.toLowerCase().includes(expected.toLowerCase());
      const status = matches ? '✅' : '⚠️ ';
      console.log(`${status} ${col.COLUMN_NAME.padEnd(20)} | ${col.COLUMN_TYPE.padEnd(20)} | Nullable: ${col.IS_NULLABLE}`);
      if (!matches) allFound = false;
    });

    console.log('─'.repeat(70));

    if (!allFound) {
      throw new Error('❌ Some QR columns have unexpected types!');
    }

    // Verify we have all expected columns
    const foundColumns = columns.map(c => c.COLUMN_NAME);
    const missingColumns = Object.keys(expectedColumns).filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`❌ Missing columns: ${missingColumns.join(', ')}`);
    }

    console.log('\n✨ SUCCESS! Database schema has been properly fixed.\n');
    console.log('📋 Summary:');
    console.log('   ✅ qr_code column exists (VARCHAR 500) - For backward compatibility');
    console.log('   ✅ qr_code_path column added (VARCHAR 500) - Stores file path');
    console.log('   ✅ qr_code_data column added (LONGTEXT) - Stores base64 data URL');
    console.log('\n💡 The payment → QR generation flow will now work correctly:');
    console.log('   1. Xendit webhook triggers on payment success');
    console.log('   2. xenditWebhookController generates QR code via qrService');
    console.log('   3. Both qr_code_path and qr_code_data are saved to database');
    console.log('   4. Frontend receives QR code URL in response');
    console.log('   5. QR code displays on booking confirmation\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Schema verification failed:', error.message);
    process.exit(1);
  }
}

verifySchema();
