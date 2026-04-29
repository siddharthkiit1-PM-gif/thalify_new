import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Mono digits — use for numbers. Defaults to true. */
  mono?: boolean
}

export default function StatCard({ label, value, hint, mono = true }: Props) {
  return (
    <div
      style={{
        background: 'var(--sand)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="label" style={{ marginBottom: 'var(--space-2)' }}>{label}</div>
      <div
        className={mono ? 'mono' : undefined}
        style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
