import { createContext, useContext } from 'react'

const SocketContext = createContext({ connected: false })

export function SocketProvider({ children }) {
  // Placeholder — extend for room-level signalling beyond Yjs
  return (
    <SocketContext.Provider value={{ connected: false }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  return useContext(SocketContext)
}
