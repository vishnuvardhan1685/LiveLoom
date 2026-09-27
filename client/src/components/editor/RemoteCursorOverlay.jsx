import { useEffect, useRef } from 'react'

export function useRemoteCursorLabels(editor, awareness) {
  const widgetsRef = useRef(new Map())

  useEffect(() => {
    if (!editor || !awareness) return

    function render() {
      const states = awareness.getStates()
      const seen = new Set()

      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        const cursor = state.cursor
        const user = state.user
        if (!cursor || !user) return
        seen.add(clientId)

        const id = `remote-label-${clientId}`
        let widget = widgetsRef.current.get(clientId)
        const domNode = widget?.domNode ?? document.createElement('div')
        domNode.className = 'remote-cursor-label'
        domNode.style.background = user.color
        domNode.style.color = '#0a0a0a'
        domNode.textContent = user.name

        const position = { lineNumber: cursor.lineNumber, column: cursor.column }
        const newWidget = {
          domNode,
          getId: () => id,
          getDomNode: () => domNode,
          getPosition: () => ({
            position,
            preference: [0], // ABOVE
          }),
        }
        if (widget) editor.removeContentWidget(widget)
        editor.addContentWidget(newWidget)
        widgetsRef.current.set(clientId, newWidget)
      })

      // Remove widgets for clients that disconnected
      for (const [clientId, widget] of widgetsRef.current) {
        if (!seen.has(clientId)) {
          editor.removeContentWidget(widget)
          widgetsRef.current.delete(clientId)
        }
      }
    }

    awareness.on('change', render)
    return () => {
      awareness.off('change', render)
      widgetsRef.current.forEach((w) => editor.removeContentWidget(w))
      widgetsRef.current.clear()
    }
  }, [editor, awareness])
}