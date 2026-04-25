import { useState } from 'react'
import Navbar from '../components/Navbar'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

type PatternResult = {
  topPatterns: string[]
  wins: string[]
  improvements: string[]
  weeklyInsight: string
  streakMessage: string
}

export default function Patterns() {
  const logs = useQuery(api.meals.getRecentLogs)
  const analyzePatterns = useAction(api.patterns.analyzePatterns)
  const [result, setResult] = useState<PatternResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const daysLogged = new Set(logs?.map(l => l.date) ?? []).size
  const hasEnoughData = daysLogged >= 3

  const allDays = logs?.map(l => l.date) ?? []
  const uniqueDates = [...new Set(allDays)].sort()
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    return d.toISOString().split('T')[0]
  })

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    try {
      const res = await analyzePatterns()
      setResult(res as PatternResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed — please retry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 680, paddingTop: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
            Insight · Last 28 days
          </div>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, lineHeight: 1.1, letterSpacing: '-0.015em' }}>The shape of your eating.</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.55 }}>
            We read every meal you've logged and surface the patterns — what's working, what's quietly off, and one small thing to try next week.
          </p>
        </div>

        {/* Heatmap */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 12 }}>Logging Streak — Last 28 Days</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {last28.map((date, i) => {
              const logged = uniqueDates.includes(date)
              return (
                <div
                  key={i}
                  title={date}
                  style={{
                    height: 28,
                    borderRadius: 6,
                    background: logged ? 'var(--sage-700)' : 'var(--border)',
                    opacity: logged ? 1 : 0.4,
                    transition: 'background 0.2s',
                  }}
                />
              )
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>You've logged on <b style={{ color: 'var(--ink)' }}>{daysLogged}</b> day{daysLogged !== 1 ? 's' : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--sage-700)', display: 'inline-block' }} />
              Logged
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--border)', opacity: 0.4, display: 'inline-block' }} />
              Missed
            </span>
          </div>
        </div>

        {!hasEnoughData && (
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6, letterSpacing: '-0.01em' }}>Log {3 - daysLogged} more day{3 - daysLogged !== 1 ? 's' : ''} to unlock patterns</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>Three days is the minimum we need to see honest patterns. Two meals tells us very little; a week tells us everything.</div>
          </div>
        )}

        {hasEnoughData && !result && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="btn-primary"
              style={{ fontSize: 15, padding: '14px 32px' }}
            >
              {loading ? 'Analyzing…' : 'Analyze My Patterns'}
            </button>
            {loading && (
              <div style={{ marginTop: 16, color: 'var(--muted)', fontSize: 14 }}>
                Reading through {daysLogged} days of meals…
              </div>
            )}
            {error && (
              <div style={{ marginTop: 12, color: '#c0392b', fontSize: 14 }}>{error}</div>
            )}
          </div>
        )}

        {result && (
          <div>
            <div style={{ background: 'var(--sage-100)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)' }}>{result.weeklyInsight}</div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 12 }}>Patterns Spotted</div>
              {result.topPatterns.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 20 }}>{i + 1}.</span>
                  <span style={{ color: 'var(--ink-2)' }}>{p}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                <div className="label" style={{ marginBottom: 12, color: 'var(--sage-700)' }}>Wins</div>
                {result.wins.map((w, i) => (
                  <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6, color: 'var(--ink-2)' }}>
                    <span style={{ marginRight: 6 }}>✓</span>{w}
                  </div>
                ))}
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                <div className="label" style={{ marginBottom: 12 }}>Improve</div>
                {result.improvements.map((imp, i) => (
                  <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6, color: 'var(--ink-2)' }}>
                    <span style={{ marginRight: 6 }}>→</span>{imp}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--sand)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
              {result.streakMessage}
            </div>

            <button onClick={handleAnalyze} disabled={loading} className="btn-secondary" style={{ width: '100%' }}>
              {loading ? 'Re-analyzing…' : 'Refresh Analysis'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
