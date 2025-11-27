import emailService from './emailService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Booking Email Service
 * Sends booking confirmation emails with QR codes
 */
class BookingEmailService {
  /**
   * Send booking confirmation email with QR code
   * @param {object} booking - Booking data
   * @param {string} qrDataUrl - QR code as data URL (base64)
   * @returns {Promise<boolean>}
   */
  async sendBookingConfirmation(booking, qrDataUrl) {
    try {
      const email = booking.email;
      if (!email) {
        console.warn('No email provided for booking confirmation');
        return false;
      }

      const subject = `Booking Confirmed - ${booking.booking_id} | MixLab Studio`;
      
      // Format booking date and time (use start_time or booking_time depending on schema)
      const bookingDateTime = booking.start_time || booking.booking_time;
      const bookingDate = new Date(`${booking.booking_date}T${bookingDateTime}`).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Duration can be in hours or minutes depending on data
      const duration = booking.duration_minutes 
        ? `${Math.round(booking.duration_minutes / 60)} hour(s)` 
        : `${booking.hours} hour(s)`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { padding: 20px 0; text-align: center; border-bottom: 2px solid #ffd700; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; color: #333; }
              .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
              .content { padding: 0; }
              .content p { color: #555; line-height: 1.8; margin: 15px 0; }
              .booking-details { padding: 20px 0; margin: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
              .detail-label { font-weight: bold; color: #333; }
              .detail-value { color: #555; }
              .qr-section { text-align: center; margin: 30px 0; padding: 20px 0; }
              .qr-section h3 { margin: 0 0 10px 0; color: #333; }
              .qr-code { max-width: 250px; margin: 20px auto; }
              .instructions { padding: 15px; margin: 20px 0; background-color: #fffaf0; border-left: 3px solid #ffd700; color: #555; }
              .instructions strong { color: #333; }
              .instructions ul { margin: 10px 0; padding-left: 20px; color: #555; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
              .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px; }
              .status-paid { background: #ffd700; color: #333; }
              .status-pending { color: #ffd700; border: 1px solid #ffd700; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Confirmed</h1>
                <p>MixLab Studio</p>
              </div>
              <div class="content">
                <p>Hello <strong>${booking.name}</strong>,</p>
                <p>Your studio booking has been confirmed.</p>
                
                <div class="booking-details">
                  <h3 style="margin: 0 0 15px 0; color: #333;">Booking Details</h3>
                  <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value"><strong>${booking.booking_id}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">${this.formatServiceType(booking.service_type)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date & Time:</span>
                    <span class="detail-value">${bookingDate}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">${duration}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Payment Method:</span>
                    <span class="detail-value">${this.formatPaymentMethod(booking.payment_method)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Payment Status:</span>
                    <span class="detail-value">
                      <span class="status-badge status-${booking.payment_status || 'pending'}">
                        ${(booking.payment_status || 'pending').toUpperCase()}
                      </span>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value"><strong>₱${booking.total_price || '0.00'}</strong></span>
                  </div>
                  ${booking.reference_number && booking.reference_number !== 'N/A' ? `
                  <div class="detail-row">
                    <span class="detail-label">Payment Reference:</span>
                    <span class="detail-value">${booking.reference_number}</span>
                  </div>
                  ` : ''}
                  ${booking.members ? `
                  <div class="detail-row">
                    <span class="detail-label">Number of Members:</span>
                    <span class="detail-value">${booking.members}</span>
                  </div>
                  ` : ''}
                </div>

                <div class="instructions">
                  <strong>✓ Your booking is confirmed!</strong>
                  <p style="margin: 10px 0; color: #555;">Your studio session has been successfully booked. You will receive further details and check-in instructions closer to your booking date.</p>
                  ${booking.payment_status === 'pending' ? '<p style="margin: 10px 0; color: #555;"><strong>Note:</strong> Please complete payment before your booking date.</p>' : ''}
                </div>

                <p>If you have any questions, please contact us.</p>
                
                <p>Best regards,<br>The MixLab Studio Team</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>MixLab Studio | Professional Music Production & Recording</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Send email using Brevo service
      return await emailService.sendEmail(email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending booking confirmation email:', error);
      return false;
    }
  }

  /**
   * Format service type for display
   */
  formatServiceType(serviceType) {
    const types = {
      'music_lesson': 'Music Lesson',
      'recording': 'Recording Studio',
      'rehearsal': 'Band Rehearsal',
      'dance': 'Dance Studio',
      'arrangement': 'Music Arrangement',
      'voiceover': 'Voiceover/Dubbing',
      'vocal': 'Vocal Recording',
      'band': 'Band Recording',
      'podcast': 'Podcast',
      'mixing': 'Mixing & Mastering'
    };
    return types[serviceType] || serviceType;
  }

  /**
   * Format payment method for display
   */
  formatPaymentMethod(method) {
    const methods = {
      'gcash': 'GCash',
      'GCash': 'GCash',
      'credit_card': 'Credit/Debit Card',
      'Credit/Debit Card': 'Credit/Debit Card',
      'debit_card': 'Debit Card',
      'cash': 'Cash (Pay on Arrival)',
      'Cash': 'Cash (Pay on Arrival)'
    };
    return methods[method] || method;
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellationEmail(booking) {
    try {
      const email = booking.email;
      if (!email) {
        console.warn('No email provided for booking cancellation');
        return false;
      }

      const subject = `Booking Cancelled - ${booking.booking_id} | MixLab Studio`;
      
      const bookingDate = new Date(`${booking.booking_date}T${booking.booking_time}`).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { padding: 20px 0; text-align: center; border-bottom: 2px solid #ffd700; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; color: #d32f2f; }
              .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
              .content { padding: 0; }
              .content p { color: #555; line-height: 1.8; margin: 15px 0; }
              .booking-details { padding: 20px 0; margin: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
              .detail-label { font-weight: bold; color: #333; }
              .detail-value { color: #555; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
              .alert { padding: 15px; margin: 20px 0; background-color: #ffe6e6; border-left: 3px solid #d32f2f; color: #555; }
              .alert strong { color: #d32f2f; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Cancelled</h1>
                <p>MixLab Studio</p>
              </div>
              <div class="content">
                <p>Hello <strong>${booking.name}</strong>,</p>
                <p>Your studio booking has been cancelled.</p>
                
                <div class="booking-details">
                  <h3 style="margin: 0 0 15px 0; color: #333;">Cancelled Booking Details</h3>
                  <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value"><strong>${booking.booking_id}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">${this.formatServiceType(booking.service_type)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Original Date & Time:</span>
                    <span class="detail-value">${bookingDate}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">${booking.hours} hour(s)</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Refunded Amount:</span>
                    <span class="detail-value"><strong>₱${booking.total_price || '0.00'}</strong></span>
                  </div>
                </div>

                <div class="alert">
                  <strong>Refund Status:</strong> If payment was made, your refund will be processed within 3-5 business days to your original payment method.
                </div>

                <p>If you would like to rebook or have any questions, please feel free to contact us.</p>
                
                <p>Best regards,<br>The MixLab Studio Team</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>MixLab Studio | Professional Music Production & Recording</p>
              </div>
            </div>
          </body>
        </html>
      `;

      return await emailService.sendEmail(email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending booking cancellation email:', error);
      return false;
    }
  }

  /**
   * Send booking reschedule email
   */
  async sendBookingRescheduleEmail(booking) {
    try {
      const email = booking.email;
      if (!email) {
        console.warn('No email provided for booking reschedule');
        return false;
      }

      const subject = `Booking Rescheduled - ${booking.booking_id} | MixLab Studio`;
      
      const newBookingDate = new Date(`${booking.booking_date}T${booking.booking_time}`).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { padding: 20px 0; text-align: center; border-bottom: 2px solid #ffd700; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; color: #333; }
              .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
              .content { padding: 0; }
              .content p { color: #555; line-height: 1.8; margin: 15px 0; }
              .booking-details { padding: 20px 0; margin: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
              .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
              .detail-label { font-weight: bold; color: #333; }
              .detail-value { color: #555; }
              .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
              .alert { padding: 15px; margin: 20px 0; background-color: #e8f5e9; border-left: 3px solid #2e7d32; color: #555; }
              .instructions { padding: 15px; margin: 20px 0; background-color: #fffaf0; border-left: 3px solid #ffd700; color: #555; }
              .instructions ul { margin: 10px 0; padding-left: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Booking Rescheduled</h1>
                <p>MixLab Studio</p>
              </div>
              <div class="content">
                <p>Hello <strong>${booking.name}</strong>,</p>
                <p>Your studio booking has been successfully rescheduled.</p>

                <div class="booking-details">
                  <h3 style="margin: 0 0 15px 0; color: #333;">Updated Booking Details</h3>
                  <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value"><strong>${booking.booking_id}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span class="detail-value">${this.formatServiceType(booking.service_type)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">New Date & Time:</span>
                    <span class="detail-value"><strong>${newBookingDate}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">${booking.hours} hour(s)</span>
                  </div>
                </div>

                <div class="alert">
                  <strong>✓ Your rescheduled booking is confirmed.</strong> An updated QR code will be available in your booking confirmation.
                </div>

                <div class="instructions">
                  <strong>Important Reminders:</strong>
                  <ul>
                    <li>Your new booking date is: <strong>${newBookingDate}</strong></li>
                    <li>Arrive 10 minutes early</li>
                    <li>Bring a valid ID for check-in</li>
                    <li>Keep this email for your records</li>
                  </ul>
                </div>

                <p>If you have any questions or need to make further changes, please contact us.</p>
                
                <p>Best regards,<br>The MixLab Studio Team</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>MixLab Studio | Professional Music Production & Recording</p>
              </div>
            </div>
          </body>
        </html>
      `;

      return await emailService.sendEmail(email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending booking reschedule email:', error);
      return false;
    }
  }
}

export default new BookingEmailService();

