import { useState, useEffect } from 'react'
import apiClient from '@/lib/api'

export function ServerWakingScreen({ children }) {
  const [isWakingUp, setIsWakingUp] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [progress, setProgress] = useState(10)

  useEffect(() => {
    let timer = null
    let cancelled = false
    let progressInterval = null

    async function checkServerHealth(attempt = 0) {
      timer = setTimeout(() => {
        if (!cancelled) {
          setIsWakingUp(true)
          if (!progressInterval) {
            progressInterval = setInterval(() => {
              setProgress((prev) => (prev >= 95 ? 95 : prev + 5))
            }, 1000)
          }
        }
      }, 3000)

      try {
        await apiClient.get('/readyz', { timeout: 15000 })
        if (!cancelled) {
          clearTimeout(timer)
          if (progressInterval) clearInterval(progressInterval)
          setProgress(100)
          setTimeout(() => setIsWakingUp(false), 200)
        }
      } catch (err) {
        if (cancelled) return
        clearTimeout(timer)
        setIsWakingUp(true)
        setRetryCount(attempt + 1)
        const backoffMs = Math.min(3000 * Math.pow(1.5, attempt), 10000)
        setTimeout(() => checkServerHealth(attempt + 1), backoffMs)
      }
    }

    checkServerHealth()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [])

  return (
    <>
      {isWakingUp && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-white p-6 transition-all duration-300">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
                <span className="w-3 h-3 bg-indigo-400 rounded-full animate-ping" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Waking up the server, this can take up to a minute
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                The free tier container service is spinning up. Retrying connection automatically...
              </p>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
              <span>Status: Connecting to backend</span>
              {retryCount > 0 && <span>Attempt {retryCount}</span>}
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
