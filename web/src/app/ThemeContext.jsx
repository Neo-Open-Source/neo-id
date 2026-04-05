import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext(null)

export function ThemeProvider({ children }) {
  // 'system' | 'light' | 'dark'
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system')

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    localStorage.setItem('theme', mode)
  }, [mode])

  // Listen for system changes
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setMode('system') // trigger re-render
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  return <Ctx.Provider value={{ mode, setMode, resolved }}>{children}</Ctx.Provider>
}

export function useThemeMode() {
  return useContext(Ctx)
}
