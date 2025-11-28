-- =====================================================
-- MIXLAB STUDIO - MySQL Database Schema
-- =====================================================

-- =====================================================
-- 1. USERS TABLE
-- Central table for all user types (Students, Instructors, Admins)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    birthday DATE,
    contact VARCHAR(20),
    home_address TEXT,
    hashed_password VARCHAR(255),
    role ENUM('student', 'admin', 'instructor') DEFAULT 'student',
    is_verified BOOLEAN DEFAULT FALSE,

    -- Instructor-Specific Fields
    specialization TEXT,
    years_experience INTEGER,
    certifications TEXT,
    bio TEXT,
    hourly_rate DECIMAL(10, 2),
    available_for_booking BOOLEAN DEFAULT TRUE,

    -- OTP Verification Fields
    otp_secret VARCHAR(255),

    -- Tracking
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    login_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INTEGER,

    -- Soft Delete
    deleted_at TIMESTAMP NULL,

    -- Indexes for performance
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_is_verified (is_verified),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. USER PREFERENCES TABLE
-- Store individual user notification and UI preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    
    -- Notification Preferences
    email_notifications BOOLEAN DEFAULT TRUE,
    lesson_updates BOOLEAN DEFAULT TRUE,
    achievement_alerts BOOLEAN DEFAULT TRUE,
    
    -- Additional Preferences (can be extended)
    theme VARCHAR(20) DEFAULT 'dark',
    language VARCHAR(10) DEFAULT 'en',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preference (user_id),
    INDEX idx_user_preferences_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. OTP VERIFICATIONS TABLE
-- For one-time password/password reset functionality
-- =====================================================
CREATE TABLE IF NOT EXISTS otp_verification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    type ENUM('verify_email', 'reset_password') NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   
    -- Foreign key constraint
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
   
    -- Indexes for performance
    INDEX idx_email (email),
    INDEX idx_otp_code (otp_code),
    INDEX idx_expires_at (expires_at),
    INDEX idx_type (type),
    INDEX idx_is_used (is_used),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. SERVICES TABLE
