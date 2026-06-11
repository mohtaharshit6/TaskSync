import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const { socket } = useSocket();

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => setOffline(true);
    const onConnect    = () => setOffline(false);
    socket.on('disconnect', onDisconnect);
    socket.on('connect',    onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect',    onConnect);
    };
  }, [socket]);

  if (!offline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-red-500 text-white text-sm text-center py-2 px-4 font-medium shadow-lg">
      You're offline — changes may not save. Reconnecting…
    </div>
  );
}
