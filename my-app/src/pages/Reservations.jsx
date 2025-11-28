import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../lib/jwtUtils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import NotificationDropdown from '../components/NotificationDropdown'

export default function Reservations() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [expandedBookingId, setExpandedBookingId] = useState(null)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({
    date: '',
    timeSlot: ''
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth/login')
    }
  }, [navigate])

  // Fetch user bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const token = localStorage.getItem('token')

        const response = await fetch(`${API_URL}/bookings/user`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch bookings')
        }

        const data = await response.json()
        setBookings(data.data?.bookings || data.data || [])
      } catch (err) {
        console.error('Error fetching bookings:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [])

  const fetchAvailableSlots = async (date, duration, service) => {
    try {
      setSlotsLoading(true)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

      const response = await fetch(
        `${API_URL}/bookings/available-slots?service=${service}&date=${date}&duration=${duration}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch available slots')
      }

      const data = await response.json()
      setAvailableSlots(data.data || [])
    } catch (err) {
      console.error('Error fetching slots:', err)
      setAvailableSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  const fetchBookingDetails = async (bookingId) => {
    try {
      setDetailsLoading(true)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

      const response = await fetch(`${API_URL}/bookings/${bookingId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch booking details')
      }

      const data = await response.json()
      setBookingDetails(data.data)
    } catch (err) {
      console.error('Error fetching booking details:', err)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleExpandBooking = (booking) => {
    if (expandedBookingId === booking.booking_id) {
      setExpandedBookingId(null)
      setBookingDetails(null)
    } else {
      setExpandedBookingId(booking.booking_id)
      fetchBookingDetails(booking.booking_id)
    }
  }

  const handleRescheduleClick = (booking) => {
    setSelectedBooking(booking)
    setRescheduleData({ date: '', timeSlot: '' })
    setShowRescheduleModal(true)
  }

  const handleCancelClick = (booking) => {
    setSelectedBooking(booking)
    setShowCancelModal(true)
  }

  const handleRescheduleSubmit = async () => {
    if (!rescheduleData.date || !rescheduleData.timeSlot) {
      alert('Please select both date and time')
      return
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_URL}/bookings/${selectedBooking.booking_id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          new_date: rescheduleData.date,
          new_time: rescheduleData.timeSlot
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reschedule booking')
      }

      alert('Booking rescheduled successfully!')
      setShowRescheduleModal(false)
      
      // Refresh bookings
      const bookingsResponse = await fetch(`${API_URL}/bookings/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const bookingsData = await bookingsResponse.json()
      setBookings(bookingsData.data?.bookings || bookingsData.data || [])
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleCancelSubmit = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const token = localStorage.getItem('token')

      const response = await fetch(`${API_URL}/bookings/${selectedBooking.booking_id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to cancel booking')
      }

      alert('Booking cancelled successfully!')
      setShowCancelModal(false)
      
      // Refresh bookings
      const bookingsResponse = await fetch(`${API_URL}/bookings/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const bookingsData = await bookingsResponse.json()
      setBookings(bookingsData.data?.bookings || bookingsData.data || [])
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/20 text-green-400'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getPaymentBadgeColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-400'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-white">
      {/* Header */}
      <header className="w-full sticky top-0 z-50 bg-[#1b1b1b] shadow-md border-b border-[#444]">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-[#ffd700]">Reservations</h1>
          <div className="flex items-center gap-3">
            <NotificationDropdown isAdmin={false} />
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-[#ffd700] hover:bg-[#ffe44c] text-black rounded-lg transition font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#888]">Loading your reservations...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">Error: {error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888] mb-4">You have no reservations yet</p>
            <button
              onClick={() => navigate('/Bookings')}
              className="px-6 py-2 bg-[#ffd700] hover:bg-[#ffe44c] text-black rounded-lg transition font-semibold"
            >
              Make a Booking
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings.map(booking => (
              <div key={booking.booking_id} className="bg-[#232323] rounded-2xl border border-[#444] hover:border-[#ffd700] transition overflow-hidden">
                {/* Summary Header - Always Visible */}
                <button
                  onClick={() => handleExpandBooking(booking)}
                  className="w-full p-6 text-left hover:bg-[#2a2a2a] transition"
                >
                  <div className="grid md:grid-cols-5 gap-4 items-center">
                    <div>
                      <div className="text-[#888] text-xs uppercase">Booking Reference</div>
                      <div className="text-lg font-semibold">{booking.booking_reference || booking.booking_id}</div>
                    </div>
                    <div>
                      <div className="text-[#888] text-xs uppercase">Service</div>
                      <div className="text-lg font-semibold">{booking.service_type || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[#888] text-xs uppercase">Date</div>
                      <div className="text-lg font-semibold">{formatDate(booking.booking_date)}</div>
                    </div>
                    <div>
                      <div className="text-[#888] text-xs uppercase">Status</div>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(booking.status)}`}>
                        {booking.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                    <div className="text-right">
                      {expandedBookingId === booking.booking_id ? (
                        <ChevronDown className="w-6 h-6 text-[#ffd700]" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-[#ffd700]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedBookingId === booking.booking_id && (
                  <div className="border-t border-[#444] p-6 bg-[#1b1b1b]">
                    {detailsLoading ? (
                      <p className="text-[#888]">Loading booking details...</p>
                    ) : bookingDetails ? (
                      <div className="space-y-6">
                        {/* Booking Information */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <div className="text-[#888] text-xs uppercase">Booking Reference</div>
                              <div className="text-lg font-semibold text-[#ffd700]">{bookingDetails.booking_reference || bookingDetails.booking_id}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Service</div>
                              <div className="text-lg font-semibold">{bookingDetails.service_type || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Date</div>
                              <div className="text-lg font-semibold">{formatDate(bookingDetails.booking_date)}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Time</div>
                              <div className="text-lg font-semibold">{bookingDetails.booking_time || 'N/A'}</div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="text-[#888] text-xs uppercase">Duration</div>
                              <div className="text-lg font-semibold">{bookingDetails.hours || 1} hour(s)</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Booking Status</div>
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(booking.status)}`}>
                                {booking.status?.toUpperCase() || 'PENDING'}
                              </span>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Payment Status</div>
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPaymentBadgeColor(bookingDetails.payment_status)}`}>
                                {bookingDetails.payment_status?.toUpperCase() || 'PENDING'}
                              </span>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Total Price</div>
                              <div className="text-lg font-semibold text-[#ffd700]">₱{bookingDetails.total_price || '0.00'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Instructor Info */}
                        {bookingDetails.instructor && (
                          <div className="bg-[#232323] rounded-lg p-4 border border-[#444]">
                            <h3 className="text-xl font-semibold mb-4">Instructor Information</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-[#888] text-xs uppercase">Instructor Name</div>
                                <div className="text-lg font-semibold">{bookingDetails.instructor.instructor_name || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-[#888] text-xs uppercase">Specialization</div>
                                <div className="text-lg font-semibold text-[#ffd700]">{bookingDetails.instructor.specialization || 'General'}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* QR Code */}
                        {bookingDetails.qr_code_url && (
                          <div className="bg-[#232323] rounded-lg p-6 border border-[#444] text-center">
                            <h3 className="text-xl font-semibold mb-4">Check-In QR Code</h3>
                            <img src={bookingDetails.qr_code_url} alt="Booking QR Code" className="w-48 h-48 mx-auto" />
                            <p className="text-[#888] text-sm mt-4">Booking Reference: <span className="text-[#ffd700] font-semibold">{bookingDetails.booking_reference || bookingDetails.booking_id}</span></p>
                          </div>
                        )}

                        {/* Customer Information */}
                        <div className="bg-[#232323] rounded-lg p-4 border border-[#444]">
                          <h3 className="text-xl font-semibold mb-4">Customer Information</h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-[#888] text-xs uppercase">Name</div>
                              <div className="text-lg font-semibold">{bookingDetails.name || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Email</div>
                              <div className="text-lg font-semibold">{bookingDetails.email || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Contact</div>
                              <div className="text-lg font-semibold">{bookingDetails.contact || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-[#888] text-xs uppercase">Payment Method</div>
                              <div className="text-lg font-semibold">{bookingDetails.payment_method || 'N/A'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 flex-wrap pt-4 border-t border-[#444]">
                          {booking.status !== 'cancelled' && (
                            <>
                              <button
                                onClick={() => handleRescheduleClick(booking)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelClick(booking)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold"
                              >
                                Cancel Booking
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-400">Failed to load booking details</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232323] rounded-2xl p-6 max-w-md w-full border border-[#444]">
            <h2 className="text-2xl font-bold mb-4">Reschedule Booking</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[#888] text-sm mb-2">New Date</label>
                <input
                  type="date"
                  value={rescheduleData.date}
                  onChange={(e) => {
                    setRescheduleData(prev => ({ ...prev, date: e.target.value }))
                    if (e.target.value) {
                      fetchAvailableSlots(e.target.value, selectedBooking.hours || 1, selectedBooking.service_type)
                    }
                  }}
                  className="w-full bg-[#1b1b1b] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#ffd700]"
                />
              </div>

              <div>
                <label className="block text-[#888] text-sm mb-2">New Time</label>
                {slotsLoading ? (
                  <p className="text-[#888]">Loading available times...</p>
                ) : availableSlots.length > 0 ? (
                  <select
                    value={rescheduleData.timeSlot}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, timeSlot: e.target.value }))}
                    className="w-full bg-[#1b1b1b] border border-[#444] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#ffd700]"
                  >
                    <option value="">Select a time...</option>
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[#888]">No available slots for this date</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="flex-1 px-4 py-2 bg-[#444] hover:bg-[#555] text-white rounded-lg transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232323] rounded-2xl p-6 max-w-md w-full border border-[#444]">
            <h2 className="text-2xl font-bold mb-4 text-red-400">Cancel Booking</h2>
            
            <p className="text-[#888] mb-6">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 bg-[#444] hover:bg-[#555] text-white rounded-lg transition font-semibold"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
