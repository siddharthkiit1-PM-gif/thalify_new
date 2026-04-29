import { useState, useEffect } from 'react'
import { useAction, useMutation } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'
type OptResult = { name: string; action: 'keep' | 'reduce' | 'skip' | 'add'; recommendation: string; cal: number; protein: number; portion: string; matched: boolean }

const ACTION_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  keep:   { color: '#2D5F3A', bg: 'var(--sage-100)', label: '✓ Keep' },
  reduce: { color: '#b45309', bg: '#fffbeb',          label: '⬇ Reduce' },
  skip:   { color: '#b91c1c', bg: '#fef2f2',          label: '✗ Skip' },
  add:    { color: '#1d4ed8', bg: '#eff6ff',          label: '+ Add' },
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

function todayDate() { return new Date().toISOString().split('T')[0] }

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

export default function Family() {
  const navigate = useNavigate()
  const optimizeFamily = useAction(api.family.optimizeFamily)
  const logMeal = useMutation(api.meals.logMeal)

  const [dishInput, setDishInput] = useState('')
  const [dishes, setDishes] = useState<string[]>([])
  const [result, setResult] = useState<OptResult[] | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)
  // Per-item selection — user picks which optimized items they're actually eating.
  // Defaults: every non-skip row is checked; skip rows start unchecked.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [logging, setLogging] = useState(false)

  // Whenever a fresh optimize result arrives, reset the selection to non-skip rows.
  useEffect(() => {
    if (!result) { setSelected(new Set()); return }
    const next = new Set<number>()
    result.forEach((r, i) => { if (r.action !== 'skip') next.add(i) })
    setSelected(next)
  }, [result])

  function toggleSelected(i: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  function addDish() {
    const trimmed = dishInput.trim()
    if (trimmed && !dishes.includes(trimmed)) setDishes(prev => [...prev, trimmed])
    setDishInput('')
  }

  async function optimize() {
    if (dishes.length === 0) return
    setOptimizing(true)
    setError('')
    try {
      const res = await optimizeFamily({ dishes, date: todayDate() })
      setResult(res.plate)
      setWarning(res.warning)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Optimization failed — please try again.')
    } finally {
      setOptimizing(false)
    }
  }

  async function logSelected() {
    if (!result) return
    if (selected.size === 0) return
    setLogging(true)
    setError('')
    try {
      const items = result
        .map((r, i) => ({ r, i }))
        .filter(({ i }) => selected.has(i))
        .map(({ r }) => {
          // "Reduce" rows log at half-portion / half-cal. "Add" + "Keep" log full.
          const multiplier = r.action === 'reduce' ? 0.5 : 1
          return {
            name: r.action === 'reduce' ? `${r.name} (½ portion)` : r.name,
            portion: r.portion || '1 serving',
            cal: Math.round(r.cal * multiplier),
            protein: Math.round((r.protein || 0) * multiplier),
            carbs: 0,
            fat: 0,
          }
        })
      const totalCal = items.reduce((acc, i) => acc + i.cal, 0)
      await logMeal({ date: todayDate(), mealType, items, totalCal })
      setLogged(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not log meal — please retry.')
    } finally {
      setLogging(false)
    }
  }

  // Live count of selected calories (respecting reduce → half)
  const selectedCal = result
    ? result.reduce((acc, r, i) => {
        if (!selected.has(i)) return acc
        const mult = r.action === 'reduce' ? 0.5 : 1
        return acc + r.cal * mult
      }, 0)
    : 0

  const beforeCal = result ? result.filter(r => r.action !== 'add').reduce((acc, r) => acc + r.cal, 0) : 0
  const afterCal = result ? result.filter(r => r.action !== 'skip').reduce((acc, r) => {
    const multiplier = r.action === 'reduce' ? 0.5 : 1
    return acc + r.cal * multiplier
  }, 0) : 0
  const calorieDelta = afterCal - beforeCal

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 720 }}>
        <Section
          eyebrow="Family · Tonight's menu"
          title="Eat what's cooked. Eat the right amount."
          subtitle={<>Add the dishes Mummy made. We tell you what to keep, what to halve, and what to skip — for <em style={{ color: 'var(--sage-700)' }}>your goal</em>, not the family's.</>}
          hero
          bottom="var(--space-7)"
        />

        {/* Dish input */}
        <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 22, marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 12 }}>Tonight's Menu</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="e.g. Dal, Roti, Rice, Paneer Sabzi..."
              value={dishInput}
              onChange={e => setDishInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDish()}
            />
            <button className="btn btn-secondary" onClick={addDish}>Add</button>
          </div>
          {dishes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dishes.map(dish => (
                <div key={dish} style={{ padding: '6px 12px', background: 'var(--cream)', borderRadius: 99, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dish}
                  <span style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setDishes(d => d.filter(x => x !== dish))}>×</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 28 }} disabled={dishes.length === 0 || optimizing} onClick={optimize}>
          {optimizing ? 'Optimizing your plate...' : '🍽️ Optimize My Plate'}
        </button>

        {error && <div style={{ color: '#b91c1c', padding: '12px 16px', background: '#fef2f2', borderRadius: 10, marginBottom: 16 }}>{error}</div>}
        {warning && <div style={{ color: '#b45309', padding: '12px 16px', background: '#fffbeb', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>Heads up: {warning} Showing deterministic recommendations from our Indian food database instead.</div>}

        {result && (
          <div className="fade-in">
            {/* Before / After */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
              <div style={{ background: 'var(--sand)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <div className="label" style={{ marginBottom: 6 }}>Your Plate</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{Math.round(beforeCal)} cal</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>as entered</div>
              </div>
              <div style={{ background: 'var(--sage-100, #EEF7EC)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <div className="label" style={{ marginBottom: 6, color: 'var(--sage-700)' }}>Recommended</div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--sage-700)' }}>{Math.round(afterCal)} cal</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>after Thalify's edits</div>
              </div>
            </div>
            {calorieDelta !== 0 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                {calorieDelta > 0
                  ? `+${Math.round(calorieDelta)} cal added (mostly protein/fiber for balance)`
                  : `${Math.round(calorieDelta)} cal reduced`}
              </div>
            )}
            {calorieDelta === 0 && <div style={{ marginBottom: 20 }} />}

            {/* Per-dish guidance with selection checkboxes */}
            <div className="label" style={{ marginBottom: 8 }}>Tick what you're actually eating</div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
              {result.map((item, i) => {
                const s = ACTION_STYLE[item.action]
                const isChecked = selected.has(i)
                const halfMode = item.action === 'reduce'
                return (
                  <div
                    key={i}
                    onClick={() => !logged && toggleSelected(i)}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      cursor: logged ? 'default' : 'pointer',
                      opacity: isChecked || logged ? 1 : 0.6,
                      transition: 'opacity 0.15s ease, background 0.15s ease',
                      background: isChecked && !logged ? 'rgba(45,95,58,0.04)' : 'transparent',
                    }}
                  >
                    {/* checkbox */}
                    <div
                      style={{
                        width: 20, height: 20, borderRadius: 5,
                        border: `1.5px solid ${isChecked ? 'var(--sage-700)' : 'var(--muted)'}`,
                        background: isChecked ? 'var(--sage-700)' : 'transparent',
                        display: 'grid', placeItems: 'center',
                        flexShrink: 0, marginTop: 2,
                      }}
                    >
                      {isChecked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: 'nowrap', marginTop: 2 }}>{s.label}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span>{item.name}{halfMode && isChecked && <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 13 }}> · ½ portion</span>}</span>
                        {item.cal > 0 && (
                          <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {halfMode && isChecked ? Math.round(item.cal * 0.5) : item.cal} cal · {item.protein}g protein · {item.portion}
                          </span>
                        )}
                        {!item.matched && item.action !== 'add' && (
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>(estimate)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{item.recommendation}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {!logged && (
              <>
                {/* Meal type picker */}
                <div className="label" style={{ marginBottom: 8 }}>Log as</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
                  {MEAL_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => setMealType(t)}
                      disabled={logging}
                      style={{
                        height: 38, borderRadius: 8,
                        background: mealType === t ? 'var(--sage-700)' : 'var(--cream)',
                        color: mealType === t ? '#fff' : 'var(--ink-2)',
                        border: '1px solid ' + (mealType === t ? 'var(--sage-700)' : 'var(--border)'),
                        fontSize: 13, fontWeight: 600,
                        textTransform: 'capitalize', cursor: 'pointer',
                      }}
                    >{t}</button>
                  ))}
                </div>

                {/* Selected summary + log button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                  <span>{selected.size === 0 ? 'Nothing selected' : `${selected.size} item${selected.size === 1 ? '' : 's'} selected`}</span>
                  {selected.size > 0 && (
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {Math.round(selectedCal)} cal total
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={selected.size === 0 || logging}
                  onClick={logSelected}
                >
                  {logging ? 'Logging…' : `Log selected as ${mealType}`}
                </button>
              </>
            )}
            {logged && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--sage-700)', fontWeight: 600 }}>
                ✓ Logged! <span style={{ color: 'var(--ink-2)', fontWeight: 400, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/dashboard')}>Back to dashboard →</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
