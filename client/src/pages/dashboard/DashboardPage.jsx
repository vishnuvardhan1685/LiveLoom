import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomsApi, invitesApi } from '@/lib/api'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { ProfileModal } from '@/components/ProfileModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ManageMembersModal } from '@/components/ManageMembersModal'
import { toast } from '@/components/Toast'
import { useUserEvents } from '@/hooks/useUserEvents'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function parseInviteToken(input) {
  if (!input) return ''
  const trimmed = input.trim()
  if (trimmed.includes('/join/')) {
    return trimmed.split('/join/')[1].split('?')[0].split('#')[0]
  }
  return trimmed
}

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const [rooms,        setRooms]        = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomName,     setRoomName]     = useState('')
  const [inviteToken,  setInviteToken]  = useState('')
  const [busy,         setBusy]         = useState(false)
  const [profileOpen,  setProfileOpen]  = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [managingRoom, setManagingRoom] = useState(null)

  useEffect(() => {
    let cancelled = false
    roomsApi.list()
      .then(({ data }) => { if (!cancelled) setRooms(data) })
      .catch(() => toast.error('Could not load rooms.'))
      .finally(() => { if (!cancelled) setRoomsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleRoomDeletedEvent = useCallback(({ roomId, roomName: name }) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId))
    toast.warn(`Room "${name}" was deleted by the owner.`)
  }, [])

  const handleRoleChangedAck = useCallback(({ targetName, role }) => {
    toast.success(`Role of ${targetName} changed to ${role}.`)
  }, [])

  const handleRoleChanged = useCallback(({ roomId: rId, roomName: rName, role: newRole }) => {
    setRooms((prev) => prev.map((r) => r.id === rId ? { ...r, role: newRole } : r))
    toast.warn(`Your role in "${rName}" was changed to ${newRole}.`)
  }, [])

  useUserEvents({
    onRoomDeleted:    handleRoomDeletedEvent,
    onRoleChanged:    handleRoleChanged,
    onRoleChangedAck: handleRoleChangedAck,
  })

  async function handleCreate(e) {
    e.preventDefault()
    if (!roomName.trim()) return
    setBusy(true)
    try {
      const { data } = await roomsApi.create(roomName.trim())
      setRooms((prev) => [{ id: data.id, name: data.name, role: data.role, memberCount: 1 }, ...prev])
      setRoomName('')
      toast.success(`Room "${data.name}" created!`)
      navigate(`/room/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not create room.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    const token = parseInviteToken(inviteToken)
    if (!token) {
      toast.error('Please enter a valid invite token or link.')
      return
    }
    setBusy(true)
    try {
      const { data } = await invitesApi.redeem(token)
      toast.success('Successfully joined room!')
      navigate(`/room/${data.roomId}`)
    } catch (err) {
      const status = err.response?.status
      if (status === 410) {
        toast.error('Invite link has expired or been fully used.')
      } else if (status === 404) {
        toast.error('Invite link not found.')
      } else {
        toast.error(err.response?.data?.error ?? 'Invalid or expired invite.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteRequest = useCallback((room) => {
    setConfirmState({
      title:     `Delete "${room.name}"?`,
      body:      `This removes the room and all files for every member. This cannot be undone.`,
      danger:    true,
      label:     'Delete',
      onConfirm: async () => {
        try {
          await roomsApi.delete(room.id)
          setRooms((prev) => prev.filter((r) => r.id !== room.id))
          toast.success(`Room "${room.name}" deleted.`)
        } catch (err) {
          const status = err.response?.status
          if (status === 403) toast.error('Only the room owner can delete it.')
          else toast.error(err.response?.data?.error ?? 'Could not delete room.')
        }
      },
    })
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const ROLE_COLOR = { owner: '#7c6af7', editor: '#34d399', viewer: '#f59e0b' }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans">
      <header className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-surface-variant bg-surface-container-lowest">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">code_blocks</span>
          <span className="font-mono text-xs font-bold tracking-widest text-outline uppercase">LIVELOOM</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="User profile settings"
            className="ll-btn ll-btn-ghost text-xs min-h-[40px] px-3 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span className="truncate max-w-[120px] sm:max-w-xs">{user?.name ?? user?.email}</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 flex-1">
        {/* Create / Join grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <form onSubmit={handleCreate} className="bg-surface-container-low border border-surface-variant p-5 flex flex-col justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-on-surface mb-1">New room</h3>
              <p className="text-xs text-outline mb-3">Create a new workspace for real-time collaboration.</p>
              <label htmlFor="dashboard-create-room-input" className="sr-only">Room name</label>
              <input
                id="dashboard-create-room-input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name"
                className="ll-input"
              />
            </div>
            <button type="submit" disabled={busy} className="ll-btn ll-btn-primary w-full min-h-[40px]">
              Create
            </button>
          </form>

          <form onSubmit={handleJoin} className="bg-surface-container-low border border-surface-variant p-5 flex flex-col justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-on-surface mb-1">Join with invite</h3>
              <p className="text-xs text-outline mb-3">Paste a token or full invite link to join an existing room.</p>
              <label htmlFor="dashboard-join-invite-input" className="sr-only">Invite token or link</label>
              <input
                id="dashboard-join-invite-input"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Invite token or paste full link"
                className="ll-input"
              />
            </div>
            <button type="submit" disabled={busy} className="ll-btn ll-btn-ghost w-full min-h-[40px]">
              Join
            </button>
          </form>
        </div>

        {/* Rooms list */}
        <h3 className="text-xs font-mono text-outline tracking-wider uppercase mb-3">MY ROOMS</h3>
        {roomsLoading ? (
          <div className="py-8 text-center text-xs font-mono text-outline">Loading rooms…</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 border border-dashed border-surface-variant text-center flex flex-col items-center gap-3 bg-surface-container-lowest">
            <span className="material-symbols-outlined text-[36px] text-outline">meeting_room</span>
            <p className="text-xs text-outline font-mono max-w-sm">
              No rooms yet. Create one or join with an invite.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 border border-surface-variant bg-surface-container-low hover:border-outline transition-colors text-xs font-mono"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <span className="material-symbols-outlined text-outline text-[18px]">folder</span>
                  <span
                    onClick={() => navigate(`/room/${r.id}`)}
                    className="text-on-surface font-semibold cursor-pointer truncate hover:text-primary transition-colors"
                    title={r.name}
                  >
                    {r.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  {r.memberCount != null && (
                    <span className="text-[11px] text-outline hidden sm:inline">
                      {r.memberCount} member{r.memberCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 border" style={{
                    borderColor: `${ROLE_COLOR[r.role] ?? '#555'}66`,
                    color: ROLE_COLOR[r.role] ?? '#aaa',
                    backgroundColor: `${ROLE_COLOR[r.role] ?? '#555'}15`,
                  }}>
                    {r.role}
                  </span>

                  {r.role === 'owner' && (
                    <div className="flex items-center gap-1">
                      <button
                        id={`manage-members-${r.id}`}
                        onClick={(e) => { e.stopPropagation(); setManagingRoom(r) }}
                        title="Manage members"
                        aria-label={`Manage members for ${r.name}`}
                        className="w-10 h-10 flex items-center justify-center text-outline hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">group</span>
                      </button>

                      <button
                        id={`delete-room-${r.id}`}
                        onClick={(e) => { e.stopPropagation(); handleDeleteRequest(r) }}
                        title="Delete room"
                        aria-label={`Delete room ${r.name}`}
                        className="w-10 h-10 flex items-center justify-center text-outline hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      {managingRoom && (
        <ManageMembersModal
          roomId={managingRoom.id}
          roomName={managingRoom.name}
          onClose={() => setManagingRoom(null)}
        />
      )}
    </div>
  )
}