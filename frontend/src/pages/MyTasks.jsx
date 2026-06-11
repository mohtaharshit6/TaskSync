import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Layout/Navbar';

const PRIORITY = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700'
};

const STATUS = {
  todo:        { label: 'To Do',       color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700' }
};

const STATUS_ORDER = ['todo', 'in_progress', 'done'];

export default function MyTasks() {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all'); // 'all' | 'todo' | 'in_progress' | 'done'
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/tasks/my')
      .then(r => setTasks(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const displayed = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = displayed.filter(t => t.status === s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tasks</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All tasks assigned to you across every project</p>
          </div>
          <div className="flex gap-2">
            {['all', 'todo', 'in_progress', 'done'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
                }`}
              >
                {s === 'all' ? 'All' : STATUS[s].label}
                {s !== 'all' && (
                  <span className="ml-1.5 opacity-70">{tasks.filter(t => t.status === s).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium">No tasks assigned to you yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {STATUS_ORDER.map(s => {
              const group = grouped[s];
              if (group.length === 0) return null;
              return (
                <div key={s}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS[s].color}`}>
                      {STATUS[s].label}
                    </span>
                    <span className="text-xs text-gray-400">{group.length} task{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {group.map(task => (
                      <div key={task.id}
                        onClick={() => navigate(`/projects/${task.project.id}`)}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start justify-between gap-4 cursor-pointer hover:shadow-sm hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                              {task.project?.name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY[task.priority]}`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-gray-400">
                                Due {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
