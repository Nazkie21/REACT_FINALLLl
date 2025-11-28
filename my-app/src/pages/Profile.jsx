import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Award, BookOpen, Flame, Zap, Crown, Trophy, Music, Gem, Edit3, Lock } from 'lucide-react';
import { FaRightFromBracket } from 'react-icons/fa6';
import apiService from '../lib/apiService';
import badge1Icon from '../assets/icons/badge1.png';
import NotificationDropdown from '../components/NotificationDropdown';

export default function ProfileDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('achievements');
  const [points, setPoints] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpThreshold, setXpThreshold] = useState(500);
  const [level, setLevel] = useState(1);
  const [streakDays, setStreakDays] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalInfo, setPersonalInfo] = useState({
    username: '',
    email: '',
    birthday: '',
    contact: '',
    address: ''
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    lesson: true,
    achieve: true,
  });
  const [continueLessons, setContinueLessons] = useState([]);
  const [recentLessons, setRecentLessons] = useState([]);
  const [recentBadges, setRecentBadges] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);

  const badgeIconMap = {
    badge1: badge1Icon,
  };

  // Get user data and progress from backend (and fall back to localStorage if needed)
  useEffect(() => {
    const initProfile = async () => {
      // Optimistic: show cached user immediately if available
      const storedUser = localStorage.getItem('user');
      if (storedUser && !userData) {
        try {
          setUserData(JSON.parse(storedUser));
        } catch (e) {
          console.log('Error parsing user data:', e);
        }
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/auth/login');
          return;
        }

        // Fetch profile
        const result = await apiService.getProfile();
        const user = result.user || result.data || result;

        if (user) {
          setUserData(user);
          localStorage.setItem('user', JSON.stringify(user));
        }

        // Fetch learning progress / stats
        const progress = await apiService.getUserProgress();
        const data = progress.data || progress;

        if (data?.xp) {
          setXp(data.xp.total_xp ?? 0);
          setLevel(data.xp.current_level ?? 1);
          setXpThreshold(data.xp.xp_to_next_level ?? 500);
          setStreakDays(data.xp.current_streak_days ?? 0);
          setPoints(data.xp.total_xp ?? 0);
        }

        if (Array.isArray(data?.badges)) {
          setBadgeCount(data.badges.length);
          setRecentBadges(data.badges.slice(0, 3));
          setEarnedBadgeIds(data.badges.map((b) => b.badge_id));
        }

        if (Array.isArray(data?.completedLessonsList)) {
          // Use the most recently completed lessons as "Continue Learning" entries
          setContinueLessons(data.completedLessonsList.slice(0, 5));
          setRecentLessons(data.completedLessonsList.slice(0, 3));
        }

        // Fetch all badge definitions (for All Badges & Achievements grid)
        try {
          const allBadgesRes = await apiService.getAllBadges();
          const badgeDefs = allBadgesRes.data || allBadgesRes;
          if (Array.isArray(badgeDefs)) {
            setAllBadges(badgeDefs);
          }
        } catch (badgeErr) {
          console.error('Error fetching all badges:', badgeErr);
        }

        // Fetch recent bookings for booking history
        try {
          const bookingsRes = await apiService.getBookings();
          const bookingsData = bookingsRes.data || bookingsRes.bookings || bookingsRes;
          if (Array.isArray(bookingsData)) {
            const sorted = [...bookingsData].sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
            setRecentBookings(sorted.slice(0, 3));
          }
        } catch (bookErr) {
          console.error('Error fetching booking history:', bookErr);
        }
      } catch (err) {
        console.error('Error initializing profile:', err);
        const status = err.response?.status;
        if (status === 401) {
          navigate('/auth/login');
        }
      } finally {
        setLoading(false);
      }
    };

    initProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync editable personal info state when userData changes
  useEffect(() => {
    if (userData) {
      setPersonalInfo({
        username: userData.username || '',
        email: userData.email || '',
        birthday: userData.birthday || '',
        contact: userData.contact || userData.phone || '',
        address: userData.home_address || userData.address || ''
      });
    }
  }, [userData]);

  const xpPercentage = Math.min(100, Math.round((xp / xpThreshold) * 100));

  const toggleNotification = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    navigate('/auth/login');
  };

  const badgeTypeIconMap = {
    milestone: Award,
    mastery: Trophy,
    streak: Flame,
    special: Crown,
  };

  const formatLessonProgress = (lesson) => {
    // We only have completed lessons list from backend.
    // Use xp_earned as a proxy for progress percentage (capped at 100).
    const progress = Math.min(100, Math.round((lesson.xp_earned || 0) / (lesson.xp_reward || 100) * 100) || 0);
    return {
      id: lesson.progress_id || lesson.lesson_id,
      title: lesson.lesson_name || 'Lesson',
      completed: 1,
      lessons: 1,
      progress,
    };
  };

  const getDisplayName = () => {
    if (!userData) return 'User';
    if (userData.first_name || userData.last_name) {
      return [userData.first_name, userData.last_name].filter(Boolean).join(' ');
    }
    return userData.username || userData.email || 'User';
  };

  const getAvatarLetter = () => {
    const name = getDisplayName();
    return (name.charAt(0) || 'U').toUpperCase();
  };

  const handleSavePersonalInfo = async () => {
    try {
      const payload = {
        username: personalInfo.username || undefined,
        birthday: personalInfo.birthday || null,
        contact: personalInfo.contact || null,
        home_address: personalInfo.address || null,
      };

      const result = await apiService.updateProfile(payload);
      const updatedUser = result.user || result.data || userData;

      if (updatedUser) {
        setUserData(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setIsEditingPersonal(false);
      alert('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-[#1b1b1b] text-gray-200 flex items-center justify-center">
        <div className="text-gray-100 text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-gray-200">
      {/* Header */}
      <header className="w-full sticky top-0 z-50 bg-[#1b1b1b] shadow-md border-b border-[#444]">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="bg-transparent border-2 border-yellow-600 border-opacity-15 p-2 rounded-lg text-yellow-500 hover:border-opacity-25 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-yellow-500">Profile</h1>
            <div className="ml-auto flex items-center gap-2">
              <NotificationDropdown isAdmin={false} />
              <button 
                onClick={handleLogout}
                className="bg-transparent border-2 border-yellow-600 border-opacity-15 p-2 rounded-lg text-yellow-500 hover:border-opacity-25 transition flex items-center gap-1"
              >
                <FaRightFromBracket size={18} /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-6 py-4">

        {/* Main Grid - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-3">
            {/* Profile Card */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center font-bold text-3xl text-gray-900 mx-auto mb-1 overflow-hidden">
                {getAvatarLetter()}
              </div>
              <div className="text-center font-bold text-gray-100 text-base">{getDisplayName()}</div>
              <div className="text-center text-gray-300 text-sm mb-1">Student</div>

              {/* Stats */}
              <div className="flex gap-2 mt-2">
                {[
                  { num: points, label: 'Points' },
                  { num: `${badgeCount}/5`, label: 'Badges' },
                  { num: streakDays, label: 'Streak (days)' },
                ].map((stat, i) => (
                  <div key={i} className="flex-1 bg-white/3 backdrop-blur p-2 rounded-2xl text-center border border-white/3">
                    <div className="font-bold text-xl text-gray-100">{stat.num}</div>
                    <div className="text-sm text-gray-300">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* XP Progress */}
              <div className="mt-2">
                <div className="flex justify-between text-sm text-gray-300 mb-1">
                  <span>Level {level}</span>
                  <span>{xp} / {xpThreshold} XP</span>
                </div>
                <div className="bg-white/3 backdrop-blur h-2 rounded-full overflow-hidden border border-white/2">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 transition-all duration-500"
                    style={{ width: `${xpPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Continue Learning */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="font-bold text-gray-100 mb-2 text-base">Continue Learning</div>
              <div className="space-y-2">
                {(continueLessons || []).map((lesson) => {
                  const formatted = formatLessonProgress(lesson);
                  return (
                    <div key={formatted.id} className="bg-white/1 border border-white/2 rounded-2xl p-3 hover:bg-white/2 transition cursor-pointer">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-100 text-sm truncate">{formatted.title}</div>
                          <div className="text-xs text-gray-300 mb-1">{formatted.completed} / {formatted.lessons} lessons</div>
                          <div className="bg-white/2 h-1.5 rounded-full overflow-hidden border border-white/1">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 transition-all"
                              style={{ width: `${formatted.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-sm text-yellow-400 font-semibold whitespace-nowrap">{formatted.progress}%</div>
                      </div>
                    </div>
                  );
                })}
                {(!continueLessons || continueLessons.length === 0) && (
                  <div className="text-sm text-gray-400">No recent lessons yet. Start a module to see it here.</div>
                )}
              </div>
            </div>

            {/* Recently Finished */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="font-bold text-gray-100 mb-1 text-base">Recently Finished</div>
              <div className="space-y-0.5 text-sm text-gray-300">
                {recentLessons.length > 0 ? (
                  recentLessons.map((lesson, idx) => (
                    <div key={idx}>
                      Lesson: {lesson.lesson_name || 'Lesson'}
                    </div>
                  ))
                ) : (
                  <div>No recently finished lessons yet.</div>
                )}
              </div>
            </div>

            {/* Recent Achievements */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="font-bold text-gray-100 mb-1 text-base">Recent Achievements</div>
              <div className="space-y-1 text-sm text-gray-300">
                {recentBadges.length > 0 ? (
                  recentBadges.map((badge, idx) => {
                    const iconSrc = badgeIconMap[badge.badge_icon_url];
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {iconSrc && (
                          <img
                            src={iconSrc}
                            alt={badge.badge_name || 'Badge icon'}
                            className="w-7 h-7 rounded-full object-cover border border-white/20"
                          />
                        )}
                        <div>
                          <div className="text-gray-100">
                            {badge.badge_name || 'Badge'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(badge.earned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div>No recent achievements yet.</div>
                )}
              </div>
            </div>

            {/* Booking History */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="font-bold text-gray-100 mb-1 text-base">Booking History</div>
              <div className="space-y-0.5 text-sm text-gray-300">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking, idx) => (
                    <div key={idx}>
                      {booking.service_name || booking.service_type || 'Booking'} — {new Date(booking.booking_date).toLocaleDateString()}
                    </div>
                  ))
                ) : (
                  <div>No recent bookings found.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            {/* Personal Information */}
            <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-gray-100 text-base">Personal Information</div>
                <button
                  type="button"
                  onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                  className="text-yellow-500 hover:text-yellow-400 p-1 rounded-lg border border-yellow-600/20 hover:border-yellow-600/40 transition"
                  aria-label={isEditingPersonal ? 'Disable editing' : 'Enable editing'}
                >
                  <Edit3 size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'name', label: 'Name:', value: getDisplayName(), editable: false },
                  { key: 'username', label: 'Username:', value: personalInfo.username, editable: true },
                  { key: 'email', label: 'Email:', value: personalInfo.email, editable: false },
                  { key: 'birthday', label: 'Birthday:', value: personalInfo.birthday, editable: true },
                  { key: 'contact', label: 'Contact:', value: personalInfo.contact, editable: true },
                  { key: 'address', label: 'Address:', value: personalInfo.address, editable: true },
                ].map((field, i) => (
                  <label key={i} className="block text-sm text-gray-300">
                    {field.label}
                    <input
                      type={field.key === 'birthday' ? 'date' : 'text'}
                      value={field.value || ''}
                      readOnly={!isEditingPersonal || !field.editable}
                      onChange={(e) => {
                        if (!field.editable) return;
                        const value = e.target.value;
                        setPersonalInfo(prev => ({
                          ...prev,
                          [field.key]: value,
                        }));
                      }}
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-100 text-sm focus:outline-none focus:border-yellow-500/30"
                    />
                  </label>
                ))}
              </div>
              {isEditingPersonal && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePersonalInfo}
                    className="px-4 py-1.5 rounded-lg border border-yellow-600/40 bg-yellow-500/10 text-yellow-200 text-sm font-semibold hover:bg-yellow-500/20 hover:border-yellow-500/60 transition"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5">
              {['achievements', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-2xl border text-sm transition ${
                    activeTab === tab
                      ? 'bg-yellow-600/10 border-yellow-600/20 text-yellow-500 font-semibold'
                      : 'bg-transparent border-white/5 text-gray-300 hover:border-white/10'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
                <div className="font-bold text-gray-100 mb-2 text-base">All Badges & Achievements</div>
                <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                  {allBadges.map((badge) => {
                    const isUnlocked = earnedBadgeIds.includes(badge.badge_id);
                    const TypeIcon = badgeTypeIconMap[badge.badge_type] || Gem;
                    const iconSrc = badgeIconMap[badge.badge_icon_url];
                    return (
                      <div
                        key={badge.badge_id}
                        className={`p-2 rounded-2xl bg-white/1 transition text-center border ${
                          isUnlocked
                            ? 'border-yellow-500/70 shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                            : 'border-white/2'
                        }`}
                      >
                        <div className="flex justify-center mb-1">
                          {iconSrc ? (
                            <img
                              src={iconSrc}
                              alt={badge.badge_name}
                              className="w-8 h-8 rounded-full object-cover border border-white/20"
                            />
                          ) : (
                            <TypeIcon size={32} className="text-yellow-400" />
                          )}
                        </div>
                        <div className="font-semibold text-gray-100 text-sm line-clamp-2">
                          {badge.badge_name}
                        </div>
                        <div className="text-xs text-gray-300 mt-1 line-clamp-2">
                          {badge.description}
                        </div>
                        {!isUnlocked && (
                          <div className="flex justify-center mt-1 text-yellow-400">
                            <Lock size={14} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {allBadges.length === 0 && (
                    <div className="col-span-4 text-center text-sm text-gray-400">
                      No badges defined yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-gradient-to-b from-white/2 to-white/1 backdrop-blur border border-yellow-600 border-opacity-10 rounded-3xl p-4">
                <div className="font-bold text-gray-100 mb-2 text-base">Notification Preferences</div>
                <div className="space-y-2">
                  {[
                    { key: 'email', title: 'Email Notifications', desc: 'Lesson updates, achievements' },
                    { key: 'lesson', title: 'Lesson Updates', desc: 'New lessons & module changes' },
                    { key: 'achieve', title: 'Achievement Alerts', desc: 'Badges & milestones' },
                  ].map(pref => (
                    <div key={pref.key} className="flex justify-between items-center p-2.5 rounded-2xl bg-white/1 border border-white/2">
                      <div>
                        <div className="font-semibold text-gray-100 text-sm">{pref.title}</div>
                        <div className="text-xs text-gray-300">{pref.desc}</div>
                      </div>
                      <button
                        onClick={() => {
                          setNotifications(prev => ({ ...prev, [pref.key]: !prev[pref.key] }));
                        }}
                        className={`w-11 h-6 rounded-full relative transition ${
                          notifications[pref.key]
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                            : 'bg-white/10'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                            notifications[pref.key] ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Security Section */}
                <div className="mt-2 p-2.5 rounded-2xl bg-white/1 border border-white/2">
                  <div className="text-sm text-gray-300 font-semibold">Security</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-sm text-gray-300">Password: •••••••• </div>
                    <button className="text-xs px-2 py-1 rounded border border-yellow-600/30 text-yellow-500 hover:border-yellow-600/50 transition">
                      Change
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center">
          <div className="bg-[#2a2a2a] rounded-xl p-10 max-w-sm w-11/12 text-center shadow-2xl border border-[#ffb400]/30">
            <div className="text-5xl mb-5 flex justify-center">
              <FaRightFromBracket className="text-[#ffb400] w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Log Out?</h2>
            <p className="text-base text-gray-400 mb-8">Are you sure you want to log out of your account?</p>
            <div className="flex gap-4 justify-center">
              <button 
                className="px-8 py-3 bg-[#3d3d3d] text-white font-semibold rounded-lg transition-all hover:bg-[#4a4a4a]"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-8 py-3 bg-[#ffb400] text-black font-semibold rounded-lg transition-all hover:bg-[#ffe44c]"
                onClick={confirmLogout}
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
