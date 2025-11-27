import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addCustomerInfoColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mixlab_studio',
  });

  try {
    console.log('🚀 Starting customer info columns migration...\n');

    // Check if columns already exist
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'customer%'
    `);

    if (columns.length > 0) {
      console.log('✅ Customer info columns already exist:');
      columns.forEach(col => console.log(`   - ${col.COLUMN_NAME}`));
      await connection.end();
      return;
    }

    // Add customer_name column
    console.log('Adding customer_name column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN customer_name VARCHAR(255) AFTER user_id
    `);
    console.log('✅ customer_name column added');

    // Add customer_email column
    console.log('Adding customer_email column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN customer_email VARCHAR(255) AFTER customer_name
    `);
    console.log('✅ customer_email column added');

    // Add customer_contact column
    console.log('Adding customer_contact column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN customer_contact VARCHAR(20) AFTER customer_email
    `);
    console.log('✅ customer_contact column added');

    // Add customer_address column
    console.log('Adding customer_address column...');
    await connection.query(`
      ALTER TABLE bookings ADD COLUMN customer_address TEXT AFTER customer_contact
    `);
    console.log('✅ customer_address column added');

    // Create indexes
    console.log('Creating indexes...');
    try {
      await connection.query(`
        ALTER TABLE bookings ADD INDEX idx_bookings_customer_name (customer_name)
      `);
      console.log('✅ Index on customer_name created');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    }

    try {
      await connection.query(`
        ALTER TABLE bookings ADD INDEX idx_bookings_customer_email (customer_email)
      `);
      console.log('✅ Index on customer_email created');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
    }

    // Verify the changes
    console.log('\n📋 Verifying columns...');
    const [verifyColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME LIKE 'customer%'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nCustomer Info Columns:');
    verifyColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(25)} | ${col.COLUMN_TYPE.padEnd(25)} | Nullable: ${col.IS_NULLABLE}`);
    });

    console.log('\n✨ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addCustomerInfoColumns();
