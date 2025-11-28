-- =====================================================
-- Migration: Add Cancellation and Rescheduling Policies
-- Date: 2025-11-28
-- =====================================================

-- Add cancellation policies table
CREATE TABLE IF NOT EXISTS cancellation_policies (
    policy_id INT AUTO_INCREMENT PRIMARY KEY,
    policy_type VARCHAR(20) NOT NULL, -- 'cancellation' or 'rescheduling'

    -- Time thresholds in hours before booking
    hours_before_booking INT NOT NULL,

    -- Refund/Fee percentages (0-100)
    refund_percentage DECIMAL(5,2) DEFAULT 0,
    fee_percentage DECIMAL(5,2) DEFAULT 0,

    -- Description
    description TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_cancellation_policies_type (policy_type),
    INDEX idx_cancellation_policies_active (is_active),

    CONSTRAINT chk_policy_type CHECK (policy_type IN ('cancellation', 'rescheduling')),
    CONSTRAINT chk_refund_percentage CHECK (refund_percentage BETWEEN 0 AND 100),
    CONSTRAINT chk_fee_percentage CHECK (fee_percentage BETWEEN 0 AND 100),
    CONSTRAINT chk_hours_before CHECK (hours_before_booking >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Columns already exist in bookings table - skipping ALTER TABLE statements

-- Add booking refunds table
CREATE TABLE IF NOT EXISTS booking_refunds (
    refund_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INTEGER NOT NULL,

    -- Refund Details
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason VARCHAR(100) NOT NULL, -- 'cancellation', 'rescheduling_fee', 'partial_refund'
    refund_method VARCHAR(50), -- 'original_payment_method', 'bank_transfer', 'credit_note'

    -- Processing Details
    processed_by INTEGER,
    processed_at TIMESTAMP NULL,
    refund_reference VARCHAR(100) UNIQUE,

    -- External Payment Gateway Info
    gateway_refund_id VARCHAR(255),
    gateway_response TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Notes
    admin_notes TEXT,

    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_refund_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_refund_processed_by FOREIGN KEY (processed_by) REFERENCES users(id),

    INDEX idx_booking_refunds_booking (booking_id),
    INDEX idx_booking_refunds_status (status),
    INDEX idx_booking_refunds_processed (processed_at),

    CONSTRAINT chk_refund_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_refund_method CHECK (refund_method IN ('original_payment_method', 'bank_transfer', 'credit_note', 'cash', 'other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert cancellation and rescheduling policies
INSERT INTO cancellation_policies (policy_type, hours_before_booking, refund_percentage, fee_percentage, description) VALUES
-- Cancellation Rules
('cancellation', 48, 100.00, 0.00, 'Full refund if cancelled 48+ hours before booking'),
('cancellation', 24, 50.00, 0.00, '50% refund if cancelled 24-47 hours before booking'),
('cancellation', 0, 0.00, 0.00, 'No refund if cancelled less than 24 hours before booking'),

-- Rescheduling Rules
('rescheduling', 24, 0.00, 0.00, 'Free rescheduling if done 24+ hours before booking'),
('rescheduling', 8, 0.00, 100.00, 'Small rescheduling fee if done 8-23 hours before booking'),
('rescheduling', 0, 0.00, 0.00, 'Not allowed - treated as cancellation if done less than 8 hours before booking');

-- =====================================================
-- STORED PROCEDURES AND FUNCTIONS
-- Business logic for cancellation and rescheduling
-- =====================================================

DELIMITER //

-- Drop functions if they exist
DROP FUNCTION IF EXISTS calculate_hours_until_booking;
DROP FUNCTION IF EXISTS get_cancellation_policy;
DROP FUNCTION IF EXISTS calculate_cancellation_refund;
DROP FUNCTION IF EXISTS calculate_rescheduling_fee;

-- Drop procedures if they exist
DROP PROCEDURE IF EXISTS process_booking_cancellation;
DROP PROCEDURE IF EXISTS process_booking_rescheduling;

-- Function to calculate hours until booking
CREATE FUNCTION calculate_hours_until_booking(booking_date DATETIME, start_time TIME)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE booking_datetime DATETIME;
    DECLARE hours_until INT;

    -- Combine booking_date and start_time
    SET booking_datetime = TIMESTAMP(booking_date, start_time);

    -- Calculate hours until booking
    SET hours_until = TIMESTAMPDIFF(HOUR, NOW(), booking_datetime);

    RETURN GREATEST(0, hours_until);
END //

-- Function to get applicable cancellation/rescheduling policy
CREATE FUNCTION get_cancellation_policy(policy_type VARCHAR(20), hours_until INT)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE policy_id INT;

    -- Get the most restrictive policy that applies (highest hours_before_booking that is <= hours_until)
    SELECT cp.policy_id INTO policy_id
    FROM cancellation_policies cp
    WHERE cp.policy_type = policy_type
      AND cp.hours_before_booking <= hours_until
      AND cp.is_active = TRUE
    ORDER BY cp.hours_before_booking DESC
    LIMIT 1;

    RETURN policy_id;
END //

-- Function to calculate refund amount for cancellation
CREATE FUNCTION calculate_cancellation_refund(booking_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    DECLARE hours_until INT;
    DECLARE refund_percentage DECIMAL(5,2);
    DECLARE refund_amount DECIMAL(10,2);

    -- Get booking details
    SELECT b.total_amount, calculate_hours_until_booking(b.booking_date, b.start_time)
    INTO total_amount, hours_until
    FROM bookings b
    WHERE b.booking_id = booking_id;

    -- If booking not found or no payment, return 0
    IF total_amount IS NULL OR total_amount = 0 THEN
        RETURN 0.00;
    END IF;

    -- Get refund percentage from policy
    SELECT cp.refund_percentage INTO refund_percentage
    FROM cancellation_policies cp
    WHERE cp.policy_id = get_cancellation_policy('cancellation', hours_until);

    -- Calculate refund amount
    SET refund_amount = total_amount * (refund_percentage / 100);

    RETURN refund_amount;
END //

-- Function to calculate rescheduling fee
CREATE FUNCTION calculate_rescheduling_fee(booking_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    DECLARE hours_until INT;
    DECLARE fee_percentage DECIMAL(5,2);
    DECLARE fee_amount DECIMAL(10,2);

    -- Get booking details
    SELECT b.total_amount, calculate_hours_until_booking(b.booking_date, b.start_time)
    INTO total_amount, hours_until
    FROM bookings b
    WHERE b.booking_id = booking_id;

    -- If booking not found or no payment, return 0
    IF total_amount IS NULL OR total_amount = 0 THEN
        RETURN 0.00;
    END IF;

    -- Check if rescheduling is allowed (if hours_until < 8, it should be treated as cancellation)
    IF hours_until < 8 THEN
        RETURN -1.00; -- Special value indicating rescheduling not allowed
    END IF;

    -- Get fee percentage from policy
    SELECT cp.fee_percentage INTO fee_percentage
    FROM cancellation_policies cp
    WHERE cp.policy_id = get_cancellation_policy('rescheduling', hours_until);

    -- Calculate fee amount
    SET fee_amount = total_amount * (fee_percentage / 100);

    RETURN fee_amount;
END //

-- Procedure to process booking cancellation
CREATE PROCEDURE process_booking_cancellation(
    IN p_booking_id INT,
    IN p_cancelled_by INT,
    IN p_cancellation_reason TEXT
)
BEGIN
    DECLARE refund_amount DECIMAL(10,2);
    DECLARE booking_status VARCHAR(20);

    -- Start transaction
    START TRANSACTION;

    -- Check current booking status
    SELECT status INTO booking_status
    FROM bookings
    WHERE booking_id = p_booking_id;

    -- Only allow cancellation if booking is not already cancelled/completed
    IF booking_status NOT IN ('cancelled', 'completed', 'no_show') THEN
        -- Calculate refund amount
        SET refund_amount = calculate_cancellation_refund(p_booking_id);

        -- Update booking
        UPDATE bookings
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = p_cancelled_by,
            cancellation_reason = p_cancellation_reason,
            refund_amount = refund_amount,
            updated_at = NOW()
        WHERE booking_id = p_booking_id;

        -- Insert refund record if refund amount > 0
        IF refund_amount > 0 THEN
            INSERT INTO booking_refunds (
                booking_id,
                refund_amount,
                refund_reason,
                refund_method,
                status,
                admin_notes
            ) VALUES (
                p_booking_id,
                refund_amount,
                'cancellation',
                'original_payment_method',
                'pending',
                CONCAT('Auto-calculated refund for cancellation: ', p_cancellation_reason)
            );
        END IF;

        -- Log activity
        INSERT INTO activity_logs (
            user_id,
            action,
            entity_type,
            entity_id,
            description,
            metadata
        ) VALUES (
            p_cancelled_by,
            'booking_cancelled',
            'booking',
            p_booking_id,
            CONCAT('Booking cancelled with refund amount: ', refund_amount),
            JSON_OBJECT('refund_amount', refund_amount, 'reason', p_cancellation_reason)
        );

        COMMIT;
    ELSE
        -- Rollback if booking cannot be cancelled
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking cannot be cancelled in its current status';
    END IF;
END //

-- Procedure to process booking rescheduling
CREATE PROCEDURE process_booking_rescheduling(
    IN p_booking_id INT,
    IN p_new_booking_date DATE,
    IN p_new_start_time TIME,
    IN p_rescheduled_by INT,
    IN p_rescheduling_reason TEXT
)
BEGIN
    DECLARE fee_amount DECIMAL(10,2);
    DECLARE new_booking_id INT;
    DECLARE original_booking_data JSON;

    -- Start transaction
    START TRANSACTION;

    -- Calculate rescheduling fee
    SET fee_amount = calculate_rescheduling_fee(p_booking_id);

    -- Check if rescheduling is allowed
    IF fee_amount = -1.00 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rescheduling not allowed within 8 hours of booking time';
    END IF;

    -- Get original booking data
    SELECT JSON_OBJECT(
        'user_id', user_id,
        'instructor_id', instructor_id,
        'service_id', service_id,
        'customer_name', customer_name,
        'customer_email', customer_email,
        'customer_contact', customer_contact,
        'customer_address', customer_address,
        'service_type', service_type,
        'service_name', service_name,
        'duration_minutes', duration_minutes,
        'room_location', room_location,
        'number_of_people', number_of_people,
        'special_requests', special_requests,
        'total_amount', total_amount,
        'payment_status', payment_status,
        'xendit_payment_id', xendit_payment_id,
        'xendit_invoice_id', xendit_invoice_id,
        'paid_at', paid_at,
        'created_by', created_by
    ) INTO original_booking_data
    FROM bookings
    WHERE booking_id = p_booking_id;

    -- Create new booking
    INSERT INTO bookings (
        booking_reference,
        user_id, instructor_id, service_id,
        customer_name, customer_email, customer_contact, customer_address,
        booking_date, start_time, end_time, duration_minutes,
        service_type, service_name,
        status, room_location, number_of_people, special_requests,
        total_amount, payment_status, xendit_payment_id, xendit_invoice_id, paid_at,
        rescheduled_from, created_by
    )
    SELECT
        CONCAT('RESCH-', booking_reference),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.user_id')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.instructor_id')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.service_id')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.customer_name')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.customer_email')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.customer_contact')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.customer_address')),
        p_new_booking_date,
        p_new_start_time,
        ADDTIME(p_new_start_time, SEC_TO_TIME(duration_minutes * 60)),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.duration_minutes')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.service_type')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.service_name')),
        'confirmed',
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.room_location')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.number_of_people')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.special_requests')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.total_amount')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.payment_status')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.xendit_payment_id')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.xendit_invoice_id')),
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.paid_at')),
        p_booking_id,
        JSON_UNQUOTE(JSON_EXTRACT(original_booking_data, '$.created_by'))
    FROM bookings
    WHERE booking_id = p_booking_id;

    SET new_booking_id = LAST_INSERT_ID();

    -- Update original booking
    UPDATE bookings
    SET
        status = 'rescheduled',
        rescheduled_to = new_booking_id,
        rescheduling_fee = fee_amount,
        updated_at = NOW()
    WHERE booking_id = p_booking_id;

    -- Insert fee record if fee amount > 0
    IF fee_amount > 0 THEN
        INSERT INTO booking_refunds (
            booking_id,
            refund_amount,
            refund_reason,
            refund_method,
            status,
            admin_notes
        ) VALUES (
            p_booking_id,
            -fee_amount, -- Negative to indicate fee owed
            'rescheduling_fee',
            'original_payment_method',
            'pending',
            CONCAT('Rescheduling fee: ', p_rescheduling_reason)
        );
    END IF;

    -- Log activity
    INSERT INTO activity_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        description,
        metadata
    ) VALUES (
        p_rescheduled_by,
        'booking_rescheduled',
        'booking',
        p_booking_id,
        CONCAT('Booking rescheduled to new booking ID: ', new_booking_id, ', fee: ', fee_amount),
        JSON_OBJECT('new_booking_id', new_booking_id, 'fee_amount', fee_amount, 'reason', p_rescheduling_reason)
    );

    COMMIT;
END //

DELIMITER ;
