import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../Layout/Navbar';

export default function Dashboard() {
  const [projects, setProjects]         = useState([]);
  const [archived, setArchived]         = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [showJoin, setShowJoin]         = useState(false);
  const [form, setForm]                 = useState({ name: '', description: '' });
  const [creating, setCreating]         = useState(false);
  const [joinCode, setJoinCode]         = useState('');
  const [joining, setJoining]           = useState(false);
  const [joinError, setJoinError]       = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        api.get('/projects?status=active'),
        api.get('/projects?status=archived')
      ]);
      setProjects(activeRes.data.data);
      setArchived(archivedRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/projects', form);
      setProjects(p => [data.data, ...p]);
      setShowCreate(false);
      setForm({ name: '', description: '' });
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      const { data } = await api.post('/projects/join', { inviteCode: joinCode.trim().toUpperCase() });
      navigate(`/projects/${data.data.projectId}`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to join project');
    } finally { setJoining(false); }
  };

  const handleArchive = async (e, projectId) => {
    e.stopPropagation();
    try {
      await api.put(`/projects/${projectId}/archive`);
      fetchProjects();
    } catch (err) { console.error(err); }
  };

  const handleUnarchive = async (e, projectId) => {
    e.stopPropagation();
    try {
      await api.put(`/projects/${projectId}/unarchive`);
      fetchProjects();
    } catch (err) { console.error(err); }
  };

  const openJoin = () => { setJoinCode(''); setJoinError(''); setShowJoin(true); };

  const ProjectCard = ({ p, isArchived = false }) => (
    <div onClick={() => !isArchived && navigate(`/projects/${p.id}`)}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-shadow ${isArchived ? 'opacity-70' : 'cursor-pointer hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{p.name}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.owner?.id === user?.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
            {p.owner?.id === user?.id ? 'Owner' : 'Member'}
          </span>
          {p.overdueCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
              ⚠ {p.overdueCount} overdue
            </span>
          )}
        </div>
      </div>
      {p.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">{p.description}</p>}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex gap-4">
          <span>{p._count?.tasks ?? 0} tasks</span>
          <span>{p._count?.members ?? 0} members</span>
        </div>
        {p.owner?.id === user?.id && (
          isArchived ? (
            <button onClick={(e) => handleUnarchive(e, p.id)}
              className="text-xs text-indigo-600 hover:underline">Restore</button>
          ) : (
            <button onClick={(e) => handleArchive(e, p.id)}
              className="text-xs text-gray-400 hover:text-gray-600">Archive</button>
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your projects and teams</p>
          </div>
          <div className="flex gap-3">
            <button onClick={openJoin}
              className="border border-indigo-300 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors font-medium">
              Join Project
            </button>
            <button onClick={() => setShowCreate(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              + New Project
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading projects…</div>
        ) : projects.length === 0 && archived.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create a new project or join one with an invite code</p>
            <div className="flex gap-3 justify-center">
              <button onClick={openJoin}
                className="border border-indigo-300 text-indigo-600 px-6 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                Join Project
              </button>
              <button onClick={() => setShowCreate(true)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Create Project
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => <ProjectCard key={p.id} p={p} />)}
            </div>
            {archived.length > 0 && (
              <div className="mt-10">
                <button onClick={() => setShowArchived(v => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium mb-4">
                  <span>{showArchived ? '▼' : '▶'}</span>
                  Archived Projects ({archived.length})
                </button>
                {showArchived && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {archived.map(p => <ProjectCard key={p.id} p={p} isArchived />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Project name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Join a Project</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter the invite code shared by the project admin.</p>
            <form onSubmit={handleJoin} className="space-y-3">
              <input type="text" value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                maxLength={16} placeholder="Paste invite code"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest font-mono text-lg uppercase"
              />
              {joinError && <p className="text-sm text-red-500">{joinError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowJoin(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={joining || joinCode.trim().length < 8}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {joining ? 'Joining…' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
