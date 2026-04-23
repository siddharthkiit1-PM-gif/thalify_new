const MAP: Record<string, string> = {
  HIGH: 'sev-high', CRITICAL: 'sev-high',
  MED: 'sev-med', MEDIUM: 'sev-med',
  LOW: 'sev-low', GOOD: 'sev-low',
}
export default function Severity({ level }: { level: string }) {
  return <span className={`sev ${MAP[level] || ''}`}>{level}</span>
}
