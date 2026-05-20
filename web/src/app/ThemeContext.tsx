import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Mode = 'light' | 'dark' | 'system'
interface ThemeCtx { mode: Mode; setMode: (m: Mode) => void; resolved: 'light' | 'dark' }

const Ctx = createContext<ThemeCtx | null>(null)

function getResolved(m: Mode): 'light' | 'dark' {
  if (m !== 'system') return m
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('theme') as Mode) || 'system')
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => getResolved(mode))

  useEffect(() => {
    localStorage.setItem('theme', mode)
    const r = getResolved(mode)
    setResolved(r)
    document.documentElement.dataset.theme = r === 'light' ? 'light' : 'dark'
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = mq.matches ? 'dark' : 'light'
      setResolved(r)
      document.documentElement.dataset.theme = r
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  return <Ctx.Provider value={{ mode, setMode, resolved }}>{children}</Ctx.Provider>
}

export function useThemeMode() {
  return useContext(Ctx)!
}
