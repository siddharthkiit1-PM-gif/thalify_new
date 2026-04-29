import type { CSSProperties, ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  /** Spacing below the whole header block. Default: var(--space-6). */
  bottom?: string | number
  /** When true, scales display-1 (44px) for hero sections; else h1 (28px). */
  hero?: boolean
  style?: CSSProperties
}

export default function Section({ eyebrow, title, subtitle, bottom, hero, style }: Props) {
  return (
    <div style={{ marginBottom: bottom ?? 'var(--space-6)', ...style }}>
      {eyebrow && (
        <div
          data-eyebrow
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--fs-label)',
            letterSpacing: '0.18em',
            color: 'var(--sage-700)',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 'var(--space-3)',
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        className="serif"
        style={{
          fontSize: hero ? 'var(--fs-display-2)' : 'var(--fs-h1)',
          margin: 0,
          marginBottom: subtitle ? 'var(--space-2)' : 0,
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-body-lg)', lineHeight: 1.55, margin: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
