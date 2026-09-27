import { useState, useCallback } from 'react'
import { getLanguageFromPath } from '@/lib/fileSystemUtils'

export function useFileTree() {
  const [tree,         setTree]        = useState([])
  const [openTabs,     setOpenTabs]    = useState([])
  const [activeTabId,  setActiveTabId] = useState(null)
  const [expandedDirs, setExpandedDirs] = useState(new Set())

  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null

  const openFile = useCallback((node) => {
    if (node.type === 'directory') return
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === node.id)) return prev
      return [
        ...prev,
        {
          id:       node.id,
          path:     node.path,
          name:     node.name,
          language: node.language ?? getLanguageFromPath(node.name),
          isDirty:  false,
        },
      ]
    })
    setActiveTabId(node.id)
  }, [])

  const closeTab = useCallback((tabId) => {
    setOpenTabs((prev) => {
      const idx  = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId) {
        setActiveTabId(next[idx]?.id ?? next[idx - 1]?.id ?? null)
      }
      return next
    })
  }, [activeTabId])

  const setActiveTab = useCallback((tabId) => setActiveTabId(tabId), [])

  const toggleDir = useCallback((path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const markDirty = useCallback((tabId, dirty) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t))
    )
  }, [])

  return {
    tree, activeTab, openTabs, expandedDirs,
    setTree, openFile, closeTab, setActiveTab, toggleDir, markDirty,
  }
}
