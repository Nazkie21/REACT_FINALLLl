# QR Code & Payment System - Testing Guide

## Overview

This guide walks you through testing the complete payment → QR code generation flow.

## Prerequisites

- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:5176`
- Xendit account with test keys configured
- Database with migration applied

## Test Scenarios

### Scenario 1: End-to-End Payment Success Flow

**Objective:** Verify QR code generates and appears after successful payment

#### Steps:

1. **Start Backend**
   ```bash
   cd Backend
   npm start
   # Should see: Database connected successfully
   ```

2. **Start Frontend**
   ```bash
   cd my-app
   npm run dev
   # Opens to http://localhost:5176
   ```

3. **Create a Booking**
   - Navigate to booking page
   - Select service, date, time
   - Fill in user details
   - Submit booking (status: 'pending', payment_status: 'pending')

4. **Initiate Payment**
   - Click "Pay Now" button
   - Select payment method (Xendit/GCash)
   - You'll be redirected to Xendit payment page

5. **Complete Payment (Xendit Test)**
   - In Xendit test environment, simulate payment success
   - Payment webhook will trigger on backend
   - You'll be redirected to: `http://localhost:5176?payment=success&booking={bookingId}`

6. **Verify Results**
   ```
   Frontend:
   ✅ BookingModal appears
   ✅ QR code displays
   ✅ Booking status shows 'confirmed'
   ✅ Payment status shows 'paid'
   
   Backend (Check logs):
   ✅ Webhook received
   ✅ Payment status updated
   ✅ Status changed to 'confirmed'
   ✅ QR code generated
   ✅ QR code saved to database
   ✅ Confirmation email sent
   ```

#### Database Verification:
```bash
# Connect to MySQL
mysql -u root mixlab_studio

# Check booking record
SELECT booking_id, status, payment_status, qr_code_path, 
       LENGTH(qr_code_data) as qr_data_size 
FROM bookings 
WHERE booking_id = 'your_booking_id';

# Expected output:
# ✅ status = 'confirmed'
# ✅ payment_status = 'paid'
# ✅ qr_code_path = '/uploads/qrcodes/...'
# ✅ qr_data_size > 1000 (base64 PNG data)
```

### Scenario 2: Manual QR Generation Fallback

**Objective:** Verify fallback QR generation works for manually paid bookings

#### Steps:

1. **Mark Booking as Paid (Manual)**
   ```bash
   mysql -u root mixlab_studio

   UPDATE bookings 
   SET payment_status = 'paid', status = 'confirmed'
   WHERE booking_id = 'test_booking_id';
   ```

2. **Fetch Booking Details**
   ```bash
   curl -X GET http://localhost:5000/api/bookings/test_booking_id
   ```

3. **Verify Response**
   ```json
   {
     "success": true,
     "data": {
       "booking_id": "test_booking_id",
       "status": "confirmed",
       "payment_status": "paid",
       "qr_code_url": "data:image/png;base64,...",
       ...
     }
   }
   ```

4. **Check Backend Logs**
   ```
   ✅ "Generating missing QR for booking..."
   ✅ "QR generated and saved for booking..."
   ```

### Scenario 3: Payment Verification Endpoint

**Objective:** Test manual verification of payment status

#### Steps:

1. **Create booking and mark as pending with Xendit invoice**
   ```sql
   UPDATE bookings 
   SET payment_status = 'pending', 
       xendit_invoice_id = 'real_invoice_id'
   WHERE booking_id = 'test_id';
   ```

2. **Call Verify Endpoint**
   ```bash
   curl -X GET http://localhost:5000/api/webhooks/xendit/verify/test_id
   ```

3. **Observe Verification Process**
   - If payment is confirmed on Xendit: `payment_status` updates to 'paid'
   - If payment is still pending: Returns current booking status
   - QR code generated if not present

4. **Check Response**
   ```json
   {
     "success": true,
     "data": {
       "booking_id": "test_id",
       "payment_status": "paid",
       "status": "confirmed",
       "qr_code_path": "...",
       "qr_code_data": "data:image/png;base64,..."
     }
   }
   ```

### Scenario 4: Email Confirmation

**Objective:** Verify confirmation email with QR code is sent

#### Steps:

1. **Complete payment for a booking**
   - Ensure user email is valid
   - Payment webhook triggers

2. **Check Email**
   - Look in email inbox (or Brevo dashboard)
   - Should receive confirmation email from: `BREVO_SENDER_EMAIL`

