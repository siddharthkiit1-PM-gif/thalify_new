interface Props { value: number; max: number; className?: string }

export default function Progress({ value, max, className = '' }: Props) {
  const pct = Math.min(100, (value / max) * 100)
  const cls = pct > 100 ? 'danger' : pct > 80 ? 'warn' : ''
  return (
    <div className={`progress ${className}`}>
      <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
