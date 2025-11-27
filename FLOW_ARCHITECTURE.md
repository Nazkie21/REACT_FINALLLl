# QR Code & Payment Status Flow - Architecture Diagram

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER BOOKS A LESSON                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. User fills booking form (service, date, time)                             │
│  2. Frontend: POST /api/bookings (React)                                      │
│  3. Backend: Create booking with status='pending', payment_status='pending'   │
│  4. Database: INSERT INTO bookings (...)                                      │
│     - booking_id: UUID                                                        │
│     - status: 'pending'                                                       │
│     - payment_status: 'pending'                                               │
│     - qr_code: NULL (will be generated after payment)                         │
│     - qr_code_path: NULL (NEW COLUMN)                                         │
│     - qr_code_data: NULL (NEW COLUMN)                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      USER INITIATES PAYMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. User clicks "Pay Now" button                                              │
│  2. Frontend creates Xendit invoice                                            │
│  3. Xendit generates payment link (GCash, card, e-wallet)                      │
│  4. User redirected to Xendit payment page                                     │
│  5. User completes payment (GCash/Credit Card)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    XENDIT WEBHOOK RECEIVED                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Backend: POST /api/webhooks/xendit                                            │
│  ├─ Verify webhook token (security check)                                     │
│  ├─ Parse payment event (status: PAID)                                        │
│  └─ Call xenditWebhookController.handlePaymentSuccess()                       │
│                                                                                │
│  What happens:                                                                │
│  1. Find booking in database                                                  │
│     SELECT * FROM bookings WHERE booking_id = ?                               │
│                                                                                │
│  2. UPDATE booking status                                                     │
│     UPDATE bookings SET                                                       │
│       payment_status = 'paid'          ← Payment confirmed!                   │
│       status = 'confirmed'              ← Booking now confirmed                │
│       xendit_payment_id = ?                                                    │
│       xendit_invoice_id = ?                                                    │
│     WHERE booking_id = ?                                                       │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    QR CODE GENERATION                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Backend: Call qrService.generateBookingQR()                                   │
│  ├─ Input:                                                                    │
│  │  ├─ booking_id                                                             │
│  │  ├─ booking_date                                                           │
│  │  ├─ start_time                                                             │
│  │  └─ service_type                                                           │
│  │                                                                             │
│  └─ Output:                                                                   │
│     ├─ qrPath: /uploads/qrcodes/booking_123_abc123.png                        │
│     ├─ qrDataUrl: data:image/png;base64,iVBORw0KGgoAAAAN...                   │
│     └─ success: true                                                          │
│                                                                                │
│  Save to Database (THE FIX!):                                                 │
│  UPDATE bookings SET                                                          │
│    qr_code_path = '/uploads/qrcodes/booking_123_abc123.png'  ← NEW COLUMN    │
│    qr_code_data = 'data:image/png;base64,...'                 ← NEW COLUMN    │
│  WHERE booking_id = ?                                                         │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMAIL CONFIRMATION SENT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Call bookingEmailService.sendBookingConfirmation()                            │
│  ├─ Email Service: Brevo (SendInBlue)                                        │
│  ├─ Recipient: booking.email                                                  │
│  └─ Attachments:                                                              │
│     ├─ Booking details                                                        │
│     ├─ QR code (as embedded image)                                            │
│     └─ Payment reference                                                      │
│                                                                                │
│  User receives email with:                                                    │
│  ✓ Service details (Piano Lesson, etc.)                                       │
│  ✓ Date and time                                                              │
│  ✓ QR code (scannable)                                                        │
│  ✓ Booking reference                                                          │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    IN-APP NOTIFICATIONS SENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  1. Notify User (if authenticated):                                            │
│     notifyUser(                                                                │
│       user_id,                                                                │
│       'payment_received',                                                     │
│       'Payment received for your booking',                                     │
│       '/booking/{booking_id}'                                                 │
│     )                                                                          │
│                                                                                │
│  2. Notify Admins:                                                             │
│     notifyAdmins(                                                              │
│       'payment_received',                                                     │
│       'Online payment received for booking #...',                              │
│       '/admin/bookings?id=...'                                                │
│     )                                                                          │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                  FRONTEND VERIFICATION & QR DISPLAY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Browser receives: ?payment=success&booking={bookingId}                        │
│                                                                                │
│  Landing.jsx Effect:                                                          │
│  1. Detect payment return parameters                                           │
│  2. Enter verification polling loop                                            │
│                                                                                │
│  FOR attempt = 1 to 3:                                                        │
│    ├─ Try: GET /api/webhooks/xendit/verify/{bookingId}                        │
│    │ (Asks backend to verify with Xendit if needed)                           │
│    ├─ If fails, try: GET /api/bookings/{bookingId}                            │
│    ├─ Check response:                                                         │
│    │ ├─ payment_status === 'paid' ?                                           │
│    │ └─ qr_code_url exists ?                                                  │
│    ├─ If both true: BREAK (got the QR!)                                       │
│    └─ Wait 800ms before next attempt                                          │
│                                                                                │
│  Render BookingModal with:                                                    │
│  ├─ ✓ Booking details                                                        │
│  ├─ ✓ QR code image (from qr_code_url)                                        │
│  ├─ ✓ Payment status: 'paid' (green checkmark)                                │
│  ├─ ✓ Booking status: 'confirmed'                                             │
│  └─ ✓ "Thank you for your booking!" message                                   │
│                                                                                │
│  Success! User can now scan QR code                                            │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Database Schema Evolution

