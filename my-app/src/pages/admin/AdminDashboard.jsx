import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, BookOpen, FileText, Settings, LogOut,
  Search, Bell, Menu, ChevronLeft, ChevronRight, TrendingUp, Wallet, RefreshCw, Download, Clock, X, TrendingDown, ArrowUpRight, ArrowDownRight, CreditCard, Activity, UserCheck, Plus
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { LineChart, Line as RechartLine, ResponsiveContainer } from 'recharts';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import TotalRevenueCard from '../../components/TotalRevenueCard';
import TotalAppointmentsCard from '../../components/TotalAppointmentsCard';
import TotalActiveStudentsCard from '../../components/TotalActiveStudentsCard';
import LessonCompletionRateCard from '../../components/LessonCompletionRateCard';
import TopStudentsTable from '../../components/TopStudentsTable';
import NotificationDropdown from '../../components/NotificationDropdown';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// --- Configuration & Constants ---

const API_BASE_URL = 'http://localhost:5000/api';
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Tailwind utility classes matching the custom CSS variables
const BASE_CLASSES = {
    GOLD: 'bg-[#ffb400]',
    DARK: 'bg-[#1b1b1b]',
    BG_DARK: 'bg-gradient-to-br from-[#2a2a2a] to-[#1b1b1b]',
    CARD_BG: 'bg-[#2a2a2a]',
    SIDEBAR_BG: 'bg-[#2c2c3a]',
    ACCENT_TEXT: 'text-[#ffb400]',
    ACCENT_BG: 'bg-[#ffb400]',
    TEXT_LIGHT: 'text-white',
    TEXT_MUTED: 'text-[#bbb]',
    BORDER: 'border-[#444]',
};

// --- Reusable Component Definitions ---

const MetricIcon = ({ icon: Icon }) => (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-400 text-gray-900 flex-shrink-0">
        <Icon className="w-6 h-6" />
    </div>
);

const MetricCard = ({ icon, label, value, change, isPositive }) => {
    const changeClass = isPositive ? 'text-green-500' : 'text-gray-400';
    return (
        <div className={`${BASE_CLASSES.CARD_BG} border border-gray-700 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-3 md:gap-4 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-950/30 transition duration-200 hover:-translate-y-0.5`}>
            <MetricIcon icon={icon} />
            <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{label}</p>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-0.5 md:mb-1 break-words">{value}</h3>
                <p className={`text-xs ${changeClass}`}>{change}</p>
            </div>
        </div>
    );
};

