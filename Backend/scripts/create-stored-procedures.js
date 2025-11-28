import { query } from '../config/db.js';

const procedures = `
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
    SET booking_datetime = TIMESTAMP(booking_date, start_time);
    SET hours_until = TIMESTAMPDIFF(HOUR, NOW(), booking_datetime);
    RETURN GREATEST(0, hours_until);
END;

-- Function to get applicable cancellation/rescheduling policy
CREATE FUNCTION get_cancellation_policy(policy_type VARCHAR(20), hours_until INT)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE policy_id INT;
    SELECT cp.policy_id INTO policy_id
    FROM cancellation_policies cp
    WHERE cp.policy_type = policy_type
      AND cp.hours_before_booking <= hours_until
      AND cp.is_active = TRUE
    ORDER BY cp.hours_before_booking DESC
    LIMIT 1;
    RETURN policy_id;
END;

-- Function to calculate refund amount for cancellation
CREATE FUNCTION calculate_cancellation_refund(booking_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    DECLARE hours_until INT;
    DECLARE refund_percentage DECIMAL(5,2);
    DECLARE refund_amount DECIMAL(10,2);
    SELECT b.total_amount, calculate_hours_until_booking(b.booking_date, b.start_time)
    INTO total_amount, hours_until
    FROM bookings b
    WHERE b.booking_id = booking_id;
    IF total_amount IS NULL OR total_amount = 0 THEN
        RETURN 0.00;
    END IF;
    SELECT cp.refund_percentage INTO refund_percentage
    FROM cancellation_policies cp
    WHERE cp.policy_id = get_cancellation_policy('cancellation', hours_until);
    SET refund_amount = total_amount * (refund_percentage / 100);
    RETURN refund_amount;
END;

-- Function to calculate rescheduling fee
CREATE FUNCTION calculate_rescheduling_fee(booking_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    DECLARE hours_until INT;
    DECLARE fee_percentage DECIMAL(5,2);
    DECLARE fee_amount DECIMAL(10,2);
    SELECT b.total_amount, calculate_hours_until_booking(b.booking_date, b.start_time)
    INTO total_amount, hours_until
    FROM bookings b
    WHERE b.booking_id = booking_id;
    IF total_amount IS NULL OR total_amount = 0 THEN
        RETURN 0.00;
    END IF;
    IF hours_until < 8 THEN
        RETURN -1.00;
    END IF;
    SELECT cp.fee_percentage INTO fee_percentage
    FROM cancellation_policies cp
    WHERE cp.policy_id = get_cancellation_policy('rescheduling', hours_until);
    SET fee_amount = total_amount * (fee_percentage / 100);
    RETURN fee_amount;
END;

-- Procedure to process booking cancellation
CREATE PROCEDURE process_booking_cancellation(
    IN p_booking_id INT,
    IN p_cancelled_by INT,
    IN p_cancellation_reason TEXT
)
BEGIN
    DECLARE refund_amount DECIMAL(10,2);
    DECLARE booking_status VARCHAR(20);
    START TRANSACTION;
    SELECT status INTO booking_status
    FROM bookings
    WHERE booking_id = p_booking_id;
    IF booking_status NOT IN ('cancelled', 'completed', 'no_show') THEN
        SET refund_amount = calculate_cancellation_refund(p_booking_id);
        UPDATE bookings
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = p_cancelled_by,
            cancellation_reason = p_cancellation_reason,
            refund_amount = refund_amount,
            updated_at = NOW()
        WHERE booking_id = p_booking_id;
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
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking cannot be cancelled in its current status';
    END IF;
END;

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
    START TRANSACTION;
    SET fee_amount = calculate_rescheduling_fee(p_booking_id);
    IF fee_amount = -1.00 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rescheduling not allowed within 8 hours of booking time';
    END IF;
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
    UPDATE bookings
    SET
        status = 'rescheduled',
        rescheduled_to = new_booking_id,
        rescheduling_fee = fee_amount,
        updated_at = NOW()
    WHERE booking_id = p_booking_id;
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
            -fee_amount,
            'rescheduling_fee',
            'original_payment_method',
            'pending',
            CONCAT('Rescheduling fee: ', p_rescheduling_reason)
        );
    END IF;
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
END;
`;

try {
  await query(procedures);
  console.log('✅ Stored procedures and functions created successfully!');
} catch (error) {
  console.error('❌ Error creating stored procedures:', error.message);
  console.error('Stack:', error.stack);
}
