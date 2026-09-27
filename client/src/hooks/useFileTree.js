import { useState, useCallback, useEffect } from 'react'
import { getLanguageFromPath, buildFileTree } from '@/lib/fileSystemUtils'

export function useFileTree({ listFilePaths, fileTreeVersion }) {
  const [tree,         setTree]        = useState([])
  const [openTabs,     setOpenTabs]    = useState([])
  const [activeTabId,  setActiveTabId] = useState(null)
  const [expandedDirs, setExpandedDirs] = useState(new Set())

  // Re-derive the tree whenever the shared files map changes (someone
  // uploaded/deleted a file) — this is what makes uploads show up live
  // for every collaborator, not just the person who dropped the files.
  useEffect(() => {
    if (!listFilePaths) return
    const paths = listFilePaths()
    setTree(buildFileTree(paths.map((relativePath) => ({ relativePath }))))
  }, [listFilePaths, fileTreeVersion])

  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null

  const openFile = useCallback((node) => {
    if (node.type === 'directory') return
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === node.id)) return prev
      return [...prev, { id: node.id, path: node.path, name: node.name, language: node.language ?? getLanguageFromPath(node.name), isDirty: false }]
    })
    setActiveTabId(node.id)
  }, [])

  const closeTab = useCallback((tabId) => {
    setOpenTabs((prev) => {
      const idx  = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId) setActiveTabId(next[idx]?.id ?? next[idx - 1]?.id ?? null)
      return next
    })
  }, [activeTabId])

  const setActiveTab = useCallback((tabId) => setActiveTabId(tabId), [])
  const toggleDir = useCallback((path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  return { tree, activeTab, openTabs, expandedDirs, openFile, closeTab, setActiveTab, toggleDir }
}