import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ token: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: form.token, newPassword: form.newPassword });
      navigate('/login', { state: { message: 'Password reset successfully. Please log in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
        <p className="text-sm text-gray-500 mb-6">Paste your reset token and choose a new password.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reset Token</label>
            <input value={form.token} onChange={set('token')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              placeholder="Paste token here" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={form.newPassword} onChange={set('newPassword')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min 8 chars, 1 uppercase, 1 number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat new password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-indigo-600 hover:underline">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
