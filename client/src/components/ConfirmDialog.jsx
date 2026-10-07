/**
 * ConfirmDialog.jsx — reusable modal replacing all window.confirm() calls.
 *
 * Usage:
 *   const [confirmState, setConfirmState] = useState(null)
 *
 *   // trigger:
 *   setConfirmState({
 *     title:   'Delete room?',
 *     body:    'This removes the room and all files for every member.',
 *     danger:  true,          // makes the confirm button pink/red
 *     label:   'Delete',      // optional confirm button label (default: 'Confirm')
 *     onConfirm: () => doDelete(),
 *   })
 *
 *   // render:
 *   <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
 *
 * InputDialog:
 *   Same idea but renders an <input> inside the body for rename / prompt flows.
 */
import { useState, useEffect, useRef } from 'react'

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
export function ConfirmDialog({ state, onClose }) {
  if (!state) return null

  const { title, body, danger = false, label = 'Confirm', onConfirm } = state

  const handleConfirm = () => {
    onConfirm?.()
    onClose()
  }

  return (
    <Overlay onClose={onClose}>
      <h2
        style={{
          margin:     '0 0 10px',
          fontSize:   15,
          fontWeight: 700,
          color:      danger ? '#ff516a' : '#e3e2e4',
        }}
      >
        {title}
      </h2>
      {body && (
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9ea0', lineHeight: 1.6 }}>
          {body}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="ll-btn ll-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          id="confirm-dialog-confirm-btn"
          className="ll-btn"
          style={{
            background:  danger ? 'rgba(255,81,104,0.15)' : 'rgba(78,222,163,0.15)',
            border:      `1px solid ${danger ? 'rgba(255,81,104,0.4)' : 'rgba(78,222,163,0.4)'}`,
            color:       danger ? '#ff516a' : '#4edea3',
          }}
          onClick={handleConfirm}
        >
          {label}
        </button>
      </div>
    </Overlay>
  )
}

// ── InputDialog — replaces window.prompt() ────────────────────────────────────
export function InputDialog({ state, onClose }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  // Pre-fill when the dialog opens
  useEffect(() => {
    if (state) {
      setValue(state.defaultValue ?? '')
      setTimeout(() => inputRef.current?.select(), 60)
    }
  }, [state])

  if (!state) return null

  const { title, placeholder = '', label = 'OK', onCommit } = state

  const handleCommit = () => {
    if (!value.trim()) return
    onCommit?.(value.trim())
    onClose()
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#e3e2e4' }}>
        {title}
      </h2>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') onClose() }}
        placeholder={placeholder}
        className="ll-input"
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="ll-btn ll-btn-ghost" onClick={onClose}>Cancel</button>
        <button
          id="input-dialog-commit-btn"
          className="ll-btn ll-btn-primary"
          onClick={handleCommit}
          disabled={!value.trim()}
        >
          {label}
        </button>
      </div>
    </Overlay>
  )
}

// ── Shared backdrop + card ────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}           // click outside → close
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          8888,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(0,0,0,0.6)',
        backdropFilter:  'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}  // prevent backdrop click
        style={{
          background:   'var(--bg-surface, #1c1d1f)',
          border:       '1px solid var(--border, #2e2f31)',
          borderRadius: 8,
          padding:      '24px 28px',
          width:        440,
          maxWidth:     '90vw',
          boxShadow:    '0 20px 60px rgba(0,0,0,0.6)',
          fontFamily:   "'JetBrains Mono', monospace",
        }}
      >
        {children}
      </div>
    </div>
  )
}
