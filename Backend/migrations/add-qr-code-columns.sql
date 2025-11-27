-- =====================================================
-- Migration: Add QR Code Storage Columns
-- =====================================================
-- This script adds missing columns for QR code storage
-- These are used to store both the file path and base64 data URL

-- Add QR code columns to bookings table
-- qr_code_path: File path like /uploads/qrcodes/booking_123_456789.png
-- qr_code_data: Base64 encoded data URL for easy display in frontend
ALTER TABLE bookings ADD COLUMN qr_code_path VARCHAR(500) AFTER qr_code;
ALTER TABLE bookings ADD COLUMN qr_code_data LONGTEXT AFTER qr_code_path;

-- Create index for QR code lookups
ALTER TABLE bookings ADD INDEX idx_bookings_qr_code_path (qr_code_path);

-- Verify changes
SELECT 'QR Code columns added successfully!' as status;
SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME LIKE 'qr%';
