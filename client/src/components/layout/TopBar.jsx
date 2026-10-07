import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PresenceAvatarStack } from './PresenceAvatarStack'
import { useAuthContext } from '@/app/providers/AuthProvider'
import { ProfileModal } from '@/components/ProfileModal'

export function TopBar({ roomName, syncStatus, collaborators, readOnly, sidebarVisible, onToggleSidebar, onInvite, onBack }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthContext()
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="h-14 bg-surface-container-lowest border-b border-surface-variant flex items-center justify-between px-2 sm:px-4 select-none flex-shrink-0 z-40">
        {/* Left: Brand & Room Details */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            aria-label="Toggle navigation menu"
            className="w-10 h-10 bg-surface-container-high border border-surface-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:border-outline transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              {sidebarVisible ? 'menu_open' : 'menu'}
            </span>
          </button>

          <button
            onClick={onBack ?? (() => navigate('/dashboard'))}
            className="flex items-center gap-1.5 font-headline-sm uppercase text-on-surface font-bold tracking-wider hover:text-primary transition-colors text-xs sm:text-sm flex-shrink-0"
          >
            <span className="material-symbols-outlined text-primary text-[18px]">code_blocks</span>
            <span className="hidden xs:inline">LiveLoom</span>
          </button>

          <div className="h-4 w-[1px] bg-surface-variant hidden sm:block flex-shrink-0" />

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-label-md text-xs text-on-surface font-mono truncate max-w-[100px] sm:max-w-[160px] md:max-w-xs">
              room: {roomName || '—'}
            </span>
            {readOnly && (
              <span className="font-label-sm text-[9px] sm:text-[10px] text-error bg-error-container/20 px-1.5 py-0.5 border border-error/40 font-mono flex-shrink-0">
                READ-ONLY
              </span>
            )}
          </div>
        </div>

        {/* Right: Collaborators, Sync Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Avatars */}
          <PresenceAvatarStack collaborators={collaborators ?? []} />

          <div className="h-4 w-[1px] bg-surface-variant hidden sm:block" />

          {/* Sync Status Pill */}
          <div className={`h-8 px-2 border flex items-center gap-1.5 font-label-sm text-[10px] font-mono ${
            syncStatus === 'synced' ? 'bg-surface-container border-tertiary-container text-tertiary' :
            syncStatus === 'syncing' ? 'bg-surface-container border-secondary-container text-secondary' :
            'bg-surface-container border-error-container text-error'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'synced' ? 'bg-tertiary animate-pulse' :
              syncStatus === 'syncing' ? 'bg-secondary animate-spin' :
              'bg-error'
            }`} />
            <span className="hidden sm:inline">CRDT</span> {syncStatus === 'synced' ? 'SYNCED' : syncStatus.toUpperCase()}
          </div>

          {/* Share / Invite Button */}
          {!readOnly && (
            <button
              onClick={onInvite}
              aria-label="Share room invite"
              title="Share room invite"
              className="h-9 px-2.5 sm:px-3 bg-primary hover:bg-primary-container text-on-primary hover:text-white border border-primary flex items-center gap-1.5 text-xs font-mono uppercase font-bold tracking-wider transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">ios_share</span>
              <span className="hidden sm:inline">SHARE</span>
            </button>
          )}

          {/* Profile Button */}
          <button
            onClick={() => setProfileOpen(true)}
            title={`Profile (${user?.name || user?.email})`}
            aria-label="User profile settings"
            className="w-10 h-10 bg-surface-container-high hover:bg-surface-container-highest border border-surface-variant flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
          </button>
        </div>
      </header>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
      />
    </>
  )
}