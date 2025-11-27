import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mixlab_studio',
  });

  try {
    console.log('🚀 Starting QR Code columns migration...\n');

    // Check if columns already exist
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME IN ('qr_code_path', 'qr_code_data')
    `);

    if (columns.length > 0) {
      console.log('✅ QR Code columns already exist:');
      columns.forEach(col => console.log(`   - ${col.COLUMN_NAME}`));
      await connection.end();
      return;
    }

    // Add qr_code_path column
    console.log('Adding qr_code_path column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN qr_code_path VARCHAR(500) AFTER qr_code
    `);
    console.log('✅ qr_code_path column added');

    // Add qr_code_data column
    console.log('Adding qr_code_data column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN qr_code_data LONGTEXT AFTER qr_code_path
    `);
    console.log('✅ qr_code_data column added');

    // Create index
    console.log('Creating index on qr_code_path...');
    try {
      await connection.query(`
        ALTER TABLE bookings ADD INDEX idx_bookings_qr_code_path (qr_code_path)
      `);
      console.log('✅ Index created');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Index already exists');
      } else {
        throw err;
      }
    }

    // Verify the changes
    console.log('\n📋 Verifying columns...');
    const [verifyColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'qr%'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nQR Code Related Columns:');
    verifyColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} | ${col.COLUMN_TYPE.padEnd(20)} | Nullable: ${col.IS_NULLABLE}`);
    });

    console.log('\n✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
