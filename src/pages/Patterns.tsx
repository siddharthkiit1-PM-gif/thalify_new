import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Card from '../components/ui/Card'
import Section from '../components/ui/Section'
import EmptyState from '../components/ui/EmptyState'
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
      <div className="page" style={{ maxWidth: 680, paddingTop: 'var(--space-7)' }}>
        <Section
          eyebrow="Insight · Last 28 days"
          title="The shape of your eating."
          subtitle="We read every meal you've logged and surface the patterns — what's working, what's quietly off, and one small thing to try next week."
          hero
          bottom="var(--space-7)"
        />

        {/* Top signal — the most recent live nudge from the engine */}
        {topSignal && (
          <Card
            variant="sage"
            pad="md"
            style={{
              marginBottom: 'var(--space-5)',
              border: '1px solid var(--sage-700)',
              position: 'relative',
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--fs-label)',
              letterSpacing: '0.18em',
              color: 'var(--sage-700)',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage-700)', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
              Today's signal
            </div>
            <div style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.55, color: 'var(--ink)' }}>
              {topSignal.message}
            </div>
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--fs-micro)', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
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
          </Card>
        )}

        {/* Heatmap */}
        <Card variant="outline" pad="md" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="label" style={{ marginBottom: 'var(--space-3)' }}>Logging Streak — Last 28 Days</div>
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
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--fs-small)', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>You've logged on <b style={{ color: 'var(--ink)' }}>{daysLogged}</b> day{daysLogged !== 1 ? 's' : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--sage-700)', display: 'inline-block' }} />
              Logged
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--border)', opacity: 0.4, display: 'inline-block' }} />
              Missed
            </span>
          </div>
        </Card>

        {/* Daily calorie trend — last 14 days. Always visible, even with <3 days */}
        {hasEnoughData && (
          <Card variant="outline" pad="md" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
              <div className="label">Daily Calories — Last 14 Days</div>
              <div className="mono" style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', letterSpacing: 0.5 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontSize: 'var(--fs-label)', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              <span>{last14[0].monthDay}</span>
              <span>today</span>
            </div>
          </Card>
        )}

        {!hasEnoughData && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <EmptyState
              icon="📊"
              title={`Log ${3 - daysLogged} more day${3 - daysLogged !== 1 ? 's' : ''} to unlock patterns`}
              helper="Three days is the minimum we need to see honest patterns. Two meals tells us very little; a week tells us everything. Once you cross the line, this page automatically shows your trends + AI insights."
            />
          </div>
        )}

        {hasEnoughData && loading && !result && (
          <Card variant="sage" pad="lg" style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-700)', animation: `bounce 1.1s ${i * 0.15}s infinite ease-in-out` }} />
              ))}
            </div>
            <div className="serif" style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--space-1)' }}>
              Reading {daysLogged} days of meals…
            </div>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
              Surfacing your patterns + one small thing to try this week.
            </div>
          </Card>
        )}

        {hasEnoughData && error && !loading && (
          <Card pad="md" style={{ marginBottom: 'var(--space-6)', background: 'var(--red-bg)', border: '1px solid var(--red-br)', textAlign: 'center' }}>
            <div style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', marginBottom: 'var(--space-3)' }}>{error}</div>
            <button onClick={handleAnalyze} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </Card>
        )}

        {result && (
          <div>
            {result.weeklyInsight && (
              <Card variant="sage" pad="md" style={{ marginBottom: 'var(--space-5)' }}>
                <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.7, color: 'var(--ink-2)' }}>{result.weeklyInsight}</div>
              </Card>
            )}

            {result.topPatterns.length > 0 && (
              <Card variant="outline" pad="md" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="label" style={{ marginBottom: 'var(--space-3)' }}>Patterns Spotted</div>
                {result.topPatterns.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--muted)', minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ color: 'var(--ink-2)' }}>{p}</span>
                  </div>
                ))}
              </Card>
            )}

            {(result.wins.length > 0 || result.improvements.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <Card variant="outline" pad="md">
                  <div className="label" style={{ marginBottom: 'var(--space-3)', color: 'var(--sage-700)' }}>Wins</div>
                  {result.wins.map((w, i) => (
                    <div key={i} style={{ fontSize: 'var(--fs-small)', lineHeight: 1.6, marginBottom: 'var(--space-1)', color: 'var(--ink-2)' }}>
                      <span style={{ marginRight: 'var(--space-1)' }}>✓</span>{w}
                    </div>
                  ))}
                </Card>
                <Card variant="outline" pad="md">
                  <div className="label" style={{ marginBottom: 'var(--space-3)' }}>Improve</div>
                  {result.improvements.map((imp, i) => (
                    <div key={i} style={{ fontSize: 'var(--fs-small)', lineHeight: 1.6, marginBottom: 'var(--space-1)', color: 'var(--ink-2)' }}>
                      <span style={{ marginRight: 'var(--space-1)' }}>→</span>{imp}
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {result.streakMessage && (
              <Card variant="sand" pad="md" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {result.streakMessage}
              </Card>
            )}

            <button onClick={handleAnalyze} disabled={loading} className="btn btn-secondary" style={{ width: '100%' }}>
              {loading ? 'Re-analyzing…' : 'Refresh Analysis'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
