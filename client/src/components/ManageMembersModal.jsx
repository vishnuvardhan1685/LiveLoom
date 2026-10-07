/**
 * ManageMembersModal.jsx
 * Owner-only modal for listing room members, editing their roles (editor/viewer),
 * and optionally removing them.
 *
 * Props:
 *   roomId    {string}   — the room to manage
 *   roomName  {string}   — displayed in the title
 *   onClose   {function} — called when the modal should close
 */
import { useState, useEffect, useCallback } from 'react'
import { roomsApi } from '@/lib/api'
import { toast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const ROLE_COLOR = {
  owner:  { text: '#7c6af7', bg: 'rgba(124,106,247,0.12)', border: 'rgba(124,106,247,0.3)' },
  editor: { text: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
  viewer: { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
}

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] ?? { text: '#888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.2)' }
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 3,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
    }}>
      {role.toUpperCase()}
    </span>
  )
}

export function ManageMembersModal({ roomId, roomName, onClose }) {
  const [members,      setMembers]      = useState([])
  const [ownerId,      setOwnerId]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  // pendingRoles holds the in-progress role values for each member row while editing
  const [pendingRoles, setPendingRoles] = useState({})
  const [saving,       setSaving]       = useState({})   // userId -> bool
  const [confirmState, setConfirmState] = useState(null)

  // Load member list on open
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    roomsApi.getMembers(roomId)
      .then(({ data }) => {
        if (cancelled) return
        setMembers(data.members)
        setOwnerId(data.ownerId)
        // Seed pending roles from current roles
        const initial = {}
        data.members.forEach((m) => { initial[m.userId] = m.role })
        setPendingRoles(initial)
      })
      .catch((err) => {
        toast.error(err.response?.data?.error ?? 'Could not load members.')
        onClose()
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [roomId, onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRoleChange = (userId, newRole) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: newRole }))
  }

  const handleSave = useCallback(async (member) => {
    const newRole = pendingRoles[member.userId]
    if (newRole === member.role) return   // nothing changed

    setSaving((prev) => ({ ...prev, [member.userId]: true }))
    try {
      await roomsApi.patchMemberRole(roomId, member.userId, newRole)
      // Update local member list to reflect saved role
      setMembers((prev) =>
        prev.map((m) => m.userId === member.userId ? { ...m, role: newRole } : m)
      )
      toast.success(`Role of ${member.name} changed to ${newRole}.`)
    } catch (err) {
      const status = err.response?.status
      if (status === 403) toast.error('Only the room owner can change roles.')
      else toast.error(err.response?.data?.error ?? 'Could not update role.')
      // Revert the dropdown to the saved role
      setPendingRoles((prev) => ({ ...prev, [member.userId]: member.role }))
    } finally {
      setSaving((prev) => ({ ...prev, [member.userId]: false }))
    }
  }, [roomId, pendingRoles])

  const handleRemoveRequest = useCallback((member) => {
    setConfirmState({
      title:     `Remove "${member.name}"?`,
      body:      'They will lose access to this room immediately.',
      danger:    true,
      label:     'Remove',
      onConfirm: async () => {
        try {
          await roomsApi.removeMember(roomId, member.userId)
          setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
          toast.success(`${member.name} removed from room.`)
        } catch (err) {
          toast.error(err.response?.data?.error ?? 'Could not remove member.')
        }
      },
    })
  }, [roomId])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 8800,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, zIndex: 8900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          pointerEvents:  'auto',
          background:     'var(--bg-surface, #1c1d1f)',
          border:         '1px solid var(--border, #2e2f31)',
          borderRadius:   8,
          padding:        '24px 28px',
          width:          520,
          maxWidth:       '92vw',
          maxHeight:      '80vh',
          display:        'flex',
          flexDirection:  'column',
          boxShadow:      '0 20px 60px rgba(0,0,0,0.6)',
          fontFamily:     "'JetBrains Mono', monospace",
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e3e2e4' }}>
                Manage Members
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9e9ea0' }}>
                {roomName}
              </p>
            </div>
            <button
              id="manage-members-close-btn"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9e9ea0', padding: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          {/* Member list */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#9e9ea0', textAlign: 'center', padding: '20px 0' }}>
                Loading members…
              </p>
            ) : members.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9e9ea0', textAlign: 'center', padding: '20px 0' }}>
                No members found.
              </p>
            ) : members.map((member) => {
              const isOwner    = member.userId === ownerId
              const isSaving   = !!saving[member.userId]
              const pending    = pendingRoles[member.userId] ?? member.role
              const isDirty    = pending !== member.role

              return (
                <div
                  key={member.userId}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            12,
                    padding:        '10px 12px',
                    background:     'var(--bg-base, #141516)',
                    border:         '1px solid var(--border, #2e2f31)',
                    borderRadius:   5,
                    fontSize:       13,
                  }}
                >
                  {/* Avatar initial */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(124,106,247,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#7c6af7',
                  }}>
                    {(member.name?.[0] ?? '?').toUpperCase()}
                  </div>

                  {/* Name + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e3e2e4', fontWeight: 600, fontSize: 13, truncate: true }}>
                      {member.name}
                    </div>
                    {member.email && (
                      <div style={{ color: '#9e9ea0', fontSize: 11 }}>{member.email}</div>
                    )}
                  </div>

                  {/* Role control */}
                  {isOwner ? (
                    <RoleBadge role="owner" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select
                        id={`role-select-${member.userId}`}
                        value={pending}
                        disabled={isSaving}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        style={{
                          background:   'var(--bg-base, #141516)',
                          border:       `1px solid ${isDirty ? '#7c6af7' : 'var(--border, #2e2f31)'}`,
                          borderRadius: 3,
                          color:        '#e3e2e4',
                          fontSize:     12,
                          padding:      '3px 6px',
                          fontFamily:   "'JetBrains Mono', monospace",
                          cursor:       'pointer',
                          outline:      'none',
                        }}
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>

                      {/* Save button — only visible when role changed */}
                      {isDirty && (
                        <button
                          id={`save-role-${member.userId}`}
                          onClick={() => handleSave(member)}
                          disabled={isSaving}
                          style={{
                            background:   'rgba(78,222,163,0.15)',
                            border:       '1px solid rgba(78,222,163,0.4)',
                            borderRadius: 3,
                            color:        '#4edea3',
                            fontSize:     11,
                            padding:      '3px 8px',
                            cursor:       'pointer',
                            fontFamily:   "'JetBrains Mono', monospace",
                          }}
                        >
                          {isSaving ? '…' : 'Save'}
                        </button>
                      )}

                      {/* Remove member button */}
                      <button
                        id={`remove-member-${member.userId}`}
                        onClick={() => handleRemoveRequest(member)}
                        title="Remove member"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#9e9ea0', padding: '2px 4px',
                          display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff516a' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9e9ea0' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person_remove</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button id="manage-members-done-btn" className="ll-btn ll-btn-ghost" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  )
}
