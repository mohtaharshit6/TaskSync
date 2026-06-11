import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getToken } from '../api/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const socketRef = useRef(null);
  const currentProjectRef = useRef(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const s = io(import.meta.env.VITE_SOCKET_URL || '', { withCredentials: true, auth: { token: getToken() } });
    socketRef.current = s;
    setSocket(s);

    // Re-join project room after reconnect (e.g. brief network drop)
    s.on('connect', () => {
      if (currentProjectRef.current) {
        s.emit('join_project', currentProjectRef.current);
      }
    });

    // Re-authenticate when the socket gets an auth error after token refresh
    s.on('connect_error', (err) => {
      if (err.message === 'Invalid or expired token') {
        const newToken = getToken();
        if (newToken) {
          s.auth = { token: newToken };
          s.connect();
        }
      }
    });

    return () => { s.disconnect(); socketRef.current = null; };
  }, [user]);

  // When API interceptor refreshes the token, push the new token into the socket
  useEffect(() => {
    const onTokenRefresh = (e) => {
      if (socketRef.current) {
        socketRef.current.auth = { token: e.detail.token };
        if (!socketRef.current.connected) socketRef.current.connect();
      }
    };
    window.addEventListener('token-refreshed', onTokenRefresh);
    return () => window.removeEventListener('token-refreshed', onTokenRefresh);
  }, []);

  const joinProject = (id) => {
    currentProjectRef.current = id;
    socket?.emit('join_project', id);
  };

  const leaveProject = (id) => {
    if (currentProjectRef.current === id) currentProjectRef.current = null;
    socket?.emit('leave_project', id);
  };

  return (
    <SocketContext.Provider value={{ socket, joinProject, leaveProject }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
