-- =====================================================
-- Migration: Add Customer Name to Bookings Table
-- =====================================================
-- Stores the customer name directly in bookings for easy access
-- This prevents issues when user account doesn't exist or is deleted

ALTER TABLE bookings ADD COLUMN customer_name VARCHAR(255) AFTER user_id;
ALTER TABLE bookings ADD COLUMN customer_email VARCHAR(255) AFTER customer_name;
ALTER TABLE bookings ADD COLUMN customer_contact VARCHAR(20) AFTER customer_email;
ALTER TABLE bookings ADD COLUMN customer_address TEXT AFTER customer_contact;

-- Create indexes for lookups
ALTER TABLE bookings ADD INDEX idx_bookings_customer_name (customer_name);
ALTER TABLE bookings ADD INDEX idx_bookings_customer_email (customer_email);

SELECT 'Customer info columns added to bookings table!' as status;
SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME LIKE 'customer%'
ORDER BY ORDINAL_POSITION;
