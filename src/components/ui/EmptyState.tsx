import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: ReactNode
  helper?: ReactNode
  cta?: ReactNode
}

export default function EmptyState({ icon, title, helper, cta }: Props) {
  return (
    <div
      style={{
        background: 'var(--sand)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-7) var(--space-5)',
        textAlign: 'center',
      }}
    >
      {icon && <div style={{ fontSize: 36, marginBottom: 'var(--space-3)' }}>{icon}</div>}
      <div className="serif" style={{ fontSize: 'var(--fs-h2)', marginBottom: 'var(--space-2)', letterSpacing: '-0.01em' }}>
        {title}
      </div>
      {helper && (
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' }}>
          {helper}
        </div>
      )}
      {cta && <div style={{ marginTop: 'var(--space-5)' }}>{cta}</div>}
    </div>
  )
}
