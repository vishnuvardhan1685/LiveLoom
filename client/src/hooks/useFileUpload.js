import { useState, useCallback, useRef } from 'react'

/**
 * Handles file uploads.
 *
 * The current backend has no dedicated file-upload REST endpoint —
 * content is synced via Yjs. This hook simulates per-file progress
 * and calls onComplete with the DroppedFile list when done.
 *
 * When a real upload endpoint is added (e.g. POST /rooms/:id/files),
 * replace the body of uploadSingle() with an axios multipart POST.
 */
export function useFileUpload(roomId, onComplete) {
  const [uploads,     setUploads]     = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const abortRef = useRef(null)

  const setProgress = useCallback((relativePath, progress, status) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.relativePath === relativePath ? { ...u, progress, status } : u
      )
    )
  }, [])

  const uploadFiles = useCallback(async (files) => {
    if (!files.length) return

    abortRef.current = new AbortController()
    setIsUploading(true)

    setUploads(
      files.map((f) => ({
        fileName:     f.file.name,
        relativePath: f.relativePath,
        progress:     0,
        status:       'pending',
      }))
    )

    // Simulated sequential upload — replace with real axios call when ready
    async function uploadSingle(file) {
      setProgress(file.relativePath, 0, 'uploading')
      const steps = 8
      const delay = Math.min(800, Math.max(100, file.file.size / 5000))
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, delay))
        setProgress(file.relativePath, Math.round((i / steps) * 100), 'uploading')
      }
      setProgress(file.relativePath, 100, 'done')
    }

    for (const file of files) {
      if (abortRef.current?.signal.aborted) break
      try {
        await uploadSingle(file)
      } catch {
        setProgress(file.relativePath, 0, 'error')
      }
    }

    setIsUploading(false)
    onComplete?.(files)
  }, [onComplete, setProgress])

  const overallProgress = uploads.length
    ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
    : 0

  const clearUploads = useCallback(() => setUploads([]), [])

  return { uploadFiles, uploads, overallProgress, isUploading, clearUploads }
}
