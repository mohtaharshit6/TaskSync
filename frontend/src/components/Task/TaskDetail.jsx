import { useState, useEffect } from 'react';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import CommentThread from '../Comment/CommentThread';
import ConfirmDialog from '../UI/ConfirmDialog';

const PRIORITY = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700'
};

const ACTION_LABEL = {
  created: 'created this task',
  status_changed: 'moved task',
  edited: 'edited task details',
  commented: 'added a comment'
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function TaskDetail({ taskId, onClose, onDelete, onUpdate, members = [], currentUserRole }) {
  const [task, setTask]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [form, setForm]               = useState({});
  const [saving, setSaving]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab]     = useState('comments'); // 'comments' | 'activity' | 'subtasks'
  const [activities, setActivities]   = useState([]);
  const [subtasks, setSubtasks]       = useState([]);
  const [newSubtask, setNewSubtask]   = useState('');
  const [labels, setLabels]           = useState([]);         // project labels
  const [taskLabels, setTaskLabels]   = useState([]);         // labels on this task
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const { user } = useAuth();
  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    api.get(`/tasks/${taskId}`).then(r => {
      const t = r.data.data;
      setTask(t);
      setSubtasks(t.subtasks || []);
      setTaskLabels(t.labels?.map(tl => tl.label) || []);
      setForm({
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
        assignedTo: t.assignedTo || ''
      });
      // Fetch project labels
      api.get(`/projects/${t.project?.id || t.projectId}/labels`)
        .then(lr => setLabels(lr.data.data))
        .catch(() => {});
    }).catch(console.error).finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    if (activeTab === 'activity' && activities.length === 0) {
      api.get(`/tasks/${taskId}/activity`)
        .then(r => setActivities(r.data.data))
        .catch(console.error);
    }
  }, [activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, assignedTo: form.assignedTo || null };
      const { data } = await api.put(`/tasks/${taskId}`, payload);
      setTask(data.data);
      onUpdate(data.data);
      setEditing(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/tasks/${taskId}`); onDelete(taskId); }
    catch (err) { console.error(err); }
  };

  // Subtask handlers
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    try {
      const { data } = await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask });
      setSubtasks(s => [...s, data.data]);
      setNewSubtask('');
    } catch (err) { console.error(err); }
  };

  const handleToggleSubtask = async (subtaskId) => {
    try {
      const { data } = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`);
      setSubtasks(s => s.map(x => x.id === subtaskId ? data.data : x));
    } catch (err) { console.error(err); }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
      setSubtasks(s => s.filter(x => x.id !== subtaskId));
    } catch (err) { console.error(err); }
  };

  // Label handlers
  const handleToggleLabel = async (label) => {
    const assigned = taskLabels.find(l => l.id === label.id);
    try {
      if (assigned) {
        await api.delete(`/tasks/${taskId}/labels/${label.id}`);
        setTaskLabels(tl => tl.filter(l => l.id !== label.id));
      } else {
        await api.post(`/tasks/${taskId}/labels/${label.id}`);
        setTaskLabels(tl => [...tl, label]);
      }
    } catch (err) { console.error(err); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const doneCount = subtasks.filter(s => s.done).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  return (
    <>
    {showConfirm && (
      <ConfirmDialog
        title="Delete Task"
        message={`Are you sure you want to delete "${task?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { setShowConfirm(false); handleDelete(); }}
        onCancel={() => setShowConfirm(false)}
      />
    )}
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1 pr-4">
                {editing ? (
                  <div>
                    <input value={form.title} onChange={set('title')} maxLength={255}
                      className="w-full text-xl font-semibold border-b border-gray-300 dark:border-gray-600 dark:bg-transparent dark:text-white focus:outline-none focus:border-indigo-500 pb-1" />
                    <p className={`text-xs mt-0.5 text-right ${form.title.length > 240 ? 'text-red-500' : 'text-gray-400'}`}>
                      {form.title.length}/255
                    </p>
                  </div>
                ) : (
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{task.title}</h2>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {task.status.replace('_', ' ')}
                  </span>
                  {taskLabels.map(l => (
                    <span key={l.id} className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                      style={{ backgroundColor: l.color }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {editing ? (
                  <>
                    <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                      className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </>
                ) : isAdmin ? (
                  <>
                    {/* Label picker toggle */}
                    <button onClick={() => setShowLabelPicker(v => !v)} title="Labels"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </button>
                    <button onClick={() => setEditing(true)} title="Edit task"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
                      </svg>
                    </button>
                    <button onClick={() => setShowConfirm(true)} title="Delete task"
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </>
                ) : null}
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1">×</button>
              </div>
            </div>

            {/* Label picker dropdown */}
            {showLabelPicker && (
              <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                {labels.length === 0 ? (
                  <p className="text-xs text-gray-400">No labels yet. Create labels from the board header.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {labels.map(l => {
                      const active = taskLabels.some(tl => tl.id === l.id);
                      return (
                        <button key={l.id} onClick={() => handleToggleLabel(l)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all ${active ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 bg-white'}`}
                          style={active ? { backgroundColor: l.color, borderColor: l.color } : {}}>
                          {active && '✓ '}{l.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-5">
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select value={form.status} onChange={set('status')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                    <select value={form.priority} onChange={set('priority')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                    <select value={form.assignedTo} onChange={set('assignedTo')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Unassigned</option>
                      {members.map(m => (
                        <option key={m.userId} value={m.userId}>{m.user?.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input type="date" value={form.dueDate} onChange={set('dueDate')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                  {task.dueDate && <span><span className="text-gray-400 dark:text-gray-500">Due: </span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                  {task.assignee && <span><span className="text-gray-400 dark:text-gray-500">Assigned to: </span>{task.assignee.name}</span>}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                {editing
                  ? <textarea value={form.description} onChange={set('description')} rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Add a description…" />
                  : <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {task.description || <span className="text-gray-400 italic">No description</span>}
                    </p>
                }
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subtasks {subtasks.length > 0 && <span className="text-gray-400 font-normal">({doneCount}/{subtasks.length})</span>}
                  </label>
                </div>
                {subtasks.length > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${subtaskProgress}%` }} />
                  </div>
                )}
                <div className="space-y-1.5 mb-2">
                  {subtasks.map(s => (
                    <div key={s.id} className="flex items-center gap-2 group">
                      <input type="checkbox" checked={s.done} onChange={() => handleToggleSubtask(s.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" />
                      <span className={`text-sm flex-1 ${s.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{s.title}</span>
                      <button onClick={() => handleDeleteSubtask(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                    placeholder="Add subtask…"
                    className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="submit" disabled={!newSubtask.trim()}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40">
                    Add
                  </button>
                </form>
              </div>

              {/* Tabs */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex gap-1 mb-4 border-b border-gray-100 dark:border-gray-700">
                  {['comments', 'activity'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                        activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === 'comments' && (
                  <CommentThread taskId={taskId} currentUser={user} initialComments={task.comments || []} members={members} />
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-3">
                    {activities.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No activity yet</p>
                    ) : activities.map(a => (
                      <div key={a.id} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-bold flex-shrink-0 mt-0.5">
                          {a.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{a.user?.name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400"> {ACTION_LABEL[a.action] || a.action}</span>
                          {a.detail && <span className="text-xs text-gray-400 block">{a.detail}</span>}
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
