import { query, getConnection } from '../config/db.js';
import { verifyWebhookToken, getInvoiceStatus } from '../utils/xendit.js';
import qrService from '../services/qrService.js';
import bookingEmailService from '../services/bookingEmailService.js';
import { notifyUser, notifyAdmins } from '../services/notificationService.js';

/**
 * Xendit Webhook Controller
 * Handles payment callbacks from Xendit
 */

/**
 * Handle Xendit webhook
 * POST /api/webhooks/xendit
 */
export const handleXenditWebhook = async (req, res) => {
  try {
    // Verify webhook token
    const webhookToken = req.headers['x-callback-token'];
    if (!verifyWebhookToken(webhookToken)) {
      console.warn('Invalid webhook token received');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook token'
      });
    }

    const event = req.body;
    console.log('Xendit webhook received:', event.status, event.external_id);

    // Handle different event types
    switch (event.status) {
      case 'PAID':
        await handlePaymentSuccess(event);
        break;
      case 'EXPIRED':
        await handlePaymentExpired(event);
        break;
      case 'FAILED':
        await handlePaymentFailed(event);
        break;
      default:
        console.log('Unhandled webhook event:', event.status);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Xendit webhook:', error);
    // Still return 200 to prevent Xendit from retrying
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(event) {
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();

    const externalId = event.external_id;
    const invoiceId = event.id;
    const paymentId = event.payment_id;

    console.log(`Processing payment success for booking: ${externalId}`);

    // Find booking by external_id (booking_id)
    const bookingResults = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [externalId],
      connection
    );

    // Handle array response properly
    const booking = Array.isArray(bookingResults) ? bookingResults[0] : bookingResults;

    if (!booking) {
      console.error('Booking not found for payment:', externalId);
      await connection.rollback();
      return;
    }

    console.log(`Found booking ${booking.id} for ${booking.name}`);

    // Update booking payment status and store payment reference
    // Also update booking status to 'confirmed' when payment is successful
    await query(
      `UPDATE bookings 
       SET payment_status = 'paid', 
           status = 'confirmed',
           xendit_payment_id = ?,
           xendit_invoice_id = ?,
           updated_at = NOW()
       WHERE booking_id = ?`,
      [paymentId || null, invoiceId || null, externalId],
      connection
    );

    // Generate QR code - always generate after payment confirmation
    let qrDataUrl = booking.qr_code_data;
    let qrPath = booking.qr_code_path;
    
    if (!qrDataUrl && qrService && qrService.generateBookingQR) {
      console.log(`🔄 Generating QR code for booking ${externalId}...`);
      try {
        const hours = booking.duration_minutes ? Math.ceil(booking.duration_minutes / 60) : 1;
        
        // Parse notes to get service type
        let serviceType = 'Studio Session';
        try {
          const bookingNotes = booking.user_notes ? JSON.parse(booking.user_notes) : {};
          serviceType = bookingNotes.original_service || 'Studio Session';
        } catch (e) {
          // Use default if parsing fails
        }
        
        const qrResult = await qrService.generateBookingQR({
          name: booking.customer_name || 'Guest',
          service_type: serviceType,
          booking_date: booking.booking_date,
          booking_time: booking.start_time,
          hours: hours
        }, booking.booking_id);
        
        if (qrResult.success) {
          qrDataUrl = qrResult.qrDataUrl;
          qrPath = qrResult.qrPath;
          await query(
            'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
            [qrPath, qrDataUrl, externalId],
            connection
          );
          console.log(`✅ QR code generated successfully for booking ${externalId}`);
        } else {
          console.error(`❌ QR code generation failed: ${qrResult.error}`);
        }
      } catch (qrError) {
        console.error('❌ QR code generation error:', qrError.message);
        console.error('Stack trace:', qrError.stack);
      }
    } else if (qrDataUrl) {
      console.log(`✅ QR code already exists for booking ${externalId}`);
    }

    await connection.commit();

    // Send confirmation email with all booking details
    if (booking.email && bookingEmailService && bookingEmailService.sendBookingConfirmation) {
      console.log(`📧 Preparing to send confirmation email to ${booking.email}...`);
      
      const updatedBooking = { 
        ...booking, 
        payment_status: 'paid',
        reference_number: paymentId || invoiceId || 'N/A'
      };
      
      try {
        const emailSent = await bookingEmailService.sendBookingConfirmation(updatedBooking, qrDataUrl);
        if (emailSent) {
          console.log(`✅ Confirmation email sent successfully to ${booking.email}`);
        } else {
          console.warn(`⚠️  Email sending returned false for ${booking.email}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send confirmation email:', emailError.message);
        console.error('Stack trace:', emailError.stack);
      }
    } else {
      console.warn(`⚠️  Cannot send email: ${!booking.email ? 'No email' : 'Email service unavailable'}`);
    }

    console.log(`✅ Payment successful for booking ${externalId}`);

    // Create notifications after successful payment
    try {
      // Notify user (if linked to a user account)
      if (booking.user_id) {
        const userMessage = `Payment received for your ${booking.service_type || 'studio'} booking on ${booking.booking_date}`;
        await notifyUser(
          booking.user_id,
          'payment_received',
          userMessage,
          `/booking/${booking.booking_id}`
        );
      }

      // Notify admins about the successful online payment
      const adminMessage = `Online payment received for booking #${externalId} (${booking.service_type || 'studio'} on ${booking.booking_date}).`;
      await notifyAdmins('payment_received', adminMessage, `/admin/bookings?id=${externalId}`);
    } catch (notifError) {
      console.warn('Warning: Failed to send payment notifications:', notifError.message);
    }
  } catch (error) {
    await connection.rollback();
    console.error('Error handling payment success:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Handle expired payment
 */
async function handlePaymentExpired(event) {
  try {
    const externalId = event.external_id;
    console.log(`Processing payment expiry for booking: ${externalId}`);

    await query(
      `UPDATE bookings 
       SET payment_status = 'expired',
           updated_at = NOW()
       WHERE booking_id = ? AND payment_status = 'pending'`,
      [externalId]
    );

    console.log(`⏰ Payment expired for booking ${externalId}`);
  } catch (error) {
    console.error('Error handling payment expired:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(event) {
  try {
    const externalId = event.external_id;
    console.log(`Processing payment failure for booking: ${externalId}`);

    await query(
      `UPDATE bookings 
       SET payment_status = 'failed',
           updated_at = NOW()
       WHERE booking_id = ? AND payment_status = 'pending'`,
      [externalId]
    );

    console.log(`❌ Payment failed for booking ${externalId}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

/**
 * Verify payment status manually
 * GET /api/webhooks/xendit/verify/:bookingId
 */
export const verifyPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    console.log(`🔍 Verifying payment for booking: ${bookingId}`);

    // Get booking from database
    const bookingResults = await query(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );

    // Handle array response
    const booking = Array.isArray(bookingResults) ? bookingResults[0] : bookingResults;

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // If has Xendit invoice ID and payment is still pending, check with Xendit
    if (booking.xendit_invoice_id && booking.payment_status === 'pending') {
      console.log(`Checking Xendit status for invoice: ${booking.xendit_invoice_id}`);
      
      const invoiceStatus = await getInvoiceStatus(booking.xendit_invoice_id);
      
      if (invoiceStatus.success && invoiceStatus.data.status === 'PAID') {
        // Update booking status to paid and confirmed
        await query(
          'UPDATE bookings SET payment_status = "paid", status = "confirmed", updated_at = NOW() WHERE booking_id = ?',
          [bookingId]
        );
        
        // Fetch updated booking
        const updatedResults = await query(
          'SELECT * FROM bookings WHERE booking_id = ?',
          [bookingId]
        );
        
        const updatedBooking = Array.isArray(updatedResults) ? updatedResults[0] : updatedResults;
        
        // Generate QR code if not already present
        if (!updatedBooking.qr_code_data && qrService && typeof qrService.generateBookingQR === 'function') {
          try {
            console.log(`🔄 Generating QR code for verified booking ${bookingId}...`);
            const hours = updatedBooking.duration_minutes ? Math.ceil(updatedBooking.duration_minutes / 60) : 1;
            // Parse notes to get service type
            let serviceType = 'Studio Session';
            try {
              const bookingNotes = updatedBooking.user_notes ? JSON.parse(updatedBooking.user_notes) : {};
              serviceType = bookingNotes.original_service || 'Studio Session';
            } catch (e) {
              // Use default if parsing fails
            }
            
            const qrResult = await qrService.generateBookingQR({
              name: updatedBooking.customer_name || 'Guest',
              service_type: serviceType,
              booking_date: updatedBooking.booking_date,
              booking_time: updatedBooking.start_time,
              hours: hours
            }, bookingId);
            
            if (qrResult && qrResult.success) {
              await query(
                'UPDATE bookings SET qr_code_path = ?, qr_code_data = ? WHERE booking_id = ?',
                [qrResult.qrPath, qrResult.qrDataUrl, bookingId]
              );
              updatedBooking.qr_code_path = qrResult.qrPath;
              updatedBooking.qr_code_data = qrResult.qrDataUrl;
              console.log(`✅ QR code generated for verified booking ${bookingId}`);
            } else {
              console.warn(`❌ QR generation failed for booking ${bookingId}:`, qrResult?.error);
            }
          } catch (qrErr) {
            console.error('❌ QR generation error:', qrErr.message);
          }
        }
        
        return res.json({
          success: true,
          data: updatedBooking
        });
      }
    }

    // Return current booking status
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error verifying payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};