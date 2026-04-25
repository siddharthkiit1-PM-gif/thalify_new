import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useIsMobile } from '../hooks/useIsMobile'

type Sex = 'male' | 'female' | 'other'
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
type Goal = 'lose' | 'maintain' | 'diabetes' | 'gain'

interface Profile {
  goal: Goal
  calorieGoal: number
  weightKg?: number
  heightCm?: number
  age?: number
  sex?: Sex
  activityLevel?: Activity
  bodyFatPct?: number
  tdee?: number
}

const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Sedentary (desk job)',
  light: 'Lightly active (1-3 days)',
  moderate: 'Moderately active (3-5 days)',
  active: 'Very active (6-7 days)',
  very_active: 'Extra active (athlete)',
}

const GOAL_LABELS: Record<Goal, string> = {
  lose: 'weight loss',
  maintain: 'maintenance',
  diabetes: 'blood sugar control',
  gain: 'weight gain',
}

export default function BodyStatsCard({ profile }: { profile: Profile }) {
  const updateBodyStats = useMutation(api.users.updateBodyStats)
  const isMobile = useIsMobile()
  const filled = profile.weightKg !== undefined && profile.heightCm !== undefined && profile.age !== undefined && profile.sex !== undefined && profile.activityLevel !== undefined

  const [editing, setEditing] = useState(!filled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? '')
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [sex, setSex] = useState<Sex>(profile.sex ?? 'male')
  const [activity, setActivity] = useState<Activity>(profile.activityLevel ?? 'moderate')
  const [bodyFat, setBodyFat] = useState(profile.bodyFatPct?.toString() ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const w = Number(weightKg), h = Number(heightCm), a = Number(age)
    const bf = bodyFat.trim() === '' ? undefined : Number(bodyFat)
    if (!w || !h || !a) { setError('Weight, height and age are required'); return }
    setSaving(true)
    try {
      await updateBodyStats({ weightKg: w, heightCm: h, age: a, sex, activityLevel: activity, bodyFatPct: bf })
      setEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="label">Your Stats</div>
          {filled && <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>}
        </div>

        <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Weight (kg)</div>
            <input className="input" type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70" min="30" max="300" step="0.1" required />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Height (cm)</div>
            <input className="input" type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="175" min="100" max="250" required />
          </div>
          <div style={isMobile ? { gridColumn: '1 / span 2' } : {}}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Age</div>
            <input className="input" type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="30" min="13" max="100" required />
          </div>

          <div style={isMobile ? { gridColumn: '1 / span 2' } : {}}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Sex</div>
            <select className="input" value={sex} onChange={e => setSex(e.target.value as Sex)} style={{ appearance: 'auto' }}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={isMobile ? { gridColumn: '1 / span 2' } : { gridColumn: '2 / span 2' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Activity level</div>
            <select className="input" value={activity} onChange={e => setActivity(e.target.value as Activity)} style={{ appearance: 'auto' }}>
              {(Object.keys(ACTIVITY_LABELS) as Activity[]).map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
            </select>
          </div>

          <div style={isMobile ? { gridColumn: '1 / span 2' } : { gridColumn: '1 / span 3' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Body fat % <span style={{ color: 'var(--muted)' }}>(optional — more accurate if known)</span></div>
            <input className="input" type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="e.g. 18" min="3" max="60" step="0.1" />
          </div>

          {error && <div style={isMobile ? { gridColumn: '1 / span 2', color: '#b91c1c', fontSize: 13 } : { gridColumn: '1 / span 3', color: '#b91c1c', fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={saving} className="btn btn-primary" style={isMobile ? { gridColumn: '1 / span 2', marginTop: 4 } : { gridColumn: '1 / span 3', marginTop: 4 }}>
            {saving ? 'Calculating…' : 'Calculate maintenance calories'}
          </button>
        </form>
      </div>
    )
  }

  const maintenance = profile.tdee ?? profile.calorieGoal
  const target = profile.calorieGoal
  const delta = target - maintenance
  const sexLabel = profile.sex === 'male' ? 'Male' : profile.sex === 'female' ? 'Female' : 'Other'

  return (
    <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="label">Your Stats</div>
        <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--ink-2)', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>Edit</button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.7 }}>
        {profile.weightKg} kg &middot; {profile.heightCm} cm &middot; {profile.age} yrs &middot; {sexLabel}<br />
        <span style={{ color: 'var(--muted)' }}>{ACTIVITY_LABELS[profile.activityLevel!]}{profile.bodyFatPct ? ` · ${profile.bodyFatPct}% body fat` : ''}</span>
      </div>

      <div style={{ background: 'var(--cream)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Maintenance (TDEE)</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{maintenance} cal/day</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: 'var(--sage-700)', fontWeight: 600 }}>Your target ({GOAL_LABELS[profile.goal]})</span>
          <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--sage-700)' }}>{target} cal/day</span>
        </div>
      </div>
      {delta !== 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {delta < 0 ? `${Math.abs(delta)} cal deficit` : `+${delta} cal surplus`} for {GOAL_LABELS[profile.goal]}
        </div>
      )}
    </div>
  )
}
