import { useState } from 'react';
import apiService from '../lib/apiService';
import DOMPurify from 'dompurify';

export default function LoginModal({ isOpen, onClose, buttonRef }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: DOMPurify.sanitize(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiService.login({
        username: formData.identifier,
        password: formData.password
      });
      
      if (response.success) {
        localStorage.setItem('authProvider', 'password');
        const userRole = response.user.role;

        console.log('🔐 Login successful:', {
          user: response.user,
          role: userRole,
          token: !!response.token
        });

        if (userRole === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (userRole === 'user' || userRole === 'student') {
          window.location.href = '/';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google`;
    } catch (err) {
      setError('Google login failed.');
      setLoading(false);
    }
  };

  const handleFacebookSignIn = () => {
    window.location.href = 'http://localhost:5000/api/auth/facebook';
  };

  const EyeIcon = ({ slashed }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
      {slashed ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </>
      )}
    </svg>
  )

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown Modal */}
      <div className="fixed z-50" style={{
        top: buttonRef?.getBoundingClientRect().bottom + 10 + 'px',
        left: 'auto',
        right: Math.max(0, window.innerWidth - (buttonRef?.getBoundingClientRect().right || 0)) + 'px'
      }}>
        <div className="bg-[#2a2a2a] rounded-2xl w-96 p-10 relative border border-white/5 animate-slideIn" style={{
          boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)'
        }}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#aaa] hover:text-white text-2xl transition"
            aria-label="Close modal"
          >
            ×
          </button>

          {/* Glow border effect */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
            padding: '2px',
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 255, 255, 0.05))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude'
          }}></div>

          <h1 className="text-3xl font-bold text-white mb-2" style={{ textShadow: '0 0 6px rgba(255, 215, 0, 0.3)' }}>
            Login
          </h1>
          <p className="text-[#bbb] mb-8 text-sm">Sign in to your MixLab Studio account</p>

          <div className="space-y-5">
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-white mb-2">
                Email or Username
              </label>
              <input
                type="text"
                id="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="Enter your email or username"
                required
                className="w-full px-4 py-3 bg-[#1c1c1c] border border-[#3d3d3d] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 pr-12 bg-[#1c1c1c] border border-[#3d3d3d] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-[#ffd700] focus:shadow-[0_0_6px_#ffd700] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 hover:opacity-70 transition"
                  aria-label="Toggle password visibility"
                >
                  <EyeIcon slashed={!showPassword} />
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold py-3 rounded-lg transition mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

            {/* Forgot Password */}
            <a 
              href="/auth/forgot-password" 
              className="block text-left text-[#aaa] hover:underline text-sm transition mt-2"
            >
              Forgot password?
            </a>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#444]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#2a2a2a] text-[#aaa]">or sign in with</span>
              </div>
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#333] hover:bg-[#db4437] border-none rounded-lg transition font-semibold"
                style={{ boxShadow: '0 0 10px rgba(219, 68, 55, 0.4)' }}
              >
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/281/281764.png" 
                  alt="Google" 
                  className="w-5 h-5" 
                />
                <span className="text-white">Google</span>
              </button>
              <button
                onClick={handleFacebookSignIn}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#333] hover:bg-[#4267b2] border-none rounded-lg transition font-semibold"
                style={{ boxShadow: '0 0 10px rgba(66, 103, 178, 0.4)' }}
              >
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/733/733547.png" 
                  alt="Facebook" 
                  className="w-5 h-5" 
                />
                <span className="text-white">Facebook</span>
              </button>
            </div>

            {/* Register Link */}
            <p className="text-center text-[#bbb] mt-6 text-sm">
              Don't have an account?{' '}
              <a 
                href="/auth/register" 
                className="text-[#ffd700] hover:underline font-semibold transition"
              >
                Register here
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
