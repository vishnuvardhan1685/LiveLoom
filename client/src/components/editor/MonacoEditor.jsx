import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { useRemoteCursorLabels } from './RemoteCursorOverlay'

export function MonacoEditor({ ytext, awareness, language, readOnly = false, onCursorMove, onEditorActivity }) {
  const editorRef = useRef(null)
  const bindingRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useRemoteCursorLabels(editorRef.current, awareness)

  function handleBeforeMount(monaco) {
    monaco.editor.defineTheme('loom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4edea3', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ffb2b7', fontStyle: 'bold' },
        { token: 'string', foreground: '4cd7f6' },
        { token: 'number', foreground: 'ff516a' },
        { token: 'type', foreground: 'acedff' },
        { token: 'function', foreground: '6ffbbe' },
      ],
      colors: {
        'editor.background': '#0d0e10',
        'editor.foreground': '#e3e2e4',
        'editor.lineHighlightBackground': '#1b1c1e',
        'editorCursor.foreground': '#ffb2b7',
        'editorWhitespace.foreground': '#343537',
        'editorLineNumber.foreground': '#5b4041',
        'editorLineNumber.activeForeground': '#ffb2b7',
        'editor.selectionBackground': '#92002a55',
        'editor.inactiveSelectionBackground': '#92002a22',
      },
    })
  }

  function handleMount(editor) {
    editorRef.current = editor
    setMounted(true)
    editor.onDidChangeCursorPosition((e) => onCursorMove?.(e.position))
  }

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !ytext || !awareness) return

    bindingRef.current?.destroy()
    const model = editor.getModel()
    if (!model) return

    bindingRef.current = new MonacoBinding(ytext, model, new Set([editor]), awareness)

    const cursorSub = editor.onDidChangeCursorPosition((e) => {
      onEditorActivity?.()
      awareness.setLocalStateField('cursor', {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      })
    })

    // Monaco captures key events before document listeners; call onEditorActivity
    // so typing inside the editor resets the idle timer.
    const keySub = editor.onKeyDown(() => {
      onEditorActivity?.()
    })

    return () => {
      bindingRef.current?.destroy()
      bindingRef.current = null
      cursorSub.dispose()
      keySub.dispose()
    }
  }, [ytext, awareness, mounted])

  return (
    <Editor
      height="100%"
      theme="loom-dark"
      language={language ?? 'plaintext'}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: true },
        automaticLayout: true,
        readOnly,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
      }}
    />
  )
}