// Tailwind equivalent of the user row (using grid/flex instead of table for better mobile)
const UserRow = ({ name, email, points, level, status }) => {
    const statusClasses = {
        'active': 'text-green-400 bg-green-900/30',
        'pending': 'text-yellow-400 bg-yellow-900/30',
        'inactive': 'text-red-400 bg-red-900/30',
    };
    return (
        <tr className="border-b border-gray-700/50 hover:bg-white/5 transition duration-200">
            <td className="p-4 text-sm text-white font-medium">{name}</td>
            <td className="p-4 text-sm text-gray-300">Lvl {level} ({points} pts)</td>
            <td className="p-4 text-sm text-gray-300">{email}</td>
            <td className="p-4">
                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full capitalize ${statusClasses[status] || 'text-gray-400'}`}>{status}</span>
            </td>
        </tr>
    );
};


// --- Chart Options ---

const chartOptions = (titleText) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            display: titleText === 'User Engagement' || titleText === 'Activity', // Display legend for bar and activity charts
            labels: {
                color: '#a0a0a0',
                usePointStyle: true,
                padding: 15,
            },
        },
        title: {
            display: false,
        },
        tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#ffb400',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        if (titleText === 'Revenue') {
                            label += '₱' + parseFloat(context.parsed.y).toLocaleString('en-PH', { maximumFractionDigits: 1 }) + 'K';
                        } else if (titleText === 'DAU') {
                            label += context.parsed.y.toLocaleString();
                        } else {
                            label += context.parsed.y.toLocaleString();
                        }
                    }
                    return label;
                },
                title: function(context) {
                    return context[0].label || '';
                }
            }
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: { color: '#a0a0a0' },
            grid: { color: '#2a2d3a' },
        },
        x: {
            ticks: { color: '#a0a0a0' },
            grid: { color: '#2a2d3a' },
        },
    },
});

// --- Main Component ---

const AdminDashboard = () => {
  console.log('🔧 AdminDashboard component mounting...');
  console.log('🔑 Token exists:', !!localStorage.getItem('token'));
  console.log('👤 User data:', localStorage.getItem('user'));

  const navigate = useNavigate();
  const location = useLocation();
  
  // --- State Initialization ---
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [metrics, setMetrics] = useState({});
  const [revenueChartData, setRevenueChartData] = useState(null);
  const [engagementChartData, setEngagementChartData] = useState(null);
  const [bookingsByServiceData, setBookingsByServiceData] = useState(null);
  const [studentActivityData, setStudentActivityData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [registrationNotifications, setRegistrationNotifications] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Initialize date range with last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [dateRange, setDateRange] = useState({ 
    start: sevenDaysAgo.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  });
  const [selectedDatePreset, setSelectedDatePreset] = useState('Last 7 Days');
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  
  // Quick Action Modals
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  
  // Form states for modals
  const [appointmentForm, setAppointmentForm] = useState({
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
    payment: '',
    instructor_id: null
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [instructors, setInstructors] = useState([]);
  const [appointmentFormErrors, setAppointmentFormErrors] = useState({});
  
  const [moduleForm, setModuleForm] = useState({
    name: '',
    description: '',
    instrument: 'piano',
    difficulty: 'beginner'
  });
  const [moduleFormErrors, setModuleFormErrors] = useState({});
  
  const [lessonForm, setLessonForm] = useState({
    title: '',
    duration: '',
    description: ''
  });
  const [lessonFormErrors, setLessonFormErrors] = useState({});

  // Service type configuration
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

  // Fetch available time slots for appointment form
  const fetchAppointmentSlots = async (service, duration, date) => {
    if (!service || !duration || !date) return;

    setSlotsLoading(true);
    setSlotsError(null);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/available-slots-v2?service=${encodeURIComponent(service)}&duration=${duration}&date=${date}`
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

  // Fetch instructors for music lessons
  const fetchAppointmentInstructors = async (date = null, time = null, duration = null) => {
    try {
      const queryDate = date || appointmentForm.date;
      const queryTime = time || appointmentForm.timeSlot;
      const queryDuration = duration || appointmentForm.duration;
      
      let url = `${API_BASE_URL}/bookings/instructors`;
      
      if (queryDate && queryTime && queryDuration) {
        url += `?date=${queryDate}&time=${queryTime}&duration=${queryDuration}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch instructors: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        setInstructors(data.data);
      }
    } catch (err) {
      console.error('Error fetching instructors:', err);
    }
  };

  // Handle service change in appointment form
  const handleAppointmentServiceChange = (service) => {
    setAppointmentForm(prev => ({
      ...prev,
      service,
      duration: SERVICE_CONFIG[service]?.durationFixed ? '60' : '',
      date: '',
      timeSlot: '',
      instructor_id: null
    }));
    setAvailableSlots([]);
    setSlotsError(null);
    
    if (service === 'music_lesson') {
      fetchAppointmentInstructors();
    }
  };

  // Handle duration change in appointment form
  const handleAppointmentDurationChange = (duration) => {
    setAppointmentForm(prev => ({
      ...prev,
      duration,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    if (appointmentForm.service && appointmentForm.date) {
      fetchAppointmentSlots(appointmentForm.service, duration, appointmentForm.date);
    }
  };

  // Handle date change in appointment form
  const handleAppointmentDateChange = (date) => {
    setAppointmentForm(prev => ({
      ...prev,
      date,
      timeSlot: ''
    }));
    setAvailableSlots([]);
    setSlotsError(null);

    if (appointmentForm.service && appointmentForm.duration) {
      fetchAppointmentSlots(appointmentForm.service, appointmentForm.duration, date);
    }
    
    if (appointmentForm.service === 'music_lesson' && appointmentForm.duration && appointmentForm.timeSlot) {
      fetchAppointmentInstructors(date, appointmentForm.timeSlot, appointmentForm.duration);
    }
  };

  // Handle time slot change in appointment form
  const handleAppointmentTimeSlotChange = (slot) => {
    setAppointmentForm(prev => ({
      ...prev,
      timeSlot: slot.display
    }));
    
    if (appointmentForm.service === 'music_lesson' && appointmentForm.date && appointmentForm.duration) {
      fetchAppointmentInstructors(appointmentForm.date, slot.display, appointmentForm.duration);
    }
  };

  // Validate appointment form
  const validateAppointmentForm = () => {
    const errors = {};
    
    if (!appointmentForm.name.trim()) errors.name = 'Full name is required';
    if (!appointmentForm.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointmentForm.email)) errors.email = 'Invalid email';
    
    if (!appointmentForm.contact.trim()) errors.contact = 'Mobile number is required';
    else if (!/^09\d{9}$/.test(appointmentForm.contact.replace(/\D/g, ''))) errors.contact = 'Mobile number must start with 09 and be 11 digits';
    
    if (!appointmentForm.service) errors.service = 'Service type is required';
    if (appointmentForm.service === 'music_lesson' && !appointmentForm.instructor_id) errors.instructor_id = 'Instructor is required';
    if (!appointmentForm.duration) errors.duration = 'Duration is required';
    if (!appointmentForm.date) errors.date = 'Booking date is required';
    if (!appointmentForm.timeSlot) errors.timeSlot = 'Start time is required';
    if (!appointmentForm.people || appointmentForm.people < 1) errors.people = 'Invalid number of people';
    if (!appointmentForm.payment) errors.payment = 'Payment method is required';
    
    setAppointmentFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle appointment input change
  const handleAppointmentInputChange = (e) => {
    const { name, value } = e.target;
    
    let newValue = value;
    if (name === 'contact') {
      newValue = value.replace(/\D/g, '');
      if (newValue.length > 11) {
        newValue = newValue.slice(0, 11);
      }
    }
    
    setAppointmentForm(prev => ({ ...prev, [name]: newValue }));
    
    if (appointmentFormErrors[name]) {
      setAppointmentFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handler functions for quick action modals
  const handleSaveAppointment = async () => {
    if (!validateAppointmentForm()) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        return;
      }

      // Calculate total amount
      const serviceRates = {
        music_lesson: 500,
        recording: 1500,
        rehearsal: 800,
        dance: 600,
        arrangement: 2000,
        voiceover: 1000,
      };
      const baseRate = serviceRates[appointmentForm.service] || 800;
      const durationHours = appointmentForm.duration ? parseInt(appointmentForm.duration) / 60 : 1;
      const totalAmount = baseRate * durationHours;

      // Prepare booking payload
      const bookingPayload = {
        name: appointmentForm.name,
        email: appointmentForm.email,
        contact: appointmentForm.contact,
        birthday: appointmentForm.birthday || null,
        address: appointmentForm.address || null,
        service: appointmentForm.service,
        date: appointmentForm.date,
        timeSlot: appointmentForm.timeSlot,
        duration: parseInt(appointmentForm.duration, 10),
        people: parseInt(appointmentForm.people, 10),
        payment: appointmentForm.payment,
        instructor_id: appointmentForm.instructor_id || null,
        totalAmount: totalAmount
      };

      // Create booking directly via API
      const response = await fetch(`${API_BASE_URL}/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to create booking: ${errorData.message || response.statusText}`);
        return;
      }

      const result = await response.json();
      
      if (result.success) {
        alert('Appointment created successfully!');
        setShowAddAppointmentModal(false);
        setAppointmentForm({
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
          payment: '',
          instructor_id: null
        });
        setAppointmentFormErrors({});
        // Refresh the bookings page or navigate to it
        navigate('/admin/bookings');
      } else {
        alert(`Booking creation failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert('An error occurred while creating the appointment. Please try again.');
    }
  };

  const handleSaveModule = () => {
    if (!moduleForm.moduleName) {
      alert('Please enter module name');
      return;
    }
    // Store module data in sessionStorage to pass to modules page
    sessionStorage.setItem('newModule', JSON.stringify(moduleForm));
    setShowAddModuleModal(false);
    setModuleForm({ moduleName: '', description: '', instructor: '' });
    navigate('/admin/modules');
  };

  const handleSaveLesson = () => {
    if (!lessonForm.module || !lessonForm.lessonTitle) {
      alert('Please fill in all required fields');
      return;
    }
    // Store lesson data in sessionStorage to pass to modules page
    sessionStorage.setItem('newLesson', JSON.stringify(lessonForm));
    setShowAddLessonModal(false);
    setLessonForm({ module: '', lessonTitle: '', description: '', duration: '' });
    navigate('/admin/modules');
  };
  
  // Determine active nav based on current route
  const getActiveNav = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/users')) return 'users';
    if (path.includes('/bookings')) return 'bookings';
    if (path.includes('/modules')) return 'modules';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/notifications')) return 'notifications';
    if (path.includes('/payments')) return 'payments';
    if (path.includes('/activity')) return 'activity';
    if (path.includes('/instructors')) return 'instructors';
    if (path.includes('/profile')) return 'profile';
    return 'dashboard';
  };
  
  const activeNav = getActiveNav();

  // --- Refs for Charts ---
  const revenueChartRef = useRef(null);
  const engagementChartRef = useRef(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Initialize date range with today and 7 days ago
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setDateRange({
      start: sevenDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });

    // Initialize charts with default date range data
    setRevenueChartData(generateRevenueData('Last 7 Days'));
    setBookingsByServiceData(generateBookingsByServiceData('Last 7 Days'));
    setStudentActivityData(generateStudentActivityData('Last 7 Days'));
  }, []);

  // Note: Registration notifications are now fetched in loadDashboardData
  // This consolidates all dashboard data fetching into one place

  // Fetch admin system notifications
  useEffect(() => {
    const fetchAdminNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/notifications/admin/system`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          // Admin system notifications fetched
        }
      } catch (error) {
        console.error('Error fetching admin system notifications:', error);
      }
    };

    fetchAdminNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAdminNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Utility Functions ---

  const getTimeAgo = (date) => {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCurrentDateTime = () => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    return currentTime.toLocaleDateString('en-US', options);
  };

  // --- Chart Data Generation Functions ---

  const generateRevenueData = (preset) => {
    const today = new Date();
    let startDate = new Date();
    let isShortRange = false;

    switch(preset) {
      case 'Today':
        isShortRange = true;
        break;
      case 'Week':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'This Month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Last Month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        break;
      default:
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Generate realistic revenue data based on range
    const labels = [];
    const data = [];
    const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    if (isShortRange) {
      // Hourly data for Today/Yesterday
      for (let i = 0; i < 24; i++) {
        labels.push(`${i.toString().padStart(2, '0')}:00`);
        data.push(Math.floor(Math.random() * 5000) + 1000);
      }
    } else if (daysDiff <= 7) {
      // Daily data for 7 days
      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        data.push(Math.floor(Math.random() * 8000) + 3000);
      }
    } else {
      // Weekly data for longer ranges
      for (let i = 0; i < daysDiff; i += 7) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        data.push(Math.floor(Math.random() * 25000) + 10000);
      }
    }

    return {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        borderColor: '#f4c542',
        backgroundColor: 'rgba(244, 197, 66, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#f4c542',
        pointBorderColor: '#fff',
      }],
    };
  };

  const generateBookingsByServiceData = (preset) => {
    const services = [
      { name: 'Band Rehearsal', color: '#ff6b6b' },
      { name: 'Recording', color: '#4ecdc4' },
      { name: 'Music Lessons', color: '#95e1d3' },
      { name: 'Mixing & Production', color: '#ffd93d' },
    ];

    // Generate realistic booking counts
    const bookingCounts = services.map(() => Math.floor(Math.random() * 50) + 10);
    const total = bookingCounts.reduce((a, b) => a + b, 0);

    return {
      labels: services.map(s => s.name),
      datasets: [{
        label: 'Bookings by Service',
        data: bookingCounts,
        backgroundColor: services.map(s => s.color),
        borderColor: '#2a2a2a',
        borderWidth: 2,
      }],
      percentages: bookingCounts.map(count => ((count / total) * 100).toFixed(1)),
      total,
    };
  };

  const generateStudentActivityData = (preset) => {
    const today = new Date();
    let startDate = new Date();
    const daysDiff = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    // Activity levels
    const activitySegments = {
      'Highly Active': Math.floor(Math.random() * 200) + 100,
      'Moderate': Math.floor(Math.random() * 300) + 150,
      'Low': Math.floor(Math.random() * 250) + 100,
      'Inactive': Math.floor(Math.random() * 200) + 50,
    };

    // Daily Active Users
    const labels = [];
    const dau = [];
    const daysToShow = Math.min(daysDiff, 30);

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      dau.push(Math.floor(Math.random() * 500) + 300);
    }

    return {
      donut: {
        labels: Object.keys(activitySegments),
        datasets: [{
          data: Object.values(activitySegments),
          backgroundColor: ['#28c76f', '#ffb400', '#ff9f43', '#ea5455'],
          borderColor: '#2a2a2a',
          borderWidth: 2,
        }],
        total: Object.values(activitySegments).reduce((a, b) => a + b, 0),
      },
      line: {
        labels,
        datasets: [{
          label: 'Daily Active Users',
          data: dau,
          borderColor: '#ffb400',
          backgroundColor: 'rgba(255, 180, 0, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#ffb400',
          pointBorderColor: '#fff',
        }],
        peak: Math.max(...dau),
        lowest: Math.min(...dau),
        average: Math.round(dau.reduce((a, b) => a + b, 0) / dau.length),
      },
    };
  };

  const handleDatePreset = (preset) => {
    const today = new Date();
    let start = new Date();
    
    switch(preset) {
      case 'Today':
        start = new Date(today);
        break;
      case 'Week':
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateRange({
          start: start.toISOString().split('T')[0],
          end: endOfLastMonth.toISOString().split('T')[0]
        });
        setSelectedDatePreset(preset);
        setIsLoadingCharts(true);
        return;
      default:
        break;
    }
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });
    setSelectedDatePreset(preset);
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    loadDashboardData();
    loadBookingsData();
  };

  const exportReport = (format) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Dashboard-Report-${timestamp}.${format.toLowerCase()}`;
    
    // Simple export - in production, use a proper export library
    if (format === 'PDF') {
      console.log('PDF export would be generated here');
      alert('PDF export feature coming soon');
    } else if (format === 'Excel') {
      console.log('Excel export would be generated here');
      alert('Excel export feature coming soon');
    }
  };

  // --- Utility Functions ---

  const formatMetricData = (data) => ({
    totalUsers: data.totalUsers || '0',
    userGrowth: data.userGrowth || '+0%',
    totalAppointments: data.totalAppointments || '0',
    appointmentGrowth: data.appointmentGrowth || '+0%',
    completedLessons: data.completedLessons || '0',
    newLessons: `${data.newLessonsThisMonth || 0} new this month`,
    monthlyRevenue: `₱${parseFloat(data.monthlyRevenue || 0).toFixed(1)}K`,
    revenueGrowth: data.revenueGrowth || '+0%',
    engagementRate: data.engagementRate || '0%',
    engagementGrowth: data.engagementGrowth || '+0%'
  });

  const formatChartData = (revenueData, engagementData) => {
    // Revenue Chart Data
    const formattedRevenue = revenueData ? {
        labels: revenueData.map(d => new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' })),
        datasets: [{
            label: 'Revenue',
            data: revenueData.map(d => parseFloat(d.revenue || 0)),
            borderColor: '#f4c542',
            backgroundColor: 'rgba(244, 197, 66, 0.1)',
            fill: true,
            tension: 0.4
        }],
    } : null;

    // Engagement Chart Data
    const formattedEngagement = engagementData ? {
        labels: engagementData.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
        datasets: [
            {
                label: 'Active Users',
                data: engagementData.map(d => d.active_users || 0),
                backgroundColor: '#f4c542',
                borderRadius: 8
            },
            {
                label: 'Lessons Completed',
                data: engagementData.map(d => d.lessons_completed || 0),
                backgroundColor: '#27ae60',
                borderRadius: 8
            }
        ],
    } : null;

    setRevenueChartData(formattedRevenue);
    setEngagementChartData(formattedEngagement);
  };
  
  const formatUsersData = (users) => {
    return users.map(user => ({
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        email: user.email || '',
        points: user.total_points || 0,
        level: user.total_points > 0 ? Math.floor(user.total_points / 100) + 1 : 1,
        status: user.is_verified ? 'active' : 'pending',
    }));
  };

  // --- Data Fetching Logic ---

  const loadDashboardData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found');
      return; 
    }

    try {
      // Map preset to period for API calls
      let period = 'month';
      switch(selectedDatePreset) {
        case 'Today':
          period = 'today';
          break;
        case 'Week':
          period = 'week';
          break;
        case 'This Month':
          period = 'month';
          break;
        case 'Last Month':
          period = 'lastMonth';
          break;
        default:
          period = 'month';
      }
      
      // Fetch all dashboard statistics in parallel
      const [revenueRes, appointmentsRes, studentsRes, completionRes, trendRes, serviceRes, segmentationRes, dauRes, topStudentsRes, recentUsersRes, registrationsRes, scheduleRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/dashboard/revenue?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/appointments?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/students?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/completion-rate?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/revenue-trend?startDate=${dateRange.start || new Date().toISOString().split('T')[0]}&endDate=${dateRange.end || new Date().toISOString().split('T')[0]}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/bookings-by-service?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/user-segmentation`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/daily-active-users?days=30`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/top-students?page=1&limit=10`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/recent-users?limit=4`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/new-registrations?period=today`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/dashboard/todays-schedule`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      // Process revenue data
      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        // Revenue data is used by TotalRevenueCard component
      }

      // Process appointments data
      if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
        // Appointments data is used by TotalAppointmentsCard component
      }

      // Process students data
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        // Students data is used by TotalActiveStudentsCard component
      }

      // Process completion rate data
      if (completionRes.ok) {
        const completionData = await completionRes.json();
        // Completion rate data is used by LessonCompletionRateCard component
      }

      // Process trend data for charts
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        const chartData = Array.isArray(trendData.data) 
          ? trendData.data.map(item => ({
              date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              revenue: item.revenue || 0
            }))
          : [];
        
        setRevenueChartData({
          labels: chartData.map(d => d.date),
          datasets: [{
            label: 'Revenue',
            data: chartData.map(d => {
              const revenue = parseFloat(d.revenue) || 0;
              return isNaN(revenue / 1000) ? 0 : (revenue / 1000).toFixed(1);
            }),
            borderColor: '#ffb400',
            backgroundColor: 'rgba(255, 180, 0, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#ffb400',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
          }],
        });
      } else {
        setRevenueChartData(null);
      }

      // Process bookings by service
      if (serviceRes.ok) {
        const serviceData = await serviceRes.json();
        const data = Array.isArray(serviceData.data) ? serviceData.data : [];
        if (data.length > 0) {
          const totalBookings = data.reduce((sum, s) => sum + (s.count || 0), 0);
          setBookingsByServiceData({
            labels: data.map(s => s.service_name || 'Unknown'),
            datasets: [{
              label: 'Bookings',
              data: data.map(s => s.count || 0),
              backgroundColor: ['#ffb400', '#ff6b6b', '#4ade80', '#3b82f6', '#ec4899']
            }],
            percentages: data.map(s => totalBookings > 0 ? ((s.count || 0) / totalBookings * 100).toFixed(1) : 0)
          });
        }
      }

      // Process user segmentation
      if (segmentationRes.ok) {
        const segData = await segmentationRes.json();
        const data = Array.isArray(segData.data) ? segData.data : [];
        if (data.length > 0) {
          setStudentActivityData({
            donut: {
              labels: data.map(s => s.activity_level || 'Unknown'),
              datasets: [{
                data: data.map(s => s.count || 0),
                backgroundColor: ['#28c76f', '#ff9f43', '#ff5252', '#82868b'],
                borderColor: ['#1a7a3a', '#c85a1f', '#cc2222', '#505050'],
                borderWidth: 2
              }]
            },
            line: {
              peak: Math.max(...data.map(s => s.count || 0), 0),
              average: data.length > 0 
                ? (data.reduce((sum, s) => sum + (s.count || 0), 0) / data.length).toFixed(0)
                : 0,
              lowest: Math.min(...data.map(s => s.count || 0).filter(c => c > 0), 0)
            }
          });
        }
      }

      // Process DAU data
      if (dauRes.ok) {
        const dauData = await dauRes.json();
        const chartData = Array.isArray(dauData.data)
          ? dauData.data.map(item => ({
              date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              active_users: item.active_users || 0
            }))
          : [];
        
        setEngagementChartData({
          labels: chartData.map(d => d.date),
          datasets: [{
            label: 'Daily Active Users',
            data: chartData.map(d => d.active_users),
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#4ade80',
            pointBorderColor: '#fff',
            pointRadius: 4,
          }],
        });
      } else {
        setEngagementChartData(initialEngagementData);
      }

      // Process top students
      if (topStudentsRes.ok) {
        const topStudentsData = await topStudentsRes.json();
        const list = Array.isArray(topStudentsData.data) ? topStudentsData.data : [];
        const mappedStudents = list.map((s, index) => ({
          rank: s.rank ?? index + 1,
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
          level: s.level || s.current_level || 1,
          xp: s.total_xp || s.total_points || 0,
          modules: s.modules_completed || 0,
          badges: s.badges_count || 0,
          lastActive: s.last_active
            ? new Date(s.last_active).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A',
        }));
        setTopStudents(mappedStudents);
      } else {
        setTopStudents([]);
      }

      // Process recent users
      if (recentUsersRes.ok) {
        const recentUsersData = await recentUsersRes.json();
        const userData = Array.isArray(recentUsersData.data) ? recentUsersData.data : [];
        setRecentUsers(userData.map(user => ({
          name: `${user.user_name || user.first_name || 'Unknown'} ${user.last_name || ''}`.trim(),
          level: user.level || user.current_level || 1,
          points: user.points || user.total_xp || 0,
          email: user.email || '',
          status: user.status || 'inactive'
        })));
      } else {
        setRecentUsers([]);
      }

      // Process new registrations
      if (registrationsRes.ok) {
        const registrationsData = await registrationsRes.json();
        const notificationsArray = Array.isArray(registrationsData.data?.registrations) 
          ? registrationsData.data.registrations 
          : [];
        setRegistrationNotifications(notificationsArray);
      } else {
        setRegistrationNotifications([]);
      }

      // Process todays schedule
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        console.log('Schedule API response:', scheduleData);
        const schedule = Array.isArray(scheduleData.data) ? scheduleData.data : [];
        console.log('Formatted schedule:', schedule);
        const formattedSchedule = schedule.map(booking => ({
          booking_id: booking.booking_id,
          customer_name: booking.student_name || 'Unknown',
          instructor_name: booking.instructor_name || 'Unknown',
          service_type: booking.service_name || 'Service',
          start_time: booking.start_time || 'N/A',
          end_time: booking.end_time || 'N/A',
          status: booking.status || 'pending'
        }));
        setBookings(formattedSchedule);
      } else {
        const errorText = await scheduleRes.text();
        console.error('Schedule API error:', scheduleRes.status, errorText);
        setBookings([]);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set fallback state to empty arrays
      setRecentUsers([]);
      setRegistrationNotifications([]);
      setBookings([]);
      // Log individual error details for debugging
      if (error.message) console.error('Error message:', error.message);
      if (error.stack) console.error('Stack trace:', error.stack);
    }
  }, [selectedDatePreset, dateRange]);

  // Fetch bookings from database (replaced by todays-schedule endpoint)
  // This is now handled in loadDashboardData
  const loadBookingsData = useCallback(async () => {
    // No longer needed - data is fetched in loadDashboardData
  }, []);

  // --- Lifecycle and Polling ---

  useEffect(() => {
    loadDashboardData();
    loadBookingsData();
    // Set up refresh interval (5 minutes)
    const intervalId = setInterval(() => {
      loadDashboardData();
      loadBookingsData();
    }, 5 * 60 * 1000);
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [loadDashboardData, loadBookingsData]);


  // --- Calendar Logic ---

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const generateCalendar = useCallback(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    // Empty days (padding)
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && day === today.getDate();
      const hasEvent = calendarEvents.includes(day);

      days.push(
        <div 
          key={day}
          className={`aspect-square flex items-center justify-center text-sm rounded-lg cursor-pointer relative transition duration-200 
            ${isToday ? `${BASE_CLASSES.ACCENT_BG} text-gray-900 font-bold` : `${BASE_CLASSES.TEXT_LIGHT} hover:bg-white/5`}
            ${hasEvent ? 'before:content-[""] before:absolute before:bottom-1 before:w-1 before:h-1 before:bg-amber-400 before:rounded-full' : ''}
          `}
        >
          {day}
        </div>
      );
    }
    return days;
  }, [currentCalendarDate]);
  
  // --- UI/Layout Toggles ---

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsCollapsed(prev => !prev);
    } else {
      setIsMobileOpen(prev => !prev);
    }
  };

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  const sidebarWidth = isCollapsed ? '66px' : '250px';
  const headerHeight = '64px';

  // Map selected date preset to backend period for KPI cards and stats
  const currentPeriod = selectedDatePreset === 'Today'
    ? 'today'
    : selectedDatePreset === 'Week'
      ? 'week'
      : selectedDatePreset === 'Last Month'
        ? 'lastMonth'
        : 'month';


  // Combine metric data for rendering
  // Sparkline data for each KPI card
  const sparklineData = {
    revenue: [
      { value: 8000 }, { value: 9500 }, { value: 11000 }, { value: 10500 }, { value: 12000 }, { value: 12450 }
    ],
    users: [
      { value: 2400 }, { value: 2500 }, { value: 2600 }, { value: 2700 }, { value: 2800 }, { value: 2847 }
    ],
    bookings: [
      { value: 120 }, { value: 130 }, { value: 140 }, { value: 145 }, { value: 150 }, { value: 156 }
    ],
    lessons: [
      { value: 15 }, { value: 18 }, { value: 20 }, { value: 22 }, { value: 23 }, { value: 24 }
    ]
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a2a] to-[#1b1b1b] text-white font-sans overflow-x-hidden">  

      {/* Sidebar Overlay (Mobile) */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMobileSidebar}
      ></div>

      {/* Sidebar */}
      <aside 
        id="sidebar" 
        className={`fixed top-0 left-0 z-50 h-screen bg-[#2c2c3a] text-white transition-all duration-300 ease-in-out flex flex-col gap-4 py-6 px-4 overflow-y-auto
        ${isCollapsed ? 'w-[66px] px-2' : 'w-[250px]'} 
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        aria-label="Primary"
      >
        
        {/* Profile Section */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#444]">
          <div 
            className="w-11 h-11 rounded-full bg-[#ffb400] flex items-center justify-center font-bold text-[#1b1b1b] flex-shrink-0 cursor-pointer hover:opacity-80 transition"
            onClick={() => navigate('/admin/profile')}
          >AD</div>
          <div className={`leading-snug transition-opacity duration-250 ${isCollapsed ? 'hidden' : 'block'}`}>  
            <div className="font-bold text-sm text-white">Admin User</div>
            <div className="text-xs text-[#bbb]">Administrator</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1.5 mt-1.5" aria-label="Main navigation">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', nav: 'dashboard', path: '/admin/dashboard' },
            { icon: Users, label: 'Users', nav: 'users', path: '/admin/users' },
            { icon: Calendar, label: 'Bookings', nav: 'bookings', path: '/admin/bookings' },
            { icon: BookOpen, label: 'Modules & Lessons', nav: 'modules', path: '/admin/modules' },
            { icon: UserCheck, label: 'Instructors', nav: 'instructors', path: '/admin/instructors' },
            { icon: CreditCard, label: 'Payments', nav: 'payments', path: '/admin/payments' },
            { icon: Bell, label: 'Notifications', nav: 'notifications', path: '/admin/notifications' },
            { icon: Activity, label: 'Activity Logs', nav: 'activity', path: '/admin/activity' },
            { icon: FileText, label: 'Reports', nav: 'reports', path: '/admin/reports' },
            { icon: Settings, label: 'Profile', nav: 'profile', path: '/admin/profile' }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.nav;
            const activeClasses = isActive ? 'bg-[#1b1b1b] text-[#bfa45b] font-semibold' : '';
            return (
              <button 
                key={item.nav}
                className={`flex items-center justify-start gap-3 p-2.5 border-none rounded-lg text-sm text-white transition duration-200 whitespace-nowrap hover:bg-[#23233a] ${activeClasses} ${isCollapsed ? 'justify-center p-2.5' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth <= 768) setIsMobileOpen(false);
                }}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 text-[#bfa45b]`} />
                <span className={`transition-opacity duration-250 ${isCollapsed ? 'hidden' : 'block'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button 
          className={`mt-auto flex items-center gap-3 bg-transparent border-none text-[#bfa45b] p-2.5 text-sm cursor-pointer rounded-lg transition duration-200 hover:bg-red-600 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/auth/login');
            }
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className={`${isCollapsed ? 'hidden' : 'block'}`}>Logout</span>
        </button>
      </aside>

      {/* Main Layout Wrapper */}
      <div className={`transition-all duration-300 ${isCollapsed ? 'md:ml-[66px]' : 'md:ml-[250px]'}`}>
        
        {/* Header */}
        <header className={`fixed top-0 right-0 z-30 bg-gradient-to-r from-[#23233a] to-[#1b1b1b] border-b border-[#444] shadow-lg transition-all duration-300
          ${isCollapsed ? 'left-[66px]' : 'left-0 md:left-[250px]'}
        `}>
          {/* Top Row - Title and Controls */}
          <div className="h-16 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              {/* Mobile Toggle */}
              <button 
                onClick={toggleSidebar}
                className="md:hidden text-[#bfa45b] p-1"
                aria-label="Toggle menu"
              >
                <Menu size={28} />
              </button>
              
              {/* Desktop Collapse Toggle */}
              <button 
                onClick={toggleSidebar}
                className="hidden md:flex text-[#bfa45b] hover:text-[#cfb86b]"
              >
                <Menu size={24} />
              </button>

              <div className="flex flex-col gap-0.5">
                <h2 className="text-xl font-bold text-white">Dashboard Overview</h2>
                <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={12} />
                  <span>{formatCurrentDateTime()}</span>
                </div>
              </div>
            </div>

            {/* Header Right - Date Range, Notifications, Refresh and Export */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              {/* Date Range Presets - Moved to Header */}
              <div className="hidden md:flex gap-1.5">
                {['Today', 'Week', 'This Month', 'Last Month'].map((preset) => (
                  <button 
                    key={preset}
                    onClick={() => handleDatePreset(preset)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition duration-200 ${
                      selectedDatePreset === preset
                        ? 'bg-[#bfa45b] text-[#1b1b1b] shadow-lg'
                        : 'bg-[#2a2a2a] border border-[#444] text-gray-300 hover:border-[#bfa45b] hover:text-[#bfa45b]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Notifications */}
              <NotificationDropdown isAdmin={true} />
              
              {/* Last Updated */}
              <button 
                onClick={handleRefresh}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#444] hover:border-[#bfa45b] text-xs text-gray-300 hover:text-[#bfa45b] transition duration-200 group"
                title="Refresh dashboard data"
              >
                <RefreshCw size={14} className="group-hover:rotate-180 transition duration-300" />
                <span className="hidden lg:block">{getTimeAgo(lastUpdated)}</span>
              </button>
              
              {/* Export Dropdown */}
              <div className="relative group">
                <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#bfa45b] hover:bg-[#cfb86b] text-[#1b1b1b] text-sm font-semibold transition duration-200">
                  <Download size={14} />
                  <span className="hidden lg:block">Export</span>
                </button>
                <div className="absolute right-0 mt-2 w-32 bg-[#2a2a2a] border border-[#444] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition duration-200 z-50">
                  <button 
                    onClick={() => exportReport('PDF')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#bfa45b] hover:text-[#1b1b1b] border-b border-[#444] transition duration-150 rounded-t-lg"
                  >
                    Export PDF
                  </button>
                  <button 
                    onClick={() => exportReport('Excel')}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#bfa45b] hover:text-[#1b1b1b] transition duration-150 rounded-b-lg"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Date Range Presets - Only visible on mobile */}
          <div className="md:hidden border-t border-[#444] px-6 py-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {['Today', 'Week', 'This Month', 'Last Month'].map((preset) => (
                <button 
                  key={preset}
                  onClick={() => handleDatePreset(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition duration-200 ${
                    selectedDatePreset === preset
                      ? 'bg-[#bfa45b] text-[#1b1b1b] shadow-lg'
                      : 'bg-[#2a2a2a] border border-[#444] text-gray-300 hover:border-[#bfa45b] hover:text-[#bfa45b]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="mt-[120px] md:mt-16 px-3 md:px-6 py-4 md:py-6 min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-64px)]">

        {/* All 4 KPI Cards (connected to backend period) */}
        <div className="grid gap-3 md:gap-5 mb-4 md:mb-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <TotalRevenueCard 
            period={currentPeriod}
            onRefresh={handleRefresh}
          />
          <TotalAppointmentsCard 
            period={currentPeriod}
            onRefresh={handleRefresh}
          />
          <TotalActiveStudentsCard 
            period={currentPeriod}
            onRefresh={handleRefresh}
          />
          <LessonCompletionRateCard 
            period={currentPeriod}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Quick Actions Section */}
        <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-4 md:p-6 mb-4 md:mb-6 transition duration-200`}>
          <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Quick Actions</h3>
          <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {/* Add Appointment */}
            <button 
              onClick={() => setShowAddAppointmentModal(true)}
              className="flex items-center justify-center md:justify-start gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-[#bfa45b] to-[#cfb86b] hover:from-[#cfb86b] hover:to-[#d4c876] text-[#1b1b1b] font-semibold text-sm md:text-base rounded-xl transition duration-200 hover:-translate-y-0.5 group"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition duration-200" />
              <span className="hidden sm:inline">Add Appointment</span>
              <span className="sm:hidden">Appointment</span>
            </button>

            {/* Add Module */}
            <button 
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center justify-center md:justify-start gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-[#bfa45b] to-[#cfb86b] hover:from-[#cfb86b] hover:to-[#d4c876] text-[#1b1b1b] font-semibold text-sm md:text-base rounded-xl transition duration-200 hover:-translate-y-0.5 group"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition duration-200" />
              <span className="hidden sm:inline">Add Module</span>
              <span className="sm:hidden">Module</span>
            </button>

            {/* Add Lessons */}
            <button 
              onClick={() => setShowAddLessonModal(true)}
              className="flex items-center justify-center md:justify-start gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-gradient-to-r from-[#bfa45b] to-[#cfb86b] hover:from-[#cfb86b] hover:to-[#d4c876] text-[#1b1b1b] font-semibold text-sm md:text-base rounded-xl transition duration-200 hover:-translate-y-0.5 group"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition duration-200" />
              <span className="hidden sm:inline">Add Lessons</span>
              <span className="sm:hidden">Lessons</span>
            </button>
          </div>
        </div>

        {/* Charts Section - Row 1: Revenue Trend & Bookings by Service */}
        <div className="grid gap-4 md:gap-5 mb-4 md:mb-6 lg:grid-cols-2">
          {/* Revenue Trend */}
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-4 md:p-6 transition duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Revenue Trend</h3>
                <p className="text-xs text-gray-400 mt-1">{dateRange.start} to {dateRange.end}</p>
              </div>
              {isLoadingCharts && <span className="text-xs text-[#bfa45b]">Updating...</span>}
            </div>
            {revenueChartData ? (
              <div className="h-64 md:h-80">
                <Line 
                  ref={revenueChartRef}
                  data={revenueChartData} 
                  options={chartOptions('Revenue')}
                />
              </div>
            ) : (
              <div className="h-64 md:h-80 flex items-center justify-center bg-[#1b1b1b] rounded-lg">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-2">Loading revenue data...</p>
                  <div className="inline-block animate-spin">
                    <div className="w-6 h-6 border-2 border-[#bfa45b] border-t-transparent rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 md:mt-4 grid grid-cols-3 gap-2 md:gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400">Peak Revenue</p>
                <p className="text-base md:text-lg font-bold text-[#bfa45b]">₱{revenueChartData?.datasets[0]?.data && revenueChartData.datasets[0].data.length > 0 ? (Math.max(...revenueChartData.datasets[0].data) || 0).toLocaleString() : '0'}K</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Low Revenue</p>
                <p className="text-base md:text-lg font-bold text-[#bfa45b]">₱{revenueChartData?.datasets[0]?.data && revenueChartData.datasets[0].data.length > 0 ? (Math.min(...revenueChartData.datasets[0].data) || 0).toLocaleString() : '0'}K</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Avg Revenue</p>
                <p className="text-base md:text-lg font-bold text-[#bfa45b]">₱{revenueChartData?.datasets[0]?.data && revenueChartData.datasets[0].data.length > 0 ? (Math.round(revenueChartData.datasets[0].data.reduce((a, b) => (a || 0) + (b || 0), 0) / revenueChartData.datasets[0].data.length) || 0).toLocaleString() : '0'}K</p>
              </div>
            </div>
          </div>

          {/* Bookings by Service Type */}
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-4 md:p-6 transition duration-200`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 md:mb-6">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-white">Bookings by Service Type</h3>
                <p className="text-xs text-gray-400 mt-1">Service distribution</p>
              </div>
              {isLoadingCharts && <span className="text-xs text-[#bfa45b]">Updating...</span>}
            </div>
            {bookingsByServiceData && (
              <>
                <div className="h-64 md:h-80 mb-3 md:mb-4">
                  <Bar 
                    data={bookingsByServiceData} 
                    options={chartOptions('Bookings')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs md:text-sm">
                  {bookingsByServiceData.labels.map((service, idx) => (
                    <div key={idx} className="bg-[#1b1b1b] p-2 md:p-3 rounded">
                      <p className="text-xs text-gray-400">{service}</p>
                      <p className="text-sm md:text-base font-bold text-[#bfa45b] mt-1">{bookingsByServiceData.datasets[0].data[idx]}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{bookingsByServiceData.percentages[idx]}%</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:gap-5 mb-4 md:mb-6 lg:grid-cols-2">
          {/* Donut: Activity Segmentation */}
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-4 md:p-6 transition duration-200`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 md:mb-6">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-white">Activity Segmentation</h3>
                <p className="text-xs text-gray-400 mt-1">User activity breakdown</p>
              </div>
              {isLoadingCharts && <span className="text-xs text-[#bfa45b]">Updating...</span>}
            </div>
            {studentActivityData?.donut && (
              <>
                <div className="h-48 md:h-56 mb-3 md:mb-4">
                  <Bar 
                    data={{
                      labels: studentActivityData.donut.labels,
                      datasets: [{
                        label: 'Users',
                        data: studentActivityData.donut.datasets[0].data,
                        backgroundColor: studentActivityData.donut.datasets[0].backgroundColor,
                        borderColor: studentActivityData.donut.datasets[0].borderColor,
                        borderWidth: 2,
                      }]
                    }}
                    options={chartOptions('Activity')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs md:text-sm">
                  {studentActivityData.donut.labels.map((label, idx) => (
                    <div key={idx} className="p-2 md:p-3 bg-[#1b1b1b] rounded">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm md:text-base font-bold mt-1" style={{color: studentActivityData.donut.datasets[0].backgroundColor[idx]}}>{studentActivityData.donut.datasets[0].data[idx]}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Line: Daily Active Users */}
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-6 transition duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Daily Active Users</h3>
                <p className="text-xs text-gray-400 mt-1">DAU Trend</p>
              </div>
              {isLoadingCharts && <span className="text-xs text-[#bfa45b]">Updating...</span>}
            </div>
            {studentActivityData?.line && (
              <>
                <div className="h-64 mb-6">
                  <Line 
                    data={studentActivityData.line} 
                    options={chartOptions('DAU')}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400">Peak</p>
                    <p className="text-lg font-bold text-[#28c76f]">{studentActivityData.line.peak}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Average</p>
                    <p className="text-lg font-bold text-[#bfa45b]">{studentActivityData.line.average}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Lowest</p>
                    <p className="text-lg font-bold text-[#ff9f43]">{studentActivityData.line.lowest}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tables Section - Row 1 */}
        <div className="grid gap-3 md:gap-5 mb-4 md:mb-6 grid-cols-1 lg:grid-cols-2">
          <TopStudentsTable 
            students={topStudents}
            onViewProfile={(name) => console.log('View profile:', name)}
          />
        </div>

        {/* Recent User Registrations Notification Section */}
        <div className="grid gap-5 mb-6">
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-6 hover:border-[#bfa45b] hover:shadow-lg hover:shadow-[#bfa45b]/20 transition-all duration-200`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd700] flex items-center justify-center text-[#1b1b1b]">
                  <UserCheck size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">New User Registrations</h3>
              </div>
              <a href="/admin/users" className="text-xs text-[#ffd700] hover:text-[#ffed4e] transition">View All →</a>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {Array.isArray(registrationNotifications) && registrationNotifications.length > 0 ? (
                registrationNotifications.map((notif, idx) => (
                  <div key={idx} className="bg-[#1a1a1a] border border-[#ffd700]/30 rounded-lg p-4 hover:border-[#ffd700]/60 transition duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#ffd700]">{notif.name || 'New User'}</p>
                        <p className="text-xs text-gray-400 mt-1">{notif.email || 'No email'}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notif.created_at || new Date()).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedUserDetails(notif)}
                          className="px-3 py-1 text-xs bg-[#ffd700] text-[#1b1b1b] rounded hover:bg-[#ffed4e] transition font-semibold cursor-pointer"
                          title="View User"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No new registrations</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Schedule Section */}
        <div className="grid gap-5 mb-6">
          {/* Today's Schedule Table */}
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-6 hover:border-[#bfa45b] hover:shadow-lg hover:shadow-[#bfa45b]/20 transition-all duration-200`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Today's Schedule</h3>
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select className="bg-[#1b1b1b] border border-[#444] rounded-lg px-3 py-2 text-sm text-white hover:border-[#bfa45b] transition duration-200 cursor-pointer">
                  <option>All Status</option>
                  <option>Upcoming</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="p-3 text-left font-semibold text-gray-300">Time</th>
                    <th className="p-3 text-left font-semibold text-gray-300">Student</th>
                    <th className="p-3 text-left font-semibold text-gray-300">Instructor</th>
                    <th className="p-3 text-left font-semibold text-gray-300">Service</th>
                    <th className="p-3 text-left font-semibold text-gray-300">Status</th>
                    <th className="p-3 text-center font-semibold text-gray-300">Check-in</th>
                    <th className="p-3 text-right font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length > 0 ? (
                    bookings.slice(0, 10).map((booking, index) => {
                      const statusClasses = {
                        'Confirmed': 'text-green-400 bg-green-900/30',
                        'Pending': 'text-yellow-400 bg-yellow-900/30',
                        'Cancelled': 'text-red-400 bg-red-900/30',
                        'Completed': 'text-blue-400 bg-blue-900/30',
                      };
                      return (
                        <tr key={index} className="border-b border-gray-700/30 hover:bg-white/5 transition duration-200">
                          <td className="p-3 text-white font-semibold">{booking.start_time || 'N/A'}</td>
                          <td className="p-3 text-gray-200">{booking.customer_name}</td>
                          <td className="p-3 text-gray-300">{booking.instructor_name || 'N/A'}</td>
                          <td className="p-3 text-gray-300">{booking.service_type}</td>
                          <td className="p-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusClasses[booking.status] || 'text-gray-400 bg-gray-900/30'}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <input type="checkbox" className="w-4 h-4 cursor-pointer accent-[#bfa45b]" />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setSelectedBookingDetails(booking)} className="px-2 py-1 text-xs bg-[#bfa45b] text-[#1b1b1b] rounded hover:bg-[#cfb86b] transition duration-200 font-semibold cursor-pointer" title="View Details">Details</button>
                              <button className="px-2 py-1 text-xs bg-[#2a2a2a] border border-[#444] text-gray-300 rounded hover:border-[#bfa45b] hover:text-[#bfa45b] transition duration-200" title="Edit">Edit</button>
                              <button className="px-2 py-1 text-xs bg-[#2a2a2a] border border-[#444] text-gray-300 rounded hover:border-[#bfa45b] hover:text-[#bfa45b] transition duration-200" title="Reschedule">Reschedule</button>
                              <button className="px-2 py-1 text-xs bg-[#2a2a2a] border border-[#444] text-red-400 rounded hover:border-red-500 hover:bg-red-900/30 transition duration-200" title="Cancel">Cancel</button>
                              <button className="px-2 py-1 text-xs bg-[#2a2a2a] border border-[#444] text-gray-300 rounded hover:border-[#bfa45b] hover:text-[#bfa45b] transition duration-200" title="Send Reminder">Remind</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-5 text-center text-gray-400">No scheduled appointments for today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>Showing 1-{Math.min(10, bookings.length)} of {bookings.length} appointments</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-[#2a2a2a] border border-[#444] rounded hover:border-[#bfa45b] transition duration-200">Previous</button>
                <button className="px-3 py-1 bg-[#2a2a2a] border border-[#444] rounded hover:border-[#bfa45b] transition duration-200">Next</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* User Details Modal */}
      {selectedUserDetails && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#232323] border border-[#444] rounded-2xl max-w-md w-full p-6" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">User Details</h2>
              <button
                onClick={() => setSelectedUserDetails(null)}
                className="text-[#bbb] hover:text-[#ffd700] text-2xl transition"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Full Name</p>
                <p className="text-lg font-semibold text-[#ffd700]">{selectedUserDetails.name || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-sm text-white break-all">{selectedUserDetails.email || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">User ID</p>
                <p className="text-sm text-white">{selectedUserDetails.id || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Registration Date</p>
                <p className="text-sm text-white">
                  {new Date(selectedUserDetails.created_at || new Date()).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Role</p>
                <p className="text-sm text-white capitalize">{selectedUserDetails.role || 'N/A'}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setSelectedUserDetails(null)}
                className="px-4 py-2 bg-[#1b1b1b] border border-[#444] hover:border-[#bfa45b] text-white rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigate('/admin/users');
                  setSelectedUserDetails(null);
                }}
                className="px-4 py-2 bg-[#bfa45b] hover:bg-[#cfb86b] text-[#1b1b1b] rounded-lg font-semibold transition-colors"
              >
                View Full Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBookingDetails && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#232323] border border-[#444] rounded-2xl max-w-md w-full p-6" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Booking Details</h2>
              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="text-[#bbb] hover:text-[#ffd700] text-2xl transition"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Student Name</p>
                <p className="text-lg font-semibold text-[#ffd700]">{selectedBookingDetails.customer_name || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Service</p>
                <p className="text-sm text-white">{selectedBookingDetails.service_type || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Date & Time</p>
                <p className="text-sm text-white">{selectedBookingDetails.start_time || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Instructor</p>
                <p className="text-sm text-white">{selectedBookingDetails.instructor_name || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className="text-sm text-white capitalize">{selectedBookingDetails.status || 'N/A'}</p>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#444]">
                <p className="text-xs text-gray-400 mb-2">QR Code</p>
                <div className="bg-white p-3 rounded flex items-center justify-center">
                  <p className="text-xs text-gray-600 text-center">QR Code for Booking ID</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="px-4 py-2 bg-[#1b1b1b] border border-[#444] hover:border-[#bfa45b] text-white rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showAddAppointmentModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#232323] border border-[#444] rounded-2xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-white">Add Appointment</h2>
              <button
                onClick={() => setShowAddAppointmentModal(false)}
                className="text-[#bbb] hover:text-[#ffd700] text-2xl transition"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-6">
              {/* Left Column */}
              <div className="space-y-4">
                <FormGroupAdmin
                  label="Full Name *"
                  name="name"
                  type="text"
                  value={appointmentForm.name}
                  onChange={handleAppointmentInputChange}
                  error={appointmentFormErrors.name}
                />
                <FormGroupAdmin
                  label="Email *"
                  name="email"
                  type="email"
                  value={appointmentForm.email}
                  onChange={handleAppointmentInputChange}
                  error={appointmentFormErrors.email}
                />
                <FormGroupAdmin
                  label="Mobile Number *"
                  name="contact"
                  type="text"
                  value={appointmentForm.contact}
                  placeholder="09123456789"
                  onChange={handleAppointmentInputChange}
                  error={appointmentFormErrors.contact}
                  maxLength="11"
                />
                <FormGroupAdmin
                  label="Birthday"
                  name="birthday"
                  type="date"
                  value={appointmentForm.birthday}
                  onChange={handleAppointmentInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  error={appointmentFormErrors.birthday}
                />
                <div className="form-group">
                  <label className="font-bold text-sm text-white mb-2 block">Address</label>
                  <textarea
                    name="address"
                    value={appointmentForm.address}
                    onChange={handleAppointmentInputChange}
                    rows="2"
                    className="w-full px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-white focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition resize-none"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Service Type Selection */}
                <FormSelectAdmin
                  label="Service Type *"
                  name="service"
                  value={appointmentForm.service}
                  onChange={(e) => handleAppointmentServiceChange(e.target.value)}
                  error={appointmentFormErrors.service}
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
                {appointmentForm.service === 'music_lesson' && (
                  <FormSelectAdmin
                    label="Select Instructor *"
                    name="instructor"
                    value={appointmentForm.instructor_id || ''}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, instructor_id: e.target.value ? parseInt(e.target.value) : null }))}
                    error={appointmentFormErrors.instructor_id}
                    options={[
                      { value: '', label: 'Select an instructor...' },
                      ...instructors.map(instructor => ({
                        value: instructor.id,
                        label: `${instructor.first_name} ${instructor.last_name} - ${instructor.specialization || 'General'}`
                      }))
                    ]}
                  />
                )}

                {/* Duration Selection */}
                {appointmentForm.service && (
                  <div className="form-group">
                    {SERVICE_CONFIG[appointmentForm.service]?.durationFixed ? (
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
                              onClick={() => handleAppointmentDurationChange(option.minutes.toString())}
                              className={`p-3 rounded border-2 transition font-medium text-sm
                                ${appointmentForm.duration === option.minutes.toString()
                                  ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                                  : 'border-[#3d3d3d] bg-[#181818] text-gray-300 hover:border-[#ffd700]'
                                }
                              `}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {appointmentFormErrors.duration && <div className="text-red-500 text-xs mt-1">{appointmentFormErrors.duration}</div>}
                      </>
                    )}
                  </div>
                )}

                {/* Date Selection */}
                {appointmentForm.service && appointmentForm.duration && (
                  <FormGroupAdmin
                    label="Booking Date *"
                    name="date"
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) => handleAppointmentDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    error={appointmentFormErrors.date}
                  />
                )}

                {/* Time Slot Selection */}
                {appointmentForm.service && appointmentForm.duration && appointmentForm.date && (
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
                            onClick={() => handleAppointmentTimeSlotChange(slot)}
                            className={`p-2 rounded border-2 transition font-medium text-xs
                              ${appointmentForm.timeSlot === slot.display
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
                    {appointmentFormErrors.timeSlot && <div className="text-red-500 text-xs mt-1">{appointmentFormErrors.timeSlot}</div>}
                  </div>
                )}
                
                <FormGroupAdmin
                  label="Number of People *"
                  name="people"
                  type="number"
                  value={appointmentForm.people}
                  onChange={handleAppointmentInputChange}
                  error={appointmentFormErrors.people}
                  min="1"
                  max="20"
                />
                <FormSelectAdmin
                  label="Payment Method *"
                  name="payment"
                  value={appointmentForm.payment}
                  onChange={handleAppointmentInputChange}
                  error={appointmentFormErrors.payment}
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

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddAppointmentModal(false)}
                className="flex-1 px-4 py-2 bg-[#1b1b1b] border border-[#444] text-white rounded-lg hover:border-[#bfa45b] transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAppointment}
                className="flex-1 px-4 py-3 bg-[#ffd700] hover:bg-[#ffe44c] text-black rounded-lg transition font-bold"
              >
                Save & Go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      <AddModuleModal
        isOpen={showAddModuleModal}
        onClose={() => {
          setShowAddModuleModal(false);
          setModuleForm({ name: '', description: '', instrument: 'piano', difficulty: 'beginner' });
          setModuleFormErrors({});
        }}
        onAdd={(newModule) => {
          console.log('Module created:', newModule);
          setShowAddModuleModal(false);
          setModuleForm({ name: '', description: '', instrument: 'piano', difficulty: 'beginner' });
          setModuleFormErrors({});
          // TODO: Send to backend API
        }}
        formData={moduleForm}
        setFormData={setModuleForm}
        errors={moduleFormErrors}
        setErrors={setModuleFormErrors}
      />

      {/* Add Lesson Modal */}
      <AddLessonModal
        isOpen={showAddLessonModal}
        onClose={() => {
          setShowAddLessonModal(false);
          setLessonForm({ title: '', duration: '', description: '' });
          setLessonFormErrors({});
        }}
        onAdd={(newLesson) => {
          console.log('Lesson created:', newLesson);
          setShowAddLessonModal(false);
          setLessonForm({ title: '', duration: '', description: '' });
          setLessonFormErrors({});
          // TODO: Send to backend API
        }}
        formData={lessonForm}
        setFormData={setLessonForm}
        errors={lessonFormErrors}
        setErrors={setLessonFormErrors}
      />
      </div>
    </div>
  );
};

// Form components for Add Appointment Modal
const FormGroupAdmin = ({ label, name, type, value, onChange, error, placeholder, min, max, maxLength }) => (
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
      maxLength={maxLength}
      className="px-3 py-2 bg-[#181818] border border-[#3d3d3d] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition"
    />
    {error && <div className="text-red-500 text-xs">{error}</div>}
  </div>
);

const FormSelectAdmin = ({ label, name, value, onChange, error, options }) => (
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
);

// --- Add Module Modal ---
const AddModuleModal = ({ isOpen, onClose, onAdd, formData, setFormData, errors, setErrors }) => {
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Module name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd({
      ...formData,
      lessons: 0,
      quizzes: 0,
      students: 0,
      completionRate: 0,
      avgScore: 0,
      status: 'draft',
      published: false,
      updated: new Date().toISOString().split('T')[0],
      createdDate: new Date().toISOString().split('T')[0],
    });

    setFormData({ name: '', description: '', instrument: 'piano', difficulty: 'beginner' });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#2a2a2a] border border-[#444] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#23233a] border-b border-[#444] p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Module</h2>
          <button onClick={onClose} className="text-[#bbb] hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Module Name */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Module Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter module name"
              className={`w-full px-4 py-2.5 bg-[#1b1b1b] border rounded-lg text-white placeholder-[#666] focus:outline-none transition-colors ${
                errors.name ? 'border-red-500' : 'border-[#444] focus:border-[#bfa45b]'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter module description"
              rows="4"
              className={`w-full px-4 py-2.5 bg-[#1b1b1b] border rounded-lg text-white placeholder-[#666] focus:outline-none transition-colors resize-none ${
                errors.description ? 'border-red-500' : 'border-[#444] focus:border-[#bfa45b]'
              }`}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Instrument & Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Instrument <span className="text-red-500">*</span>
              </label>
              <select
                name="instrument"
                value={formData.instrument}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-[#1b1b1b] border border-[#444] rounded-lg text-white focus:outline-none focus:border-[#bfa45b] transition-colors"
              >
                <option value="piano">Piano</option>
                <option value="guitar">Guitar</option>
                <option value="theory">Theory</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Difficulty Level <span className="text-red-500">*</span>
              </label>
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-[#1b1b1b] border border-[#444] rounded-lg text-white focus:outline-none focus:border-[#bfa45b] transition-colors"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-[#23233a] border border-[#444] rounded-lg p-4">
            <p className="text-xs text-[#bbb]">
              <span className="font-semibold text-[#bfa45b]">Note:</span> Module will be created as a draft. You can add lessons and quizzes after creation, then publish when ready.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b1b1b] border border-[#444] hover:border-[#bfa45b] text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#bfa45b] hover:bg-[#cfb86b] text-[#1b1b1b] rounded-lg font-semibold transition-colors"
            >
              Create Module
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Add Lesson Modal ---
const AddLessonModal = ({ isOpen, onClose, onAdd, formData, setFormData, errors, setErrors }) => {
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Lesson title is required';
    if (!formData.duration || parseInt(formData.duration) <= 0) newErrors.duration = 'Valid duration is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd({
      ...formData,
      duration: parseInt(formData.duration),
      contentType: 'text',
    });

    setFormData({ title: '', duration: '', description: '' });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#2a2a2a] border border-[#444] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#23233a] border-b border-[#444] p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add New Lesson</h2>
          <button onClick={onClose} className="text-[#bbb] hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Lesson Title */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Lesson Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter lesson title"
              className={`w-full px-4 py-2.5 bg-[#1b1b1b] border rounded-lg text-white placeholder-[#666] focus:outline-none transition-colors ${
                errors.title ? 'border-red-500' : 'border-[#444] focus:border-[#bfa45b]'
              }`}
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="e.g., 15"
              className={`w-full px-4 py-2.5 bg-[#1b1b1b] border rounded-lg text-white placeholder-[#666] focus:outline-none transition-colors ${
                errors.duration ? 'border-red-500' : 'border-[#444] focus:border-[#bfa45b]'
              }`}
            />
            {errors.duration && <p className="text-red-500 text-xs mt-1">{errors.duration}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter lesson description (optional)"
              rows="4"
              className="w-full px-4 py-2.5 bg-[#1b1b1b] border border-[#444] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#bfa45b] transition-colors resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="bg-[#23233a] border border-[#444] rounded-lg p-4">
            <p className="text-xs text-[#bbb]">
              <span className="font-semibold text-[#bfa45b]">Note:</span> You can add quizzes and manage the lesson order after creating the lesson.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b1b1b] border border-[#444] hover:border-[#bfa45b] text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#bfa45b] hover:bg-[#cfb86b] text-[#1b1b1b] rounded-lg font-semibold transition-colors"
            >
              Add Lesson
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;