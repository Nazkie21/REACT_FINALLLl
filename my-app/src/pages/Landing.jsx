import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { FaInstagram, FaFacebook, FaTiktok, FaBell } from "react-icons/fa";
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';

import {
  gallery1,
  gallery2,
  gallery3,
  gallery4,
  hero_bg,
  logo,
  music_production,
  recording_studio,
  studiomic,
  slider1,
  slider2,
  slider3,
  slider4,
  slider5,
} from "../assets/images"

function displayName(user) {
  if (!user) return null
  if (user.username) return user.username
  if (user.first_name || user.last_name) return [user.first_name, user.last_name].filter(Boolean).join(' ')
  return user.name || user.fullname || user.email || null
}

export default function Landing() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  // State for the mini-booking form on the landing page
  const [miniBooking, setMiniBooking] = useState({
    name: '',
    service: '',
    duration: '',
    date: '',
    timeSlot: ''
  })
  const [miniFormError, setMiniFormError] = useState('')
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [miniAvailableSlots, setMiniAvailableSlots] = useState([])
  const [miniSlotsLoading, setMiniSlotsLoading] = useState(false)
  const [miniSlotsError, setMiniSlotsError] = useState(null)
  // Burger menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // State for booking success modal
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  // Notification states
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [contactFormError, setContactFormError] = useState('')
  const [contactFormSuccess, setContactFormSuccess] = useState(false)
  // Login modal state for non-authenticated users
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const handleURLParams = async () => {
      try {
        // Check if we have an OAuth token in the URL
        const qs = new URLSearchParams(window.location.search)
        const oauthToken = qs.get('token')
        const oauthUser = qs.get('user')
        const oauthProvider = qs.get('oauth')
        // Check if returning from payment (new flow)
        const paymentStatus = qs.get('payment') // 'success' or 'failed'
        const bookingId = qs.get('booking') || qs.get('id')
        
        if (oauthToken) {
          // Store the token and auth provider (google/facebook)
          localStorage.setItem('token', oauthToken)
          if (oauthProvider) {
            localStorage.setItem('authProvider', oauthProvider)
          }
          
          // Parse and store user data if provided
          let userData = null
          if (oauthUser) {
            try {
              userData = JSON.parse(decodeURIComponent(oauthUser))
              localStorage.setItem('user', JSON.stringify(userData))
              setUser(userData)
            } catch (e) {
              console.log('Error parsing OAuth user data:', e)
            }
          }
          
          // Clean up URL parameters
          const url = new URL(window.location.href)
          url.searchParams.delete('token')
          url.searchParams.delete('user')
          url.searchParams.delete('oauth')
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
          
          // Redirect based on user role
          if (userData && userData.role) {
            const userRole = userData.role
            if (userRole === 'admin') {
              // Admin users go to AdminDashboard - set redirecting flag first
              setIsRedirecting(true)
              // Add a small delay to ensure UI updates before redirect
              setTimeout(() => {
                window.location.href = '/admin/dashboard'
              }, 500)
              return
            }
            // User/Student roles stay on landing page (already here)
          }
        }

        // Check if returning from payment
        if (paymentStatus && bookingId) {
          console.log('Payment return detected:', paymentStatus, bookingId)

          if (paymentStatus === 'success') {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const maxAttempts = 3;
            const delayMs = 800;
            let verifiedData = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                // First, ask backend to verify with Xendit and update payment_status if needed
                const verifyResponse = await fetch(`${API_URL}/webhooks/xendit/verify/${bookingId}`);
                if (verifyResponse.ok) {
                  const verifyResult = await verifyResponse.json();
                  const data = verifyResult.data;
                  const isPaid = data?.payment_status && data.payment_status.toLowerCase() === 'paid';
                  const hasQr = !!data?.qr_code_url;
                  if (isPaid && hasQr) {
                    verifiedData = data;
                    break;
                  }
                }

                // Fallback: fetch booking directly if verify endpoint didn't return paid yet
                const response = await fetch(`${API_URL}/bookings/${bookingId}`);
                if (response.ok) {
                  const result = await response.json();
                  const data = result.data;
                  const isPaid = data?.payment_status && data.payment_status.toLowerCase() === 'paid';
                  const hasQr = !!data?.qr_code_url;
                  if (isPaid && hasQr) {
                    verifiedData = data;
                    break;
                  }
                }
              } catch (err) {
                console.error('Verification attempt failed:', err);
              }

              if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }

            if (verifiedData) {
              setBookingDetails(verifiedData);
            } else {
              // Webhook or verification not finished yet; show minimal info and let email handle full confirmation
              setBookingDetails({ booking_id: bookingId });
            }
            setShowBookingModal(true);
            setBookingSuccess(true);
          } else if (paymentStatus === 'failed') {
            // TODO: implement dedicated failed payment modal per spec
          }

          // Clean up URL parameters
          const url = new URL(window.location.href)
          url.searchParams.delete('payment')
          url.searchParams.delete('booking')
          url.searchParams.delete('id')
          window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
        }
      } catch (e) {
        console.log('URL params error:', e)
      }
      
      // Also check for existing user data in localStorage
      const s = localStorage.getItem('user')
      if (s && !user) {
        try { 
          setUser(JSON.parse(s)) 
        } catch (e) {
          console.log('Error parsing user data:', e)
        }
      }
    }
    
    handleURLParams()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')

    // User data is already available from login response in localStorage
    // No need to fetch /auth/me

    // Fetch notifications if user is logged in
    if (user && token) {
      fetchNotifications();
    }
  }, [user])

  // Set up real-time notifications for logged-in user
  useRealtimeNotifications(false, () => {
    fetchNotifications();
  });

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const apiNotifications = result.data?.notifications || [];
        // Map backend fields to the shape used by the original UI (type, read_status)
        const mappedNotifications = apiNotifications.map((n) => ({
          ...n,
          type: n.notification_type || n.type,
          read_status: typeof n.is_read !== 'undefined'
            ? !!n.is_read
            : !!n.read_status
        }));

        setNotifications(mappedNotifications);
        setUnreadCount(result.data?.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // Handle notification click - mark as read and navigate to reservations
  const handleNotificationClick = async (notif) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Mark notification as read
      if (!notif.read_status) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        await fetch(`${API_URL}/notifications/${notif.notification_id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Update local state
        setNotifications(notifications.map(n => 
          n.notification_id === notif.notification_id 
            ? { ...n, read_status: true, is_read: 1 }
            : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }

      // Close notification panel
      setShowNotificationPanel(false);

      // Navigate to reservations page
      navigate('/reservations');
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  // Handle contact form input change
  const handleContactFormChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
    setContactFormError('');
  };

  // Submit contact form
  const handleContactFormSubmit = async (e) => {
    e.preventDefault();
    setContactFormError('');

    // Validation
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactFormError('All fields are required');
      return;
    }

    if (contactForm.message.length < 10) {
      setContactFormError('Message must be at least 10 characters');
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/contact/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });

      if (response.ok) {
        setContactFormSuccess(true);
        setContactForm({ name: '', email: '', message: '' });
        
        // Hide success message after 5 seconds
        setTimeout(() => setContactFormSuccess(false), 5000);
      } else {
        const result = await response.json();
        setContactFormError(result.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error submitting contact form:', err);
      setContactFormError('Failed to send message. Please try again.');
    }
  };

  // Carousel auto-slide
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const name = displayName(user)

  // Detail Row Component for booking details
  const DetailRow = ({ label, value }) => (
    <div className="flex gap-4 py-2 border-b border-[#242401]">
      <div className="w-38 text-[#bbb] font-medium text-sm">{label}</div>
      <div className="flex-1 text-white font-bold text-sm">{value}</div>
    </div>
  )

  // Format service type for display
  const formatServiceType = (serviceType) => {
    const types = {
      'vocal': 'Vocal Recording',
      'band': 'Band Recording',
      'podcast': 'Podcast',
      'mixing': 'Mixing & Mastering',
      'music_lesson': 'Music Lesson',
      'recording': 'Recording Studio',
      'rehearsal': 'Band Rehearsal',
      'dance': 'Dance Studio',
      'arrangement': 'Music Arrangement',
      'voiceover': 'Voiceover/Dubbing'
    }
    return types[serviceType] || serviceType || 'N/A'
  }

  // Format payment method for display
  const formatPaymentMethod = (method) => {
    const methods = {
      'GCash': 'GCash',
      'Credit/Debit Card': 'Credit/Debit Card',
      'Cash': 'Cash (Pay on Arrival)',
      'gcash': 'GCash',
      'credit_card': 'Credit Card',
      'cash': 'Cash (Pay on Arrival)'
    }
    return methods[method] || method
  }

  const sliderImages = [slider1, slider2, slider3, slider4, slider5]
  const galleryImages = [gallery1, gallery2, gallery3, gallery4]

  const testimonials = [
    {
      name: "Sarah Chen",
      content: "MixLab transformed my demo into a professional track that got me signed! The engineers are incredibly talented and really understood my vision.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      content: "Best rehearsal space in Pasig! Great equipment, comfortable rooms, and the staff is always helpful. Our band practices here every week.",
      rating: 5
    },
    {
      name: "Liza Santos",
      content: "I've been taking vocal lessons here for 6 months and my progress has been amazing. The instructors are patient and really know their craft.",
      rating: 5
    },
    {
      name: "DJ Mike Torres",
      content: "Top-notch recording quality and reasonable rates. Recorded my entire EP here and couldn't be happier with the results!",
      rating: 5
    }
  ]

  const handlePrevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const handleNextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  // Available time slots based on service type
  const getAvailableTimeSlots = (service) => {
    const allTimeSlots = [];
    // Operating hours: 10:00 AM - 8:00 PM
    for (let hour = 10; hour < 20; hour++) {
      allTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 19) allTimeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    
    // All services use all available time slots (10am - 8pm)
    // Each service has its own dedicated room with independent booking calendar
    return allTimeSlots;
  };

  // --- NEW HANDLERS FOR MINI-BOOKING FORM ---
  const SERVICE_CONFIG = {
    music_lesson: { label: 'Music Lessons', durationFixed: true },
    recording: { label: 'Recording Studio', durationFixed: false },
    rehearsal: { label: 'Rehearsal', durationFixed: false },
    dance: { label: 'Dance Studio', durationFixed: false },
    arrangement: { label: 'Music Arrangement', durationFixed: false },
    voiceover: { label: 'Voiceover/Podcast', durationFixed: false },
  };

  const DURATION_OPTIONS = [
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
    { label: '3 hours', minutes: 180 }
  ];

  // Fetch available time slots
  const fetchMiniAvailableSlots = async (service, duration, date) => {
    if (!service || !duration || !date) return;

    setMiniSlotsLoading(true);
    setMiniSlotsError(null);
    
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
        setMiniAvailableSlots(data.data.availableSlots || []);
        if (data.data.availableSlots.length === 0) {
          setMiniSlotsError('No available time slots for this date');
        }
      } else {
        setMiniSlotsError(data.message || 'Failed to fetch slots');
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setMiniSlotsError(err.message || 'Error fetching available slots');
    } finally {
      setMiniSlotsLoading(false);
    }
  };

  // Handle service change
  const handleMiniServiceChange = (service) => {
    setMiniBooking(prev => ({
      ...prev,
      service,
      duration: SERVICE_CONFIG[service]?.durationFixed ? '60' : '',
      date: '',
      timeSlot: ''
    }));
    setMiniAvailableSlots([]);
    setMiniSlotsError(null);
  };

  // Handle duration change
  const handleMiniDurationChange = (duration) => {
    setMiniBooking(prev => ({
      ...prev,
      duration,
      timeSlot: ''
    }));
    setMiniAvailableSlots([]);
    setMiniSlotsError(null);

    // Fetch new slots if service and date are already set
    if (miniBooking.service && miniBooking.date) {
      fetchMiniAvailableSlots(miniBooking.service, duration, miniBooking.date);
    }
  };

  // Handle date change
  const handleMiniDateChange = (date) => {
    setMiniBooking(prev => ({
      ...prev,
      date,
      timeSlot: ''
    }));
    setMiniAvailableSlots([]);
    setMiniSlotsError(null);

    // Fetch new slots if service and duration are already set
    if (miniBooking.service && miniBooking.duration) {
      fetchMiniAvailableSlots(miniBooking.service, miniBooking.duration, date);
    }
  };

  // Handle time slot selection
  const handleMiniTimeSlotChange = (slot) => {
    setMiniBooking(prev => ({
      ...prev,
      timeSlot: slot.display
    }));
  };

  // Check if all prerequisites are met for time slot dropdown
  const canShowMiniTimeSlots = miniBooking.service && miniBooking.duration && miniBooking.date;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  const handleMiniInputChange = (e) => {
    const { name, value } = e.target
    setMiniBooking(prev => ({ ...prev, [name]: value }))
    setMiniFormError('') // Clear error on change
  }

  const handleRequestBooking = (e) => {
    e.preventDefault();
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      // User not logged in, show login modal
      setShowLoginModal(true);
      return;
    }
    
    if (!miniBooking.name || miniBooking.name.trim() === '') {
      setMiniFormError('Please enter your full name.')
      return;
    }
    if (!miniBooking.service) {
      setMiniFormError('Please select a service type.')
      return;
    }
    if (!miniBooking.duration) {
      setMiniFormError('Please select a duration.')
      return;
    }
    if (!miniBooking.date) {
      setMiniFormError('Please select a booking date.')
      return;
    }
    if (!miniBooking.timeSlot) {
      setMiniFormError('Please select a time slot.')
      return;
    }
    
    // Save mini-booking data to localStorage for auto-fill on booking page
    // Include the name entered by user
    localStorage.setItem('miniBookingData', JSON.stringify({
      name: miniBooking.name,
      service: miniBooking.service,
      duration: miniBooking.duration,
      date: miniBooking.date,
      timeSlot: miniBooking.timeSlot
    }));
    
    // User is logged in, proceed to booking page
    window.location.href = '/Bookings';
  }
  // ------------------------------------------

  return (
    <div className="font-poppins text-white" style={{background: 'linear-gradient(to bottom, rgba(255, 215, 0, 0.1), rgba(27, 27, 27, 1)), #1b1b1b'}}>
      {/* Redirecting Overlay */}
      {isRedirecting && (
        <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffd700]"></div>
        </div>
      )}
      
      {/* Header */}
      <header className="w-full sticky top-0 z-50 bg-[#1b1b1b] shadow-md border-b border-[#444]">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 py-2">
          <a href="/" className="flex items-center z-10">
            <img src={logo} alt="MixLab Logo" className="h-20 transition-transform hover:scale-105"/>
          </a>

          {/* Navigation */}
          <nav className="hidden lg:flex flex-1 justify-center">
            <ul className="flex items-center gap-5">
              <li><a href="#about" className="px-3 py-2 rounded hover:bg-white/5 transition">About</a></li>
              <li className="relative group">
                <a href="#services" className="px-3 py-2 rounded hover:bg-white/5 transition">Services & Features</a>
                <ul className="absolute left-1/2 -translate-x-1/2 mt-2 bg-[#2a2a2a] rounded-lg hidden group-hover:flex flex-col min-w-[200px] shadow-lg gap-2 p-2">
                  <li><a href="#services" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Music Lessons</a></li>
                  <li><a href="/user/welcome" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Band Rehearsal</a></li>
                  <li><a href="#features" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Recording</a></li>
                  <li><a href="#features" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Live Room</a></li>
                  <li><a href="#features" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Control Room</a></li>
                  <li><a href="#features" className="px-5 py-3 text-base hover:bg-[#1b1b1b] rounded transition">Main Hall</a></li>
                </ul>
              </li>
              <li><a href="#gallery" className="px-3 py-2 rounded hover:bg-white/5 transition">Gallery</a></li>
              <li><a href="#contact" className="px-3 py-2 rounded hover:bg-white/5 transition">Contact Us</a></li>
              <li><a href="/Reservations" className="px-3 py-2 rounded hover:bg-white/5 transition ">Reservation</a></li>
            </ul>
          </nav>

          {/* User Actions */}
          <div className="hidden lg:flex items-center gap-4 z-10 relative">
            {user && (
              <button 
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="flex items-center justify-center w-10 h-10 text-[#ffd700] hover:text-[#ffe44c] transition p-0 relative" 
                title="Notifications" 
                aria-label="Notifications"
              >
                <FaBell className="text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            {user ? (
              <a href="/Profile" className="flex items-center p-2 rounded-full hover:bg-[#ffd700]/10 transition group" title={`Go to profile - ${displayName(user)}`}>
                {/* Profile Avatar - Independent Element */}
                <span className="bg-[#ffd700] text-black w-10 h-10 rounded-full flex items-center justify-center uppercase font-semibold group-hover:shadow-[0_0_12px_#ffd700]">
                  {displayName(user)?.charAt(0) || 'U'}
                </span>
              </a>
            ) : (
              <a href="/auth/login" className="px-4 py-2 bg-[#ffd700] hover:bg-[#ffe44c] text-black rounded-lg transition font-semibold shadow-lg">Log in</a>
            )}
          </div>

          {/* Mobile Icons */}
          <div className="lg:hidden flex items-center gap-3 z-20">
            {user && (
              <button 
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="flex items-center justify-center w-10 h-10 text-[#ffd700] hover:text-[#ffe44c] transition p-0 relative" 
                title="Notifications" 
                aria-label="Notifications"
              >
                <FaBell className="text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            <button className="text-[#ffd700] text-2xl p-2" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>☰</button>
          </div>
          
          {/* Mobile Nav Drawer */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Drawer */}
              <div className="fixed top-0 right-0 h-full w-[280px] bg-[#1b1b1b] z-50 shadow-2xl flex flex-col animate-slideIn">
                {/* Drawer Header */}
                <div className="flex justify-between items-center p-4 border-b border-[#ffd700]/30">
                  <img src={logo} alt="MixLab Logo" className="h-12" />
                  <button 
                    className="text-[#ffd700] text-3xl hover:text-white transition p-2" 
                    aria-label="Close menu" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    &times;
                  </button>
                </div>
                
                {/* Navigation Links */}
                <nav className="flex-1 flex flex-col py-4 overflow-y-auto">
                  <a 
                    href="#about" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg">About</span>
                  </a>
                  <a 
                    href="#services" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg">Services & Features</span>
                  </a>
                  <a 
                    href="/user/welcome" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg pl-4">Music Lessons</span>
                  </a>
                  <a 
                    href="#features" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg pl-4">Studio Features</span>
                  </a>
                  <a 
                    href="#gallery" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg">Gallery</span>
                  </a>
                  <a 
                    href="#contact" 
                    className="flex items-center px-6 py-4 text-white hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg">Contact Us</span>
                  </a>
                  <a 
                    href="/Reservations" 
                    className="flex items-center px-6 py-4 font-semibold hover:bg-white/5 transition" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-lg">Reservation</span>
                  </a>
                  
                  {/* Divider */}
                  <div className="border-t border-[#ffd700]/30 my-4" />
                  
                  {/* User Section */}
                  <div className="px-6 py-4 flex flex-col gap-3">
                    {user ? (
                      <a 
                        href="/Profile" 
                        className="flex items-center gap-3 p-3 border border-[#ffd700] rounded-lg hover:bg-[#ffd700] hover:text-black transition group" 
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="bg-[#ffd700] text-black w-10 h-10 rounded-full flex items-center justify-center uppercase font-semibold">{displayName(user)?.charAt(0) || 'U'}</span>
                        <div className="flex flex-col">
                          <span className="text-base font-semibold">{displayName(user) || 'User'}</span>
                          <span className="text-xs">Student</span>
                        </div>
                      </a>
                    ) : (
                      <a 
                        href="/auth/login" 
                        className="block text-center px-4 py-3 bg-[#ffd700] text-black font-semibold rounded-lg hover:bg-[#ffe44c] transition shadow-lg" 
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Log in
                      </a>
                    )}
                  </div>
                </nav>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Notification Panel */}
      {showNotificationPanel && user && (
        <div className="fixed top-20 right-4 w-96 max-h-96 bg-[#2a2a2a] rounded-lg shadow-2xl border border-[#ffd700]/30 z-40 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#1b1b1b] px-4 py-3 border-b border-[#ffd700]/30 flex justify-between items-center">
            <h3 className="text-white font-bold">Notifications</h3>
            <button 
              onClick={() => setShowNotificationPanel(false)}
              className="text-[#bbb] hover:text-white transition text-xl"
            >
              ×
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length > 0 ? (
              notifications.map((notif, idx) => (
                <button
                  key={idx}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a1a1a] hover:bg-[#333] transition ${
                    !notif.read_status ? 'bg-[#1a1a1a]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1">
                      {notif.type === 'booking_confirmation' ? (
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                      ) : notif.type?.includes('reminder') ? (
                        <Clock size={18} className="text-blue-500 flex-shrink-0" />
                      ) : notif.type === 'booking_cancelled' ? (
                        <XCircle size={18} className="text-red-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={18} className="text-yellow-500 flex-shrink-0" />
                      )}
                      <h4 className={`text-sm font-bold ${notif.read_status ? 'text-[#bbb]' : 'text-[#ffd700]'}`}>
                        {notif.title}
                      </h4>
                    </div>
                    {!notif.read_status && (
                      <span className="w-2 h-2 bg-[#ffd700] rounded-full mt-1 flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-xs text-[#666] line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-[#555] mt-1">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[#666]">
                <p className="text-sm">No notifications yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="bg-[#1b1b1b] px-4 py-2 border-t border-[#ffd700]/30">
              <button 
                onClick={async () => {
                  const token = localStorage.getItem('token');
                  if (!token) return;
                  try {
                    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    const response = await fetch(`${API_URL}/notifications/read-all`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    if (response.ok) {
                      // Update local state to match original design expectations
                      setNotifications(notifications.map(n => ({ ...n, read_status: true, is_read: 1 })));
                      setUnreadCount(0);
                    }
                  } catch (err) {
                    console.error('Error marking all notifications as read:', err);
                  }
                }}
                className="text-xs text-[#ffd700] hover:text-[#ffe44c] transition"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}

      {/* Close notification panel on outside click */}
      {showNotificationPanel && (
        <div 
          className="fixed inset-0 z-30"
          onClick={() => setShowNotificationPanel(false)}
        />
      )}

      {/* Hero */}
      <section className="min-h-screen flex items-center justify-center text-center bg-cover bg-center relative" style={{backgroundImage: `url(${studiomic})`}}>
        <div className="bg-black/60 p-8 rounded">
          <h1 className="text-5xl md:text-6xl font-bold mb-5">Sound<br />Your Best</h1>
          <p className="text-[#bbb] mb-8 text-lg md:text-xl">Experience the Music on <a href="#" className="text-[#ffd700] font-bold hover:underline">MixLab Music®</a>, Recording, Rehearsal, and Music Lessons.</p>
          <div className="text-4xl animate-bounce text-white">↓</div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="flex justify-center p-16 bg-[#1b1b1b]">
        <div className="flex flex-col md:flex-row items-center max-w-[1200px] gap-10 bg-[#2a2a2a] p-12 shadow-lg rounded-lg border border-[#ffd700]/30" style={{boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'}}>
          <div className="w-full md:w-1/2">
            <div className="overflow-hidden rounded-lg h-80 relative">
              <div className="flex h-full transition-transform duration-500 ease-in-out" style={{transform: `translateX(-${currentSlide * 100}%)`}}>
                {sliderImages.map((img, i) => (
                  <div key={i} className="min-w-full h-full">
                    <img src={img} alt={`Studio Slide ${i+1}`} className="w-full h-full object-cover"/>
                  </div>
                ))}
              </div>
              {/* Slide indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {sliderImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentSlide ? 'bg-[#ffd700] w-6' : 'bg-white/50'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/2 text-white">
            <h1 className="text-3xl font-bold mb-5">MixLab Music Studio</h1>
            <p className="mb-4 text-[#bbb]">We handle professional-level production for streaming-ready, radio-worthy, and strong tracks! This is **NOT AI-generated**.</p>
            <p className="mb-6 text-[#bbb]">Your song will be produced by real musicians, producers, and arrangers who know how to create the perfect sound.</p>
            <button className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-3 px-6 rounded-lg transition shadow-lg">Discover MixLab</button>
          </div>
        </div>
      </section>

      {/* Services and Features */}
      <section id="services" className="max-w-[1200px] mx-auto p-16">
        {/* Services Grid (Main Services) */}
        <h2 className="text-4xl font-bold text-center mb-10">Our Services</h2>
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Service Card: Music Lessons */}
          <div 
            className="bg-[#2a2a2a] rounded-lg overflow-hidden cursor-pointer hover:bg-[#333] transition border border-[#ffd700]/30" 
            style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}} 
            onClick={() => window.location.href='/user/welcome'}
          >
            <img src={slider1} alt="Music School" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h3 className="text-xl font-semibold mb-2 text-white">Music lessons</h3>
              <p className="text-[#bbb] text-sm">Learn to play, create, and perform. We offer lessons for all ages and skill levels in instruments, vocals, songwriting, and music theory.</p>
            </div>
          </div>
          
          {/* Service Card: Recording Studio */}
          <div className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:bg-[#333] transition border border-[#ffd700]/30" style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}}>
            <img src={recording_studio} alt="Recording Studio" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h3 className="text-xl font-semibold mb-2 text-white">Recording Studio</h3>
              <p className="text-[#bbb] text-sm">Professional multi-track recording for bands, solo artists, and podcasters. Enjoy a creative space with high-end gear, fast turnaround, and optional analog warmth through tape emulation.</p>
            </div>
          </div>
          
          {/* Service Card: Band Rehearsal */}
          <div className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:bg-[#333] transition border border-[#ffd700]/30" style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}}>
            <img src={slider5} alt="Band Rehearsal Studio" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h3 className="text-xl font-semibold mb-2 text-white">Band Rehearsal</h3>
              <p className="text-[#bbb] text-sm">Fully equipped rehearsal rooms for bands and solo performers. Experience high-quality sound, comfortable acoustics, and reliable gear to make every practice session productive and inspiring.</p>
            </div>
          </div>
        </div>

        {/* Studio Features */}
        <h2 id="features" className="text-4xl font-bold text-center mt-20 mb-10">Studio Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Feature Card: Live Room */}
          <div className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:bg-[#333] transition border border-[#ffd700]/30" style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}}>
            <img src={slider4} alt="Live Room" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h4 className="text-xl font-semibold mb-2 text-white">Live Room</h4>
              <p className="text-[#bbb] text-sm">Spacious acoustic-treated live room with drum riser for optimal sound capture.</p>
            </div>
          </div>
          
          {/* Feature Card: Control Room */}
          <div className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:bg-[#333] transition border border-[#ffd700]/30" style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}}>
            <img src={music_production} alt="Control Room" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h4 className="text-xl font-semibold mb-2 text-white">Control Room</h4>
              <p className="text-[#bbb] text-sm">Industry monitors, high-quality preamps, and 24-track I/O for professional mixing and mastering.</p>
            </div>
          </div>
          
          {/* Feature Card: Mini Hall / Dance Studio */}
          <div className="bg-[#2a2a2a] rounded-lg overflow-hidden hover:bg-[#333] transition border border-[#ffd700]/30" style={{boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)'}}>
            <img src={slider2} alt="Dance Studio / Mini-Hall" className="h-52 w-full object-cover"/>
            <div className="p-5">
              <h4 className="text-xl font-semibold mb-2 text-white">Mini Hall / Dance Studio</h4>
              <p className="text-[#bbb] text-sm">Spacious and well-lit area ideal for dance classes, workshops, or small performances. Equipped with mirrors, sound system, and flexible lighting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section bg-[#1b1b1b] p-16 text-center">
        <div className="container mx-auto max-w-[900px]">
          <h2 className="text-4xl font-bold mb-4 text-white">What Our Clients Say</h2>
          <p className="text-[#bbb] mb-10">Don't just take our word for it — hear from our satisfied customers</p>

          <div className="testimonial-card bg-[#2a2a2a] p-10 rounded-lg relative border border-[#ffd700]/30 shadow-lg">
            <div className="text-[#ffd700] text-6xl mb-3">"</div>

            <div className="stars flex justify-center gap-1 mb-4">
              {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                <span key={i} className="text-[#ffd700] text-2xl">★</span>
              ))}
            </div>

            <p className="testimonial-content text-[#ddd] text-lg italic my-5">
              {testimonials[currentTestimonial].content}
            </p>

            <div className="author mt-4">
              <h4 className="text-[#ffd700] text-xl font-semibold">
                {testimonials[currentTestimonial].name}
              </h4>
            </div>

            <button 
              onClick={handlePrevTestimonial}
              className="testimonial-nav left absolute left-5 top-1/2 transform -translate-y-1/2 text-3xl text-white hover:text-[#ffd700] transition"
              aria-label="Previous testimonial"
            >
              ❮
            </button>
            <button 
              onClick={handleNextTestimonial}
              className="testimonial-nav right absolute right-5 top-1/2 transform -translate-y-1/2 text-3xl text-white hover:text-[#ffd700] transition"
              aria-label="Next testimonial"
            >
              ❯
            </button>
          </div>

          <div className="testimonial-dots flex justify-center gap-2 mt-5">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`w-3 h-3 rounded-full transition-all ${
                  i === currentTestimonial ? 'bg-[#ffd700] w-8' : 'bg-white/30'
                }`}
                aria-label="Go to testimonial"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="bg-[#1b1b1b] p-8 md:p-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-10">Gallery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-[1200px] mx-auto">
          {galleryImages.map((img,i) => (
            <img key={i} src={img} alt={`Studio ${i+1}`} className="rounded-lg h-48 md:h-64 w-full object-cover hover:scale-105 transition"/>
          ))}
        </div>
      </section>

      {/* Booking CTA - Mini-Form with Validation */}
      <aside className="max-w-lg mx-auto my-20 p-10 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#ffd700]/30" style={{boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'}}>
        <h2 className="text-3xl font-bold text-[#ffd700] mb-6 text-center">Book a Session</h2>
        
        {miniFormError && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">
            {miniFormError}
          </div>
        )}

        <div className="flex flex-col gap-5">
          {/* Step 1: Full Name */}
          <div>
            <label className="text-sm font-semibold text-gray-200 block mb-2">Your Full Name *</label>
            <input 
              type="text" 
              name="name"
              placeholder="Your Full Name" 
              value={miniBooking.name}
              onChange={handleMiniInputChange}
              className="w-full p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white placeholder-[#666] focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
            />
          </div>

          {/* Step 2: Service Type */}
          <div>
            <label className="text-sm font-semibold text-gray-200 block mb-2">Service Type *</label>
            <select 
              value={miniBooking.service}
              onChange={(e) => handleMiniServiceChange(e.target.value)}
              className="w-full p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none cursor-pointer"
            >
              <option value="">Select a service...</option>
              <option value="music_lesson">Music Lessons</option>
              <option value="recording">Recording</option>
              <option value="mixing">Mixing</option>
              <option value="band_rehearsal">Band Rehearsal</option>
              <option value="production">Production</option>
            </select>
          </div>

          {/* Step 3: Duration Selection */}
          {miniBooking.service && (
            <div>
              {SERVICE_CONFIG[miniBooking.service]?.durationFixed ? (
                <>
                  <label className="text-sm font-semibold text-gray-200 block mb-2">Duration</label>
                  <div className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-300 text-sm">
                    1 hour (automatically set for Music Lessons)
                  </div>
                </>
              ) : (
                <>
                  <label className="text-sm font-semibold text-gray-200 block mb-2">Duration *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.minutes}
                        type="button"
                        onClick={() => handleMiniDurationChange(option.minutes.toString())}
                        className={`p-3 rounded border-2 transition font-medium text-sm
                          ${miniBooking.duration === option.minutes.toString()
                            ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                            : 'border-[#3d3d3d] bg-[#1c1c1c] text-gray-300 hover:border-[#ffd700]'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Date Selection */}
          {miniBooking.service && miniBooking.duration && (
            <div>
              <label className="text-sm font-semibold text-gray-200 block mb-2">Booking Date *</label>
              <input 
                type="date" 
                min={today}
                value={miniBooking.date}
                onChange={(e) => handleMiniDateChange(e.target.value)}
                className="w-full p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
              />
            </div>
          )}

          {/* Step 5: Time Slot Selection */}
          {canShowMiniTimeSlots && (
            <div>
              <label className="text-sm font-semibold text-gray-200 block mb-2">Time Slot *</label>
              
              {miniSlotsLoading && (
                <div className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-300 text-sm">
                  Loading available slots...
                </div>
              )}

              {miniSlotsError && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {miniSlotsError}
                </div>
              )}

              {!miniSlotsLoading && miniAvailableSlots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {miniAvailableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleMiniTimeSlotChange(slot)}
                      className={`p-2 rounded border-2 transition font-medium text-xs
                        ${miniBooking.timeSlot === slot.display
                          ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                          : 'border-[#3d3d3d] bg-[#1c1c1c] text-gray-300 hover:border-[#ffd700]'
                        }
                      `}
                    >
                      {slot.display}
                    </button>
                  ))}
                </div>
              )}

              {!miniSlotsLoading && miniAvailableSlots.length === 0 && !miniSlotsError && (
                <div className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-400 text-sm">
                  No available time slots for this date
                </div>
              )}
            </div>
          )}
          
          {/* Button with Validation */}
          <button 
            type="button" 
            onClick={handleRequestBooking}
            disabled={!miniBooking.name || !miniBooking.service || !miniBooking.duration || !miniBooking.date || !miniBooking.timeSlot}
            className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-3 rounded-full transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request Booking
          </button>
        </div>
      </aside>

      {/* Contact */}
      <section id="contact" className="bg-[#1b1b1b] p-8 md:p-16">
        <div className="max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-[#ffd700] mb-6 text-center">Get in Touch</h2>
          
          {contactFormSuccess && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-500 text-green-300 rounded-lg text-center">
              ✅ Thank you! Your message has been sent successfully. We'll get back to you soon!
            </div>
          )}

          {contactFormError && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center">
              ❌ {contactFormError}
            </div>
          )}

          <form onSubmit={handleContactFormSubmit} className="flex flex-col gap-4">
            <input 
              type="text" 
              name="name"
              placeholder="Name" 
              value={contactForm.name}
              onChange={handleContactFormChange}
              className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white placeholder-[#666] focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
            />
            <input 
              type="email" 
              name="email"
              placeholder="Email" 
              value={contactForm.email}
              onChange={handleContactFormChange}
              className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white placeholder-[#666] focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
            />
            <textarea 
              rows={4} 
              name="message"
              placeholder="Message" 
              value={contactForm.message}
              onChange={handleContactFormChange}
              className="p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white placeholder-[#666] focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none"
            />
            <button 
              type="submit" 
              className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-3 rounded-full transition shadow-lg"
            >
              Send
            </button>
          </form>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-[1200px] mx-auto text-center text-[#bbb]">
          <div>
            <h4 className="text-[#ffd700] font-semibold mb-2">Studio Address</h4>
            <p>4th Floor Unit 401 RCJ Building Ortigas Extension Countryside Ave. Pasig City, Philippines</p>
          </div>
          <div>
            <h4 className="text-[#ffd700] font-semibold mb-2">Contact Us</h4>
            <p><a href="mailto:mixlabmusicstudios@gmail.com" className="text-[#ffd700] hover:underline">mixlabmusicstudios@gmail.com</a><br/>
            <a href="tel:+639665469046" className="text-[#ffd700] hover:underline">0966 546 9046</a></p>
          </div>
          <div>
            <h4 className="text-[#ffd700] font-semibold mb-2">Music Studio Operation</h4>
            <p>Monday – Saturday: 10am – 7pm<br/>Sunday: Closed</p>
          </div>
        </div>
      </section>

      {/* Footer (Icons using Fa components) */}
      <footer className="bg-[#1b1b1b] text-[#bbb] p-8 text-center border-t border-[#444]">
        <p>MixLab Studio</p>
        <p>Professional Music Studio in Pasig</p>
        <div className="flex justify-center gap-5 mt-3 text-2xl">
          <a href="https://www.instagram.com/mixlabmusicstudios.ph" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition">
            <FaInstagram />
          </a>
          <a href="https://web.facebook.com/mixlabmusicstudios" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition">
            <FaFacebook />
          </a>
          <a href="https://tiktok.com/@mixlabmusicstudios" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition">
            <FaTiktok />
          </a>
        </div>
      </footer>

      {/* Booking Details Modal */}
      {showBookingModal && bookingDetails && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 z-40" 
          />
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-[#232323] rounded-2xl p-8 w-full max-w-md relative overflow-y-auto max-h-[90vh]" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>

              {/* Header */}
              <div className="text-center mb-6 pb-6 border-b border-[#3d3d3d]">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1b1b1b] mb-4">
                  <span className="text-4xl" style={{ color: '#ffd700' }}>✓</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h2>
                <p className="text-[#bbb]">Your studio session has been successfully booked</p>
              </div>

              {/* Content Layout */}
              <div className="space-y-4">
                {/* Booking Reference */}
                <div className="text-[#ffd700] font-mono text-sm bg-[#1b1b1b] px-3 py-2 rounded-lg inline-block mx-auto">
                  Booking Reference: {bookingDetails.booking_reference || bookingDetails.booking_id}
                </div>

                {/* Optional email line */}
                {bookingDetails.email && (
                  <p className="text-xs text-[#aaa] text-center">
                    A confirmation email has been sent to {bookingDetails.email}.
                  </p>
                )}
              </div>

              {/* Single Action Button */}
              <button
                onClick={() => {
                  const id = bookingDetails.booking_id;
                  if (id) {
                    window.location.href = `/booking/${id}`;
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="mt-8 w-full bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-3 rounded-lg transition text-lg"
              >
                View Booking Details
              </button>
            </div>
          </div>
        </>
      )}

      {/* Time Slot Modal */}
      {showTimeModal && miniBooking.service && (
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
              <h3 className="text-2xl font-bold text-[#ffd700] mb-6">Available Time Slots</h3>
              <p className="text-[#bbb] mb-6">Select a time slot for {miniBooking.service === 'vocal' ? 'Vocal Recording' : miniBooking.service === 'band' ? 'Band Recording' : miniBooking.service === 'podcast' ? 'Podcast' : 'Mixing & Mastering'}</p>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                {getAvailableTimeSlots(miniBooking.service).map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`p-3 rounded-lg font-semibold transition border-2 ${
                      miniBooking.time === time
                        ? 'bg-[#ffd700] text-black border-[#ffd700]'
                        : 'bg-[#1b1b1b] text-white border-[#3d3d3d] hover:border-[#ffd700]'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowTimeModal(false)}
                className="w-full mt-6 bg-[#ffd700] text-black font-bold py-2 rounded-lg hover:bg-[#ffe44c] transition"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Export all images
export {
  gallery1,
  gallery2,
  gallery3,
  gallery4,
  hero_bg,
  logo,
  music_production,
  recording_studio,
  slider1,
  slider2,
  slider3,
  slider4,
  slider5,
  studiomic,
}