import { useState, useRef } from 'react'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'

type Marker = { name: string; value: string; unit: string; status: string; range: string }
type LabResult = {
  markers: Marker[]
  summary: string
  dietaryChanges: string[]
  indianFoodRecommendations: string[]
  urgentFlags: string[]
  disclaimer: string
}

const STATUS_COLOR: Record<string, string> = {
  normal: 'var(--sage-700)',
  borderline: '#e8a020',
  high: '#c0392b',
  low: '#2980b9',
  critical: '#c0392b',
}

export default function Lab() {
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'result'>('upload')
  const [result, setResult] = useState<LabResult | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const analyzeLabReport = useAction(api.lab.analyzeLabReport)
  const history = useQuery(api.lab.getLabResults)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large — please use a file under 10MB')
      return
    }
    setError('')
    setPhase('analyzing')
    try {
      const base64 = await fileToBase64(file)
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      const res = await analyzeLabReport({ imageBase64: base64, mediaType })
      setResult(res as LabResult)
      setPhase('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed — please retry')
      setPhase('upload')
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 680, paddingTop: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
            Medical · Bloodwork
          </div>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 8, lineHeight: 1.1, letterSpacing: '-0.015em' }}>Read your labs.</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15.5, lineHeight: 1.55 }}>
            Upload a photo of your blood report. We translate the numbers into <em style={{ color: 'var(--sage-700)' }}>specific Indian foods</em> to eat more, eat less, or skip — based on your markers.
          </p>
        </div>

        {phase === 'upload' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--sage-700)' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--sage-100)' : 'white',
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧪</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your lab report here</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>or click to browse — JPG, PNG, PDF photo</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#c0392b', fontSize: 14, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ background: 'var(--sage-100)', borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--ink-2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--sage-700)', marginBottom: 8 }}>What we read from your report:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', lineHeight: 1.7 }}>
                <span>HbA1c (blood sugar)</span>
                <span>Cholesterol panel</span>
                <span>Vitamin D & B12</span>
                <span>Haemoglobin & Iron</span>
                <span>Thyroid (TSH)</span>
                <span>Liver function</span>
                <span>Kidney function</span>
                <span>Uric acid</span>
              </div>
            </div>

            {history && history.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="label" style={{ marginBottom: 12 }}>Previous Reports</div>
                {history.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => { setResult(h.result as LabResult); setPhase('result') }}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Report #{history.length - i}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(h.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {phase === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🔬</div>
            <div className="serif" style={{ fontWeight: 400, fontSize: 22, marginBottom: 8, letterSpacing: '-0.01em' }}>Reading your report</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>Pulling each marker out, then matching it to Indian foods that move it…</div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-700)', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div>
            {result.urgentFlags.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 600, color: '#c0392b', marginBottom: 8 }}>Needs attention</div>
                {result.urgentFlags.map((flag, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#c0392b', lineHeight: 1.6 }}>• {flag}</div>
                ))}
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>Your Markers</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {result.markers.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--cream)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.range}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{m.value} {m.unit}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[m.status] ?? 'var(--muted)' }}>{m.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>What This Means</div>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)' }}>{result.summary}</p>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>What to Eat More / Less</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {result.dietaryChanges.map((c, i) => (
                  <div key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>• {c}</div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--sage-100)', border: '1px solid var(--sage-200, #d4e6d0)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 12, color: 'var(--sage-700)' }}>Indian Food Recommendations</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {result.indianFoodRecommendations.map((r, i) => (
                  <div key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>🌿 {r}</div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20, padding: '12px 16px', background: 'var(--sand)', borderRadius: 10 }}>
              {result.disclaimer}
            </div>

            <button onClick={() => { setPhase('upload'); setResult(null) }} className="btn-primary" style={{ width: '100%' }}>
              Analyze Another Report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
