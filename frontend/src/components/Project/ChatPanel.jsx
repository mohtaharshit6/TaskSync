import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/api';
import ConfirmDialog from '../UI/ConfirmDialog';
import UndoToast from '../UI/UndoToast';

export default function ChatPanel({ projectId, currentUser, currentUserRole, socket, onClose }) {
  const [messages, setMessages]         = useState([]);
  const [content, setContent]           = useState('');
  const [sending, setSending]           = useState(false);
  const [frozen, setFrozen]             = useState(false);
  const [toggling, setToggling]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [hoveredId, setHoveredId]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // message object
  const [pendingDelete, setPendingDelete] = useState(null); // { id, timer }
  const bottomRef = useRef(null);
  const timerRef  = useRef(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/messages`)
      .then(r => setMessages(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));

    api.get(`/projects/${projectId}`)
      .then(r => setFrozen(r.data.data.chatFrozen ?? false))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const onMsg    = ({ message }) => setMessages(p => [...p, message]);
    const onFreeze = ({ frozen: f }) => setFrozen(f);
    const onDelete = ({ messageId }) => {
      setMessages(p => p.filter(m => m.id !== messageId));
      if (pendingDelete?.id === messageId) setPendingDelete(null);
    };
    socket.on('new_message',     onMsg);
    socket.on('chat_freeze_changed', onFreeze);
    socket.on('message_deleted', onDelete);
    return () => {
      socket.off('new_message',     onMsg);
      socket.off('chat_freeze_changed', onFreeze);
      socket.off('message_deleted', onDelete);
    };
  }, [socket, pendingDelete]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await api.post(`/projects/${projectId}/messages`, { content });
      setContent('');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) alert(msg);
    } finally { setSending(false); }
  };

  const isWithin5Min = (createdAt) => {
    return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000;
  };

  const handleDeleteConfirm = () => {
    const msg = confirmDelete;
    setConfirmDelete(null);

    // Mark as pending — dim the message, start 10s timer
    setPendingDelete({ id: msg.id });
    timerRef.current = setTimeout(async () => {
      try {
        await api.delete(`/projects/${projectId}/messages/${msg.id}`);
        setMessages(p => p.filter(m => m.id !== msg.id));
      } catch (err) {
        console.error(err);
      }
      setPendingDelete(null);
    }, 10000);
  };

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingDelete(null);
  }, []);

  const handleUndoExpire = useCallback(() => {
    // Timer already fired via setTimeout — just clear UI state
    setPendingDelete(null);
  }, []);

  const handleToggleFreeze = async () => {
    setToggling(true);
    try { await api.put(`/projects/${projectId}/chat/freeze`, { frozen: !frozen }); }
    catch (err) { console.error(err); }
    finally { setToggling(false); }
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const grouped = messages.reduce((acc, msg) => {
    const day = msg.createdAt.split('T')[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <>
      <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Project Chat</span>
            {frozen && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">Frozen</span>}
          </div>
          <div className="flex items-center gap-2">
            {currentUserRole === 'admin' && (
              <button onClick={handleToggleFreeze} disabled={toggling}
                title={frozen ? 'Unfreeze chat' : 'Freeze chat'}
                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  frozen ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8 italic">No messages yet. Say hi!</div>
          ) : (
            Object.entries(grouped).map(([day, msgs]) => (
              <div key={day}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">{formatDate(msgs[0].createdAt)}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                {msgs.map((msg, i) => {
                  const isMe       = msg.userId === currentUser?.id;
                  const showAvatar = i === 0 || msgs[i - 1]?.userId !== msg.userId;
                  const isPending  = pendingDelete?.id === msg.id;
                  const canDelete  = isMe && isWithin5Min(msg.createdAt) && !isPending;

                  return (
                    <div key={msg.id}
                      className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-3' : 'mt-0.5'} ${isPending ? 'opacity-40' : ''}`}
                      onMouseEnter={() => setHoveredId(msg.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {!isMe && (
                        <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${showAvatar ? 'bg-indigo-100 text-indigo-700' : 'invisible'}`}>
                          {msg.user?.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showAvatar && !isMe && (
                          <span className="text-xs text-gray-500 font-medium mb-0.5 ml-0.5">{msg.user?.name}</span>
                        )}
                        <div className="flex items-end gap-1">
                          {canDelete && hoveredId === msg.id && isMe && (
                            <button onClick={() => setConfirmDelete(msg)}
                              className="text-gray-300 hover:text-red-400 transition-colors mb-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                          <div className={`px-3 py-1.5 rounded-2xl text-sm leading-snug ${
                            isPending
                              ? 'bg-gray-300 text-gray-500 line-through'
                              : isMe
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                          }`}>
                            {isPending ? 'Deleting…' : msg.content}
                          </div>
                          {canDelete && hoveredId === msg.id && !isMe && (
                            <button onClick={() => setConfirmDelete(msg)}
                              className="text-gray-300 hover:text-red-400 transition-colors mb-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {showAvatar && (
                          <span className="text-xs text-gray-400 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3">
          {frozen && currentUserRole !== 'admin' ? (
            <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/30 rounded-lg px-3 py-2">
              <span>🔒</span><span>Chat frozen by admin</span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <input type="text" value={content} onChange={e => setContent(e.target.value)}
                placeholder="Message the team…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" disabled={sending || !content.trim()}
                className="bg-indigo-600 text-white px-3 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Message"
          message={`Delete "${confirmDelete.content.slice(0, 60)}${confirmDelete.content.length > 60 ? '…' : ''}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Undo toast */}
      {pendingDelete && (
        <UndoToast
          message="Message deleted"
          duration={10000}
          onUndo={handleUndo}
          onExpire={handleUndoExpire}
        />
      )}
    </>
  );
}