```
BEFORE THE FIX:
┌─────────────────────────────┐
│      bookings table         │
├─────────────────────────────┤
│ booking_id      (PK)        │
│ booking_date                │
│ start_time                  │
│ status                      │
│ payment_status              │
│ qr_code         VARCHAR 500 │  ← Too small for base64
│ xendit_*                    │
│ created_at                  │
└─────────────────────────────┘
       ⚠️ MISSING COLUMNS!

AFTER THE FIX:
┌─────────────────────────────┐
│      bookings table         │
├─────────────────────────────┤
│ booking_id      (PK)        │
│ booking_date                │
│ start_time                  │
│ status                      │
│ payment_status              │
│ qr_code         VARCHAR 500 │  ← Legacy support
│ qr_code_path    VARCHAR 500 │  ← NEW! File path
│ qr_code_data    LONGTEXT    │  ← NEW! Base64 data
│ xendit_*                    │
│ created_at                  │
│ idx_qr_code_path (INDEX)    │  ← Performance
└─────────────────────────────┘
       ✅ COMPLETE!
```

## Data Flow - Database Perspective

```
BEFORE PAYMENT:
┌──────────────────────────────────────────────────┐
│ Booking Record                                    │
├──────────────────────────────────────────────────┤
│ booking_id:           "bk_123abc"                 │
│ status:               "pending"          ← pending│
│ payment_status:       "pending"          ← pending│
│ qr_code:              NULL                        │
│ qr_code_path:         NULL               ← NULL   │
│ qr_code_data:         NULL               ← NULL   │
│ xendit_invoice_id:    NULL                        │
│ xendit_payment_id:    NULL                        │
└──────────────────────────────────────────────────┘

DURING WEBHOOK PROCESSING:
Step 1: Update Status
┌──────────────────────────────────────────────────┐
│ Booking Record                                    │
├──────────────────────────────────────────────────┤
│ booking_id:           "bk_123abc"                 │
│ status:               "confirmed"        ← UPDATED│
│ payment_status:       "paid"             ← UPDATED│
│ qr_code:              NULL                        │
│ qr_code_path:         NULL                        │
│ qr_code_data:         NULL                        │
│ xendit_invoice_id:    "inv_xyz"          ← UPDATED│
│ xendit_payment_id:    "pay_def"          ← UPDATED│
└──────────────────────────────────────────────────┘

Step 2: Generate & Save QR Code
┌──────────────────────────────────────────────────┐
│ Booking Record                                    │
├──────────────────────────────────────────────────┤
│ booking_id:           "bk_123abc"                 │
│ status:               "confirmed"                 │
│ payment_status:       "paid"                      │
│ qr_code:              NULL                        │
│ qr_code_path:         "/uploads/qrc...png" ← NEW  │
│ qr_code_data:         "data:image/png;...⚒  ← NEW│
│ xendit_invoice_id:    "inv_xyz"                   │
│ xendit_payment_id:    "pay_def"                   │
└──────────────────────────────────────────────────┘
              ✅ COMPLETE AND SAVED!
```

