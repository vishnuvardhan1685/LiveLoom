/**
 * File system utilities — recursive folder-drop parsing.
 *
 * readDroppedItems: walks DataTransferItemList using webkitGetAsEntry,
 * preserving full relative paths (e.g. "src/utils/helpers.ts").
 *
 * Handles the readEntries batching requirement (each call returns ≤100 entries).
 */

export async function readDroppedItems(items) {
  const entries = Array.from(items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean)

  const results = []
  await Promise.all(entries.map((entry) => walkEntry(entry, '', results)))
  return results
}

async function walkEntry(entry, path, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) =>
      entry.file(res, rej)
    )
    out.push({ file, relativePath: path + entry.name })
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    // readEntries returns batches of ≤100 — loop until empty
    const allChildren = []
    await new Promise((res, rej) => {
      function read() {
        reader.readEntries((batch) => {
          if (batch.length === 0) { res(); return }
          allChildren.push(...batch)
          read()
        }, rej)
      }
      read()
    })
    await Promise.all(
      allChildren.map((child) =>
        walkEntry(child, path + entry.name + '/', out)
      )
    )
  }
}

/**
 * Map file extension → Monaco language identifier.
 */
export function getLanguageFromPath(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    mjs: 'javascript', cjs: 'javascript',
    json: 'json', css: 'css', scss: 'scss',
    html: 'html', xml: 'xml', svg: 'xml',
    md: 'markdown', mdx: 'markdown',
    py: 'python', rs: 'rust', go: 'go',
    java: 'java', kt: 'kotlin',
    c: 'c', cpp: 'cpp', cs: 'csharp',
    rb: 'ruby', php: 'php',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    yaml: 'yaml', yml: 'yaml', toml: 'toml',
    sql: 'sql', graphql: 'graphql', gql: 'graphql',
    vue: 'html', svelte: 'html',
  }
  return map[ext] ?? 'plaintext'
}

/**
 * Convert a flat DroppedFile list into a nested FileNode tree.
 * Directories sort before files; siblings sort alphabetically.
 */
export function buildFileTree(files) {
  const root = new Map()

  for (const { relativePath } of files) {
    const parts = relativePath.split('/')
    let current = root
    parts.forEach((part, i) => {
      if (!current.has(part)) {
        current.set(part, { isDir: i < parts.length - 1, children: new Map() })
      }
      current = current.get(part).children
    })
  }

  function mapToNodes(map, parentPath) {
    return Array.from(map.entries())
      .sort(([aName, aVal], [bName, bVal]) => {
        if (aVal.isDir !== bVal.isDir) return aVal.isDir ? -1 : 1
        return aName.localeCompare(bName)
      })
      .map(([name, val]) => {
        const path = parentPath ? `${parentPath}/${name}` : name
        return {
          id: path,
          name,
          type: val.isDir ? 'directory' : 'file',
          path,
          language: val.isDir ? undefined : getLanguageFromPath(name),
          children: val.isDir ? mapToNodes(val.children, path) : undefined,
        }
      })
  }

  return mapToNodes(root, '')
}

/** Format bytes to a human-readable string. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
