import { useState, useEffect, useRef } from 'react'
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
  const topSignal = useQuery(api.nudges.queries.topSignal)
  const analyzePatterns = useAction(api.patterns.analyzePatterns)
  const [result, setResult] = useState<PatternResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const autoTriggered = useRef(false)

  const daysLogged = new Set(logs?.map(l => l.date) ?? []).size
  const hasEnoughData = daysLogged >= 3

  const allDays = logs?.map(l => l.date) ?? []
  const uniqueDates = [...new Set(allDays)].sort()
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    return d.toISOString().split('T')[0]
  })

  // Last-14 daily calorie totals for the trend chart
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dateStr = d.toISOString().split('T')[0]
    const dayLogs = (logs ?? []).filter(l => l.date === dateStr)
    const total = dayLogs.reduce((s, l) => s + l.totalCal, 0)
    return { dateStr, total, label: d.getDate(), monthDay: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
  })
  const maxCal = Math.max(1, ...last14.map(d => d.total))

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    try {
      const res = await analyzePatterns() as Partial<PatternResult> | null | undefined
      // Defensive shape — the LLM occasionally returns valid JSON but with
      // a missing array. We never want `.map()` on `undefined` to crash the page.
      const safe: PatternResult = {
        topPatterns: Array.isArray(res?.topPatterns) ? res!.topPatterns : [],
        wins: Array.isArray(res?.wins) ? res!.wins : [],
        improvements: Array.isArray(res?.improvements) ? res!.improvements : [],
        weeklyInsight: typeof res?.weeklyInsight === 'string' ? res!.weeklyInsight : '',
        streakMessage: typeof res?.streakMessage === 'string' ? res!.streakMessage : '',
      }
      setResult(safe)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed — please retry')
    } finally {
      setLoading(false)
    }
  }

  // Auto-run analysis once when the user has enough data. The ref guards
  // against re-triggering after the user manually refreshes (which would
  // already set result/error) — we only fire on the first eligible render.
  useEffect(() => {
    if (hasEnoughData && !autoTriggered.current && !result && !loading) {
      autoTriggered.current = true
      handleAnalyze()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnoughData])

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

        {/* Top signal — the most recent live nudge from the engine */}
        {topSignal && (
          <div style={{
            background: 'linear-gradient(135deg, var(--sage-100) 0%, #DCEFE0 100%)',
            border: '1px solid var(--sage-700)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: 20,
            position: 'relative',
          }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              letterSpacing: '0.18em',
              color: 'var(--sage-700)',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage-700)', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
              Today's signal
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink)' }}>
              {topSignal.message}
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              {new Date(topSignal.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              {topSignal.deliveredViaTelegram ? 'sent to telegram' : 'in-app'}
            </div>
            <style>{`
              @keyframes pulseDot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.4); }
              }
            `}</style>
          </div>
        )}

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

        {/* Daily calorie trend — last 14 days. Always visible, even with <3 days */}
        {hasEnoughData && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div className="label">Daily Calories — Last 14 Days</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>
                avg {Math.round(last14.filter(d => d.total > 0).reduce((s, d) => s + d.total, 0) / Math.max(1, last14.filter(d => d.total > 0).length))} cal
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {last14.map((d, i) => {
                const h = d.total === 0 ? 4 : Math.max(8, (d.total / maxCal) * 72)
                return (
                  <div
                    key={i}
                    title={`${d.monthDay} · ${d.total} cal`}
                    style={{
                      flex: 1,
                      height: h,
                      background: d.total === 0 ? 'var(--border)' : 'var(--sage-700)',
                      opacity: d.total === 0 ? 0.35 : 1,
                      borderRadius: '4px 4px 0 0',
                      transition: 'background 0.2s',
                    }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              <span>{last14[0].monthDay}</span>
              <span>today</span>
            </div>
          </div>
        )}

        {!hasEnoughData && (
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 28, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 8, letterSpacing: '-0.01em' }}>
              Log {3 - daysLogged} more day{3 - daysLogged !== 1 ? 's' : ''} to unlock patterns
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' }}>
              Three days is the minimum we need to see honest patterns. Two meals tells us very little; a week tells us everything. Once you cross the line, this page automatically shows your trends + AI insights.
            </div>
          </div>
        )}

        {hasEnoughData && loading && !result && (
          <div style={{ background: 'var(--sage-100)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-700)', animation: `bounce 1.1s ${i * 0.15}s infinite ease-in-out` }} />
              ))}
            </div>
            <div className="serif" style={{ fontSize: 18, marginBottom: 4, letterSpacing: '-0.005em' }}>
              Reading {daysLogged} days of meals…
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Surfacing your patterns + one small thing to try this week.
            </div>
          </div>
        )}

        {hasEnoughData && error && !loading && (
          <div style={{ background: 'var(--red-bg, #FDF2F2)', border: '1px solid var(--red-br, #F5D0D0)', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'center' }}>
            <div style={{ color: 'var(--red, #B91C1C)', fontSize: 14, marginBottom: 10 }}>{error}</div>
            <button onClick={handleAnalyze} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </div>
        )}

        {result && (
          <div>
            {result.weeklyInsight && (
              <div style={{ background: 'var(--sage-100)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)' }}>{result.weeklyInsight}</div>
              </div>
            )}

            {result.topPatterns.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Patterns Spotted</div>
                {result.topPatterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--muted)', minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ color: 'var(--ink-2)' }}>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {(result.wins.length > 0 || result.improvements.length > 0) && (
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
            )}

            {result.streakMessage && (
              <div style={{ background: 'var(--sand)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
                {result.streakMessage}
              </div>
            )}

            <button onClick={handleAnalyze} disabled={loading} className="btn-secondary" style={{ width: '100%' }}>
              {loading ? 'Re-analyzing…' : 'Refresh Analysis'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
