import type { ReactNode } from 'react'

type Tone = 'sage' | 'amber' | 'red' | 'neutral' | 'tg'

interface Props {
  children: ReactNode
  tone?: Tone
  /** Make text uppercase + mono — useful for eyebrow-style status labels. */
  mono?: boolean
}

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  sage: { bg: 'var(--sage-100)', fg: 'var(--sage-700)', border: 'transparent' },
  amber: { bg: 'var(--amber-bg)', fg: '#B45309', border: 'rgba(232,168,48,0.5)' },
  red: { bg: 'var(--red-bg)', fg: 'var(--red)', border: 'var(--red-br)' },
  neutral: { bg: 'var(--sand-2)', fg: 'var(--muted)', border: 'transparent' },
  tg: { bg: 'var(--tg-blue-tint)', fg: 'var(--tg-blue-dark)', border: 'transparent' },
}

export default function Badge({ children, tone = 'sage', mono }: Props) {
  const t = TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: 'var(--radius-xs)',
        fontSize: mono ? 'var(--fs-micro)' : 'var(--fs-small)',
        fontWeight: mono ? 700 : 600,
        fontFamily: mono ? 'var(--mono)' : 'inherit',
        letterSpacing: mono ? '0.1em' : 0,
        textTransform: mono ? 'uppercase' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
