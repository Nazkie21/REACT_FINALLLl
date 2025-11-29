import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { FaInstagram, FaFacebook, FaTiktok, FaBell } from "react-icons/fa";
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import useRealtimeNotifications from '../hooks/useRealtimeNotifications';
import LoginModal from '../components/LoginModal';

import {
  hero_bg,
  logo,
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
  const [heroSlideIndex, setHeroSlideIndex] = useState(0)
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

  // Login modal state for non-authenticated users
  const [showLoginModal, setShowLoginModal] = useState(false)
  const loginButtonRef = useRef(null)

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

  // Hero carousel auto-slide effect
  useEffect(() => {
    const heroImages = [slider1, slider2, slider3, slider4, slider5];
    const interval = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const heroCarouselImages = [slider1, slider2, slider3, slider4, slider5];

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
        <div className="w-full flex items-center px-3 sm:px-4 md:px-6 py-2 relative gap-2 sm:gap-3">
          {/* Logo - Far Left */}
          <a href="/" className="flex items-center z-10 flex-shrink-0">
            <img src={logo} alt="MixLab Logo" className="h-14 sm:h-16 md:h-20 transition-transform hover:scale-105 w-auto"/>
          </a>

          {/* Navigation - Absolutely Centered - Hidden on mobile */}
          <nav className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2">
            <ul className="flex items-center gap-2 xl:gap-5 text-sm xl:text-base">
              <li><a href="/about" className="px-2 xl:px-3 py-2 rounded hover:bg-white/5 transition">About</a></li>
              <li className="relative group">
                <a href="/services" className="px-2 xl:px-3 py-2 rounded hover:bg-white/5 transition whitespace-nowrap">Services & Features</a>
                <ul className="absolute left-1/2 -translate-x-1/2 mt-2 bg-[#2a2a2a] rounded-lg hidden group-hover:flex flex-col min-w-[180px] xl:min-w-[200px] shadow-lg gap-2 p-2">
                  <li><a href="/music-lessons" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Music Lessons</a></li>
                  <li><a href="/band-rehearsal" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Band Rehearsal</a></li>
                  <li><a href="/recording" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Recording</a></li>
                  <li><a href="/live-room" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Live Room</a></li>
                  <li><a href="/control-room" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Control Room</a></li>
                  <li><a href="/main-hall" className="px-4 py-2 text-sm xl:text-base hover:bg-[#1b1b1b] rounded transition">Main Hall</a></li>
                </ul>
              </li>
              <li><a href="/gallery" className="px-2 xl:px-3 py-2 rounded hover:bg-white/5 transition">Gallery</a></li>
              <li><a href="/contact" className="px-2 xl:px-3 py-2 rounded hover:bg-white/5 transition">Contact Us</a></li>
              <li><a href="/Reservations" className="px-2 xl:px-3 py-2 rounded hover:bg-white/5 transition whitespace-nowrap">Reservation</a></li>
            </ul>
          </nav>

          {/* User Actions - Far Right */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-4 z-10 relative flex-shrink-0 ml-auto">
            {user && (
              <button 
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="flex items-center justify-center w-9 h-9 xl:w-10 xl:h-10 text-[#ffd700] hover:text-[#ffe44c] transition p-0 relative rounded-lg hover:bg-white/5" 
                title="Notifications" 
                aria-label="Notifications"
              >
                <FaBell className="text-lg xl:text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            {user ? (
              <a href="/Profile" className="flex items-center p-1.5 xl:p-2 rounded-full hover:bg-[#ffd700]/10 transition group" title={`Go to profile - ${displayName(user)}`}>
                {/* Profile Avatar - Independent Element */}
                <span className="bg-[#ffd700] text-black w-9 h-9 xl:w-10 xl:h-10 rounded-full flex items-center justify-center uppercase font-semibold text-sm xl:text-base group-hover:shadow-[0_0_12px_#ffd700]">
                  {displayName(user)?.charAt(0) || 'U'}
                </span>
              </a>
            ) : (
              <button ref={loginButtonRef} onClick={() => setShowLoginModal(!showLoginModal)} className="px-3 xl:px-4 py-2 bg-[#ffd700] hover:bg-[#ffe44c] text-black rounded-lg transition font-semibold shadow-lg text-sm xl:text-base">Log in</button>
            )}
          </div>

          {/* Mobile Icons */}
          <div className="lg:hidden flex items-center gap-2 z-20 ml-auto">
            {user && (
              <button 
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 text-[#ffd700] hover:text-[#ffe44c] transition p-0 relative rounded-lg hover:bg-white/5" 
                title="Notifications" 
                aria-label="Notifications"
              >
                <FaBell className="text-lg sm:text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            <button className="text-[#ffd700] text-xl sm:text-2xl p-2 rounded-lg hover:bg-white/5 transition" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>☰</button>
          </div>
          
          {/* Mobile Nav Drawer */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/60 z-40 transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Drawer */}
              <div className="fixed top-0 right-0 h-full w-[85vw] max-w-xs sm:w-80 bg-[#1b1b1b] z-50 shadow-2xl flex flex-col animate-slideIn">
                {/* Drawer Header */}
                <div className="flex justify-between items-center p-3 sm:p-4 border-b border-[#ffd700]/30">
                  <img src={logo} alt="MixLab Logo" className="h-10 sm:h-12 w-auto" />
                  <button 
                    className="text-[#ffd700] text-2xl sm:text-3xl hover:text-white transition p-2 rounded-lg hover:bg-white/5" 
                    aria-label="Close menu" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    &times;
                  </button>
                </div>
                
                {/* Navigation Links */}
                <nav className="flex-1 flex flex-col py-3 sm:py-4 overflow-y-auto">
                  <a 
                    href="/about" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>About</span>
                  </a>
                  <a 
                    href="/services" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Services & Features</span>
                  </a>
                  <a 
                    href="/music-lessons" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Music Lessons</span>
                  </a>
                  <a 
                    href="/band-rehearsal" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Band Rehearsal</span>
                  </a>
                  <a 
                    href="/recording" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Recording</span>
                  </a>
                  <a 
                    href="/live-room" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Live Room</span>
                  </a>
                  <a 
                    href="/control-room" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Control Room</span>
                  </a>
                  <a 
                    href="/main-hall" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base pl-6 sm:pl-10" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Main Hall</span>
                  </a>
                  <a 
                    href="/gallery" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Gallery</span>
                  </a>
                  <a 
                    href="/contact" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 text-white hover:bg-white/5 transition text-sm sm:text-base" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Contact Us</span>
                  </a>
                  <a 
                    href="/Reservations" 
                    className="flex items-center px-4 sm:px-6 py-3 sm:py-4 font-semibold hover:bg-white/5 transition text-sm sm:text-base" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Reservation</span>
                  </a>
                  
                  {/* Divider */}
                  <div className="border-t border-[#ffd700]/30 my-3 sm:my-4" />
                  
                  {/* User Section */}
                  <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-2 sm:gap-3">
                    {user ? (
                      <a 
                        href="/Profile" 
                        className="flex items-center gap-3 p-2 sm:p-3 border border-[#ffd700] rounded-lg hover:bg-[#ffd700] hover:text-black transition group text-sm sm:text-base" 
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="bg-[#ffd700] text-black w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center uppercase font-semibold text-xs sm:text-sm">{displayName(user)?.charAt(0) || 'U'}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold truncate">{displayName(user) || 'User'}</span>
                          <span className="text-xs opacity-75">Student</span>
                        </div>
                      </a>
                    ) : (
                      <button
                        onClick={() => {
                          setShowLoginModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="block text-center w-full px-4 py-3 bg-[#ffd700] text-black font-semibold rounded-lg hover:bg-[#ffe44c] transition shadow-lg text-sm sm:text-base"
                      >
                        Log in
                      </button>
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
        <div className="fixed top-16 sm:top-20 right-3 sm:right-4 w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 max-h-96 bg-[#2a2a2a] rounded-lg shadow-2xl border border-[#ffd700]/30 z-40 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#1b1b1b] px-3 sm:px-4 py-3 border-b border-[#ffd700]/30 flex justify-between items-center">
            <h3 className="text-white font-bold text-sm sm:text-base">Notifications</h3>
            <button 
              onClick={() => setShowNotificationPanel(false)}
              className="text-[#bbb] hover:text-white transition text-lg sm:text-xl"
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
                  className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 border-b border-[#1a1a1a] hover:bg-[#333] transition ${
                    !notif.read_status ? 'bg-[#1a1a1a]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {notif.type === 'booking_confirmation' ? (
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                      ) : notif.type?.includes('reminder') ? (
                        <Clock size={16} className="text-blue-500 flex-shrink-0" />
                      ) : notif.type === 'booking_cancelled' ? (
                        <XCircle size={16} className="text-red-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-yellow-500 flex-shrink-0" />
                      )}
                      <h4 className={`text-xs sm:text-sm font-bold truncate ${notif.read_status ? 'text-[#bbb]' : 'text-[#ffd700]'}`}>
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
              <div className="px-3 sm:px-4 py-8 text-center text-[#666]">
                <p className="text-xs sm:text-sm">No notifications yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="bg-[#1b1b1b] px-3 sm:px-4 py-2 border-t border-[#ffd700]/30">
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
      <section className="min-h-screen flex items-center justify-center text-center relative overflow-hidden">
        {/* Background Carousel */}
        <div className="absolute inset-0">
          {heroCarouselImages.map((img, index) => (
            <div
              key={index}
              className="absolute inset-0 transition-opacity duration-1000"
              style={{
                backgroundImage: `url(${img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: heroSlideIndex === index ? 1 : 0
              }}
            />
          ))}
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* Content */}
        <div className="relative z-10 bg-black/40 p-4 sm:p-6 md:p-8 rounded-lg mx-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-5 leading-tight">Sound<br />Your Best</h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-[#bbb] mb-6 sm:mb-8 max-w-2xl mx-auto">Experience the Music on <a href="#" className="text-[#ffd700] font-bold hover:underline">MixLab Music®</a>, Recording, Rehearsal, and Music Lessons.</p>
          <div className="text-3xl sm:text-4xl animate-bounce text-white">↓</div>
        </div>
      </section>



      {/* Testimonials */}
      <section className="testimonials-section bg-[#1b1b1b] py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-8 text-center">
        <div className="container mx-auto max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white">What Our Clients Say</h2>
          <p className="text-xs sm:text-sm md:text-base text-[#bbb] mb-8 sm:mb-10">Don't just take our word for it — hear from our satisfied customers</p>

          <div className="testimonial-card bg-[#2a2a2a] p-6 sm:p-8 md:p-10 rounded-lg relative border border-[#ffd700]/30 shadow-lg">
            <div className="text-[#ffd700] text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3">"</div>

            <div className="stars flex justify-center gap-1 mb-3 sm:mb-4">
              {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                <span key={i} className="text-[#ffd700] text-lg sm:text-xl md:text-2xl">★</span>
              ))}
            </div>

            <p className="testimonial-content text-xs sm:text-sm md:text-base lg:text-lg text-[#ddd] italic my-4 sm:my-5 leading-relaxed">
              {testimonials[currentTestimonial].content}
            </p>

            <div className="author mt-3 sm:mt-4">
              <h4 className="text-[#ffd700] text-base sm:text-lg md:text-xl font-semibold">
                {testimonials[currentTestimonial].name}
              </h4>
            </div>

            {/* Navigation Buttons - Hidden on mobile, shown on larger screens */}
            <button 
              onClick={handlePrevTestimonial}
              className="hidden sm:block testimonial-nav left absolute left-3 md:left-5 top-1/2 transform -translate-y-1/2 text-2xl md:text-3xl text-white hover:text-[#ffd700] transition rounded-lg hover:bg-white/5 p-2"
              aria-label="Previous testimonial"
            >
              ❮
            </button>
            <button 
              onClick={handleNextTestimonial}
              className="hidden sm:block testimonial-nav right absolute right-3 md:right-5 top-1/2 transform -translate-y-1/2 text-2xl md:text-3xl text-white hover:text-[#ffd700] transition rounded-lg hover:bg-white/5 p-2"
              aria-label="Next testimonial"
            >
              ❯
            </button>
          </div>

          <div className="testimonial-dots flex justify-center gap-2 mt-6 sm:mt-7 md:mt-8 flex-wrap">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${
                  i === currentTestimonial ? 'bg-[#ffd700] w-6 sm:w-8' : 'bg-white/30'
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>

          {/* Mobile Navigation Text */}
          <div className="sm:hidden flex justify-center gap-3 mt-6">
            <button 
              onClick={handlePrevTestimonial}
              className="px-3 py-2 text-sm text-white bg-[#ffd700]/20 hover:bg-[#ffd700]/30 border border-[#ffd700]/50 rounded transition"
              aria-label="Previous testimonial"
            >
              ← Previous
            </button>
            <button 
              onClick={handleNextTestimonial}
              className="px-3 py-2 text-sm text-white bg-[#ffd700]/20 hover:bg-[#ffd700]/30 border border-[#ffd700]/50 rounded transition"
              aria-label="Next testimonial"
            >
              Next →
            </button>
          </div>
        </div>
      </section>

      {/* Booking CTA - Mini-Form with Validation */}
      <aside className="w-full max-w-lg mx-auto my-10 sm:my-16 md:my-20 px-4 sm:px-6 md:px-0">
        <div className="p-6 sm:p-8 md:p-10 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#ffd700]/30" style={{boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'}}>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#ffd700] mb-4 sm:mb-6 text-center">Book a Session</h2>
          
          {miniFormError && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-xs sm:text-sm text-center">
              {miniFormError}
            </div>
          )}

          <form className="flex flex-col gap-4 sm:gap-5">
            {/* Step 1: Full Name */}
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Your Full Name *</label>
              <input 
                type="text" 
                name="name"
                placeholder="Your Full Name" 
                value={miniBooking.name}
                onChange={handleMiniInputChange}
                className="w-full p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white text-sm placeholder-[#666] focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none transition"
              />
            </div>

            {/* Step 2: Service Type */}
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Service Type *</label>
              <select 
                value={miniBooking.service}
                onChange={(e) => handleMiniServiceChange(e.target.value)}
                className="w-full p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white text-sm focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none cursor-pointer transition"
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
                    <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Duration</label>
                    <div className="p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-300 text-xs sm:text-sm">
                      1 hour (automatically set for Music Lessons)
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Duration *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DURATION_OPTIONS.map((option) => (
                        <button
                          key={option.minutes}
                          type="button"
                          onClick={() => handleMiniDurationChange(option.minutes.toString())}
                          className={`p-2 sm:p-3 rounded border-2 transition font-medium text-xs sm:text-sm
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
                <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Booking Date *</label>
                <input 
                  type="date" 
                  min={today}
                  value={miniBooking.date}
                  onChange={(e) => handleMiniDateChange(e.target.value)}
                  className="w-full p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-white text-sm focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700] outline-none transition"
                />
              </div>
            )}

            {/* Step 5: Time Slot Selection */}
            {canShowMiniTimeSlots && (
              <div>
                <label className="text-xs sm:text-sm font-semibold text-gray-200 block mb-2">Time Slot *</label>
                
                {miniSlotsLoading && (
                  <div className="p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-300 text-xs sm:text-sm">
                    Loading available slots...
                  </div>
                )}

                {miniSlotsError && (
                  <div className="p-2.5 sm:p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm">
                    {miniSlotsError}
                  </div>
                )}

                {!miniSlotsLoading && miniAvailableSlots.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
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
                  <div className="p-2.5 sm:p-3 rounded bg-[#1c1c1c] border border-[#3d3d3d] text-gray-400 text-xs sm:text-sm">
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
              className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-2.5 sm:py-3 rounded-full transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Request Booking
            </button>
          </form>
        </div>
      </aside>

      {/* Footer (Icons using Fa components) */}
      <footer className="bg-[#1b1b1b] text-[#bbb] py-8 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8 text-center border-t border-[#444]">
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2">MixLab Studio</h3>
        <p className="text-xs sm:text-sm md:text-base">Professional Music Studio in Pasig</p>
        <div className="flex justify-center gap-4 sm:gap-5 md:gap-6 mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl">
          <a href="https://www.instagram.com/mixlabmusicstudios.ph" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition p-2 rounded-lg hover:bg-white/5">
            <FaInstagram aria-label="Instagram" />
          </a>
          <a href="https://web.facebook.com/mixlabmusicstudios" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition p-2 rounded-lg hover:bg-white/5">
            <FaFacebook aria-label="Facebook" />
          </a>
          <a href="https://tiktok.com/@mixlabmusicstudios" target="_blank" rel="noopener noreferrer" className="hover:text-[#ffd700] transition p-2 rounded-lg hover:bg-white/5">
            <FaTiktok aria-label="TikTok" />
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
            <div className="bg-[#232323] rounded-2xl p-6 sm:p-8 w-full max-w-sm relative overflow-y-auto max-h-[90vh]" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>

              {/* Header */}
              <div className="text-center mb-5 sm:mb-6 pb-5 sm:pb-6 border-b border-[#3d3d3d]">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#1b1b1b] mb-3 sm:mb-4">
                  <span className="text-2xl sm:text-4xl" style={{ color: '#ffd700' }}>✓</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Booking Confirmed!</h2>
                <p className="text-xs sm:text-sm text-[#bbb]">Your studio session has been successfully booked</p>
              </div>

              {/* Content Layout */}
              <div className="space-y-3 sm:space-y-4">
                {/* Booking Reference */}
                <div className="text-[#ffd700] font-mono text-xs sm:text-sm bg-[#1b1b1b] px-3 py-2 rounded-lg w-fit mx-auto">
                  Booking Reference: {bookingDetails.booking_reference || bookingDetails.booking_id}
                </div>

                {/* Optional email line */}
                {bookingDetails.email && (
                  <p className="text-xs text-[#aaa] text-center break-all">
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
                className="mt-6 sm:mt-8 w-full bg-[#ffd700] hover:bg-[#ffe44c] text-black font-semibold py-2.5 sm:py-3 rounded-lg transition text-sm sm:text-base"
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
            <div className="bg-[#232323] rounded-2xl p-6 sm:p-8 w-full max-w-lg sm:max-w-2xl relative" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
              {/* Close Button */}
              <button
                onClick={() => setShowTimeModal(false)}
                className="absolute top-3 sm:top-4 right-3 sm:right-4 text-[#bbb] hover:text-[#ffd700] text-xl sm:text-2xl transition rounded-lg hover:bg-white/5 p-2"
                aria-label="Close"
              >
                ×
              </button>

              {/* Modal Header */}
              <h3 className="text-xl sm:text-2xl font-bold text-[#ffd700] mb-4 sm:mb-6 pr-8">Available Time Slots</h3>
              <p className="text-xs sm:text-sm text-[#bbb] mb-4 sm:mb-6">Select a time slot for {miniBooking.service === 'vocal' ? 'Vocal Recording' : miniBooking.service === 'band' ? 'Band Recording' : miniBooking.service === 'podcast' ? 'Podcast' : 'Mixing & Mastering'}</p>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-96 overflow-y-auto">
                {getAvailableTimeSlots(miniBooking.service).map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`p-2 sm:p-3 rounded-lg font-semibold transition border-2 text-xs sm:text-sm ${
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
                className="w-full mt-5 sm:mt-6 bg-[#ffd700] text-black font-bold py-2.5 sm:py-3 rounded-lg hover:bg-[#ffe44c] transition text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} buttonRef={loginButtonRef.current} />
    </div>
  )
}