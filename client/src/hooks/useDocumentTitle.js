import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) {
      document.title = `${title} · LiveLoom`
    } else {
      document.title = 'LiveLoom — Collaborative Code Editor'
    }
  }, [title])
}
