import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Preset = { label: string; ml: number; type: string; emoji: string }

const PRESETS: Preset[] = [
  { label: '200 ml',   ml: 200,  type: 'glass-200',   emoji: '🥛' },
  { label: '250 ml',   ml: 250,  type: 'glass-250',   emoji: '🥛' },
  { label: '500 ml',   ml: 500,  type: 'bottle-500',  emoji: '🍾' },
  { label: '1 L',      ml: 1000, type: 'bottle-1000', emoji: '🍶' },
]

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function WaterWidget() {
  const today = useQuery(api.water.getTodayWater)
  const logWater = useMutation(api.water.logWater)
  const deleteWater = useMutation(api.water.deleteWaterLog)
  const [busy, setBusy] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customMl, setCustomMl] = useState('')
  const [error, setError] = useState('')

  async function add(preset: Preset) {
    setBusy(true); setError('')
    try {
      await logWater({ amountMl: preset.ml, source: 'web', containerType: preset.type })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not log')
    } finally {
      setBusy(false)
    }
  }

  async function addCustom() {
    const ml = parseInt(customMl, 10)
    if (!ml || ml < 1 || ml > 5000) {
      setError('Enter 1–5000 ml'); return
    }
    setBusy(true); setError('')
    try {
      await logWater({ amountMl: ml, source: 'web', containerType: 'custom' })
      setCustomMl('')
      setCustomOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not log')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try { await deleteWater({ waterLogId: id as never }) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not delete') }
    finally { setBusy(false) }
  }

  if (!today) {
    return (
      <div style={{ background: 'var(--sand)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div className="label">Water</div>
      </div>
    )
  }

  const { totalMl, target, logs } = today
  const pct = Math.min(100, Math.round((totalMl / target) * 100))
  const reached = totalMl >= target

  return (
    <div style={{ background: 'var(--sand)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div className="label">Water · today</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          target {(target / 1000).toFixed(1)}L
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span
          className="mono"
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1,
            color: reached ? 'var(--sage-700)' : 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {(totalMl / 1000).toFixed(2)}L
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          / {(target / 1000).toFixed(1)}L · {pct}%
        </span>
      </div>

      {/* progress bar */}
      <div style={{ height: 6, background: 'var(--cream)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: reached ? 'var(--sage-700)' : '#22A6DC', transition: 'width 0.3s ease' }} />
      </div>

      {/* quick-log buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: customOpen ? 10 : 0 }}>
        {PRESETS.map((p) => (
          <button
            key={p.type}
            onClick={() => add(p)}
            disabled={busy}
            style={{
              padding: '10px 4px',
              background: 'var(--cream)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--ink)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#E8F4FA')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cream)')}
          >
            <span style={{ fontSize: 16 }}>{p.emoji}</span>
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((o) => !o)}
          disabled={busy}
          style={{
            padding: '10px 4px',
            background: customOpen ? 'var(--sage-700)' : 'var(--cream)',
            color: customOpen ? '#fff' : 'var(--ink)',
            border: '1px solid ' + (customOpen ? 'var(--sage-700)' : 'var(--border)'),
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          + ml
        </button>
      </div>

      {customOpen && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            type="number"
            min={1}
            max={5000}
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            placeholder="e.g. 350"
            disabled={busy}
            className="input"
            style={{ flex: 1, height: 36, fontSize: 13 }}
          />
          <button onClick={addCustom} disabled={busy} className="btn btn-primary btn-sm" style={{ minWidth: 60 }}>
            Log
          </button>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red, #b91c1c)', fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      {/* recent log entries */}
      {logs.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
            Today&rsquo;s sips
          </div>
          {logs.slice(0, 6).map((l) => (
            <div
              key={l._id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--ink-2)' }}>
                {l.amountMl}ml{' '}
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>· {formatTime(l.createdAt)}</span>
                {l.source === 'telegram' && (
                  <span style={{ marginLeft: 6, color: '#22A6DC', fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>TG</span>
                )}
              </span>
              <button
                onClick={() => remove(l._id)}
                disabled={busy}
                title="Delete"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 14, padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          ))}
          {logs.length > 6 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>
              + {logs.length - 6} more today
            </div>
          )}
        </div>
      )}
    </div>
  )
}