## API Response Flow

```
Frontend Request:
┌─────────────────────────────────────────────────┐
│ GET /api/bookings/{bookingId}                   │
└─────────────────────────────────────────────────┘
              ↓
Backend (bookingController.getBookingById):
┌─────────────────────────────────────────────────┐
│ SELECT FROM bookings                            │
│   WITH: qr_code                                │
│         qr_code_path      ← NOW INCLUDED        │
│         qr_code_data      ← NOW INCLUDED        │
└─────────────────────────────────────────────────┘
              ↓
Database Response:
┌─────────────────────────────────────────────────┐
│ booking_id: "bk_123abc"                        │
│ qr_code_path: "/uploads/qrcodes/..."           │
│ qr_code_data: "data:image/png;base64,iVBOR..." │
└─────────────────────────────────────────────────┘
              ↓
API Response to Frontend:
┌─────────────────────────────────────────────────┐
│ {                                               │
│   success: true,                                │
│   data: {                                       │
│     booking_id: "bk_123abc",                   │
│     payment_status: "paid",                     │
│     status: "confirmed",                        │
│     qr_code_url: "data:image/png;base64,i..." │ ← Shows QR!
│   }                                             │
│ }                                               │
└─────────────────────────────────────────────────┘
              ↓
Frontend (Landing.jsx):
┌─────────────────────────────────────────────────┐
│ <img src={qr_code_url} />                       │
│                                                  │
│ Displays QR code image in modal                 │
│ User can scan with phone camera                 │
└─────────────────────────────────────────────────┘
```

## The Critical Fix

```
PROBLEM AREA: xenditWebhookController.js, Line ~80

BEFORE:
Update bookings SET
  payment_status = 'paid',
  status = 'confirmed',
  qr_code_path = ?,          ← ERROR: Column doesn't exist!
  qr_code_data = ?           ← ERROR: Column doesn't exist!
  
Result: Silent failure - UPDATE statement fails because columns don't exist
        Payment status never changes, QR never saves

AFTER MIGRATION:
Same code now works because columns exist!

Update bookings SET
  payment_status = 'paid',
  status = 'confirmed',
  qr_code_path = ?,          ← ✅ Column exists now
  qr_code_data = ?           ← ✅ Column exists now

Result: SUCCESS - Payment status updates, QR code saves, user gets confirmation
```

## State Transitions

```
BOOKING LIFECYCLE:

Initial State:
  status: 'pending'
  payment_status: 'pending'
  qr_code_path: NULL
  qr_code_data: NULL

After Payment Success:
  status: 'pending' → 'confirmed'
  payment_status: 'pending' → 'paid'
  qr_code_path: NULL → '/uploads/qrcodes/...'
  qr_code_data: NULL → 'data:image/png;base64,...'

After Check-In:
  status: 'confirmed' → 'completed'
  payment_status: 'paid' (unchanged)
  qr_code_path: '/uploads/qrcodes/...' (unchanged)
  qr_code_data: 'data:image/png;base64,...' (unchanged)

Valid State Transitions:
  pending → confirmed (on payment)
  confirmed → completed (on check-in)
  pending/confirmed → cancelled (on cancellation)
  confirmed → no_show (if student doesn't attend)

Invalid Transitions: (prevented by code)
  completed → pending
  cancelled → confirmed
```

---

## Summary

The fix involves:
1. **Adding 2 columns** to store QR code data
2. **Updating SELECT queries** to include new columns
3. **Keeping existing code** that already saves correctly
4. **Frontend** already polls and displays correctly

Result: **Complete payment → QR flow that works end-to-end** ✅
