import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/api';

export default function VerifyEmail() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const email     = location.state?.email || '';
  const devOtp    = location.state?.otp || '';

  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, otp });
      navigate('/login', { state: { message: 'Email verified! You can now log in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-otp', { email });
      setResendMsg(data.otp ? `New OTP: ${data.otp}` : 'New OTP sent to your email.');
    } catch {
      setResendMsg('Failed to resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✉️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Enter the 6-digit code sent to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
          </p>
        </div>

        {/* Dev mode: show OTP inline */}
        {devOtp && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
            Dev mode — your OTP is: <span className="font-bold font-mono tracking-widest">{devOtp}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {resendMsg && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-700 dark:text-green-300">
            {resendMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" maxLength={6} required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" disabled={loading || otp.length !== 6}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50">
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <button onClick={handleResend} disabled={resending}
            className="text-indigo-600 hover:underline disabled:opacity-50">
            {resending ? 'Sending…' : 'Resend OTP'}
          </button>
          <Link to="/login" className="hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
