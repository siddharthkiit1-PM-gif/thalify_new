import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

type Goal = 'lose' | 'maintain' | 'diabetes' | 'gain'
type DietType = 'veg' | 'veg_eggs' | 'nonveg' | 'jain' | 'vegan'
type City = 'bangalore' | 'mumbai' | 'delhi' | 'other'

const DISLIKE_CHIPS = ['Paneer', 'Bitter gourd', 'Beetroot', 'Mushroom']
const STEPS = 4

export default function Onboarding() {
  const navigate = useNavigate()
  const createProfile = useMutation(api.users.createProfile)

  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [dietType, setDietType] = useState<DietType | null>(null)
  const [city, setCity] = useState<City | null>(null)
  const [allergies, setAllergies] = useState('')
  const [dislikes, setDislikes] = useState<string[]>([])
  const [allowPhotoStorage, setAllowPhotoStorage] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleDislike(item: string) {
    setDislikes(prev => prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item])
  }

  async function finish() {
    if (!goal || !dietType || !city || allowPhotoStorage === null) return
    setSaving(true)
    await createProfile({
      goal,
      dietType,
      city,
      allergies: allergies ? [allergies] : [],
      dislikes,
      allowPhotoStorage,
    })
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520, padding: 40 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {Array.from({ length: STEPS }).map((_, i) => {
            const s = i + 1
            return <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: s <= step ? 'var(--sage-700)' : 'var(--border)' }} />
          })}
        </div>

        {step === 1 && (
          <div className="fade-in">
            <h2 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>What's your health goal?</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28 }}>We'll personalise your calorie target and food guidance.</p>
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
            <h2 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>Your diet type?</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28 }}>We'll only suggest meals that match your preferences.</p>
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
            <h2 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>Almost there!</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 28 }}>A few more details for local food recommendations.</p>

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
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!city} onClick={() => setStep(4)}>Continue →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="fade-in">
            <h2 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>One last thing</h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 24, lineHeight: 1.55 }}>
              When you scan a meal, we can keep the photo to improve how accurately Thalify identifies Indian food over time. You can turn this off any time from your profile.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div
                onClick={() => setAllowPhotoStorage(true)}
                style={{ padding: '18px 20px', borderRadius: 14, border: `2px solid ${allowPhotoStorage === true ? 'var(--sage-700)' : 'var(--border)'}`, background: allowPhotoStorage === true ? 'var(--sage-100)' : 'var(--sand)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>📸</span>
                  <div style={{ fontWeight: 600 }}>Yes, keep my photos</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 32 }}>Helps us improve scan accuracy for everyone. Stored securely, never shared.</div>
              </div>

              <div
                onClick={() => setAllowPhotoStorage(false)}
                style={{ padding: '18px 20px', borderRadius: 14, border: `2px solid ${allowPhotoStorage === false ? 'var(--sage-700)' : 'var(--border)'}`, background: allowPhotoStorage === false ? 'var(--sage-100)' : 'var(--sand)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>🔒</span>
                  <div style={{ fontWeight: 600 }}>No, delete after scanning</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 32 }}>Photos are analysed then immediately discarded. Scan still works normally.</div>
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.55 }}>
              We never share photos with third parties. We only use them to make scan recognition better for Indian food.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={allowPhotoStorage === null || saving} onClick={finish}>
                {saving ? 'Saving…' : 'Start My Plan →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
