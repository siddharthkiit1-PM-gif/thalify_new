import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Goal = 'lose' | 'maintain' | 'diabetes' | 'gain'
type DietType = 'veg' | 'veg_eggs' | 'nonveg' | 'jain' | 'vegan'
type City = 'bangalore' | 'mumbai' | 'delhi' | 'other'

const DISLIKE_CHIPS = ['Paneer', 'Bitter gourd', 'Beetroot', 'Mushroom']
const STEPS = 3

export default function Onboarding() {
  const navigate = useNavigate()
  const createProfile = useMutation(api.users.createProfile)
  const currentUser = useQuery(api.users.getCurrentUser)
  const firstName = (currentUser?.name?.split(/\s+/)[0]) || ''

  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [dietType, setDietType] = useState<DietType | null>(null)
  const [city, setCity] = useState<City | null>(null)
  const [allergies, setAllergies] = useState('')
  const [dislikes, setDislikes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleDislike(item: string) {
    setDislikes(prev => prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item])
  }

  async function finish() {
    if (!goal || !dietType || !city) return
    setSaving(true)
    // Default opt-in to keep meal photos for accuracy. The user can flip this
    // any time from the inline checkbox on the Scan page.
    await createProfile({
      goal,
      dietType,
      city,
      allergies: allergies ? [allergies] : [],
      dislikes,
      allowPhotoStorage: true,
    })
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="onboarding-card" style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {Array.from({ length: STEPS }).map((_, i) => {
            const s = i + 1
            return <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: s <= step ? 'var(--sage-700)' : 'var(--border)' }} />
          })}
        </div>

        {step === 1 && (
          <div className="fade-in">
            <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
              {firstName ? `Welcome, ${firstName}` : 'Welcome'} · Step 1 of 3
            </div>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.15, letterSpacing: '-0.015em' }}>
              {firstName ? `${firstName}, what are we working toward?` : 'What are we working toward?'}
            </h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28, lineHeight: 1.55 }}>We'll set your calorie target and tailor every food suggestion around it.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                ['lose', '🏃', 'Lose weight', 'Calorie deficit plan'],
                ['maintain', '⚖️', 'Maintain weight', 'Balanced nutrition'],
                ['diabetes', '🩺', 'Manage diabetes / pre-diabetes', 'Low-GI focused'],
                ['gain', '💪', 'Gain muscle', 'High protein plan'],
              ] as const).map(([val, icon, label, sub]) => (
                <div
                  key={val}
                  onClick={() => setGoal(val)}
                  style={{ padding: '16px 20px', borderRadius: 14, border: `2px solid ${goal === val ? 'var(--sage-700)' : 'var(--border)'}`, background: goal === val ? 'var(--sage-100)' : 'var(--sand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                >
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 28 }} disabled={!goal} onClick={() => setStep(2)}>
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
              Step 2 of 3 · The plate
            </div>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.15, letterSpacing: '-0.015em' }}>What do you eat?</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28, lineHeight: 1.55 }}>Every nudge respects this. No accidental chicken in your veg plan.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                ['veg', '🥦', 'Vegetarian'],
                ['veg_eggs', '🥚', 'Vegetarian + Eggs'],
                ['nonveg', '🍗', 'Non-vegetarian'],
                ['jain', '🌿', 'Jain (no onion/garlic)'],
                ['vegan', '🌱', 'Vegan'],
              ] as const).map(([val, icon, label]) => (
                <div
                  key={val}
                  onClick={() => setDietType(val)}
                  style={{ padding: '16px 20px', borderRadius: 14, border: `2px solid ${dietType === val ? 'var(--sage-700)' : 'var(--border)'}`, background: dietType === val ? 'var(--sage-100)' : 'var(--sand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!dietType} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fade-in">
            <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
              Step 3 of 3 · The context
            </div>
            <h2 className="serif" style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.15, letterSpacing: '-0.015em' }}>A bit about your kitchen.</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28, lineHeight: 1.55 }}>Your city sets the local dishes we recommend; allergies and dislikes mean we never suggest them.</p>

            <div className="label" style={{ marginBottom: 8 }}>Your city</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {(['bangalore', 'mumbai', 'delhi', 'other'] as City[]).map(c => (
                <div
                  key={c}
                  onClick={() => setCity(c)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: `2px solid ${city === c ? 'var(--sage-700)' : 'var(--border)'}`, background: city === c ? 'var(--sage-100)' : 'var(--sand)', cursor: 'pointer', textAlign: 'center', fontWeight: 600, textTransform: 'capitalize' }}
                >
                  {c === 'bangalore' ? 'Bangalore' : c === 'mumbai' ? 'Mumbai' : c === 'delhi' ? 'Delhi' : 'Other'}
                </div>
              ))}
            </div>

            <div className="label" style={{ marginBottom: 8 }}>Allergies (optional)</div>
            <input className="input" placeholder="e.g. peanuts, shellfish" value={allergies} onChange={e => setAllergies(e.target.value)} style={{ marginBottom: 22 }} />

            <div className="label" style={{ marginBottom: 10 }}>Foods you dislike</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              {DISLIKE_CHIPS.map(item => (
                <div
                  key={item}
                  onClick={() => toggleDislike(item)}
                  style={{ padding: '8px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${dislikes.includes(item) ? 'var(--sage-700)' : 'var(--border)'}`, background: dislikes.includes(item) ? 'var(--sage-100)' : 'var(--sand)' }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!city || saving} onClick={finish}>
                {saving ? 'Saving…' : 'Start My Plan →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
