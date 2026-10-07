/**
 * Toast.jsx — lightweight toast system, no external library.
 * Matches the LiveLoom palette: pink (error), emerald (success), amber (warn), sky (info).
 *
 * Usage:
 *   import { toast } from '@/components/Toast'
 *   toast.success('Saved!')
 *   toast.error('Something went wrong')
 *   toast.info('Room deleted')
 *   toast.warn('Your role changed')
 *
 * Mount <Toaster /> once at the app root (inside App.jsx).
 */
import { useState, useEffect, useCallback } from 'react'

// ── Singleton event bus ────────────────────────────────────────────────────────
let _dispatch = null   // set by <Toaster /> on mount

function emit(type, message, durationMs = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  if (_dispatch) {
    _dispatch({ id, type, message, durationMs })
  } else {
    // Toaster not yet mounted — queue via microtask so it still shows up
    setTimeout(() => emit(type, message, durationMs), 50)
  }
}

export const toast = {
  success: (msg, ms)  => emit('success', msg, ms),
  error:   (msg, ms)  => emit('error',   msg, ms),
  warn:    (msg, ms)  => emit('warn',    msg, ms),
  info:    (msg, ms)  => emit('info',    msg, ms),
}

// ── Styles keyed by toast type ────────────────────────────────────────────────
const STYLES = {
  success: {
    border:     '1px solid rgba(52,211,153,0.35)',
    background: 'rgba(16,30,24,0.97)',
    iconColor:  '#34d399',
    icon:       'check_circle',
  },
  error: {
    border:     '1px solid rgba(255,81,104,0.4)',
    background: 'rgba(28,10,14,0.97)',
    iconColor:  '#ff516a',
    icon:       'error',
  },
  warn: {
    border:     '1px solid rgba(251,191,36,0.35)',
    background: 'rgba(28,22,8,0.97)',
    iconColor:  '#fbbf24',
    icon:       'warning',
  },
  info: {
    border:     '1px solid rgba(125,211,252,0.25)',
    background: 'rgba(10,18,28,0.97)',
    iconColor:  '#7dd3fc',
    icon:       'info',
  },
}

// ── Single toast item ─────────────────────────────────────────────────────────
function ToastItem({ id, type, message, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const st = STYLES[type] ?? STYLES.info

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    // Wait for exit animation before removing from list
    setTimeout(() => onDismiss(id), 280)
  }, [id, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={dismiss}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        minWidth:       280,
        maxWidth:       420,
        padding:        '10px 14px',
        borderRadius:   6,
        border:         st.border,
        background:     st.background,
        boxShadow:      '0 4px 24px rgba(0,0,0,0.5)',
        cursor:         'pointer',
        fontFamily:     "'JetBrains Mono', monospace",
        fontSize:       12,
        color:          '#e3e2e4',
        backdropFilter: 'blur(12px)',
        transition:     'opacity 0.28s, transform 0.28s',
        opacity:        visible ? 1 : 0,
        transform:      visible ? 'translateY(0)' : 'translateY(10px)',
        userSelect:     'none',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 18, color: st.iconColor, flexShrink: 0 }}
      >
        {st.icon}
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}
      >
        close
      </span>
    </div>
  )
}

// ── Toaster mount point ───────────────────────────────────────────────────────
export function Toaster() {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Register the dispatch function so the singleton can push to this component
  useEffect(() => {
    _dispatch = ({ id, type, message, durationMs }) => {
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => dismiss(id), durationMs)
    }
    return () => { _dispatch = null }
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      style={{
        position:      'fixed',
        bottom:        16,
        right:         16,
        maxWidth:      'calc(100vw - 32px)',
        zIndex:        9999,
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        pointerEvents: 'none',   // container is click-through
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem
            id={t.id}
            type={t.type}
            message={t.message}
            onDismiss={dismiss}
          />
        </div>
      ))}
    </div>
  )
}