-- Defines available services/lesson types
-- =====================================================
CREATE TABLE services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    description TEXT,
    instrument VARCHAR(50) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_trial BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    max_students INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_services_instrument (instrument),
    INDEX idx_services_active (is_active),
    
    CONSTRAINT chk_instrument CHECK (instrument IN ('recording', 'music_lesson', 'band_rehearsal', 'mixing', 'production'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. INSTRUCTOR AVAILABILITY TABLE
-- Manages instructor working hours and availability
-- =====================================================
CREATE TABLE instructor_availability (
    availability_id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INTEGER NOT NULL,
    
    -- Day of week (0 = Sunday, 6 = Saturday)
    day_of_week INTEGER NOT NULL,
    
    -- Time slots
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Recurring or one-time
    is_recurring BOOLEAN DEFAULT TRUE,
    specific_date DATE,
    
    -- Status
    is_available BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_instructor_avail FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_instructor_avail_instructor (instructor_id),
    INDEX idx_instructor_avail_day (day_of_week),
    UNIQUE KEY unique_availability (instructor_id, day_of_week, start_time, specific_date),
    
    CONSTRAINT chk_day_of_week CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. BOOKINGS TABLE
-- Core booking/scheduling table with complete payment & QR code support
-- =====================================================
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    
    -- Related Entities
    user_id INTEGER NOT NULL,
    instructor_id INTEGER,
    service_id INTEGER NOT NULL,
    
    -- Customer Information (from booking form)
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_contact VARCHAR(20),
    customer_address TEXT,
    
    -- Schedule Information
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    
    -- Service Details
    service_type VARCHAR(50),
    service_name VARCHAR(255),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Check-in Information
    qr_code VARCHAR(500),
    qr_code_path VARCHAR(500),
    qr_code_data LONGTEXT,
    checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMP NULL,
    
    -- Location
    room_location VARCHAR(50),
    
    -- Cancellation
    cancelled_at TIMESTAMP NULL,
    cancelled_by INTEGER,
    cancellation_reason TEXT,
    refund_amount DECIMAL(10, 2) DEFAULT 0,
    refund_processed_at TIMESTAMP NULL,

    -- Rescheduling
    rescheduled_from INTEGER,
    rescheduled_to INTEGER,
    rescheduling_fee DECIMAL(10, 2) DEFAULT 0,
    rescheduling_fee_paid_at TIMESTAMP NULL,
    
    -- User Notes
    user_notes TEXT,
    
    -- Additional Booking Details
    number_of_people INT DEFAULT 1,
    special_requests TEXT,
    
    -- Payment Information
    payment_status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    xendit_payment_id VARCHAR(255),
    xendit_invoice_id VARCHAR(255),
    paid_at TIMESTAMP NULL,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_instructor FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_booking_service FOREIGN KEY (service_id) REFERENCES services(service_id),
    CONSTRAINT fk_booking_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id),
    CONSTRAINT fk_booking_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_booking_rescheduled_from FOREIGN KEY (rescheduled_from) REFERENCES bookings(booking_id),
    CONSTRAINT fk_booking_rescheduled_to FOREIGN KEY (rescheduled_to) REFERENCES bookings(booking_id),
    
    INDEX idx_bookings_user (user_id),
    INDEX idx_bookings_instructor (instructor_id),
    INDEX idx_bookings_date (booking_date),
    INDEX idx_bookings_status (status),
    INDEX idx_bookings_reference (booking_reference),
    INDEX idx_bookings_payment_status (payment_status),
    INDEX idx_bookings_customer_email (customer_email),
    
    CONSTRAINT chk_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'pending_payment')),
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('pending', 'paid', 'expired', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. BOOKING NOTES TABLE
-- Additional notes for bookings (instructor/admin notes)
-- =====================================================
CREATE TABLE booking_notes (
    note_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    note_type VARCHAR(20),
    note_content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_booking_notes_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_notes_user FOREIGN KEY (user_id) REFERENCES users(id),
    
    INDEX idx_booking_notes_booking (booking_id),
    
    CONSTRAINT chk_note_type CHECK (note_type IN ('instructor', 'admin', 'system'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. INVOICES TABLE
-- Invoice records for bookings
-- =====================================================
CREATE TABLE invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    booking_id INTEGER,
    user_id INTEGER NOT NULL,
    
    -- Invoice Details
    issue_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    due_date DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Additional Info
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_invoice_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
    CONSTRAINT fk_invoice_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_invoices_user (user_id),
    INDEX idx_invoices_status (status),
    INDEX idx_invoices_number (invoice_number),
    
    CONSTRAINT chk_invoice_status CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. TRANSACTIONS TABLE
-- Payment transaction records
-- =====================================================
CREATE TABLE transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_reference VARCHAR(50) UNIQUE NOT NULL,
    
    -- Related Entities
    invoice_id INTEGER,
    booking_id INTEGER,
    user_id INTEGER NOT NULL,
    
    -- Transaction Details
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Payment Gateway Info (Xendit)
    gateway_transaction_id VARCHAR(255),
    gateway_response TEXT,
    xendit_payment_id VARCHAR(255),
    xendit_invoice_id VARCHAR(255),
    
    -- Refund Information
    refunded_amount DECIMAL(10, 2),
    refund_reason TEXT,
    refunded_at TIMESTAMP NULL,
    
    -- Timestamps
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    CONSTRAINT fk_transaction_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL,
    CONSTRAINT fk_transaction_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
    CONSTRAINT fk_transaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_transactions_user (user_id),
    INDEX idx_transactions_invoice (invoice_id),
    INDEX idx_transactions_status (status),
    INDEX idx_transactions_date (transaction_date),
    
    CONSTRAINT chk_payment_method CHECK (payment_method IN ('credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash', 'gcash', 'paymaya', 'xendit', 'other')),
    CONSTRAINT chk_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    INDEX idx_transactions_xendit_payment (xendit_payment_id),
    INDEX idx_transactions_xendit_invoice (xendit_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8.5 BOOKING REFUNDS TABLE
-- Track refund transactions and amounts for cancelled bookings
-- =====================================================
CREATE TABLE booking_refunds (
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

-- =====================================================
-- 9. MODULES TABLE
-- Learning modules for gamified content
-- =====================================================
CREATE TABLE modules (
    module_id INT AUTO_INCREMENT PRIMARY KEY,
    module_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    -- Module Type
    instrument VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    
    -- Content
    estimated_duration_minutes INTEGER,
    xp_reward INTEGER DEFAULT 1000,
    
    -- Level Requirements
    required_level INTEGER DEFAULT 1,
    
    -- Order and Status
    display_order INTEGER,
    status VARCHAR(20) DEFAULT 'draft',
    
    -- Metadata
    thumbnail_url VARCHAR(500),
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    CONSTRAINT fk_module_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    
    INDEX idx_modules_instrument (instrument),
    INDEX idx_modules_difficulty (difficulty),
    INDEX idx_modules_status (status),
    
    CONSTRAINT chk_instrument_module CHECK (instrument IN ('piano', 'guitar', 'theory')),
    CONSTRAINT chk_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_module_status CHECK (status IN ('draft', 'published', 'archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. LESSONS TABLE
-- Individual lessons within modules
-- =====================================================
CREATE TABLE lessons (
    lesson_id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INTEGER NOT NULL,
    
    -- Lesson Details
    lesson_name VARCHAR(150) NOT NULL,
    description TEXT,
    lesson_type VARCHAR(20),
    
    -- Content
    content_url VARCHAR(500),
    text_content TEXT,
    estimated_duration_minutes INTEGER,
    xp_reward INTEGER DEFAULT 100,
    
    -- Order
    lesson_order INTEGER NOT NULL,
    
    -- Resources
    downloadable_resources TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_lesson_module FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE,
    
    INDEX idx_lessons_module (module_id),
    INDEX idx_lessons_order (lesson_order),
    
    CONSTRAINT chk_lesson_type CHECK (lesson_type IN ('video', 'interactive', 'reading', 'practice'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. LESSON PROGRESS TABLE
-- Track student progress through lessons
-- =====================================================
CREATE TABLE lesson_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    
    -- Progress
    status VARCHAR(20) DEFAULT 'not_started',
    progress_percentage INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    
    -- Completion
    completed_at TIMESTAMP NULL,
    xp_earned INTEGER DEFAULT 0,
    
    -- Notes
    student_notes TEXT,
    
    -- Tracking
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_progress_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_student_lesson (student_id, lesson_id),
    INDEX idx_lesson_progress_student (student_id),
    INDEX idx_lesson_progress_lesson (lesson_id),
    
    CONSTRAINT chk_progress_status CHECK (status IN ('not_started', 'in_progress', 'completed')),
    CONSTRAINT chk_progress_percentage CHECK (progress_percentage BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 12. QUIZZES TABLE
-- Quizzes for modules
-- =====================================================
CREATE TABLE quizzes (
    quiz_id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INTEGER NOT NULL,
    
    -- Quiz Details
    quiz_name VARCHAR(150) NOT NULL,
    description TEXT,
    
    -- Settings
    passing_score INTEGER DEFAULT 70,
    time_limit_minutes INTEGER,
    max_attempts INTEGER,
    
    -- Rewards
    xp_reward_perfect INTEGER DEFAULT 500,
    xp_reward_pass INTEGER DEFAULT 350,
    xp_penalty_retry INTEGER DEFAULT 50,
    
    -- Order
    quiz_order INTEGER,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_quiz_module FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE,
    
    INDEX idx_quizzes_module (module_id),
    
    CONSTRAINT chk_passing_score CHECK (passing_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 13. QUIZ QUESTIONS TABLE
-- Questions for quizzes
-- =====================================================
CREATE TABLE quiz_questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INTEGER NOT NULL,
    
    -- Question Details
    question_type VARCHAR(20) NOT NULL,
    question_text TEXT NOT NULL,
    
    -- Media
    question_image_url VARCHAR(500),
    question_audio_url VARCHAR(500),
    
    -- Options
    options TEXT,
    correct_answer TEXT NOT NULL,
    
    -- Explanation
    explanation TEXT,
    
    -- Points
    points INTEGER DEFAULT 1,
    
    -- Order
    question_order INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    
    INDEX idx_quiz_questions_quiz (quiz_id),
    
    CONSTRAINT chk_question_type CHECK (question_type IN ('multiple_choice', 'true_false', 'audio_identification', 'notation_reading'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 14. QUIZ ATTEMPTS TABLE
-- Track student quiz attempts
-- =====================================================
CREATE TABLE quiz_attempts (
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    
    -- Attempt Details
    attempt_number INTEGER NOT NULL,
    
    -- Answers
    answers TEXT NOT NULL,
    
    -- Results
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    
    -- Time
    time_taken_minutes INTEGER,
    
    -- XP Earned
    xp_earned INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    
    CONSTRAINT fk_attempt_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    
    INDEX idx_quiz_attempts_student (student_id),
    INDEX idx_quiz_attempts_quiz (quiz_id),
    INDEX idx_quiz_attempts_completed (completed_at),
    
    CONSTRAINT chk_quiz_attempt_score CHECK (score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 15. USER XP TABLE
-- Track student XP and level
-- =====================================================
CREATE TABLE user_xp (
    xp_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    
    -- XP and Level
    total_xp INTEGER DEFAULT 0 NOT NULL,
    current_level INTEGER DEFAULT 1 NOT NULL,
    xp_to_next_level INTEGER DEFAULT 500 NOT NULL,
    
    -- Streaks
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    
    -- Stats
    total_lessons_completed INTEGER DEFAULT 0,
    total_quizzes_taken INTEGER DEFAULT 0,
    total_quizzes_passed INTEGER DEFAULT 0,
    total_modules_completed INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_xp_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user_xp_student (student_id),
    INDEX idx_user_xp_level (current_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 16. MODULE UNLOCKS TABLE
-- Defines which modules are unlocked at each level
-- =====================================================
CREATE TABLE module_unlocks (
    unlock_id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INTEGER NOT NULL,
    required_level INTEGER NOT NULL,
    
    CONSTRAINT fk_unlock_module FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_module_level (module_id, required_level),
    INDEX idx_module_unlocks_level (required_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 17. BADGES TABLE
-- Available badges/achievements
-- =====================================================
CREATE TABLE badges (
    badge_id INT AUTO_INCREMENT PRIMARY KEY,
    badge_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    
    -- Badge Type
    badge_type VARCHAR(20) NOT NULL,
    
    -- Unlock Criteria
    criteria TEXT NOT NULL,
    
    -- Rewards
    xp_reward INTEGER DEFAULT 0,
    
    -- Media
    badge_icon_url VARCHAR(500),
    
    -- Rarity
    rarity VARCHAR(20) DEFAULT 'common',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_badges_type (badge_type),
    INDEX idx_badges_active (is_active),
    
    CONSTRAINT chk_badge_type CHECK (badge_type IN ('milestone', 'streak', 'mastery', 'special')),
    CONSTRAINT chk_rarity CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 18. USER BADGES TABLE
-- Track badges earned by users
-- =====================================================
CREATE TABLE user_badges (
    user_badge_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    badge_id INTEGER NOT NULL,
    
    -- Earning Details
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    xp_earned INTEGER DEFAULT 0,
    
    CONSTRAINT fk_user_badge_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_badge_badge FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_student_badge (student_id, badge_id),
    INDEX idx_user_badges_student (student_id),
    INDEX idx_user_badges_badge (badge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 19. NOTIFICATIONS TABLE
-- System notifications for users
-- =====================================================
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    
    -- Notification Details
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related Entity
    related_entity_type VARCHAR(50),
    related_entity_id INTEGER,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    
    -- Delivery
    sent_via_email BOOLEAN DEFAULT FALSE,
    sent_via_sms BOOLEAN DEFAULT FALSE,
    sent_via_push BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_type (notification_type),
    INDEX idx_notifications_read (is_read),
    INDEX idx_notifications_created (created_at),
    
    CONSTRAINT chk_notification_type CHECK (notification_type IN (
        'booking_created',
        'booking_confirmed',
        'booking_confirmation',
        'booking_reminder_24h',
        'booking_reminder_1h',
        'booking_cancelled',
        'booking_rescheduled',
        'payment_received',
        'payment_reminder',
        'payment_overdue',
        'level_up',
        'badge_earned',
        'module_unlocked',
        'system_announcement',
        'instructor_message'
    ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 20. ACTIVITY LOGS TABLE
-- Comprehensive system activity logging
-- =====================================================
CREATE TABLE activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Actor
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Activity Details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    
    -- Details
    description TEXT,
    metadata TEXT,
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_activity_logs_user (user_id),
    INDEX idx_activity_logs_action (action),
    INDEX idx_activity_logs_entity (entity_type, entity_id),
    INDEX idx_activity_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 21. SYSTEM SETTINGS TABLE
-- Global system configuration
-- =====================================================
CREATE TABLE system_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INTEGER,
    
    CONSTRAINT fk_setting_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
    
    INDEX idx_system_settings_key (setting_key),
    
    CONSTRAINT chk_setting_type CHECK (setting_type IN ('string', 'integer', 'boolean', 'json'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 22. CANCELLATION POLICIES TABLE
-- Business rules for cancellation and rescheduling
-- =====================================================
CREATE TABLE cancellation_policies (
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


-- =====================================================
-- SEED DATA - SERVICES
-- =====================================================

-- Insert booking services
INSERT INTO services (service_name, description, instrument, duration_minutes, price, is_active) VALUES
('Music Lessons', 'One-on-one music instruction', 'music_lesson', 60, 500.00, TRUE),
('Recording', 'Professional recording session', 'recording', 60, 1500.00, TRUE),
('Mixing', 'Audio mixing and mastering', 'mixing', 60, 1200.00, TRUE),
('Band Rehearsal', 'Band practice and rehearsal space', 'band_rehearsal', 60, 800.00, TRUE),
('Production', 'Music production and arrangement', 'production', 60, 2000.00, TRUE);

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
-- SAMPLE DATA INSERTS - COMMENTED OUT
-- Uncomment and run separately if needed for development/testing
-- =====================================================

-- Insert System Settings
-- INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
-- ('studio_name', 'MixLab Studio', 'string', 'Name of the music studio', true),
-- ... (See seed data file for complete sample data)

-- Insert default admin user
-- INSERT INTO users (first_name, last_name, email, hashed_password, role, is_verified, home_address, email_verified)
-- VALUES ('System', 'Admin', 'admin@mixlabstudio.com', '$2a$10$example_hashed_password', 'admin', true, 'Studio Headquarters, Makati City, Metro Manila', true);

-- Insert Services, Badges, and Modules
-- (See seed data file for complete sample data)

-- =====================================================
-- STORED PROCEDURES AND FUNCTIONS
-- Business logic for cancellation and rescheduling
-- =====================================================

-- Function to calculate hours until booking
DELIMITER //

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

