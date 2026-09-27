export function AuthLayout({ children }) {
  return (
    <div className="auth-grid">
      {/* ── Left decorative panel ── */}
      <div
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="md:!flex"
      >
        {/* Woven thread SVG texture */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}
          viewBox="0 0 500 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <path
              key={`v${i}`}
              d={`M ${i * 38 - 20} 0 Q ${i * 38 + 60} 200 ${i * 38 - 10} 400 Q ${i * 38 + 70} 600 ${i * 38 - 20} 800`}
              stroke="var(--accent)" strokeWidth="1" fill="none" strokeLinecap="round"
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <path
              key={`h${i}`}
              d={`M 0 ${i * 110 + 40} Q 125 ${i * 110 + 80} 250 ${i * 110 + 40} Q 375 ${i * 110} 500 ${i * 110 + 40}`}
              stroke="var(--accent)" strokeWidth="0.6" fill="none" strokeLinecap="round" strokeOpacity="0.6"
            />
          ))}
        </svg>

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            LiveLoom
          </span>
        </div>

        {/* Tagline + presence chips */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3, color: 'var(--text-primary)', margin: 0 }}>
            Code together,<br />in real time.
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
            Multiplayer editing, live cursors, zero merge conflicts.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            {[['EV', '#34d399'], ['MT', '#f59e0b'], ['SK', '#60a5fa'], ['YO', '#f472b6']].map(([initials, color], i) => (
              <div key={initials} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: color, color: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                marginLeft: i > 0 ? -6 : 0, position: 'relative', zIndex: 4 - i,
                boxShadow: '0 0 0 2px var(--bg-surface)',
              }}>
                {initials}
              </div>
            ))}
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-muted)', marginLeft: 8 }}>
              4 collaborators online
            </span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--bg-base)' }}>
        <div style={{ width: '100%', maxWidth: 360 }} className="animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  )
}
