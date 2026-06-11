import { useState } from 'react';
import ConfirmDialog from '../UI/ConfirmDialog';

const PRIORITY = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700'
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function TaskCard({ task, onClick, onStatusChange, columns, currentUserId, currentUserRole }) {
  const [confirm, setConfirm] = useState(null);

  const canMove = !task.assignedTo || task.assignedTo === currentUserId || currentUserRole === 'admin';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  const handleMoveClick = (col) => setConfirm({ colId: col.id, colLabel: col.label });

  const handleConfirm = () => {
    onStatusChange(task.id, confirm.colId);
    setConfirm(null);
  };

  return (
    <>
      <div onClick={onClick}
        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY[task.priority]}`}>
            {task.priority}
          </span>
          {task.assignee && (
            <span className="text-xs text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-0.5 rounded-full">
              {task.assignee.name}
            </span>
          )}
          {task.dueDate && (
            <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {isOverdue && <span title="Overdue">⚠</span>}
              {isOverdue ? 'Overdue' : new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.labels?.map(tl => (
            <span key={tl.labelId || tl.label?.id}
              className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: tl.label?.color || tl.color }}>
              {tl.label?.name || tl.name}
            </span>
          ))}
        </div>
        {canMove && (
          <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
            {columns.filter(c => c.id !== task.status).map(col => (
              <button key={col.id} onClick={() => handleMoveClick(col)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 transition-colors">
                → {col.label}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-300 dark:text-gray-500 mt-2">{timeAgo(task.createdAt)}</p>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Move Task"
          message={`Move "${task.title}" to ${confirm.colLabel}?`}
          confirmLabel="Move"
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
