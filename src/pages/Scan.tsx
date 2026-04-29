import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import type { Id } from '../../convex/_generated/dataModel'
import { useIsMobile } from '../hooks/useIsMobile'

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
  const isMobile = useIsMobile()
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl)
  const scanMeal = useAction(api.scan.scanMeal)
  const updateScanItems = useMutation(api.scanFeedback.updateScanItems)
  const recordScanFeedback = useMutation(api.scanFeedback.recordScanFeedback)
  const logMeal = useMutation(api.meals.logMeal)
  const recentScans = useQuery(api.meals.getRecentLogs)
  const profile = useQuery(api.users.getProfile)
  const setPhotoStorage = useMutation(api.users.setPhotoStoragePreference)
  // Default-on: treat undefined (legacy users) as opt-in. The inline checkbox
  // below the upload zone is the only place users manage this now.
  const photoSavingOn = profile === null || profile === undefined ? true : profile.allowPhotoStorage !== false

  const [phase, setPhase] = useState<'upload' | 'scanning' | 'result' | 'logged'>('upload')
  const [items, setItems] = useState<ScanItem[]>([])
  const [mealType, setMealType] = useState<MealType>(guessMealType())
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [scanResultId, setScanResultId] = useState<Id<'scanResults'> | null>(null)
  const [edited, setEdited] = useState(false)
  const [feedback, setFeedback] = useState<'accurate' | 'inaccurate' | 'partial' | null>(null)

  const totalCal = items.reduce((s, i) => s + i.cal, 0)
  const totalProtein = items.reduce((s, i) => s + i.protein, 0)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload a JPG or PNG image.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image too large — please use under 7MB.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setPhase('scanning')
      try {
        // Upload to Convex storage first so we can keep the photo for accuracy improvements
        let imageStorageId: Id<'_storage'> | undefined
        try {
          const uploadUrl = await generateUploadUrl()
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          })
          if (res.ok) {
            const json = await res.json()
            imageStorageId = json.storageId as Id<'_storage'>
          }
        } catch {
          // Photo upload is optional — scan still runs
        }

        const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
        const result = await scanMeal({ imageBase64: base64, mediaType, imageStorageId })
        setItems(result.items)
        setScanResultId(result.scanResultId as Id<'scanResults'>)
        setEdited(false)
        setFeedback(null)
        setPhase('result')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Couldn't read this photo — try better lighting or a closer shot"
        setError(msg)
        setPhase('upload')
      }
    }
    reader.readAsDataURL(file)
  }, [scanMeal, generateUploadUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  function updateItemField(idx: number, field: keyof ScanItem, value: string | number) {
    const next = [...items]
    if (field === 'name' || field === 'portion') {
      next[idx] = { ...next[idx], [field]: value as string }
    } else {
      next[idx] = { ...next[idx], [field]: Number(value) }
    }
    setItems(next)
    setEdited(true)
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
    setEdited(true)
  }

  function addItem() {
    setItems([...items, { name: '', portion: '1 serving', cal: 100, protein: 3, carbs: 15, fat: 3 }])
    setEdited(true)
  }

  async function handleLog() {
    if (scanResultId && edited) {
      try { await updateScanItems({ scanResultId, items }) } catch (e) { console.error(e) }
    }
    await logMeal({ date: todayDate(), mealType, items, totalCal })
    setPhase('logged')
  }

  async function submitFeedback(fb: 'accurate' | 'inaccurate' | 'partial') {
    if (!scanResultId) return
    setFeedback(fb)
    try { await recordScanFeedback({ scanResultId, feedback: fb }) } catch (e) { console.error(e) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 680 }}>
        <Section
          eyebrow={`Scan · ${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`}
          title="Snap your plate."
          subtitle="Three seconds from photo to calories. Edit anything that looks off — we get better every time you do."
          hero
          bottom="var(--space-7)"
        />

        {phase === 'upload' && (
          <>
            <div
              className="scan-upload"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 18,
                padding: 56,
                textAlign: 'center',
                background: 'var(--sand)',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => document.getElementById('file-input')?.click()}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--sage-700)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
            >
              <div style={{ fontSize: 44, marginBottom: 14 }}>📷</div>
              <div className="serif" style={{ fontSize: 22, marginBottom: 6, letterSpacing: '-0.01em' }}>Drop a meal photo</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>or click to upload · JPG, PNG, HEIC</div>
              <button className="btn btn-primary">Choose Photo</button>
              <input id="file-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>

            {/* Inline photo-saving checkbox — directly below the upload zone */}
            <label
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--cream)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={photoSavingOn}
                onChange={e => setPhotoStorage({ allow: e.target.checked }).catch(console.error)}
                style={{ marginTop: 2, accentColor: 'var(--sage-700)', width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                <b style={{ color: 'var(--ink)' }}>Save my photo to improve our AI model.</b>{' '}
                <span style={{ color: 'var(--muted)' }}>
                  Stored securely, never shared. Untick to delete after each scan.
                </span>
              </span>
            </label>

            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
              💡 <b style={{ color: 'var(--ink-2)' }}>Pro tip:</b> include a spoon or coin in the shot — it sharpens portion estimation by ~15%.
            </div>
          </>
        )}

        {phase === 'scanning' && (
          <div style={{ textAlign: 'center', padding: 64, background: 'var(--sand)', borderRadius: 18 }}>
            {preview && <img src={preview} alt="meal" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 14, marginBottom: 24 }} />}
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Identifying your meal…</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-700)', animation: `bounce 1s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div>
            {preview && <img src={preview} alt="meal" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 16, marginBottom: 16 }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="label">Meal type</div>
              <select className="input" value={mealType} onChange={e => setMealType(e.target.value as MealType)} style={{ width: 'auto' }}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Snack</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Tap any field to fix what our AI got wrong — every correction trains the model.</div>

            <div style={{ background: 'var(--sand)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
              {items.map((item, i) => (
                <div key={i} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', display: 'grid', gridTemplateColumns: isMobile ? '1fr 64px 52px 24px' : '1fr 100px 70px 30px', gap: isMobile ? 6 : 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => updateItemField(i, 'name', e.target.value)}
                    placeholder="Dish name"
                    style={{ background: 'transparent', border: 'none', fontWeight: 500, fontSize: 14, padding: 0, outline: 'none', color: 'var(--ink)' }}
                  />
                  <input
                    type="text"
                    value={item.portion}
                    onChange={e => updateItemField(i, 'portion', e.target.value)}
                    placeholder="1 katori"
                    style={{ background: 'transparent', border: 'none', fontSize: 12.5, color: 'var(--muted)', padding: 0, outline: 'none' }}
                  />
                  <input
                    type="number"
                    value={item.cal}
                    onChange={e => updateItemField(i, 'cal', e.target.value)}
                    min={0}
                    max={5000}
                    style={{ background: 'transparent', border: 'none', fontFamily: 'var(--mono, monospace)', fontWeight: 600, fontSize: 14, padding: 0, outline: 'none', textAlign: 'right', width: '100%' }}
                  />
                  <button
                    onClick={() => removeItem(i)}
                    title="Remove"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 0 }}
                  >×</button>
                </div>
              ))}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                <button onClick={addItem} style={{ background: 'none', border: 'none', color: 'var(--sage-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  + Add missing dish
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 16px', borderTop: '2px solid var(--border)', background: 'var(--cream)' }}>
                <div style={{ fontWeight: 700 }}>Total</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--sage-700)' }}>{totalCal} cal · {Math.round(totalProtein)}g protein</div>
              </div>
            </div>

            {edited && <div style={{ fontSize: 12, color: 'var(--sage-700)', marginBottom: 12, padding: '6px 10px', background: 'var(--sage-100, #EEF7EC)', borderRadius: 8 }}>✓ Your edits will be saved when you log this meal</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => { setPhase('upload'); setItems([]); setPreview('') }}>Retake</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleLog} disabled={items.length === 0}>Log This Meal</button>
            </div>
          </div>
        )}

        {phase === 'logged' && (
          <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Meal logged!</div>
            <div style={{ color: 'var(--muted)', marginBottom: 24 }}>{totalCal} cal added to today's log</div>

            {feedback === null ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12, fontWeight: 600 }}>Was this scan accurate?</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                  <button onClick={() => submitFeedback('accurate')} style={{ padding: '8px 16px', border: '1px solid var(--border)', background: 'white', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>👍 Spot on</button>
                  <button onClick={() => submitFeedback('partial')} style={{ padding: '8px 16px', border: '1px solid var(--border)', background: 'white', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>🤔 Close</button>
                  <button onClick={() => submitFeedback('inaccurate')} style={{ padding: '8px 16px', border: '1px solid var(--border)', background: 'white', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>👎 Off</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--sage-700)', marginBottom: 24 }}>Thanks — your feedback trains the model.</div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => { setPhase('upload'); setItems([]); setPreview(''); setScanResultId(null); setFeedback(null); setEdited(false) }}>Scan Another</button>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Dashboard</button>
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
