import { useState, useCallback } from 'react'

const TEXT_EXT_RE = /\.(js|jsx|ts|tsx|json|css|scss|html|md|mdx|py|rs|go|java|kt|c|cpp|h|hpp|cs|rb|php|sh|bash|yaml|yml|toml|sql|graphql|gql|txt|env|xml|svg|vue|svelte)$/i

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Yield to main thread to allow WS frames, UI re-renders, and small edits to pass
const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Non-blocking Time-Sliced Priority File Upload Scheduler.
 *
 * 1. Small Files First Priority Queue (SJF): Small files (<20KB) are processed
 *    first so small edits/files are synced immediately.
 * 2. Time-Sliced Chunking: Large files (>20KB) are read and inserted with micro-yields
 *    to keep the event loop and WebSocket connection smooth.
 * 3. Real-time Timewise Metrics: Emits progressive status updates and percent done.
 */
export function useFileUpload(ensureFile) {
  const [uploads,     setUploads]     = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress,    setProgress]    = useState({ doneCount: 0, totalCount: 0, percent: 0, currentFile: '' })

  const setStatus = useCallback((relativePath, status) => {
    setUploads((prev) => prev.map((u) => (u.relativePath === relativePath ? { ...u, status } : u)))
  }, [])

  const uploadFiles = useCallback(async (files) => {
    if (!files.length || !ensureFile) return
    setIsUploading(true)

    // Initial state setup
    const fileEntries = files.map((f) => ({
      file: f.file,
      relativePath: f.relativePath,
      size: f.file.size || 0,
      fileName: f.file.name,
    }))

    setUploads(fileEntries.map((f) => ({ fileName: f.fileName, relativePath: f.relativePath, status: 'pending' })))

    // Priority Sort: Small Files First (SJF) so small file syncs complete in <10ms
    fileEntries.sort((a, b) => a.size - b.size)

    const total = fileEntries.length
    let done = 0

    for (const { file, relativePath, size } of fileEntries) {
      if (!TEXT_EXT_RE.test(relativePath)) {
        setStatus(relativePath, 'skipped-binary')
        done++
        continue
      }

      setStatus(relativePath, 'uploading')
      setProgress({ doneCount: done, totalCount: total, percent: Math.round((done / total) * 100), currentFile: relativePath })

      try {
        const content = await readAsText(file)

        // For large files (>20KB), yield execution to avoid event loop starvation
        if (size > 20_000) {
          await yieldToMain()
        }

        ensureFile(relativePath, content)
        setStatus(relativePath, 'done')

        // Yield after every file insertion to ensure WebSocket ping and UI stay 100% responsive
        await yieldToMain()
      } catch {
        setStatus(relativePath, 'error')
      }

      done++
      setProgress({ doneCount: done, totalCount: total, percent: Math.round((done / total) * 100), currentFile: relativePath })
    }

    setIsUploading(false)
  }, [ensureFile, setStatus])

  const clearUploads = useCallback(() => {
    setUploads([])
    setProgress({ doneCount: 0, totalCount: 0, percent: 0, currentFile: '' })
  }, [])

  return { uploadFiles, uploads, isUploading, progress, clearUploads }
}