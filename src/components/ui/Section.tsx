import type { CSSProperties, ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  /** Spacing below the whole header block. Default: var(--space-6). */
  bottom?: string | number
  /** When true, scales display-1 (44px) for hero sections; else h1 (28px). */
  hero?: boolean
  /** Optional element rendered left of the title block (avatar, icon, etc). */
  leading?: ReactNode
  /** Optional element rendered right of the title block (status badge, etc). */
  trailing?: ReactNode
  style?: CSSProperties
}

export default function Section({ eyebrow, title, subtitle, bottom, hero, leading, trailing, style }: Props) {
  const titleBlock = (
    <div style={{ flex: 1, minWidth: 0 }}>
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
            marginBottom: leading ? 'var(--space-1)' : 'var(--space-3)',
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        className="serif"
        style={{
          fontSize: leading ? 'var(--fs-h3)' : hero ? 'var(--fs-display-2)' : 'var(--fs-h1)',
          margin: 0,
          marginBottom: subtitle ? 'var(--space-1)' : 0,
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <div style={{ color: leading ? 'var(--sage-700)' : 'var(--ink-2)', fontSize: leading ? 'var(--fs-small)' : 'var(--fs-body-lg)', lineHeight: 1.55 }}>
          {subtitle}
        </div>
      )}
    </div>
  )

  if (leading || trailing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: bottom ?? 'var(--space-6)', ...style }}>
        {leading && <div style={{ flexShrink: 0 }}>{leading}</div>}
        {titleBlock}
        {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: bottom ?? 'var(--space-6)', ...style }}>
      {titleBlock}
    </div>
  )
}
