import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  BookOpen, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Pen, 
  Trash2, 
  X,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Bell,
  Activity,
  UserCheck,
  Table,
  LayoutList,
  Clock,
  Loader
} from 'lucide-react';
import { formatCurrentDateTime } from '../../utils/timeUtils';
import NotificationDropdown from '../../components/NotificationDropdown';

// Base URL for admin API
const API_BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/admin` : 'http://localhost:5000/api/admin';

const AdminBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [participantCountFilter, setParticipantCountFilter] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewType, setViewType] = useState('table'); // table, calendar, timeline
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  
  // --- New Booking Form State ---
  const [formData, setFormData] = useState({
    service: '',
    duration: '',
    date: '',
    timeSlot: ''
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  
  // --- API Fetch Effect ---
  useEffect(() => {
    fetchBookings();
  }, [currentPage, rowsPerPage, statusFilter, paymentStatusFilter, serviceTypeFilter, instructorFilter, dateRangeStart, dateRangeEnd, searchTerm]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: rowsPerPage,
        ...(statusFilter && { status: statusFilter }),
        ...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
        ...(serviceTypeFilter && { service: serviceTypeFilter }),
        ...(instructorFilter && { instructor: instructorFilter }),
        ...(dateRangeStart && { dateStart: dateRangeStart }),
        ...(dateRangeEnd && { dateEnd: dateRangeEnd }),
        ...(searchTerm && { search: searchTerm }),
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/bookings?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      
      if (data.success) {
        // Transform API response to match frontend expectations - include ALL fields
        const transformedBookings = data.data.bookings.map(booking => ({
          id: booking.booking_id,
          booking_id: booking.booking_reference || `#${booking.booking_id}`,
          client_name: booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Unknown',
          email: booking.customer_email || 'N/A',
          contact: booking.customer_contact || 'N/A',
          service_type: booking.instrument || booking.service_name || 'Unknown',
          sub_type: booking.service_name || 'Standard',
          instructor: booking.instructor_name || 'Unassigned',
          studio: booking.room_location || 'Studio A',
          date: booking.booking_date || 'N/A',
          time_slot: booking.start_time || 'N/A',
          duration: booking.duration_minutes || 60,
          participants: booking.people || 1,
          status: booking.status || 'pending',
          payment_status: booking.payment_status || 'pending',
          equipment: booking.equipment || 'N/A',
          qr_code: booking.qr_code || null,
          created_at: booking.created_at || new Date().toISOString(),
          amount: booking.total_amount || 0,
          // Store full booking object for detail modal
          _full: booking
        }));

        setBookings(transformedBookings);
        setTotalRecords(data.data.pagination.total);
        setTotalPages(data.data.pagination.pages);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };
  
  // Determine active nav based on current route
  const getActiveNav = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/users')) return 'users';
    if (path.includes('/bookings')) return 'bookings';
    if (path.includes('/modules')) return 'modules';
    if (path.includes('/instructors')) return 'instructors';
    if (path.includes('/payments')) return 'payments';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/activity')) return 'activity';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/profile')) return 'profile';
    return 'bookings';
  };
  
  const activeNav = getActiveNav();

  // --- Derived State (Local Filtering) ---
  const filteredBookings = useMemo(() => {
    // Data is already filtered from API, but we can apply local search if needed
    return bookings;
  }, [bookings]);

  // --- Pagination Logic ---
  const currentData = bookings;

  // --- Helpers ---
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to confirm booking');
      
      const data = await response.json();
      if (data.success) {
        alert('Booking confirmed successfully!');
        fetchBookings();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCheckInBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to check in booking');
      
      const data = await response.json();
      if (data.success) {
        alert('Booking checked in successfully!');
        fetchBookings();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCompleteBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem('token');
      const xpAwarded = window.prompt('Enter XP to award (default 100):', '100');
      
      if (xpAwarded === null) return; // User cancelled

      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          xpAwarded: parseInt(xpAwarded) || 100
        })
      });

      if (!response.ok) throw new Error('Failed to complete booking');
      
      const data = await response.json();
      if (data.success) {
        alert(`Booking completed! Student awarded ${data.data.xpAwarded} XP`);
        fetchBookings();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete booking');
      
      const data = await response.json();
      if (data.success) {
        alert('Booking deleted successfully!');
        fetchBookings();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleExport = () => {
    const headers = ['Booking ID', 'Customer', 'Service', 'Date', 'Time', 'Status', 'Payment Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...bookings.map(row => [
        row.booking_id,
        `"${row.client_name}"`,
        `"${row.service_type}"`,
        row.date,
        row.time_slot,
        row.status,
        row.payment_status,
        row.amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bookings_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Booking Form Helpers ---
  
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
    setFormData(prev => ({
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
    setFormData(prev => ({
      ...prev,
      duration,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    // Fetch new slots if service and date are already set
    if (formData.service && formData.date) {
      fetchAvailableSlots(formData.service, duration, formData.date);
    }
  };

  // Handle date change
  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      date,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    // Fetch new slots if service and duration are already set
    if (formData.service && formData.duration) {
      fetchAvailableSlots(formData.service, formData.duration, date);
    }
  };

  // Handle time slot selection
  const handleTimeSlotChange = (slot) => {
    // slot expected shape: { display: '8:00 AM - 9:00 AM', start24: '08:00' }
    setFormData(prev => ({
      ...prev,
      timeSlot: slot.display,
      startTime24: slot.start24
    }));
  };

  // Check if all prerequisites are met for time slot dropdown
  const canShowTimeSlots = formData.service && formData.duration && formData.date;

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  // --- Render Components ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a2a] to-[#1b1b1b] text-white font-sans overflow-x-hidden">
      
      {/* Sidebar Overlay (Mobile) */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 z-50 h-screen bg-[#2c2c3a] text-white transition-all duration-300 ease-in-out flex flex-col gap-4 py-6 px-4 overflow-y-auto
        ${isSidebarCollapsed ? 'w-[66px] px-2' : 'w-[250px]'} 
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Profile Section */}
        <div className={`flex items-center gap-3 pb-3 border-b border-[#444] ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <div 
            className="w-11 h-11 rounded-full bg-[#ffb400] flex items-center justify-center text-[#1b1b1b] font-bold shrink-0 cursor-pointer hover:opacity-90 transition"
            onClick={() => navigate('/admin/profile')}
          >
            AD
          </div>
          {!isSidebarCollapsed && (
            <div className="transition-opacity duration-300">
              <div className="font-bold text-sm text-white">Admin User</div>
              <div className="text-xs text-[#bbb]">Administrator</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 mt-2">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard', path: '/admin/dashboard' },
            { icon: Users, label: 'Users', id: 'users', path: '/admin/users' },
            { icon: Calendar, label: 'Bookings', id: 'bookings', path: '/admin/bookings' },
            { icon: BookOpen, label: 'Modules & Lessons', id: 'modules', path: '/admin/modules' },
            { icon: UserCheck, label: 'Instructors', id: 'instructors', path: '/admin/instructors' },
            { icon: CreditCard, label: 'Payments', id: 'payments', path: '/admin/payments' },
            { icon: Bell, label: 'Notifications', id: 'notifications', path: '/admin/notifications' },
            { icon: Activity, label: 'Activity Logs', id: 'activity', path: '/admin/activity' },
            { icon: FileText, label: 'Reports', id: 'reports', path: '/admin/reports' },
            { icon: Settings, label: 'Settings', id: 'profile', path: '/admin/profile' },
          ].map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth <= 768) setIsMobileSidebarOpen(false);
                }}
                className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-200
                  ${isActive ? 'bg-[#1b1b1b] text-[#bfa45b] font-semibold' : 'hover:bg-[#23233a]'}
                  ${isSidebarCollapsed ? 'justify-center px-1' : ''}
                `}
              >
                <item.icon size={20} className={`shrink-0 text-[#bfa45b]`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button 
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/auth/login');
            }
          }}
          className={`mt-auto flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-200 hover:bg-red-600 hover:text-white group
            ${isSidebarCollapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut size={20} className="shrink-0 group-hover:text-white text-[#bfa45b]" />
          {!isSidebarCollapsed && <span className="text-[#bfa45b]">Logout</span>}
        </button>
      </aside>

      {/* Main Layout Wrapper */}
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-[66px]' : 'md:ml-[250px]'}`}>
        
        {/* Header */}
        <header className={`fixed top-0 right-0 h-16 bg-gradient-to-r from-[#23233a] to-[#1b1b1b] border-b border-[#444] z-30 flex items-center justify-between px-6 shadow-lg transition-all duration-300
          ${isSidebarCollapsed ? 'left-[66px]' : 'left-0 md:left-[250px]'}
        `}>
          <div className="flex items-center gap-4">
            {/* Mobile Toggle */}
            <button 
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="md:hidden text-[#bfa45b] p-1"
            >
              <Menu size={28} />
            </button>
            
            {/* Desktop Collapse Toggle */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex text-[#bfa45b] hover:text-[#ffd700]"
            >
              <Menu size={24} />
            </button>

            <h2 className="text-xl font-semibold text-white">Bookings</h2>
          </div>
          
          {/* Header Middle - Timezone/Time */}
          <div className="hidden md:flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock size={12} />
              <span>{formatCurrentDateTime()}</span>
            </div>
          </div>
          
          {/* Header Right - Add Button and View Toggle */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <NotificationDropdown isAdmin={true} />
            
            <button
              onClick={() => setViewType('table')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                viewType === 'table'
                  ? 'bg-[#bfa45b] text-[#1b1b1b]'
                  : 'bg-[#2a2a2a] border border-[#444] text-gray-300 hover:border-[#bfa45b] hover:text-[#bfa45b]'
              }`}
              title="Table View"
            >
              <Table size={16} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewType('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                viewType === 'calendar'
                  ? 'bg-[#bfa45b] text-[#1b1b1b]'
                  : 'bg-[#2a2a2a] border border-[#444] text-gray-300 hover:border-[#bfa45b] hover:text-[#bfa45b]'
              }`}
              title="Calendar View"
            >
              <Calendar size={16} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewType('timeline')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                viewType === 'timeline'
                  ? 'bg-[#bfa45b] text-[#1b1b1b]'
                  : 'bg-[#2a2a2a] border border-[#444] text-gray-300 hover:border-[#bfa45b] hover:text-[#bfa45b]'
              }`}
              title="Timeline View"
            >
              <LayoutList size={16} />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            
          </div>
        </header>

        {/* Content Area */}
        <main className="mt-16 p-6 min-h-[calc(100vh-64px)]">
          {/* Filters Section */}
          <div className="bg-[#2a2a2a] p-6 rounded-xl shadow-xl border border-[#444] mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Filters</h3>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setServiceTypeFilter('');
                  setInstructorFilter('');
                  setStatusFilter('');
                  setPaymentStatusFilter('');
                  setDateRangeStart('');
                  setDateRangeEnd('');
                  setParticipantCountFilter('');
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-sm rounded-lg border border-[#bfa45b] text-[#bfa45b] hover:bg-[#bfa45b]/10 transition"
              >
                Clear Filters
              </button>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="flex items-center gap-2 bg-[#1b1b1b] px-3 py-2.5 rounded-lg border border-[#444] focus-within:border-[#bfa45b]">
                <Search size={16} className="text-[#bfa45b]" />
                <input 
                  type="text" 
                  placeholder="Search by name, ID..." 
                  className="bg-transparent border-none outline-none text-sm flex-1 text-white placeholder:text-gray-500"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              {/* Service Type */}
              <select 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={serviceTypeFilter}
                onChange={(e) => { setServiceTypeFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Service Types</option>
                <option value="Lesson">Lesson</option>
                <option value="Mixing">Mixing</option>
                <option value="Recording">Recording</option>
                <option value="Rehearsal">Rehearsal</option>
                <option value="Production">Production</option>
              </select>

              {/* Instructor */}
              <select 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={instructorFilter}
                onChange={(e) => { setInstructorFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Instructors</option>
                <option value="Michael Smith">Michael Smith</option>
                <option value="Sarah Johnson">Sarah Johnson</option>
                <option value="David Lee">David Lee</option>
                <option value="Emma Davis">Emma Davis</option>
                <option value="Chris Wilson">Chris Wilson</option>
                <option value="Mark Brown">Mark Brown</option>
              </select>

              {/* Status */}
              <select 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Payment Status */}
              <select 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={paymentStatusFilter}
                onChange={(e) => { setPaymentStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>

              {/* Date Range - Start */}
              <input 
                type="date" 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={dateRangeStart}
                onChange={(e) => { setDateRangeStart(e.target.value); setCurrentPage(1); }}
                placeholder="Start Date"
              />

              {/* Date Range - End */}
              <input 
                type="date" 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={dateRangeEnd}
                onChange={(e) => { setDateRangeEnd(e.target.value); setCurrentPage(1); }}
                placeholder="End Date"
              />

              {/* Participant Count */}
              <select 
                className="px-3 py-2.5 rounded-lg border border-[#444] bg-[#1b1b1b] text-white text-sm outline-none cursor-pointer focus:border-[#bfa45b]"
                value={participantCountFilter}
                onChange={(e) => { setParticipantCountFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Participants</option>
                <option value="1">1 Participant</option>
                <option value="2">2 Participants</option>
                <option value="3">3+ Participants</option>
                <option value="4">4+ Participants</option>
              </select>
            </div>
          </div>

          {/* TABLE VIEW */}
          {viewType === 'table' && (
            <div className="bg-[#2a2a2a] rounded-xl shadow-xl border border-[#444] overflow-x-auto">
              {loading && (
                <div className="p-8 text-center text-gray-400">
                  <Loader className="inline-block animate-spin mr-2" size={20} />
                  Loading bookings...
                </div>
              )}
              {error && (
                <div className="p-8 text-center text-red-400">
                  Error: {error}
                </div>
              )}
              {!loading && !error && (
                <>
                  <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="text-left border-b border-[#444] bg-[#23233a]">
                    <th className="p-3 font-semibold text-[13px] text-white whitespace-nowrap w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer rounded accent-[#bfa45b]"
                      />
                    </th>
                    {['Booking ID', 'Client', 'Service Type', 'Sub-Type', 'Instructor', 'Date', 'Time', 'Duration', 'Participants', 'Status', 'Payment', 'QR Code', 'Created', 'Actions'].map((head) => (
                      <th key={head} className="p-3 font-semibold text-[13px] text-white whitespace-nowrap">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length > 0 ? (
                    filteredBookings.map((booking) => (
                      <tr key={booking.id} onClick={() => { setSelectedBooking(booking); setDetailModalOpen(true); }} className="border-b border-[#444] hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="p-3 text-sm text-white">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer rounded accent-[#bfa45b]"
                          />
                        </td>
                        <td className="p-3 text-sm font-mono text-[#bfa45b]">{booking.booking_id}</td>
                        <td className="p-3 text-sm font-medium text-white">{booking.client_name}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.service_type}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.sub_type}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.instructor}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.date || 'N/A'}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.time_slot || 'N/A'}</td>
                        <td className="p-3 text-sm text-gray-300">{booking.duration || 0} min</td>
                        <td className="p-3 text-sm text-gray-300">{booking.participants || 1}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap
                            ${booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : ''}
                            ${booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                            ${booking.status === 'in-progress' ? 'bg-purple-500/20 text-purple-400' : ''}
                            ${booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : ''}
                            ${booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : ''}
                          `}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap
                            ${booking.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : ''}
                            ${booking.payment_status === 'pending' ? 'bg-orange-500/20 text-orange-400' : ''}
                            ${booking.payment_status === 'refunded' ? 'bg-blue-500/20 text-blue-400' : ''}
                          `}>
                            {booking.payment_status}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-[#bfa45b] font-mono">{booking.qr_code ? '✓ QR' : 'No QR'}</td>
                        <td className="p-3 text-xs text-gray-400">{booking.created_at?.substring(0, 10) || 'N/A'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSelectedBooking(booking); setIsModalOpen(true); }} className="p-1.5 rounded-md bg-[#1b1b1b] hover:bg-[#bfa45b]/20 text-[#bfa45b] transition" title="Edit">
                              <Pen size={14} />
                            </button>
                            <button onClick={() => handleDeleteBooking(booking.id)} className="p-1.5 rounded-md bg-[#1b1b1b] hover:bg-red-500/20 text-red-500 transition" title="Delete">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-[#bbb]">No bookings found.</td>
                    </tr>
                  )}
                </tbody>
                </table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-[#444] gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  Show 
                  <select 
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-[#1b1b1b] border border-[#444] rounded px-2 py-1 text-white outline-none focus:border-[#ffb400]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                  entries out of {totalRecords} total
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-[#444] rounded-md bg-[#1b1b1b] text-white text-sm disabled:opacity-50 hover:border-[#bfa45b] transition flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                    disabled={currentPage >= totalPages || totalPages === 0}
                    className="px-3 py-1.5 border border-[#444] rounded-md bg-[#1b1b1b] text-white text-sm disabled:opacity-50 hover:border-[#bfa45b] transition flex items-center gap-1"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
            )}
            </div>
          )}

          {/* CALENDAR VIEW */}
          {viewType === 'calendar' && (
            <div className="bg-[#2a2a2a] p-6 rounded-xl shadow-xl border border-[#444]">
              <h3 className="text-lg font-semibold text-white mb-4">Calendar View (Month)</h3>
              <div className="bg-[#1b1b1b] p-6 rounded-lg border border-[#444] text-center text-gray-400">
                <p className="mb-2">📅 Calendar Integration Coming Soon</p>
                <p className="text-sm">Displays bookings in Month, Week, and Day views with color-coded status</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>Confirmed</div>
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-1"></span>Pending</div>
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-blue-500 rounded mr-1"></span>Completed</div>
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"></span>Cancelled</div>
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-orange-500 rounded mr-1"></span>Payment Pending</div>
                  <div className="text-xs"><span className="inline-block w-3 h-3 bg-purple-500 rounded mr-1"></span>In Progress</div>
                </div>
              </div>
            </div>
          )}

          {/* TIMELINE VIEW */}
          {viewType === 'timeline' && (
            <div className="bg-[#2a2a2a] p-6 rounded-xl shadow-xl border border-[#444]">
              <h3 className="text-lg font-semibold text-white mb-4">Timeline View</h3>
              <div className="space-y-2">
                {filteredBookings.sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || '')).map((booking) => (
                  <div key={booking.id} className="flex gap-4 p-3 bg-[#1b1b1b] rounded-lg border border-[#444] hover:border-[#bfa45b] transition">
                    <div className="font-mono text-[#bfa45b] font-semibold min-w-[90px]">
                      {booking.time_slot && booking.time_slot !== 'N/A' 
                        ? `${booking.time_slot}–${String(parseInt(booking.time_slot.split(':')[0]) + Math.floor(booking.duration / 60)).padStart(2, '0')}:${String(booking.duration % 60).padStart(2, '0')}` 
                        : 'N/A'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{booking.service_type} – {booking.sub_type}</p>
                      <p className="text-sm text-gray-400">{booking.client_name} • {booking.studio}</p>
                      <p className="text-xs text-gray-500 mt-1">Instructor: {booking.instructor} • Participants: {booking.participants}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded
                        ${booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : ''}
                        ${booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                        ${booking.status === 'in-progress' ? 'bg-purple-500/20 text-purple-400' : ''}
                        ${booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : ''}
                        ${booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : ''}
                      `}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center justify-center gap-2 p-4 bg-[#2a2a2a] border border-[#444] rounded-lg hover:border-[#bfa45b] hover:bg-[#bfa45b]/5 transition text-white">
              <Plus size={18} />
              <span className="text-sm font-medium">Add Booking</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 bg-[#2a2a2a] border border-[#444] rounded-lg hover:border-[#bfa45b] hover:bg-[#bfa45b]/5 transition text-white">
              <Bell size={18} />
              <span className="text-sm font-medium">Send Reminders</span>
            </button>
            <button onClick={handleExport} className="flex items-center justify-center gap-2 p-4 bg-[#2a2a2a] border border-[#444] rounded-lg hover:border-[#bfa45b] hover:bg-[#bfa45b]/5 transition text-white">
              <Download size={18} />
              <span className="text-sm font-medium">Export Schedule</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 bg-[#2a2a2a] border border-[#444] rounded-lg hover:border-[#bfa45b] hover:bg-[#bfa45b]/5 transition text-white">
              <Activity size={18} />
              <span className="text-sm font-medium">Check Availability</span>
            </button>
          </div>
        </main>
      </div>

      {/* Booking Details Modal */}
      {detailModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#2a2a2a] border border-[#444] rounded-xl w-full max-w-2xl p-6 text-white shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Booking Details - {selectedBooking.booking_id}</h3>
              <button onClick={() => { setDetailModalOpen(false); setSelectedBooking(null); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase">Client Name</label>
                  <p className="text-white font-semibold">{selectedBooking.client_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Email</label>
                  <p className="text-white text-sm">{selectedBooking.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Contact</label>
                  <p className="text-white text-sm">{selectedBooking.contact}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Service</label>
                  <p className="text-white font-semibold">{selectedBooking.service_type}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase">Instructor</label>
                  <p className="text-white">{selectedBooking.instructor}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Date</label>
                    <p className="text-white font-mono">{selectedBooking.date}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Time</label>
                    <p className="text-white font-mono">{selectedBooking.time_slot}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Duration</label>
                    <p className="text-white">{selectedBooking.duration} min</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Amount</label>
                    <p className="text-[#bfa45b] font-semibold">{formatCurrency(selectedBooking.amount)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Status</label>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                      ${selectedBooking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : ''}
                      ${selectedBooking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                      ${selectedBooking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : ''}
                      ${selectedBooking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : ''}
                    `}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Payment</label>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                      ${selectedBooking.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : ''}
                      ${selectedBooking.payment_status === 'pending' ? 'bg-orange-500/20 text-orange-400' : ''}
                    `}>
                      {selectedBooking.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column - QR Code */}
              <div className="flex flex-col items-center justify-center bg-[#1b1b1b] rounded-lg p-6">
                {selectedBooking.qr_code ? (
                  <>
                    <img 
                      src={selectedBooking.qr_code} 
                      alt="QR Code" 
                      className="w-48 h-48 bg-white p-2 rounded-lg"
                    />
                    <p className="text-gray-300 text-sm mt-3">QR Code for Check-in</p>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-400 text-lg font-semibold mb-2">No QR Code</p>
                    <p className="text-gray-500 text-sm">QR code will be generated when payment is confirmed</p>
                    <button 
                      onClick={() => handleCompleteBooking(selectedBooking.id)}
                      className="mt-4 px-4 py-2 bg-[#bfa45b] text-white rounded-lg hover:bg-[#ffb400] transition text-sm font-semibold"
                    >
                      Generate QR Code
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[#444]">
              <button 
                onClick={() => handleConfirmBooking(selectedBooking.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
              >
                Confirm
              </button>
              <button 
                onClick={() => handleCheckInBooking(selectedBooking.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
              >
                Check In
              </button>
              <button 
                onClick={() => { setDetailModalOpen(false); setSelectedBooking(null); }}
                className="px-4 py-2 rounded-lg border border-[#bfa45b] text-[#bfa45b] hover:bg-[#bfa45b]/10 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Booking Modal - Enhanced Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#2a2a2a] border border-[#444] rounded-xl w-full max-w-2xl p-6 text-white my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Create New Booking</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setFormData({ service: '', duration: '', date: '', timeSlot: '' });
                  setAvailableSlots([]);
                  setSlotsError(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <form className="flex flex-col gap-6">
              {/* Step 1: Service Type Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-200">Service Type *</label>
                <select
                  value={formData.service}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="p-3 rounded-lg border border-[#444] bg-[#23233a] text-white focus:border-[#ffb400] outline-none cursor-pointer"
                >
                  <option value="">Select a service...</option>
                  <option value="music_lesson">Music Lessons</option>
                  <option value="recording">Recording</option>
                  <option value="mixing">Mixing</option>
                  <option value="band_rehearsal">Band Rehearsal</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {/* Step 2: Duration Selection */}
              {formData.service && (
                <div className="flex flex-col gap-2">
                  {SERVICE_CONFIG[formData.service]?.durationFixed ? (
                    <>
                      <label className="text-sm font-semibold text-gray-200">Duration</label>
                      <div className="p-3 rounded-lg border border-[#444] bg-[#23233a] text-gray-300">
                        1 hour (automatically set for Music Lessons)
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-sm font-semibold text-gray-200">Duration *</label>
                      <div className="grid grid-cols-3 gap-3">
                        {DURATION_OPTIONS.map((option) => (
                          <button
                            key={option.minutes}
                            type="button"
                            onClick={() => handleDurationChange(option.minutes.toString())}
                            className={`p-3 rounded-lg border-2 transition font-medium
                              ${formData.duration === option.minutes.toString()
                                ? 'border-[#ffb400] bg-[#ffb400]/10 text-[#ffb400]'
                                : 'border-[#444] bg-[#23233a] text-gray-300 hover:border-[#ffb400]'
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

              {/* Step 3: Date Selection */}
              {formData.service && formData.duration && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-200">Booking Date *</label>
                  <input
                    type="date"
                    min={today}
                    value={formData.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="p-3 rounded-lg border border-[#444] bg-[#23233a] text-white focus:border-[#ffb400] outline-none"
                  />
                </div>
              )}

              {/* Step 4 & 5: Time Slot Selection */}
              {canShowTimeSlots && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-200">Time Slot *</label>
                  
                  {slotsLoading && (
                    <div className="p-4 rounded-lg border border-[#444] bg-[#23233a] flex items-center gap-2 text-gray-300">
                      <Loader className="animate-spin" size={16} />
                      Loading available slots...
                    </div>
                  )}

                  {slotsError && (
                    <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
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
                          className={`p-3 rounded-lg border-2 transition font-medium text-sm
                            ${formData.timeSlot === slot.display
                              ? 'border-[#ffb400] bg-[#ffb400]/10 text-[#ffb400]'
                              : 'border-[#444] bg-[#23233a] text-gray-300 hover:border-[#ffb400]'
                            }
                          `}
                        >
                          {slot.display}
                        </button>
                      ))}
                    </div>
                  )}

                  {!slotsLoading && availableSlots.length === 0 && !slotsError && (
                    <div className="p-4 rounded-lg border border-[#444] bg-[#23233a] text-gray-400">
                      No available time slots for this date
                    </div>
                  )}
                </div>
              )}

              {/* Helper Text */}
              <div className="text-xs text-gray-400 border-t border-[#444] pt-4">
                <p>• Operating hours: 8:00 AM - 7:00 PM</p>
                <p>• All durations shown are total session length</p>
                <p>• Time slots are allocated in 1-hour intervals</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-[#444] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({ service: '', duration: '', date: '', timeSlot: '' });
                    setAvailableSlots([]);
                    setSlotsError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-[#bfa45b] text-[#bfa45b] hover:bg-[#bfa45b]/10 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!formData.service || !formData.duration || !formData.date || !formData.timeSlot}
                  onClick={handleCreateBooking}
                  className="px-4 py-2 rounded-lg bg-[#ffb400] text-[#1b1b1b] font-semibold hover:bg-[#ffc400] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminBookings;