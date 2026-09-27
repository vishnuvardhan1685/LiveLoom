import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { useRemoteCursorLabels } from './RemoteCursorOverlay'

export function MonacoEditor({ ytext, awareness, language, onEditorMount, onCursorMove }) {
  const editorRef = useRef(null)
  const bindingRef = useRef(null)

  useRemoteCursorLabels(editorRef.current, awareness)

  function handleMount(editor) {
    editorRef.current = editor
    onEditorMount?.(editor)
    editor.onDidChangeCursorPosition((e) => onCursorMove?.(e.position))
  }

  useEffect(() => {
    if (!editorRef.current || !ytext || !awareness) return
    bindingRef.current?.destroy()
    const model = editorRef.current.getModel()
    if (!model) return
    bindingRef.current = new MonacoBinding(ytext, model, new Set([editorRef.current]), awareness)

    // Broadcast our own cursor position for RemoteCursorOverlay to read back
    const sub = editorRef.current.onDidChangeCursorPosition((e) => {
      awareness.setLocalStateField('cursor', { lineNumber: e.position.lineNumber, column: e.position.column })
    })

    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
      sub.dispose()
    }
  }, [ytext, awareness])

  return (
    <Editor
      theme="vs-dark"
      language={language}
      onMount={handleMount}
      options={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
    />
  )
}