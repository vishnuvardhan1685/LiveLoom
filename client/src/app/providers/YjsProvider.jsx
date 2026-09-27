import { createContext, useContext, useState, useCallback } from 'react'

const YjsContext = createContext(null)

export function YjsProvider({ children }) {
  const [collaborators, setCollaborators] = useState([])

  const updateCollaborator = useCallback((updated) => {
    setCollaborators((prev) => {
      const idx = prev.findIndex((c) => c.userId === updated.userId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated]
    })
  }, [])

  const removeCollaborator = useCallback((userId) => {
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId))
  }, [])

  return (
    <YjsContext.Provider value={{ collaborators, setCollaborators, updateCollaborator, removeCollaborator }}>
      {children}
    </YjsContext.Provider>
  )
}

export function useYjsContext() {
  const ctx = useContext(YjsContext)
  if (!ctx) throw new Error('useYjsContext must be used within YjsProvider')
  return ctx
}
