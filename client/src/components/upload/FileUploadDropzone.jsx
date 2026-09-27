import { useState, useCallback } from 'react'
import { readDroppedItems } from '@/lib/fileSystemUtils'

export function FileUploadDropzone({ onFiles }) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.items
      ? await readDroppedItems(e.dataTransfer.items)
      : Array.from(e.dataTransfer.files).map((file) => ({ file, relativePath: file.name }))
    onFiles(dropped)
  }, [onFiles])

  return (
    <div
      className={`dropzone${isDragging ? ' dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Drop files here
      </p>
    </div>
  )
}