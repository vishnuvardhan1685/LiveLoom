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

/**
 * Reads dropped/browsed files as text and writes them into the room's
 * shared Yjs files map via ensureFile(path, content) from useYjsDoc.
 * There's no REST upload endpoint (nor should there be — content lives
 * in the CRDT doc and rides the existing snapshot/debounce persistence).
 * Non-text files are skipped with a warning; Yjs isn't a blob store.
 */
export function useFileUpload(ensureFile) {
  const [uploads,     setUploads]     = useState([])
  const [isUploading, setIsUploading] = useState(false)

  const setStatus = useCallback((relativePath, status) => {
    setUploads((prev) => prev.map((u) => (u.relativePath === relativePath ? { ...u, status } : u)))
  }, [])

  const uploadFiles = useCallback(async (files) => {
    if (!files.length || !ensureFile) return
    setIsUploading(true)
    setUploads(files.map((f) => ({ fileName: f.file.name, relativePath: f.relativePath, status: 'pending' })))

    for (const { file, relativePath } of files) {
      if (!TEXT_EXT_RE.test(relativePath)) {
        setStatus(relativePath, 'skipped-binary')
        continue
      }
      setStatus(relativePath, 'uploading')
      try {
        const content = await readAsText(file)
        ensureFile(relativePath, content)
        setStatus(relativePath, 'done')
      } catch {
        setStatus(relativePath, 'error')
      }
    }
    setIsUploading(false)
  }, [ensureFile, setStatus])

  const clearUploads = useCallback(() => setUploads([]), [])

  return { uploadFiles, uploads, isUploading, clearUploads }
}