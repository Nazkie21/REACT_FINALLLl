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

// --- Dummy/Initial Data Structure (Will be overwritten by API) ---

const initialMetrics = {
  totalUsers: '2,847', userGrowth: '+12.5%',
  totalAppointments: '156', appointmentGrowth: '+8.2%',
  completedLessons: '24', newLessons: '4 new this month',
  monthlyRevenue: '₱45.8K', revenueGrowth: '+15.3%',
  engagementRate: '87.4%', engagementGrowth: '+3.1%'
};

const initialRevenueData = {
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [{
        label: 'Revenue',
        data: [12, 19, 3, 5, 20], // Example data in K
    }],
};

const initialEngagementData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
        { label: 'Active Users', data: [65, 59, 80, 81, 56, 55, 40] },
        { label: 'Lessons Completed', data: [28, 48, 40, 19, 86, 27, 90] },
    ],
};

const dummyBookings = [
    { booking_id: '001', customer_name: 'John Doe', service_type: 'Vocal Recording', days: '2 hrs', status: 'Confirmed' },
    { booking_id: '002', customer_name: 'Jane Smith', service_type: 'Band Recording', days: '3 hrs', status: 'Pending' },
    { booking_id: '003', customer_name: 'Alice Brown', service_type: 'Podcast', days: '1 hr', status: 'Confirmed' },
    { booking_id: '004', customer_name: 'Bob White', service_type: 'Mixing & Mastering', days: '4 hrs', status: 'Cancelled' },
    { booking_id: '005', customer_name: 'Charlie Green', service_type: 'Vocal Recording', days: '2 hrs', status: 'Confirmed' },
];

const dummyUsers = [
    { first_name: 'Alice', last_name: 'Johnson', email: 'alice@mail.com', total_points: 150, is_verified: true },
    { first_name: 'Mark', last_name: 'Davis', email: 'mark@mail.com', total_points: 80, is_verified: false },
    { first_name: 'Sara', last_name: 'Lee', email: 'sara@mail.com', total_points: 320, is_verified: true },
    { first_name: 'Tom', last_name: 'Wilson', email: 'tom@mail.com', total_points: 0, is_verified: true },
];

const calendarEvents = [5, 10]; // Days with events

// --- Reusable Component Definitions ---

const MetricIcon = ({ icon: Icon }) => (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-400 text-gray-900 flex-shrink-0">
        <Icon className="w-6 h-6" />
    </div>
);

