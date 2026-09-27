export function StatusBar({ language, line, column, syncStatus }) {
  return (
    <div className="status-bar">
      <span>{language ?? 'plaintext'}</span>
      <span style={{ display: 'flex', gap: 16 }}>
        <span>Ln {line}, Col {column}</span>
        <span>{syncStatus}</span>
      </span>
    </div>
  )
}