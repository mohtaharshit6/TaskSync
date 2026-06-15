import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import Navbar from '../Layout/Navbar';
import TaskCard from '../Task/TaskCard';
import TaskDetail from '../Task/TaskDetail';
import MembersPanel from './MembersPanel';
import ChatPanel from './ChatPanel';

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: 'border-t-gray-400' },
  { id: 'in_progress', label: 'In Progress',  color: 'border-t-blue-500' },
  { id: 'done',        label: 'Done',         color: 'border-t-green-500' }
];

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const sortTasks = (tasks, sortBy) => {
  const copy = [...tasks];
  if (sortBy === 'due_date') {
    return copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }
  if (sortBy === 'priority_desc') return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  if (sortBy === 'priority_asc')  return copy.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  return copy;
};

export default function ProjectBoard() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoOpenRef = useRef(false);
  const { user } = useAuth();
  const { joinProject, leaveProject, socket } = useSocket();

  const [project, setProject]           = useState(null);
  const [tasks, setTasks]               = useState([]);
  const [sortBy, setSortBy]             = useState('normal');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const searchTimerRef                      = useRef(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [showMembers, setShowMembers]   = useState(false);
  const [showChat, setShowChat]         = useState(false);
  const [showLabels, setShowLabels]     = useState(false);
  const [projectLabels, setProjectLabels] = useState([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [chatUnread, setChatUnread]     = useState(0);
  const showChatRef                     = useRef(false);
  const [createForm, setCreateForm]     = useState({ title: '', description: '', priority: 'medium', status: 'todo' });
  const [creating, setCreating]         = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, tRes, lRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/tasks?projectId=${projectId}&limit=200`),
        api.get(`/projects/${projectId}/labels`)
      ]);
      setProject(pRes.data.data);
      setTasks(tRes.data.data);
      setProjectLabels(lRes.data.data);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) navigate('/');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    fetchData();
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId]);   // eslint-disable-line

  useEffect(() => {
    if (!socket) return;
    const onCreated  = ({ task }) => setTasks(p => [task, ...p]);
    const onUpdated  = ({ taskId, changes }) => setTasks(p => p.map(t => t.id === taskId ? { ...t, ...changes } : t));
    const onDeleted  = ({ taskId }) => { setTasks(p => p.filter(t => t.id !== taskId)); setSelectedTask(p => p?.id === taskId ? null : p); };
    const onProjUpd  = ({ changes }) => setProject(p => ({ ...p, ...changes }));
    const onNewMsg = () => { if (!showChatRef.current) setChatUnread(c => c + 1); };
    const onMemberAdded = ({ user: u, role }) => setProject(p => p ? ({
      ...p,
      members: [...(p.members || []), { userId: u.id, role, user: u }]
    }) : p);
    const onRoleChanged = ({ userId, role }) => setProject(p => p ? ({
      ...p,
      members: p.members.map(m => m.userId === userId ? { ...m, role } : m)
    }) : p);

    socket.on('task_created',    onCreated);
    socket.on('task_updated',    onUpdated);
    socket.on('task_deleted',    onDeleted);
    socket.on('project_updated', onProjUpd);
    socket.on('member_added',      onMemberAdded);
    socket.on('member_role_changed', onRoleChanged);
    socket.on('new_message',     onNewMsg);
    return () => {
      socket.off('task_created',    onCreated);
      socket.off('task_updated',    onUpdated);
      socket.off('task_deleted',    onDeleted);
      socket.off('project_updated', onProjUpd);
      socket.off('member_added',       onMemberAdded);
      socket.off('member_role_changed', onRoleChanged);
      socket.off('new_message',     onNewMsg);
    };
  }, [socket]);

  // Keep showChatRef in sync so socket handler closure always reads current value
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);

  // Auto-open a task when arriving from a notification link (?task=<id>)
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId || autoOpenRef.current || tasks.length === 0) return;
    const found = tasks.find(t => t.id === taskId);
    if (found) { autoOpenRef.current = true; setSelectedTask(found); }
  }, [tasks, searchParams]);

  const members         = project?.members ?? [];
  const currentUserRole = members.find(m => m.userId === user?.id)?.role ?? 'member';

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/tasks', { ...createForm, projectId });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', priority: 'medium', status: 'todo' });
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleStatusChange = async (taskId, status) => {
    try { await api.put(`/tasks/${taskId}`, { status }); }
    catch (err) {
      const msg = err.response?.data?.message;
      if (msg) alert(msg);
      console.error(err);
    }
  };

  const handleMemberRemoved = (userId) => {
    setProject(p => p ? ({ ...p, members: p.members.filter(m => m.userId !== userId) }) : p);
  };

  const handleMembersUpdated = (userId, role) => {
    setProject(p => p ? ({ ...p, members: p.members.map(m => m.userId === userId ? { ...m, role } : m) }) : p);
  };

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      const { data } = await api.post(`/projects/${projectId}/labels`, { name: newLabelName.trim(), color: newLabelColor });
      setProjectLabels(l => [...l, data.data]);
      setNewLabelName('');
    } catch (err) { console.error(err); }
  };

  const handleDeleteLabel = async (labelId) => {
    try {
      await api.delete(`/projects/${projectId}/labels/${labelId}`);
      setProjectLabels(l => l.filter(x => x.id !== labelId));
    } catch (err) { console.error(err); }
  };

  const setF = (k) => (e) => setCreateForm(f => ({ ...f, [k]: e.target.value }));

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) { fetchData(); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/tasks?projectId=${projectId}&search=${encodeURIComponent(val)}&limit=200`);
        setTasks(res.data.data);
      } catch {}
    }, 300);
  };

  const filteredTasks = filterAssignee ? tasks.filter(t => t.assignedTo === filterAssignee) : tasks;
  const displayTasks  = sortTasks(filteredTasks, sortBy);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><Navbar />
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">Loading board…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate('/')} className="text-sm text-indigo-600 hover:underline mb-1 block">
              ← Back to projects
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project?.name}</h1>
            {project?.description && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{project.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onClick={() => { setShowMembers(true); }}
              className="text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Members ({members.length})
            </button>
            {currentUserRole === 'admin' && (
              <button onClick={() => setShowLabels(v => !v)}
                className="text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Labels
              </button>
            )}
            <button
              onClick={() => { setShowChat(true); setChatUnread(0); }}
              className="relative text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Chat
              {chatUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            <input
              type="text" value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search tasks…"
              className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-[8rem] sm:flex-none sm:w-36"
            />
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <option value="">All Members</option>
              {members.map(m => (
                <option key={m.userId} value={m.userId}>{m.user?.name}</option>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              <option value="normal">Sort: Default</option>
              <option value="due_date">Sort: Due Date</option>
              <option value="priority_desc">Sort: Priority (High → Low)</option>
              <option value="priority_asc">Sort: Priority (Low → High)</option>
            </select>
            <button onClick={() => setShowCreate(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              + Add Task
            </button>
          </div>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(col => (
            <div key={col.id} className={`bg-white dark:bg-gray-800 rounded-xl border-t-4 ${col.color} border border-gray-200 dark:border-gray-700 p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-700 dark:text-gray-200">{col.label}</h2>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
                  {displayTasks.filter(t => t.status === col.id).length}
                </span>
              </div>
              <div className="space-y-3 min-h-[180px]">
                {displayTasks.filter(t => t.status === col.id).map(task => (
                  <TaskCard key={task.id} task={task} columns={COLUMNS}
                    onClick={() => setSelectedTask(task)}
                    onStatusChange={handleStatusChange}
                    currentUserId={user?.id}
                    currentUserRole={currentUserRole} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Labels Panel */}
      {showLabels && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Labels</h2>
              <button onClick={() => setShowLabels(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {projectLabels.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No labels yet. Create one below.</p>
              ) : projectLabels.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 group">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{l.name}</span>
                  </div>
                  <button onClick={() => handleDeleteLabel(l.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-opacity">
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleCreateLabel} className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <input
                type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)}
                className="w-9 h-9 p-0.5 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer flex-shrink-0"
                title="Pick color"
              />
              <input
                type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                placeholder="Label name…" maxLength={40}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" disabled={!newLabelName.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                Add
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input type="text" value={createForm.title} onChange={setF('title')} required maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Task title" />
                <p className={`text-xs mt-1 text-right ${createForm.title.length > 240 ? 'text-red-500' : 'text-gray-400'}`}>
                  {createForm.title.length}/255
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={createForm.description} onChange={setF('description')} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select value={createForm.priority} onChange={setF('priority')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Column</label>
                  <select value={createForm.status} onChange={setF('status')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                <select value={createForm.assignedTo || ''} onChange={setF('assignedTo')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.user?.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {creating ? 'Adding…' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetail
          taskId={selectedTask.id}
          members={members}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedTask(null)}
          onDelete={(id) => { setTasks(p => p.filter(t => t.id !== id)); setSelectedTask(null); }}
          onUpdate={(t) => { setTasks(p => p.map(x => x.id === t.id ? t : x)); setSelectedTask(t); }}
        />
      )}

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          projectId={projectId}
          currentUser={user}
          currentUserRole={currentUserRole}
          socket={socket}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Members Panel */}
      {showMembers && (
        <MembersPanel
          projectId={projectId}
          members={members}
          currentUserRole={currentUserRole}
          currentUserId={user?.id}
          ownerId={project?.ownerId}
          onClose={() => setShowMembers(false)}
          onMemberRemoved={handleMemberRemoved}
          onMembersUpdated={handleMembersUpdated}
        />
      )}
    </div>
  );
}
