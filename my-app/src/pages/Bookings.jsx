import { useState, useEffect } from 'react'

export default function StudioBooking() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [bookingData, setBookingData] = useState({
    name: '',
    email: '',
    contact: '',
    birthday: '',
    address: '',
    service: '',
    duration: '',
    date: '',
    timeSlot: '',
    people: 1,
    payment: ''
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(null)
  const [confirmationId, setConfirmationId] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)
  const [formErrors, setFormErrors] = useState({})
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeConflicts, setTimeConflicts] = useState([])
  
  // Auto-fill form with user profile data on mount
  useEffect(() => {
    try {
      const userDataString = localStorage.getItem('user')
      const miniBookingString = localStorage.getItem('miniBookingData')
      
      console.log('Auto-fill useEffect triggered');
      console.log('Mini booking string from localStorage:', miniBookingString);
      
      let miniBookingData = {}
      if (miniBookingString) {
        miniBookingData = JSON.parse(miniBookingString)
        console.log('Mini booking data parsed:', miniBookingData)
      }
      
      if (userDataString || miniBookingString) {
        const userData = userDataString ? JSON.parse(userDataString) : null
        console.log('User data:', userData);
        
        // Auto-fill fields from user profile, with mini-booking data taking precedence
        const updatedData = {
          name: miniBookingData.name || (userData?.first_name && userData?.last_name 
            ? `${userData.first_name} ${userData.last_name}`.trim()
            : userData?.username || userData?.email || ''),
          email: userData?.email || '',
          contact: userData?.contact || '',
          birthday: userData?.birthday || '',
          address: userData?.home_address || '',
          service: miniBookingData.service || '',
          duration: miniBookingData.duration || '',
          date: miniBookingData.date || '',
          timeSlot: miniBookingData.timeSlot || '',
          people: 1,
          payment: ''
        }
        
        console.log('Updated booking data to set:', updatedData)
        setBookingData(updatedData)
        
        // If mini-booking has service, duration, and date, fetch available slots
        if (miniBookingData.service && miniBookingData.duration && miniBookingData.date) {
          fetchAvailableSlots(miniBookingData.service, miniBookingData.duration, miniBookingData.date);
        }
      }
      
      // Clear mini-booking data after using it (after next render)
      setTimeout(() => {
        localStorage.removeItem('miniBookingData')
        console.log('Mini booking data cleared from localStorage');
      }, 0)
    } catch (err) {
      console.error('Error loading user profile for autofill:', err)
    }
  }, [])

  // Service type configuration with pricing
  const SERVICE_CONFIG = {
    music_lesson: { label: 'Music Lessons', durationFixed: true },
    recording: { label: 'Recording', durationFixed: false },
    mixing: { label: 'Mixing', durationFixed: false },
    band_rehearsal: { label: 'Band Rehearsal', durationFixed: false },
    production: { label: 'Production', durationFixed: false }
  };

  const DURATION_OPTIONS = [
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
    { label: '3 hours', minutes: 180 }
  ];

  // Fetch available time slots
  const fetchAvailableSlots = async (service, duration, date) => {
    if (!service || !duration || !date) return;

    setSlotsLoading(true);
    setSlotsError(null);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(
        `${API_URL}/bookings/available-slots-v2?service=${encodeURIComponent(service)}&duration=${duration}&date=${date}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }

      const data = await response.json();
      if (data.success) {
        setAvailableSlots(data.data.availableSlots || []);
        if (data.data.availableSlots.length === 0) {
          setSlotsError('No available time slots for this date');
        }
      } else {
        setSlotsError(data.message || 'Failed to fetch slots');
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setSlotsError(err.message || 'Error fetching available slots');
    } finally {
      setSlotsLoading(false);
    }
  };

  // Handle service change
  const handleServiceChange = (service) => {
    setBookingData(prev => ({
      ...prev,
      service,
      duration: SERVICE_CONFIG[service]?.durationFixed ? '60' : '',
      date: '',
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);
  };

  // Handle duration change
  const handleDurationChange = (duration) => {
    setBookingData(prev => ({
      ...prev,
      duration,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    // Fetch new slots if service and date are already set
    if (bookingData.service && bookingData.date) {
      fetchAvailableSlots(bookingData.service, duration, bookingData.date);
    }
  };

  // Handle date change
  const handleDateChange = (date) => {
    setBookingData(prev => ({
      ...prev,
      date,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    // Fetch new slots if service and duration are already set
    if (bookingData.service && bookingData.duration) {
      fetchAvailableSlots(bookingData.service, bookingData.duration, date);
    }
  };

  // Handle time slot selection
  const handleTimeSlotChange = (slot) => {
    setBookingData(prev => ({
      ...prev,
      timeSlot: slot.display
    }));
  };

  // Check if all prerequisites are met for time slot dropdown
  const canShowTimeSlots = bookingData.service && bookingData.duration && bookingData.date;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  const validateForm = () => {
    const errors = {}
    
    if (!bookingData.name.trim()) errors.name = 'Full name is required'
    if (!bookingData.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingData.email)) errors.email = 'Invalid email'
    
    if (!bookingData.contact.trim()) errors.contact = 'Mobile number is required'
    else if (!/^\d{10,13}$/.test(bookingData.contact.replace(/\D/g, ''))) errors.contact = 'Invalid mobile number'
    
    // Birthday is optional
    if (bookingData.birthday) {
      const birthDate = new Date(bookingData.birthday)
      const today = new Date()
      if (birthDate > today) errors.birthday = 'Birthday cannot be in the future'
      else {
        const age = today.getFullYear() - birthDate.getFullYear()
        if (age < 13) errors.birthday = 'You must be at least 13 years old'
      }
    }
    
    // Address is optional
    if (!bookingData.service) errors.service = 'Service type is required'
    if (!bookingData.duration) errors.duration = 'Duration is required'
    if (!bookingData.date) errors.date = 'Booking date is required'
    else {
      const bookingDate = new Date(bookingData.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (bookingDate < today) errors.date = 'Booking date must be in the future'
    }
    if (!bookingData.timeSlot) errors.timeSlot = 'Start time is required'
    if (!bookingData.people || bookingData.people < 1) errors.people = 'Invalid number of people'
    if (!bookingData.payment) errors.payment = 'Payment method is required'
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setBookingData(prev => ({ ...prev, [name]: value }))
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const calculateTotal = () => {
    const serviceRates = { music_lesson: 600, recording: 800, mixing: 1000, band_rehearsal: 1200, production: 1500 }
    const baseRate = serviceRates[bookingData.service] || 800
    const durationHours = bookingData.duration ? parseInt(bookingData.duration) / 60 : 1
    return baseRate * durationHours
  }

  const handleContinue = (e) => {
    e.preventDefault()
    if (validateForm()) {
      const refId = `MIXLAB${Date.now()}`
      setConfirmationId(refId)
      const total = calculateTotal()
      setTotalAmount(total)
      
      setStep(2)
    }
  }

  const handleConfirmPay = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      // Save booking to database first
      const response = await fetch(`${API_URL}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookingData.name,
          email: bookingData.email,
          contact: bookingData.contact,
          birthday: bookingData.birthday,
          address: bookingData.address,
          service: bookingData.service,
          date: bookingData.date,
          time: bookingData.time,
          hours: bookingData.hours,
          people: bookingData.people,
          payment: bookingData.payment,
          confirmationId,
          totalAmount
        })
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        alert(`Booking failed: ${response.statusText} (${response.status})`);
        setLoading(false);
        return;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', e);
        alert('Booking response format error. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Booking created:', result);
      
      // Check payment method
      if (bookingData.payment === 'Cash') {
        // For cash payment, redirect immediately to landing page with success
        // The backend has already generated QR and sent email
        alert('Booking confirmed! Redirecting to view your booking details...');
        window.location.href = `/?booking=success&id=${result.data.booking.booking_id}`;
      } else if (bookingData.payment === 'GCash' || bookingData.payment === 'Credit/Debit Card') {
        // For online payment, redirect to Xendit checkout
        // Store booking ID in localStorage so we can retrieve it after payment
        const bookingId = result.data.booking.booking_id;
        localStorage.setItem('currentBookingId', bookingId);
        
        if (result.data?.xenditCheckoutUrl) {
          // After payment, Xendit returns to landing page with success notification
          const bookingId = result.data.booking.booking_id;
          const returnUrl = `${window.location.origin}/?booking=success&id=${bookingId}`;
          const xenditUrl = `${result.data.xenditCheckoutUrl}${result.data.xenditCheckoutUrl.includes('?') ? '&' : '?'}return_url=${encodeURIComponent(returnUrl)}`;
          window.location.href = xenditUrl;
        } else if (result.data?.paymentUrl) {
          // Fallback payment URL
          const bookingId = result.data.booking.booking_id;
          const returnUrl = `${window.location.origin}/?booking=success&id=${bookingId}`;
          const paymentUrl = `${result.data.paymentUrl}${result.data.paymentUrl.includes('?') ? '&' : '?'}return_url=${encodeURIComponent(returnUrl)}`;
          window.location.href = paymentUrl;
        } else {
          alert('Payment gateway is temporarily unavailable. Please try cash payment or contact support.');
          setStep(2);
        }
      } else {
        // Default to redirect to home
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Booking error:', err);
      alert('Failed to process booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderReviewDetails = () => (
    <div className="space-y-0">
      <DetailRow label="Name" value={bookingData.name} />
      <DetailRow label="Email" value={bookingData.email} />
      <DetailRow label="Contact" value={bookingData.contact} />
      <DetailRow label="Service" value={bookingData.service} />
      <DetailRow label="Date & Time" value={`${bookingData.date} @ ${bookingData.timeSlot}`} />
      <DetailRow label="Duration" value={`${parseInt(bookingData.duration) / 60} hour(s)`} />
      <DetailRow label="People" value={bookingData.people} />
      <DetailRow label="Payment" value={bookingData.payment} />
    </div>
  )

  const DetailRow = ({ label, value }) => (
    <div className="flex gap-4 py-2 border-b border-[#242401]">
      <div className="w-38 text-[#bbb] font-medium text-sm">{label}</div>
      <div className="flex-1 text-white font-bold text-sm">{value}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1b1b1b] py-12 px-4" style={{
      backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.07), transparent 60%), radial-gradient(circle at 80% 80%, rgba(255, 215, 0, 0.07), transparent 60%)'
    }}>
      <div className="w-full max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => window.location.href = '/'}
          className="mb-6 flex items-center gap-2 text-[#ffd700] hover:text-[#ffe44c] font-semibold transition"
        >
          <span className="text-xl">←</span>
        </button>

        <div className="bg-[#232323] rounded-2xl p-8" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
          <h1 className="text-3xl font-bold text-center mb-8" style={{ color: '#ffd700', textShadow: '0 0 6px rgba(255, 215, 0, 0.3)' }}>
            Studio Session Booking
          </h1>

        {/* STEP 1: Booking Form */}
        {step === 1 && (
          <div>
            <div className="text-[#ffd700] font-semibold text-lg mb-6">Step 1 of 3: Book Your Session</div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Left Column */}
              <div className="space-y-5">
                <FormGroup
                  label="Full Name *"
                  name="name"
                  type="text"
                  value={bookingData.name}
                  onChange={handleInputChange}
                  error={formErrors.name}
                />
                <FormGroup
                  label="Email *"
                  name="email"
                  type="email"
                  value={bookingData.email}
                  onChange={handleInputChange}
                  error={formErrors.email}
                />
                <FormGroup
                  label="Mobile Number *"
                  name="contact"
                  type="text"
                  value={bookingData.contact}
                  placeholder="09XXYYYYZZZZ"
                  onChange={handleInputChange}
                  error={formErrors.contact}
                />
                <FormGroup
                  label="Birthday"
                  name="birthday"
                  type="date"
                  value={bookingData.birthday}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  error={formErrors.birthday}
                />
                <div className="form-group">
                  <label className="font-bold text-sm text-white mb-2 block">Address</label>
                  <textarea
                    name="address"
                    value={bookingData.address}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-white focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition resize-none"
                  />
                  {formErrors.address && <div className="text-red-500 text-xs mt-1">{formErrors.address}</div>}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                {/* Step 1: Service Type Selection */}
                <FormSelect
                  label="Service Type *"
                  name="service"
                  value={bookingData.service}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  error={formErrors.service}
                  options={[
                    { value: '', label: 'Select a service...' },
                    { value: 'music_lesson', label: 'Music Lessons' },
                    { value: 'recording', label: 'Recording' },
                    { value: 'mixing', label: 'Mixing' },
                    { value: 'band_rehearsal', label: 'Band Rehearsal' },
                    { value: 'production', label: 'Production' }
                  ]}
                />

                {/* Step 2: Duration Selection */}
                {bookingData.service && (
                  <div className="form-group">
                    {SERVICE_CONFIG[bookingData.service]?.durationFixed ? (
                      <>
                        <label className="font-bold text-sm text-white mb-2 block">Duration</label>
                        <div className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-gray-300 text-sm">
                          1 hour (automatically set for Music Lessons)
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="font-bold text-sm text-white mb-2 block">Duration *</label>
                        <div className="grid grid-cols-3 gap-2">
                          {DURATION_OPTIONS.map((option) => (
                            <button
                              key={option.minutes}
                              type="button"
                              onClick={() => handleDurationChange(option.minutes.toString())}
                              className={`p-3 rounded border-2 transition font-medium text-sm
                                ${bookingData.duration === option.minutes.toString()
                                  ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                                  : 'border-[#3d3d3d] bg-[#181818] text-gray-300 hover:border-[#ffd700]'
                                }
                              `}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {formErrors.duration && <div className="text-red-500 text-xs mt-1">{formErrors.duration}</div>}
                      </>
                    )}
                  </div>
                )}

                {/* Step 3: Date Selection */}
                {bookingData.service && bookingData.duration && (
                  <FormGroup
                    label="Booking Date *"
                    name="date"
                    type="date"
                    value={bookingData.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={today}
                    error={formErrors.date}
                  />
                )}

                {/* Step 4 & 5: Time Slot Selection */}
                {canShowTimeSlots && (
                  <div className="form-group">
                    <label className="font-bold text-sm text-white mb-2 block">Time Slot *</label>
                    
                    {slotsLoading && (
                      <div className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-gray-300 text-sm">
                        Loading available slots...
                      </div>
                    )}

                    {slotsError && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {slotsError}
                      </div>
                    )}

                    {!slotsLoading && availableSlots.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {availableSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleTimeSlotChange(slot)}
                            className={`p-2 rounded border-2 transition font-medium text-xs
                              ${bookingData.timeSlot === slot.display
                                ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                                : 'border-[#3d3d3d] bg-[#181818] text-gray-300 hover:border-[#ffd700]'
                              }
                            `}
                          >
                            {slot.display}
                          </button>
                        ))}
                      </div>
                    )}

                    {!slotsLoading && availableSlots.length === 0 && !slotsError && (
                      <div className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-gray-400 text-sm">
                        No available time slots for this date
                      </div>
                    )}
                    {formErrors.timeSlot && <div className="text-red-500 text-xs mt-1">{formErrors.timeSlot}</div>}
                  </div>
                )}
                
                <FormGroup
                  label="Number of People *"
                  name="people"
                  type="number"
                  value={bookingData.people}
                  onChange={handleInputChange}
                  error={formErrors.people}
                  min="1"
                  max="20"
                />
                <FormSelect
                  label="Payment Method *"
                  name="payment"
                  value={bookingData.payment}
                  onChange={handleInputChange}
                  error={formErrors.payment}
                  options={[
                    { value: '', label: 'Select payment method...' },
                    { value: 'GCash', label: 'GCash' },
                    { value: 'Credit/Debit Card', label: 'Credit/Debit Card' },
                    { value: 'Cash', label: 'Pay on Arrival (Cash)' }
                  ]}
                />
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!bookingData.service || !bookingData.duration || !bookingData.date || !bookingData.timeSlot || !bookingData.people || !bookingData.payment}
              style={{ boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)' }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div className="max-w-lg mx-auto">
            <div className="text-[#ffd700] font-semibold text-lg mb-6">Step 2 of 3: Review Your Booking</div>
            
            <div className="bg-[#232323] rounded-2xl p-6 border-2 border-[#33332d]" style={{ boxShadow: '0 0 20px rgba(255, 215, 0, 0.11)' }}>
              <div className="text-[#ffd700] font-bold text-lg mb-4 pb-2 border-b border-dashed border-[#33332d]">
                Confirmation #: {confirmationId}
              </div>
              
              {renderReviewDetails()}
              
              <div className="bg-[#222114] border-2 border-[#ffd700] rounded-lg p-4 mt-6 text-center">
                <div className="text-[#ffd700] font-bold text-xl">Total: ₱{totalAmount}</div>
              </div>

              {/* Payment method info */}
              <div className="bg-[#222114] border-2 border-[#ffd700] rounded-lg p-4 mt-4 text-center text-sm text-white">
                {bookingData.payment === 'Cash' 
                  ? 'You will complete your booking after reviewing. Pay on arrival.' 
                  : 'You will be redirected to Xendit to complete your payment.'}
              </div>

              <button
                onClick={handleConfirmPay}
                disabled={loading}
                className="w-full bg-[#ffd700] hover:bg-[#ffe44c] disabled:opacity-50 text-black font-bold py-3 rounded-lg transition mt-6"
                style={{ boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)' }}
              >
                {loading ? 'Processing...' : bookingData.payment === 'Cash' ? 'Confirm Booking' : 'Confirm & Pay'}
              </button>

              <button
                onClick={() => setStep(1)}
                className="w-full bg-transparent hover:bg-[#333] text-[#ffd700] font-bold py-3 rounded-lg transition border border-[#ffd700] mt-3"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FormGroup = ({ label, name, type, value, onChange, error, placeholder, min, max }) => (
  <div className="flex flex-col gap-1">
    <label className="font-bold text-sm text-white">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition"
    />
    {error && <div className="text-red-500 text-xs">{error}</div>}
  </div>
)

const FormSelect = ({ label, name, value, onChange, error, options }) => (
  <div className="flex flex-col gap-1">
    <label className="font-bold text-sm text-white">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-white focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <div className="text-red-500 text-xs">{error}</div>}
  </div>
)