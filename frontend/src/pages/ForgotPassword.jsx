import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep]         = useState(1); // 1 = email, 2 = otp + new password
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState('');
  const [newPassword, setNew]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      navigate('/login', { state: { message: 'Password reset successfully. Please log in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Forgot Password</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Enter your email and we'll send a 6-digit OTP.
            </p>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              <Link to="/login" className="text-indigo-600 hover:underline">Back to login</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Reset Password</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Enter the OTP sent to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> and your new password.
              <span className="block text-xs mt-1 opacity-70">(Dev mode: check the server terminal for the OTP.)</span>
            </p>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">6-digit OTP</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required maxLength={6} placeholder="000000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
                <input type="password" value={newPassword} onChange={e => setNew(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Min 8 chars" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Repeat password" />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              <button onClick={() => { setStep(1); setError(''); setOtp(''); setNew(''); setConfirm(''); }}
                className="text-indigo-600 hover:underline">
                ← Use a different email
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
