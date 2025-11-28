import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NotificationDropdown from '../components/NotificationDropdown';

const StatusBadge = ({ paymentStatus }) => {
  const normalized = (paymentStatus || '').toLowerCase();
  let label = 'Payment Pending';
  let classes = 'bg-yellow-500/20 text-yellow-300';

  if (normalized === 'paid') {
    label = 'Confirmed';
    classes = 'bg-green-500/20 text-green-300';
  } else if (normalized === 'failed' || normalized === 'cancelled') {
    label = 'Cancelled';
    classes = 'bg-red-500/20 text-red-300';
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
};

const BookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        
        // First, try to verify payment status with Xendit (in case webhook hasn't arrived yet)
        try {
          console.log(`Verifying payment status for booking ${id}...`);
          const verifyRes = await fetch(`${API_URL}/webhooks/xendit/verify/${id}`);
          if (verifyRes.ok) {
            const verifyResult = await verifyRes.json();
            console.log('Payment verification result:', verifyResult);
          }
        } catch (verifyErr) {
          console.warn('Payment verification failed (non-critical):', verifyErr);
        }
        
        // Then fetch the booking details
        const res = await fetch(`${API_URL}/bookings/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch booking details');
        }
        const result = await res.json();
        setBooking(result.data);
      } catch (err) {
        console.error('Error loading booking details:', err);
        setError(err.message || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchBooking();
  }, [id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTimeRange = (start, hours) => {
    if (!start) return 'N/A';
    const [hh, mm] = start.split(':');
    if (!hh) return start;
    const startDate = new Date();
    startDate.setHours(parseInt(hh, 10), parseInt(mm || '0', 10), 0, 0);
    const endDate = new Date(startDate.getTime() + (hours || 1) * 60 * 60 * 1000);
    const opts = { hour: 'numeric', minute: '2-digit' };
    return `${startDate.toLocaleTimeString('en-PH', opts)} - ${endDate.toLocaleTimeString('en-PH', opts)}`;
  };

  const handleDownloadQr = async () => {
    if (!booking?.qr_code_url) return;
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = booking.qr_code_url;
      link.download = `booking-${booking.booking_id}-qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download QR code:', err);
      alert('Failed to download QR code. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b1b1b] flex items-center justify-center text-white">
        <p>Loading booking details...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#1b1b1b] flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-2xl font-bold mb-2">Booking not found</h1>
        <p className="text-[#bbb] mb-6">This booking does not exist or may have been cancelled.</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#ffd700] text-black font-semibold rounded-lg hover:bg-[#ffe44c] transition"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const hours = booking.hours || 1;

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-white py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#ffd700] hover:text-[#ffe44c] font-semibold"
          >
            <span className="text-xl">←</span>
            <span>Back to Home</span>
          </button>
          <div className="flex items-center gap-3">
            <NotificationDropdown isAdmin={false} />
            <StatusBadge paymentStatus={booking.payment_status} />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">Booking Details</h1>

        {/* Booking Information Card */}
        <div className="bg-[#232323] rounded-2xl p-6 border border-[#444] mb-6">
          <h2 className="text-xl font-semibold mb-4">Booking Information</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div>
                <div className="text-[#888] text-xs uppercase">Booking Reference</div>
                <div className="font-mono text-[#ffd700]">{booking.booking_reference || booking.booking_id}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Service Type</div>
                <div>{booking.service_type || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Duration</div>
                <div>{hours} hour(s)</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Date</div>
                <div>{formatDate(booking.booking_date)}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Time</div>
                <div>{formatTimeRange(booking.booking_time, hours)}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[#888] text-xs uppercase">Customer Name</div>
                <div>{booking.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Email</div>
                <div>{booking.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Phone</div>
                <div>{booking.contact || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#888] text-xs uppercase">Total Paid</div>
                <div className="text-xl font-bold text-[#ffd700]">₱{booking.total_price?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructor Information Card (for music lessons) */}
        {booking.instructor && (
          <div className="bg-[#232323] rounded-2xl p-6 border border-[#444] mb-6">
            <h2 className="text-xl font-semibold mb-4">Instructor Information</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <div className="text-[#888] text-xs uppercase">Instructor Name</div>
                  <div className="text-lg font-semibold">{booking.instructor.instructor_name || 'N/A'}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[#888] text-xs uppercase">Specialization</div>
                  <div className="text-lg font-semibold text-[#ffd700]">{booking.instructor.specialization || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Card */}
        <div className="bg-[#232323] rounded-2xl p-6 border border-[#444] mb-6 flex flex-col items-center">
          <h2 className="text-xl font-semibold mb-4">Appointment QR Code</h2>
          {booking.payment_status?.toLowerCase() === 'paid' && booking.qr_code_url ? (
            <>
              <div className="bg-white p-4 rounded-lg mb-4">
                <img
                  src={booking.qr_code_url}
                  alt="Booking verification QR code"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <p className="text-sm text-[#ddd] text-center mb-3">
                Show this QR code at your appointment for verification.
              </p>
              <button
                onClick={handleDownloadQr}
                disabled={downloading}
                className="mt-2 px-4 py-2 border border-[#ffd700] text-[#ffd700] rounded-lg hover:bg-[#ffd700]/10 disabled:opacity-60"
              >
                {downloading ? 'Downloading...' : '📥 Download QR Code'}
              </button>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-[#bbb] mb-2">
                Appointment QR Code
              </p>
              <p className="text-sm text-[#999]">
                QR code is not available yet. Please check again later or contact support.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetails;
