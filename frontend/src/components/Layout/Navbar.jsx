import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/api';
import useDarkMode from '../../hooks/useDarkMode';

// Consistent color per project derived from its id
const CHIP_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-orange-100 text-orange-700',
];
const chipColor = (id = '') => CHIP_COLORS[id.charCodeAt(0) % CHIP_COLORS.length];

const TYPE_ICON = {
  task_assigned: '📋',
  task_moved:    '↗',
  member_added:  '👥',
  comment_added: '💬',
  mentioned:     '@',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [dark, setDark] = useDarkMode();
  const { id: currentProjectId } = useParams(); // set when on /projects/:id, else undefined

  const [notifications, setNotifications] = useState([]);
  const [totalUnread, setTotalUnread]     = useState(0);
  const [showDrop, setShowDrop]           = useState(false);
  const dropRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.data);
      setTotalUnread(data.unreadCount);
    } catch {}
  };

  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  useEffect(() => {
    if (!socket) return;
    const onNotif = (notif) => {
      setNotifications(p => [notif, ...p].slice(0, 50));
      setTotalUnread(c => c + 1);
    };
    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [socket]);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter notifications based on current page context
  const visible = currentProjectId
    ? notifications.filter(n => n.projectId === currentProjectId)
    : notifications;

  const visibleUnread = currentProjectId
    ? visible.filter(n => !n.isRead).length
    : totalUnread;

  const handleMarkAll = async () => {
    try {
      const url = currentProjectId
        ? `/notifications/read-all?projectId=${currentProjectId}`
        : '/notifications/read-all';
      await api.put(url);
      setNotifications(p => p.map(n =>
        (!currentProjectId || n.projectId === currentProjectId) ? { ...n, isRead: true } : n
      ));
      if (!currentProjectId) setTotalUnread(0);
      else setTotalUnread(c => Math.max(0, c - visibleUnread));
    } catch {}
  };

  const handleMarkOne = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
      setTotalUnread(c => Math.max(0, c - 1));
    } catch {}
  };

  const handleNotifClick = (n) => {
    if (!n.isRead) handleMarkOne(n.id);
    setShowDrop(false);
    if (n.projectId) {
      navigate(n.taskId ? `/projects/${n.projectId}?task=${n.taskId}` : `/projects/${n.projectId}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-indigo-600">TaskSync</Link>
      <div className="flex items-center gap-4">
        <Link to="/my-tasks" className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors">My Tasks</Link>
        <span className="text-sm text-gray-600 dark:text-gray-300">{user?.name}</span>

        {/* Dark mode toggle */}
        <button onClick={() => setDark(d => !d)}
          className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {dark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => { setShowDrop(v => !v); if (!showDrop) fetchNotifications(); }}
            className="relative p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-4.976A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {visibleUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {visibleUnread > 9 ? '9+' : visibleUnread}
              </span>
            )}
          </button>

          {showDrop && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {currentProjectId ? 'Project Notifications' : 'Notifications'}
                </span>
                {visibleUnread > 0 && (
                  <button onClick={handleMarkAll} className="text-xs text-indigo-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {visible.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-6">No notifications</p>
                ) : visible.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!n.isRead ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                  >
                    <span className="text-base mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      {!currentProjectId && n.project?.name && (
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium mb-1 ${chipColor(n.project.id)}`}>
                          {n.project.name}
                        </span>
                      )}
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={handleLogout} className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
          Logout
        </button>
      </div>
    </nav>
  );
}
