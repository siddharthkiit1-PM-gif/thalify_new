import { useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'

type OptResult = { name: string; action: 'keep' | 'reduce' | 'skip' | 'add'; recommendation: string; cal: number }

const ACTION_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  keep:   { color: '#2D5F3A', bg: 'var(--sage-100)', label: '✓ Keep' },
  reduce: { color: '#b45309', bg: '#fffbeb',          label: '⬇ Reduce' },
  skip:   { color: '#b91c1c', bg: '#fef2f2',          label: '✗ Skip' },
  add:    { color: '#1d4ed8', bg: '#eff6ff',          label: '+ Add' },
}

function todayDate() { return new Date().toISOString().split('T')[0] }

export default function Family() {
  const navigate = useNavigate()
  const optimizeFamily = useAction(api.family.optimizeFamily)
  const logMeal = useMutation(api.meals.logMeal)

  const [dishInput, setDishInput] = useState('')
  const [dishes, setDishes] = useState<string[]>([])
  const [result, setResult] = useState<OptResult[] | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)

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
      setResult(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Optimization failed — please try again.')
    } finally {
      setOptimizing(false)
    }
  }

  async function logOptimized() {
    if (!result) return
    const items = result.filter(r => r.action !== 'skip').map(r => ({
      name: r.name, portion: '1 serving', cal: r.cal, protein: 0, carbs: 0, fat: 0
    }))
    const totalCal = items.reduce((acc, i) => acc + i.cal, 0)
    await logMeal({ date: todayDate(), mealType: 'dinner', items, totalCal })
    setLogged(true)
  }

  const afterCal = result ? result.filter(r => r.action !== 'skip').reduce((acc, r) => acc + r.cal, 0) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 720 }}>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 4 }}>Family Meal Optimizer</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 28 }}>Add tonight's dishes — get personalized plate guidance</p>

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

        {result && (
          <div className="fade-in">
            {/* Before / After */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {([['Before', result.reduce((acc, r) => acc + r.cal, 0)], ['After', afterCal]] as [string, number][]).map(([label, cal]) => (
                <div key={label} style={{ background: 'var(--sand)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                  <div className="label" style={{ marginBottom: 6 }}>{label}</div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: label === 'After' ? 'var(--sage-700)' : 'var(--ink)' }}>{cal} cal</div>
                </div>
              ))}
            </div>

            {/* Per-dish guidance */}
            <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
              {result.map((item, i) => {
                const s = ACTION_STYLE[item.action]
                return (
                  <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: 'nowrap', marginTop: 2 }}>{s.label}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name} {item.cal > 0 && <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>· {item.cal} cal</span>}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{item.recommendation}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {!logged ? (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={logOptimized}>Log Optimized Meal</button>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--sage-700)', fontWeight: 600 }}>
                ✓ Logged! <span style={{ color: 'var(--ink-2)', fontWeight: 400, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>Back to dashboard →</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
