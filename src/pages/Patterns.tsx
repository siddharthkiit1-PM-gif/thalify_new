import Navbar from '../components/Navbar'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export default function Patterns() {
  const logs = useQuery(api.meals.getRecentLogs)
  const daysLogged = new Set(logs?.map(l => l.date) ?? []).size
  const daysLeft = Math.max(0, 30 - daysLogged)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 10 }}>Behavioral Patterns</h1>
        <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
          Keep logging meals — check back in <b style={{ color: 'var(--ink)' }}>{daysLeft} days</b> for your personalized patterns.
        </p>

        {/* Greyed heatmap preview */}
        <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 24, opacity: 0.5, pointerEvents: 'none' }}>
          <div className="label" style={{ marginBottom: 12 }}>Eating Heatmap (preview)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} style={{ height: 28, borderRadius: 6, background: i % 2 === 0 ? 'var(--sage-700)' : 'var(--border)', opacity: 0.6 }} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>
          You've logged meals on <b style={{ color: 'var(--ink)' }}>{daysLogged}</b> day{daysLogged !== 1 ? 's' : ''} so far.
        </div>
      </div>
    </div>
  )
}
