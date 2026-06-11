import { useState, useRef, useCallback } from 'react';
import api from '../../api/api';
import ConfirmDialog from '../UI/ConfirmDialog';
import UndoToast from '../UI/UndoToast';

// Render @mentions as blue highlighted spans
function renderMentions(text) {
  const parts = text.split(/(\B@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-indigo-600 font-medium">{part}</span>
      : part
  );
}

export default function CommentThread({ taskId, currentUser, initialComments = [], members = [] }) {
  const [comments, setComments]           = useState(initialComments);
  const [content, setContent]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [hoveredId, setHoveredId]         = useState(null);
  const [showMentions, setShowMentions]   = useState(false);
  const [mentionQuery, setMentionQuery]   = useState('');
  const timerRef    = useRef(null);
  const textareaRef = useRef(null);

  const getMemberRole = (userId) => members.find(m => m.userId === userId)?.role;

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    // Detect @ trigger at cursor
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const filteredMembers = members.filter(m =>
    m.user?.name?.toLowerCase().includes(mentionQuery)
  );

  const insertMention = (name) => {
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const before = content.slice(0, cursor);
    const after  = content.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${name.replace(/\s+/g, '')} `);
    setContent(replaced + after);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/comments', { taskId, content });
      setComments(c => [...c, data.data]);
      setContent('');
      setShowMentions(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDeleteConfirm = () => {
    const comment = confirmDelete;
    setConfirmDelete(null);
    setPendingDelete({ id: comment.id });
    timerRef.current = setTimeout(async () => {
      try {
        await api.delete(`/comments/${comment.id}`);
        setComments(c => c.filter(x => x.id !== comment.id));
      } catch (err) { console.error(err); }
      setPendingDelete(null);
    }, 10000);
  };

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingDelete(null);
  }, []);

  const handleUndoExpire = useCallback(() => { setPendingDelete(null); }, []);

  return (
    <>
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Comments ({comments.length})</h3>
        <div className="space-y-3 mb-4 max-h-52 overflow-y-auto pr-1">
          {comments.length === 0
            ? <p className="text-sm text-gray-400 italic">No comments yet</p>
            : comments.map(c => {
                const isPending = pendingDelete?.id === c.id;
                return (
                  <div key={c.id}
                    className={`flex gap-3 items-start group transition-opacity ${isPending ? 'opacity-40' : ''}`}
                    onMouseEnter={() => setHoveredId(c.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-xs font-bold flex-shrink-0">
                      {c.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{c.user?.name}</span>
                        {getMemberRole(c.userId) === 'admin' && (
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">Admin</span>
                        )}
                        <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                        {c.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${isPending ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {renderMentions(c.content)}
                      </p>
                    </div>
                    {c.userId === currentUser?.id && !isPending ? (
                      <button onClick={() => setConfirmDelete(c)}
                        className={`flex-shrink-0 p-1 rounded transition-opacity ${hoveredId === c.id ? 'opacity-100' : 'opacity-0'} text-gray-300 hover:text-red-500`}
                        title="Delete comment">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-5 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
        </div>

        {/* Comment input with @mention autocomplete */}
        <form onSubmit={handleSubmit} className="relative flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={e => {
                if (e.key === 'Escape') setShowMentions(false);
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
              }}
              rows={2}
              placeholder="Add a comment… (use @ to mention)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 w-48 max-h-40 overflow-y-auto">
                {filteredMembers.map(m => (
                  <button key={m.userId} type="button"
                    onMouseDown={e => { e.preventDefault(); insertMention(m.user.name); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-800 dark:text-gray-200">
                    @{m.user?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting || !content.trim()}
            className="self-end bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {submitting ? '…' : 'Send'}
          </button>
        </form>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Comment"
          message={`Delete this comment by ${confirmDelete.user?.name}?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {pendingDelete && (
        <UndoToast message="Comment deleted" duration={10000} onUndo={handleUndo} onExpire={handleUndoExpire} />
      )}
    </>
  );
}
