import type { CSSProperties, ReactNode, MouseEvent } from 'react'

type Variant = 'sand' | 'cream' | 'sage' | 'outline'
type Pad = 'sm' | 'md' | 'lg'

interface Props {
  children: ReactNode
  variant?: Variant
  pad?: Pad
  className?: string
  style?: CSSProperties
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  as?: 'div' | 'section' | 'article'
}

const PADS: Record<Pad, string> = {
  sm: 'var(--space-4)',
  md: 'var(--space-5)',
  lg: 'var(--space-6)',
}

const BG: Record<Variant, string> = {
  sand: 'var(--sand)',
  cream: 'var(--cream)',
  sage: 'var(--sage-100)',
  outline: 'var(--cream)',
}

export default function Card({ children, variant = 'sand', pad = 'md', className, style, onClick, as = 'div' }: Props) {
  const Tag = as
  return (
    <Tag
      className={className}
      onClick={onClick}
      style={{
        background: BG[variant],
        border: variant === 'outline' ? '1px solid var(--border)' : 'none',
        borderRadius: 'var(--radius-md)',
        padding: PADS[pad],
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'transform 0.15s ease, box-shadow 0.15s ease' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
