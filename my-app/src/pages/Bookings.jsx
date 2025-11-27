import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function StudioBooking() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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
    startTime: '',
    people: 1,
    payment: '',
    instructor_id: null
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(null)
  const [totalAmount, setTotalAmount] = useState(0)
  const [formErrors, setFormErrors] = useState({})
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [timeConflicts, setTimeConflicts] = useState([])
  const [instructors, setInstructors] = useState([])

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (!token || !user) {
      // User not logged in, redirect to login
      window.location.href = '/auth/login'
      return
    }
    
    setIsAuthenticated(true)
    setIsLoading(false)
  }, [])

  // Auto-fill form with user profile data on mount
  useEffect(() => {
    if (!isAuthenticated) return
    
    try {
      const userDataString = localStorage.getItem('user')
      const miniBookingString = localStorage.getItem('miniBookingData')
      
      console.log('Auto-fill useEffect triggered');
      console.log('User data string:', userDataString);
      console.log('Mini booking string from localStorage:', miniBookingString);
      
      let miniBookingData = {}
      if (miniBookingString) {
        miniBookingData = JSON.parse(miniBookingString)
        console.log('Mini booking data parsed:', miniBookingData)
      }
      
      if (userDataString) {
        const userData = JSON.parse(userDataString)
        console.log('User data parsed:', userData);
        
        // Auto-fill fields from user profile and mini-booking data
        const service = miniBookingData.service || ''
        let duration = miniBookingData.duration || ''
        
        // If service has fixed duration and no duration was provided, set it
        if (service && !duration && SERVICE_CONFIG[service]?.durationFixed) {
          duration = '60'
        }
        
        const updatedData = {
          name: miniBookingData.name || (userData?.first_name && userData?.last_name 
            ? `${userData.first_name} ${userData.last_name}`.trim()
            : userData?.username || userData?.email || ''),
          email: userData?.email || '',
          contact: userData?.contact || '',
          birthday: userData?.birthday || '',
          address: userData?.home_address || '',
          service: service,
          duration: duration,
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
        
        // If service is music_lesson, fetch instructors
        if (miniBookingData.service === 'music_lesson') {
          console.log('🎵 Music lesson detected in autofill, fetching instructors...');
          fetchInstructors();
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
  }, [isAuthenticated])

  // Service type configuration with pricing (must match backend PRICING)
  const SERVICE_CONFIG = {
    music_lesson: { label: 'Music Lessons', price: 500, durationFixed: true },
    recording: { label: 'Recording Studio', price: 1500, durationFixed: false },
    rehearsal: { label: 'Rehearsal', price: 800, durationFixed: false },
    dance: { label: 'Dance Studio', price: 600, durationFixed: false },
    arrangement: { label: 'Music Arrangement', price: 2000, durationFixed: false },
    voiceover: { label: 'Voiceover/Podcast', price: 1000, durationFixed: false },
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
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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

  // Fetch available instructors for music lessons
  const fetchInstructors = async (date = null, time = null, duration = null) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      // Use provided params or fall back to booking data
      const queryDate = date || bookingData.date;
      const queryTime = time || bookingData.timeSlot;
      const queryDuration = duration || bookingData.duration;
      
      let url = `${API_URL}/bookings/instructors`;
      
      // Add query params if all are available
      if (queryDate && queryTime && queryDuration) {
        url += `?date=${queryDate}&time=${queryTime}&duration=${queryDuration}`;
        console.log('🔄 Fetching available instructors for:', { date: queryDate, time: queryTime, duration: queryDuration });
      } else {
        console.log('🔄 Fetching all instructors (no date/time filter)');
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch instructors: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Instructors response:', data);
      if (data.success && data.data) {
        console.log('✅ Setting instructors:', data.data);
        setInstructors(data.data);
      } else {
        console.warn('⚠️ Invalid response format:', data);
      }
    } catch (err) {
      console.error('❌ Error fetching instructors:', err);
    }
  };

  // Handle service change
  const handleServiceChange = (service) => {
    console.log('🎵 Service changed to:', service);
    setBookingData(prev => ({
      ...prev,
      service,
      duration: SERVICE_CONFIG[service]?.durationFixed ? '60' : '',
      date: '',
      timeSlot: '',
      instructor_id: null
    }));
    setAvailableSlots([]);
    setSlotsError(null);
    
    // Fetch instructors if music lesson is selected
    if (service === 'music_lesson') {
      console.log('🎵 Music lesson selected, fetching instructors...');
      fetchInstructors();
    }
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
    
    // Refresh instructor availability if music lesson and time is set
    if (bookingData.service === 'music_lesson' && bookingData.duration && bookingData.timeSlot) {
      fetchInstructors(date, bookingData.timeSlot, bookingData.duration);
    }
  };

  // Handle time slot selection
  const handleTimeSlotChange = (slot) => {
    setBookingData(prev => ({
      ...prev,
      timeSlot: slot.display, // For display
      startTime: slot.startTime // For the API
    }));
    
    // Refresh instructor availability if music lesson
    if (bookingData.service === 'music_lesson' && bookingData.date && bookingData.duration) {
      fetchInstructors(bookingData.date, slot.display, bookingData.duration);
    }
  };

  // Check if all prerequisites are met for time slot dropdown
  const canShowTimeSlots = bookingData.service && bookingData.duration && bookingData.date;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];


  const validateForm = () => {
    const errors = {}
    
    console.log('=== VALIDATING FORM ===');
    console.log('Current bookingData:', bookingData);
    
    if (!bookingData.name.trim()) errors.name = 'Full name is required'
    if (!bookingData.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingData.email)) errors.email = 'Invalid email'
    
    if (!bookingData.contact.trim()) errors.contact = 'Mobile number is required'
    else if (!/^09\d{9}$/.test(bookingData.contact.replace(/\D/g, ''))) errors.contact = 'Mobile number must start with 09 and be 11 digits (e.g., 09123456789)'
    
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
    if (bookingData.service === 'music_lesson' && !bookingData.instructor_id) errors.instructor_id = 'Instructor is required for music lessons'
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
    
    console.log('Validation errors:', errors);
    console.log('Form is valid:', Object.keys(errors).length === 0);
    console.log('=== END VALIDATION ===');
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    // For contact field, only allow digits
    let newValue = value
    if (name === 'contact') {
      // Remove any non-digit characters
      newValue = value.replace(/\D/g, '')
      // Limit to 11 digits (Philippine phone number)
      if (newValue.length > 11) {
        newValue = newValue.slice(0, 11)
      }
    }
    
    setBookingData(prev => ({ ...prev, [name]: newValue }))
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const calculateTotal = () => {
    const serviceRates = {
      music_lesson: 500,
      recording: 1500,
      rehearsal: 800,
      dance: 600,
      arrangement: 2000,
      voiceover: 1000,
    }
    const baseRate = serviceRates[bookingData.service] || 800
    const durationHours = bookingData.duration ? parseInt(bookingData.duration) / 60 : 1
    return baseRate * durationHours
  }

  const handleContinue = (e) => {
    e.preventDefault()
    if (validateForm()) {
      const total = calculateTotal()
      setTotalAmount(total)
      
      // Generate QR code data based on booking information
      
      setStep(2)
    }
  }

  const handleConfirmPay = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      // Get user ID from local storage
      const user = JSON.parse(localStorage.getItem('user'));
      const userId = user ? (user.user_id || user.id) : null;
      const token = localStorage.getItem('token');

      // Extra guard + debug for service selection
      console.log('=== USER DEBUG ===');
      console.log('User object:', user);
      console.log('User ID:', userId);
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('=== SERVICE DEBUG ===');
      console.log('Service from state:', bookingData.service);
      console.log('Service type of:', typeof bookingData.service);
      console.log('Service is empty?', !bookingData.service);
      console.log('Service is valid option?', ['music_lesson', 'recording', 'mixing', 'band_rehearsal', 'production'].includes(bookingData.service));

      if (!bookingData.service || bookingData.service === '') {
        alert('Please select a service type before continuing');
        setLoading(false);
        return;
      }

      // Prepare booking payload
      const bookingPayload = {
        name: bookingData.name,
        email: bookingData.email,
        contact: bookingData.contact,
        birthday: bookingData.birthday || null,
        address: bookingData.address || null,
        service: bookingData.service,
        date: bookingData.date,
        timeSlot: bookingData.startTime || bookingData.timeSlot,
        duration: parseInt(bookingData.duration, 10),
        people: parseInt(bookingData.people, 10),
        payment: bookingData.payment,
        instructor_id: bookingData.instructor_id || null,
        userId
      };

      // Debug logging
      console.log('=== BOOKING PAYLOAD DEBUG ===');
      console.log('Full bookingData state:', bookingData);
      console.log('Service value:', bookingData.service);
      console.log('Service type:', typeof bookingData.service);
      console.log('Duration:', bookingData.duration);
      console.log('Date:', bookingData.date);
      console.log('Time Slot:', bookingData.startTime || bookingData.timeSlot);
      console.log('Payment method:', bookingData.payment);
      console.log('Final payload:', bookingPayload);
      console.log('Token being sent:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      console.log('=== END DEBUG ===');

      // Save booking to database first
      const response = await fetch(`${API_URL}/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload)
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
      
      // Send confirmation email
      const bookingId = result.data.booking.booking_id;
      const customerEmail = bookingData.email;
      
      try {
        console.log('📧 Sending confirmation email to:', customerEmail);
        const emailResponse = await fetch(`${API_URL}/bookings/${bookingId}/send-confirmation-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: customerEmail,
            bookingId: bookingId
          })
        });
        
        if (emailResponse.ok) {
          console.log('✅ Confirmation email sent successfully');
        } else {
          console.warn('⚠️ Email sending failed, but booking was created');
        }
      } catch (emailErr) {
        console.error('❌ Error sending email:', emailErr);
      }
      
      // Check payment method
      if (bookingData.payment === 'Cash') {
        // For cash payment, redirect immediately to landing page with success
        alert('Booking confirmed! A confirmation email has been sent to ' + customerEmail);
        window.location.href = '/';
      } else if (bookingData.payment === 'GCash' || bookingData.payment === 'Credit Card' || bookingData.payment === 'PayMaya') {
        // For online payment, redirect to Xendit checkout
        // Store booking ID in localStorage so we can retrieve it after payment
        localStorage.setItem('currentBookingId', bookingId);
        
        if (result.data?.xenditCheckoutUrl) {
          // After payment, Xendit returns to landing page with success notification
          const returnUrl = `${window.location.origin}/?payment=success&booking=${bookingId}`;
          const xenditUrl = `${result.data.xenditCheckoutUrl}${result.data.xenditCheckoutUrl.includes('?') ? '&' : '?'}return_url=${encodeURIComponent(returnUrl)}`;
          window.location.href = xenditUrl;
        } else if (result.data?.paymentUrl) {
          // Fallback payment URL
          const returnUrl = `${window.location.origin}/?payment=success&booking=${bookingId}`;
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

  const handleDownloadReceipt = () => {
    const element = document.getElementById('receipt-content')
    if (!element) return
    
    const html2canvas = window.html2canvas || null
    if (!html2canvas) {
      alert('Download feature not available')
      return
    }
  }

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
                  placeholder="09123456789"
                  onChange={handleInputChange}
                  error={formErrors.contact}
                  maxLength="11"
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
                    { value: 'music_lesson', label: 'Music Lessons - ₱500/hour' },
                    { value: 'recording', label: 'Recording Studio - ₱1500/hour' },
                    { value: 'rehearsal', label: 'Rehearsal - ₱800/hour' },
                    { value: 'dance', label: 'Dance Studio - ₱600/hour' },
                    { value: 'arrangement', label: 'Music Arrangement - ₱2000/hour' },
                    { value: 'voiceover', label: 'Voiceover/Podcast - ₱1000/hour' },
                  ]}
                />

                {/* Instructor Selection (for music lessons) */}
                {bookingData.service === 'music_lesson' && (
                  <>
                    {console.log('Instructors available:', instructors)}
                    <FormSelect
                      label="Select Instructor *"
                      name="instructor"
                      value={bookingData.instructor_id || ''}
                      onChange={(e) => setBookingData(prev => ({ ...prev, instructor_id: e.target.value ? parseInt(e.target.value) : null }))}
                      error={formErrors.instructor_id}
                      options={[
                        { value: '', label: 'Select an instructor...' },
                        ...instructors.map(instructor => ({
                          value: instructor.id,
                          label: `${instructor.first_name} ${instructor.last_name} - ${instructor.specialization || 'General'}`
                        }))
                      ]}
                    />
                  </>
                )}

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
                    { value: 'Credit Card', label: 'Credit Card' },
                    { value: 'PayMaya', label: 'PayMaya' },
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
                {loading ? 'Processing...' : 'Confirm and Pay'}
              </button>

              <button
                onClick={() => setStep(1)}
                className="w-full bg-transparent hover:bg-[#333] text-[#ffd700] font-bold py-3 rounded-lg transition border border-[#ffd700] mt-3"
              >
                Edit Booking
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Time Slot Modal */}
      {showTimeModal && bookingData.service && bookingData.date && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-40" 
            onClick={() => setShowTimeModal(false)}
          />
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-[#232323] rounded-2xl p-8 w-full max-w-2xl relative" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
              {/* Close Button */}
              <button
                onClick={() => setShowTimeModal(false)}
                className="absolute top-4 right-4 text-[#bbb] hover:text-[#ffd700] text-2xl transition"
              >
                ×
              </button>

              {/* Modal Header */}
              <h3 className="text-2xl font-bold text-[#ffd700] mb-2">Available Time Slots</h3>
              <p className="text-[#bbb] mb-4">
                Date: <span className="text-[#ffd700] font-semibold">{new Date(bookingData.date).toLocaleDateString()}</span>
              </p>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto mb-6">
                {availableTimeSlots.map((time) => {
                  const isBooked = timeConflicts.includes(time);
                  return (
                    <button
                      key={time}
                      onClick={() => !isBooked && handleTimeSelect(time)}
                      disabled={isBooked}
                      className={`p-3 rounded-lg font-semibold transition border-2 ${
                        isBooked
                          ? 'bg-[#3d3d3d] text-[#888] border-[#555] cursor-not-allowed opacity-50'
                          : bookingData.time === time
                          ? 'bg-[#ffd700] text-black border-[#ffd700]'
                          : 'bg-[#1b1b1b] text-white border-[#3d3d3d] hover:border-[#ffd700]'
                      }`}
                      title={isBooked ? 'Already booked' : ''}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowTimeModal(false)}
                className="w-full bg-[#ffd700] text-black font-bold py-2 rounded-lg hover:bg-[#ffe44c] transition"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
        </div>
    </div>
  )
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