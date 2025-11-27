import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * QR Code Service
 * Generates QR codes for booking check-in
 */
class QRCodeService {
  constructor() {
    // QR code storage directory
    this.qrDir = path.join(__dirname, '../../uploads/qrcodes');
    this.ensureDirectoryExists();
  }

  /**
   * Ensure QR code directory exists
   */
  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.qrDir, { recursive: true });
    } catch (error) {
      console.error('Error creating QR directory:', error);
    }
  }

  /**
   * Generate QR code for booking
   * @param {object} bookingData - Booking data to encode in QR
   * @param {string} bookingId - Unique booking ID
   * @returns {Promise<{success: boolean, qrPath?: string, qrDataUrl?: string, error?: string}>}
   */
  async generateBookingQR(bookingData, bookingId) {
    try {
      // Calculate expiration date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      // Create QR code data object
      const qrData = {
        bookingId: bookingId,
        name: bookingData.name,
        serviceType: bookingData.service_type || bookingData.service_name || 'Studio Session',
        date: bookingData.booking_date,
        time: bookingData.booking_time,
        hours: bookingData.hours,
        expiresAt: expiresAt.toISOString().split('T')[0],
        checkInCode: this.generateCheckInCode(bookingId)
      };

      // Convert to JSON string
      const qrString = JSON.stringify(qrData);

      // Generate QR code as data URL (base64)
      const qrDataUrl = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      });

      // Save QR code as file
      const fileName = `booking_${bookingId}_${Date.now()}.png`;
      const filePath = path.join(this.qrDir, fileName);
      const relativePath = `/uploads/qrcodes/${fileName}`;

      // Convert data URL to buffer and save
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filePath, buffer);

      return {
        success: true,
        qrPath: relativePath,
        qrDataUrl: qrDataUrl,
        qrString: qrString
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a check-in code for additional security
   * @param {string} bookingId - Booking ID
   * @returns {string} Check-in code
   */
  generateCheckInCode(bookingId) {
    // Generate a short code based on booking ID and timestamp
    const hash = bookingId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
  }

  /**
   * Verify QR code data
   * @param {string} qrString - QR code string (JSON)
   * @returns {object|null} Parsed QR data or null if invalid
   */
  verifyQRCode(qrString) {
    try {
      const data = JSON.parse(qrString);
      
      // Validate required fields
      if (!data.bookingId || !data.date || !data.time || !data.checkInCode) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error verifying QR code:', error);
      return null;
    }
  }

  /**
   * Delete QR code file
   * @param {string} qrPath - Relative path to QR code
   */
  async deleteQRCode(qrPath) {
    try {
      if (qrPath && qrPath.startsWith('/uploads/qrcodes/')) {
        const filePath = path.join(__dirname, '../..', qrPath);
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting QR code:', error);
      // Don't throw, just log
    }
  }
}

export default new QRCodeService();