const MetricCard = ({ icon, label, value, change, isPositive }) => {
    const changeClass = isPositive ? 'text-green-500' : 'text-gray-400';
    return (
        <div className={`${BASE_CLASSES.CARD_BG} border border-gray-700 rounded-2xl p-6 flex gap-4 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-950/30 transition duration-200 hover:-translate-y-0.5`}>
            <MetricIcon icon={icon} />
            <div className="flex-1">
                <p className="text-sm text-gray-400 mb-2">{label}</p>
                <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
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
    plugins: {
        legend: {
            display: titleText === 'User Engagement', // Only display legend for bar chart
            labels: {
                color: '#a0a0a0',
            },
        },
        title: {
            display: false,
        },
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
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- State Initialization ---
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [metrics, setMetrics] = useState(initialMetrics);
  const [revenueChartData, setRevenueChartData] = useState(initialRevenueData);
  const [engagementChartData, setEngagementChartData] = useState(initialEngagementData);
  const [bookingsByServiceData, setBookingsByServiceData] = useState(null);
  const [studentActivityData, setStudentActivityData] = useState(null);
  const [bookings, setBookings] = useState(dummyBookings);
  const [recentUsers, setRecentUsers] = useState(dummyUsers);
  const [topStudents, setTopStudents] = useState([]);
  const [registrationNotifications, setRegistrationNotifications] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedDatePreset, setSelectedDatePreset] = useState('Last 7 Days');
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  
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

  // Fetch user registration notifications
  useEffect(() => {
    const fetchRegistrationNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/notifications/admin/registrations`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          setRegistrationNotifications(result.data.notifications || []);
        }
      } catch (error) {
        console.error('Error fetching registration notifications:', error);
      }
    };

    fetchRegistrationNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRegistrationNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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
      case 'Yesterday':
        isShortRange = true;
        break;
      case 'Last 7 Days':
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
      case 'Yesterday':
        start = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'Last 7 Days':
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Last 30 Days':
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        break;
      default:
        break;
    }
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });
    setSelectedDatePreset(preset);

    // Automatically refresh charts with new date range
    setIsLoadingCharts(true);
    setTimeout(() => {
      setRevenueChartData(generateRevenueData(preset));
      setBookingsByServiceData(generateBookingsByServiceData(preset));
      setStudentActivityData(generateStudentActivityData(preset));
      setLastUpdated(new Date());
      setIsLoadingCharts(false);
    }, 300); // Simulate API call delay
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
    } : initialRevenueData;

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
    } : initialEngagementData;

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
      const period = selectedDatePreset === 'Last 7 Days' ? 'week' : 'month';
      
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
        setRevenueChartData(initialRevenueData);
      }

      // Process bookings by service
      if (serviceRes.ok) {
        const serviceData = await serviceRes.json();
        const data = Array.isArray(serviceData.data) ? serviceData.data : [];
        if (data.length > 0) {
          setBookingsByServiceData({
            labels: data.map(s => s.service_name || 'Unknown'),
            datasets: [{
              label: 'Bookings',
              data: data.map(s => s.count || 0),
              backgroundColor: ['#ffb400', '#ff6b6b', '#4ade80', '#3b82f6', '#ec4899']
            }],
            percentages: data.map(s => parseFloat(s.percentage || 0).toFixed(1))
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
    } catch (error) {
      console.error(error);
    }
  }, [selectedDatePreset, dateRange, initialRevenueData, initialEngagementData]);

  // ... rest of the code remains the same ...

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 p-6">
        {/* Recent Users Section */}
        <div className="grid gap-5 mb-6">
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-6 hover:border-[#ffb400] hover:shadow-lg hover:shadow-[#ffb400]/30 transition duration-200`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Recent Users</h3>
              <a href="/admin/users" className="text-xs text-[#ffb400] hover:text-[#ffed4e] transition">View All →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider text-left bg-white/5 rounded-tl-xl">User</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider text-left bg-white/5">Level/Points</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider text-left bg-white/5">Email</th>
                    <th className="p-4 text-sm font-semibold text-gray-400 uppercase tracking-wider text-left bg-white/5 rounded-tr-xl">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(recentUsers) && recentUsers.length > 0 ? (
                      recentUsers.map((user, index) => (
                          <UserRow 
                              key={index} 
                              name={user.name || 'Unknown'} 
                              email={user.email || 'N/A'} 
                              points={user.points || 0}
                              level={user.level || 1}
                              status={user.status || 'inactive'}
                          />
                      ))
                  ) : (
                      <tr><td colSpan="4" className="text-center text-gray-400 p-5">No recent users.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent User Registrations Notification Section */}
        <div className="grid gap-5 mb-6">
          <div className={`${BASE_CLASSES.CARD_BG} border-2 border-[#ffd700] rounded-2xl p-6 hover:shadow-lg hover:shadow-[#ffd700]/30 transition duration-200 bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a]`}>
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
                        <p className="text-sm font-semibold text-[#ffd700]">New Registration</p>
                        <p className="text-sm text-gray-300 mt-1">{notif.message || `${notif.name || 'New User'} registered`}</p>
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
                          className="px-3 py-1 text-xs bg-[#ffd700] text-[#1b1b1b] rounded hover:bg-[#ffed4e] transition font-semibold"
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
          <div className={`${BASE_CLASSES.CARD_BG} border border-[#444] rounded-2xl p-6 hover:border-[#ffb400] hover:shadow-lg hover:shadow-[#ffb400]/30 transition duration-200`}>
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
                          <td className="p-3 text-white font-semibold">09:00 AM</td>
                          <td className="p-3 text-gray-200">{booking.customer_name}</td>
                          <td className="p-3 text-gray-300">Sarah Johnson</td>
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
                              <button className="px-2 py-1 text-xs bg-[#bfa45b] text-[#1b1b1b] rounded hover:bg-[#cfb86b] transition duration-200 font-semibold" title="View Details">Details</button>
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
    </div>
  );
};

export default AdminDashboard;