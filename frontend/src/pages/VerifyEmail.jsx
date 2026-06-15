import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/api';

export default function VerifyEmail() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const email     = location.state?.email || '';

  const [shownOtp, setShownOtp]   = useState(location.state?.otp || '');
  const [emailSent, setEmailSent] = useState(false);
  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(false);
  const [error, setError]         = useState('');

  // If we arrived without a code (e.g. via the login redirect), fetch one
  // automatically so the user sees it on first load — no manual click needed.
  useEffect(() => {
    if (shownOtp || !email) return;
    (async () => {
      setFetching(true);
      try {
        const { data } = await api.post('/auth/resend-otp', { email });
        if (data.otp) setShownOtp(data.otp);
        else setEmailSent(true);
      } catch {
        setError('Could not generate a code. Tap "Resend code" to try again.');
      } finally {
        setFetching(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setError('');
    setLoading(false);
    setFetching(true);
    try {
      const { data } = await api.post('/auth/resend-otp', { email });
      if (data.otp) { setShownOtp(data.otp); setEmailSent(false); }
      else { setEmailSent(true); setShownOtp(''); }
    } catch {
      setError('Failed to resend. Try again.');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✉️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {shownOtp
              ? 'Enter the 6-digit code below to verify your account.'
              : emailSent
                ? <>We sent a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span></>
                : 'Generating your verification code…'}
          </p>
        </div>

        {/* Code shown on screen (this build delivers the OTP in-app) */}
        {shownOtp && (
          <div className="mb-5 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg text-center">
            <p className="text-xs uppercase tracking-wide text-indigo-500 dark:text-indigo-300 mb-1">Your verification code</p>
            <p className="text-3xl font-bold font-mono tracking-[0.4em] text-indigo-700 dark:text-indigo-200">{shownOtp}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
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
          <button onClick={handleResend} disabled={fetching}
            className="text-indigo-600 hover:underline disabled:opacity-50">
            {fetching ? 'Generating…' : 'Resend code'}
          </button>
          <Link to="/login" className="hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
