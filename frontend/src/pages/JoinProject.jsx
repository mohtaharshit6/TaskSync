import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Layout/Navbar';

export default function JoinProject() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('joining'); // 'joining' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setMessage('No invite code provided.');
      return;
    }
    api.post('/projects/join', { inviteCode: code })
      .then(({ data }) => {
        setStatus('success');
        setTimeout(() => navigate(`/projects/${data.data.projectId}`), 1500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Failed to join project.');
      });
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        {status === 'joining' && (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Joining project…</p>
          </div>
        )}
        {status === 'success' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">You joined the project!</p>
            <p className="text-sm text-gray-400 mt-1">Redirecting…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">{message}</p>
            <button onClick={() => navigate('/')} className="mt-3 text-sm text-indigo-600 hover:underline">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
