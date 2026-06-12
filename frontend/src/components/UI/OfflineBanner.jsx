import { useState, useEffect } from 'react';

// Reflects the device's real network status only. A dropped Socket.io
// connection is NOT "offline" — the socket reconnects on its own (and on
// free hosting the server may briefly spin down), so it must not trigger
// a scary "check your internet" banner while the network is fine.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

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

  if (!offline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-red-500 text-white text-sm text-center py-2 px-4 font-medium shadow-lg">
      You're offline — changes may not save. Reconnecting…
    </div>
  );
}
