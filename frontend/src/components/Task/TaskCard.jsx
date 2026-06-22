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

  const isAdmin = currentUserRole === 'admin';
  const canMove = !task.assignedTo || task.assignedTo === currentUserId || isAdmin;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  // A completed task can only be reopened (moved out of Done) by an admin.
  const moveTargets = columns.filter(c => {
    if (c.id === task.status) return false;
    if (task.status === 'done' && !isAdmin) return false;
    return true;
  });

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
        {canMove && moveTargets.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-600" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Move to</p>
            <div className="flex flex-wrap gap-1.5">
              {moveTargets.map(col => (
                <button key={col.id} onClick={() => handleMoveClick(col)}
                  title={`Move to ${col.label}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-1 rounded-md hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-500 transition-colors">
                  <span aria-hidden="true">→</span> {col.label}
                </button>
              ))}
            </div>
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