3. **Email Content Verification**
   ```
   ✅ Subject: Booking Confirmation
   ✅ Contains booking details
   ✅ Contains QR code image
   ✅ Contains booking reference
   ✅ Contains date/time information
   ```

4. **Backend Logs**
   ```
   ✅ "Preparing to send confirmation email to user@email.com"
   ✅ "Confirmation email sent successfully"
   ```

## Expected Log Output - Complete Flow

When everything works correctly, backend logs should show:

```
🚀 Starting Xendit webhook handler...
   ✅ Webhook token verified
   ✅ Processing payment success for booking: BOOKING_123

Found booking BOOKING_123 for John Doe

🔄 Generating QR code for booking BOOKING_123...
   ✅ QR code generated successfully

📧 Preparing to send confirmation email to john@example.com...
   ✅ Confirmation email sent successfully

Payment successful for booking BOOKING_123
   ✅ Database updated
   ✅ QR code saved
   ✅ Notifications sent
```

## Troubleshooting

### QR Code Not Showing

**Problem:** Payment succeeds but QR code missing from booking details

**Check:**
```bash
# 1. Verify columns exist
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'bookings' AND COLUMN_NAME LIKE 'qr%';

# 2. Check booking record
SELECT booking_id, qr_code, qr_code_path, qr_code_data 
FROM bookings WHERE booking_id = 'your_booking_id';

# 3. Check if NULL
SELECT qr_code_data IS NULL, qr_code_path IS NULL 
FROM bookings WHERE booking_id = 'your_booking_id';
```

**Solutions:**
- Run migration: `node Backend/migrations/run-qr-migration.js`
- Check `/uploads/qrcodes/` directory exists
- Check qrService has proper write permissions

### Payment Status Not Updating

**Problem:** Payment completes but status stays 'pending'

**Check:**
```bash
# Check if xendit_invoice_id is saved
SELECT payment_status, xendit_invoice_id FROM bookings 
WHERE booking_id = 'your_booking_id';

# Check if webhook received
# Look for "Xendit webhook received" in backend logs
```

**Solutions:**
- Verify XENDIT_WEBHOOK_TOKEN is correct
- Check backend logs for webhook errors
- Verify Xendit callback URL is correct in settings

### Email Not Sent

**Problem:** Booking confirmed but no confirmation email

**Check:**
```bash
# Verify email service is configured
echo $BREVO_API_KEY
echo $BREVO_SENDER_EMAIL

# Check booking email address
SELECT email FROM bookings WHERE booking_id = 'your_booking_id';
```

**Solutions:**
- Verify Brevo API key is valid
- Check email address is correct
- Check spam folder
- Verify Brevo account has quota remaining

## Performance Testing

### Test QR Code Generation Speed

```javascript
// Add this to xenditWebhookController.js temporarily
const startTime = Date.now();
const qrResult = await qrService.generateBookingQR(...);
const duration = Date.now() - startTime;
console.log(`QR generation took ${duration}ms`);

// Expected: < 500ms for typical booking
```

### Test Database Save Performance

```javascript
const startTime = Date.now();
await query('UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?', [...]);
const duration = Date.now() - startTime;
console.log(`Database save took ${duration}ms`);

// Expected: < 100ms
```

## Load Testing

To verify system works under load:

```bash
# Test concurrent webhook processing
ab -n 100 -c 10 -X POST http://localhost:5000/api/webhooks/xendit \
  -H "x-callback-token: my_super_secret_webhook_token_12356789" \
  -d @webhook-payload.json

# Expected: All requests succeed, QR codes generated for all
```

## Rollback Procedure

If you need to revert the QR code columns:

```bash
# Drop the new columns
ALTER TABLE bookings DROP COLUMN qr_code_path;
ALTER TABLE bookings DROP COLUMN qr_code_data;
```

But you shouldn't need to - the implementation is backward compatible!

## Success Criteria

After implementing this fix, you should be able to:

- ✅ Create a booking
- ✅ Complete payment via Xendit
- ✅ See booking status change from 'pending' to 'confirmed'
- ✅ See payment status change from 'pending' to 'paid'
- ✅ See QR code displayed in booking confirmation
- ✅ Receive confirmation email with QR code
- ✅ Scan QR code to verify booking details

If all these pass, the implementation is complete and working correctly!

---

**Testing Complete:** Mark this as done after all scenarios pass ✅
