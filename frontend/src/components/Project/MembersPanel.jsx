import { useState, useEffect } from 'react';
import api from '../../api/api';
import ConfirmDialog from '../UI/ConfirmDialog';

export default function MembersPanel({ projectId, members, currentUserRole, currentUserId, ownerId, onClose, onMemberRemoved, onMembersUpdated }) {
  const [inviteCode, setInviteCode]     = useState('');
  const [copied, setCopied]             = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirm, setConfirm]           = useState(null); // { action, userId, label }

  const isOwner = currentUserId === ownerId;

  useEffect(() => {
    if (currentUserRole === 'admin') {
      api.get(`/projects/${projectId}/invite-code`)
        .then(r => setInviteCode(r.data.data.inviteCode))
        .catch(() => {});
    }
  }, [projectId, currentUserRole]);

  const inviteLink = inviteCode ? `${window.location.origin}/join?code=${inviteCode}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.put(`/projects/${projectId}/invite-code`);
      setInviteCode(data.data.inviteCode);
    } catch {} finally { setRegenerating(false); }
  };

  const executeConfirm = async () => {
    const { action, userId } = confirm;
    setConfirm(null);
    try {
      if (action === 'remove') {
        await api.delete(`/projects/${projectId}/members/${userId}`);
        onMemberRemoved(userId);
      } else if (action === 'make_admin') {
        await api.put(`/projects/${projectId}/members/${userId}/role`, { role: 'admin' });
        onMembersUpdated(userId, 'admin');
      } else if (action === 'remove_admin') {
        await api.put(`/projects/${projectId}/members/${userId}/role`, { role: 'member' });
        onMembersUpdated(userId, 'member');
      } else if (action === 'transfer') {
        await api.put(`/projects/${projectId}/transfer`, { newOwnerId: userId });
        // Reload page to reflect ownership change everywhere
        window.location.reload();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const confirmAction = (action, userId, memberName) => {
    const labels = {
      remove:       { title: 'Remove Member',       message: `Remove ${memberName} from the project?`,                       btn: 'Remove',    danger: true },
      make_admin:   { title: 'Make Admin',           message: `Give ${memberName} admin privileges?`,                         btn: 'Confirm',   danger: false },
      remove_admin: { title: 'Remove Admin',         message: `Remove admin privileges from ${memberName}?`,                  btn: 'Confirm',   danger: false },
      transfer:     { title: 'Transfer Ownership',   message: `Transfer project ownership to ${memberName}? You will become a regular admin.`, btn: 'Transfer', danger: true },
    };
    setConfirm({ action, userId, ...labels[action] });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">×</button>
          </div>

          {/* Members list */}
          <div className="p-5 space-y-1">
            {members.map(m => {
              const isThisOwner  = m.userId === ownerId;
              const isThisMe     = m.userId === currentUserId;

              return (
                <div key={m.userId} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                      {m.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{m.user?.name}</span>
                        {isThisOwner && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">Owner</span>
                        )}
                        {!isThisOwner && m.role === 'admin' && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Admin</span>
                        )}
                        {isThisMe && (
                          <span className="text-xs text-gray-400">(you)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{m.user?.email}</p>
                    </div>
                  </div>

                  {/* Action buttons — only visible to owner, not on self, not on owner row */}
                  {isOwner && !isThisMe && !isThisOwner && (
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {m.role === 'member' ? (
                        <>
                          <button onClick={() => confirmAction('make_admin', m.userId, m.user?.name)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                            Make Admin
                          </button>
                          <button onClick={() => confirmAction('remove', m.userId, m.user?.name)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors">
                            Remove
                          </button>
                        </>
                      ) : (
                        // This is a regular admin (not owner)
                        <>
                          <button onClick={() => confirmAction('transfer', m.userId, m.user?.name)}
                            className="text-xs text-yellow-600 hover:text-yellow-800 transition-colors">
                            Transfer
                          </button>
                          <button onClick={() => confirmAction('remove_admin', m.userId, m.user?.name)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            Demote
                          </button>
                          <button onClick={() => confirmAction('remove', m.userId, m.user?.name)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors">
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Regular admins can only remove members (not other admins) */}
                  {!isOwner && currentUserRole === 'admin' && !isThisMe && !isThisOwner && m.role === 'member' && (
                    <button onClick={() => confirmAction('remove', m.userId, m.user?.name)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Invite section — admin only */}
          {currentUserRole === 'admin' && inviteCode && (
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invite Link</p>
              <div className="flex gap-2">
                <input readOnly value={inviteLink}
                  className="flex-1 text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 truncate focus:outline-none" />
                <button onClick={handleCopy}
                  className={`text-xs px-3 py-2 rounded-lg transition-colors font-medium ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button onClick={handleRegenerate} disabled={regenerating}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50">
                {regenerating ? 'Regenerating…' : 'Regenerate code'}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.btn}
          danger={confirm.danger}
          onConfirm={executeConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
