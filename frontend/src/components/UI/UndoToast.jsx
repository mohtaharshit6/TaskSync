import { useEffect, useState } from 'react';

export default function UndoToast({ message, duration = 10000, onUndo, onExpire }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) { clearInterval(interval); onExpire(); }
    }, 50);
    return () => clearInterval(interval);
  }, [duration, onExpire]);

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:bottom-5 sm:right-5 sm:left-auto z-[300] w-auto sm:w-72 bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm">{message}</span>
        <button
          onClick={onUndo}
          className="ml-4 text-sm font-semibold text-indigo-300 hover:text-indigo-100 transition-colors flex-shrink-0"
        >
          Undo
        </button>
      </div>
      {/* Countdown progress bar */}
      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-indigo-400 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
