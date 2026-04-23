import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'
type ScanItem = { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number }

function todayDate() { return new Date().toISOString().split('T')[0] }
function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

export default function Scan() {
  const navigate = useNavigate()
  const scanMeal = useAction(api.scan.scanMeal)
  const logMeal = useMutation(api.meals.logMeal)
  const recentScans = useQuery(api.meals.getRecentLogs)

  const [phase, setPhase] = useState<'upload' | 'scanning' | 'result' | 'logged'>('upload')
  const [items, setItems] = useState<ScanItem[]>([])
  const [totalCal, setTotalCal] = useState(0)
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload a JPG or PNG image.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setPhase('scanning')
      try {
        const result = await scanMeal({ imageBase64: base64 })
        setItems(result.items)
        setTotalCal(result.totalCal)
        setPhase('result')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Couldn't read this photo — try better lighting or a closer shot"
        setError(msg)
        setPhase('upload')
      }
    }
    reader.readAsDataURL(file)
  }, [scanMeal])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleLog() {
    await logMeal({ date: todayDate(), mealType, items, totalCal })
    setPhase('logged')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 680 }}>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 4 }}>Scan Meal</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 28 }}>Photo to calories in 3 seconds</p>

        {phase === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{ border: '2px dashed var(--border)', borderRadius: 18, padding: 48, textAlign: 'center', background: 'var(--sand)', cursor: 'pointer' }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop your meal photo here</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>or click to upload · JPG / PNG</div>
            <button className="btn btn-primary">Choose Photo</button>
            <input id="file-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )}

        {phase === 'scanning' && (
          <div style={{ textAlign: 'center', padding: 64, background: 'var(--sand)', borderRadius: 18 }}>
            {preview && <img src={preview} alt="meal" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 14, marginBottom: 24 }} />}
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Identifying your meal...</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-700)', animation: `bounce 1s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div>
            {preview && <img src={preview} alt="meal" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 16, marginBottom: 20 }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="label">Meal type</div>
              <select className="input" value={mealType} onChange={e => setMealType(e.target.value as MealType)} style={{ width: 'auto' }}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Snack</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px', gap: 0, padding: '10px 16px', background: 'var(--cream)', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <div>Item</div><div>Portion</div><div>Cal</div><div>Prot</div><div>Carbs</div>
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px', gap: 0, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{item.portion}</div>
                  <div className="mono" style={{ fontWeight: 600 }}>{item.cal}</div>
                  <div className="mono" style={{ color: 'var(--muted)' }}>{item.protein}g</div>
                  <div className="mono" style={{ color: 'var(--muted)' }}>{item.carbs}g</div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px', gap: 0, padding: '12px 16px', borderTop: '2px solid var(--border)', background: 'var(--cream)' }}>
                <div style={{ fontWeight: 700 }}>Total</div>
                <div></div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--sage-700)' }}>{totalCal}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setPhase('upload')}>Try Another Photo</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleLog}>Log This Meal</button>
            </div>
          </div>
        )}

        {phase === 'logged' && (
          <div style={{ textAlign: 'center', padding: 48, background: 'var(--sand)', borderRadius: 18 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Meal logged!</div>
            <div style={{ color: 'var(--muted)', marginBottom: 24 }}>{totalCal} cal added to today&apos;s log</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => { setPhase('upload'); setItems([]); setPreview('') }}>Scan Another</button>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: 16, color: '#b91c1c', padding: '12px 16px', background: '#fef2f2', borderRadius: 10 }}>{error}</div>}

        {recentScans && recentScans.length > 0 && phase === 'upload' && (
          <div style={{ marginTop: 32 }}>
            <div className="label" style={{ marginBottom: 12 }}>Recent Meals</div>
            {recentScans.slice(0, 3).map(log => (
              <div key={log._id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--sand)', borderRadius: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{log.mealType} · {log.date}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{log.items.map(i => i.name).join(', ')}</div>
                </div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--sage-700)' }}>{log.totalCal} cal</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
