import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  length?: number
  onEnter?: () => void
  autoFocus?: boolean
  cellClassName?: string
  filledCellClassName?: string
  cellStyle?: React.CSSProperties
}

export default function CodeInput({
  value,
  onChange,
  length = 6,
  onEnter,
  autoFocus = true,
  cellClassName,
  filledCellClassName,
  cellStyle,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  const setDigits = (next: string[]) => onChange(next.join('').replace(/\s+/g, ''))

  const onDigitChange = (i: number, val: string) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, length)
      const next = Array(length).fill('')
      for (let j = 0; j < cleaned.length; j += 1) next[j] = cleaned[j]
      setDigits(next)
      refs.current[Math.min(cleaned.length, length - 1)]?.focus()
      return
    }
    const digit = val.replace(/\D/g, '')
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const n = [...digits]
        n[i] = ''
        setDigits(n)
      } else if (i > 0) refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
    else if (e.key === 'Enter' && value.length === length && onEnter) onEnter()
  }

  return (
    <>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={length}
          value={d}
          onChange={(e) => onDigitChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`${cellClassName || ''} ${d && filledCellClassName ? filledCellClassName : ''}`.trim()}
          style={cellStyle}
        />
      ))}
    </>
  )
}
