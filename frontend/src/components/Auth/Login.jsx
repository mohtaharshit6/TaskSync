import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname + (location.state?.from?.search ?? '') || '/';
  const flashMessage = location.state?.message;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        navigate('/verify-email', { state: { email: err.response.data.email } });
        return;
      }
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">TaskSync</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to your workspace</p>
        </div>
        {flashMessage && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{flashMessage}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input type="password" value={form.password} onChange={set('password')} required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">Forgot your password?</Link>
          <span>Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-medium">Sign up</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
