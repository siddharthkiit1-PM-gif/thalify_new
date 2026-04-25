import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Progress from '../components/ui/Progress'
import BodyStatsCard from '../components/BodyStatsCard'
import NotificationBanner from '../components/NotificationBanner'
import TelegramConnectModal from '../components/TelegramConnectModal'
import TelegramLogo from '../components/TelegramLogo'
import { useIsMobile } from '../hooks/useIsMobile'

function todayDate() { return new Date().toISOString().split('T')[0] }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MEAL_ICON: Record<string, string> = {
  breakfast: '☀️', lunch: '🌤️', snack: '🌅', dinner: '🌙'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [tgOpen, setTgOpen] = useState(false)
  const profile = useQuery(api.users.getProfile)
  const currentUser = useQuery(api.users.getCurrentUser)
  const todayLogs = useQuery(api.meals.getTodayLogs, { date: todayDate() })

  const totalCal = todayLogs?.reduce((acc, log) => acc + log.totalCal, 0) ?? 0
  const calorieGoal = profile?.calorieGoal ?? 1800
  const totalProtein = todayLogs?.flatMap(l => l.items).reduce((a, i) => a + i.protein, 0) ?? 0
  const totalCarbs = todayLogs?.flatMap(l => l.items).reduce((a, i) => a + i.carbs, 0) ?? 0
  const totalFat = todayLogs?.flatMap(l => l.items).reduce((a, i) => a + i.fat, 0) ?? 0

  if (profile === undefined) {
    return <div style={{ minHeight: '100vh', background: 'var(--cream)' }}><Navbar /></div>
  }

  const insightMsg = totalCal === 0
    ? "You haven't logged any meals today. Scan your breakfast to get started!"
    : totalCal < calorieGoal * 0.5
    ? "You're under halfway to your goal. Add a balanced lunch with dal and roti."
    : totalCal > calorieGoal
    ? "You've exceeded your goal today. Try a light dinner — khichdi or vegetable soup."
    : "You're on track! Keep going with a balanced dinner."

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? 16 : 28 }}>
        <div>
          <div data-eyebrow style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--sage-700)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
            {greeting()} · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <h1 className="serif" style={{ fontSize: 36, marginBottom: 24, lineHeight: 1.1, letterSpacing: '-0.015em' }}>
            {currentUser?.name ? <>Hi {currentUser.name.split(' ')[0]}, here's where you stand.</> : <>Here's where you stand.</>}
          </h1>

          <NotificationBanner />

          {/* Founder offer — only visible to free-tier users */}
          {profile && profile.plan !== 'lifetime' && (
            <div
              onClick={() => navigate('/upgrade')}
              style={{
                background: 'linear-gradient(135deg, var(--sage-100) 0%, #DCEFE0 100%)',
                border: '1px solid var(--sage-700)',
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(45,95,58,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: 26 }}>🌿</div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', marginBottom: 2, letterSpacing: '-0.005em' }}>
                  Become a Founder · ₹99 once, lifetime
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  3,000 AI actions every month, forever. Limited to first 50.
                </div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--sage-700)' }}>→</span>
            </div>
          )}

          {profile && !profile.telegramOptIn && (
            <div className="tg-card">
              <div className="tg-card-logo">
                <TelegramLogo size={28} />
              </div>
              <div className="tg-card-body">
                <h3 className="tg-card-title">Get gentle nudges in Telegram</h3>
                <p className="tg-card-sub">One tap. No phone number, no codes. Free forever.</p>
                <button className="btn-tg" onClick={() => setTgOpen(true)}>
                  <TelegramLogo size={14} /> Connect with Telegram
                </button>
              </div>
            </div>
          )}
          <TelegramConnectModal open={tgOpen} onClose={() => setTgOpen(false)} />

          <BodyStatsCard profile={profile as never} />

          {/* Calorie card */}
          <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 24, marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 10 }}>Calories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 42, fontWeight: 700 }}>{totalCal.toLocaleString()}</span>
              <span style={{ color: 'var(--muted)', fontSize: 14 }}>/ {calorieGoal.toLocaleString()} kcal</span>
            </div>
            <Progress value={totalCal} max={calorieGoal} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18 }}>
              {[['Protein', totalProtein, 'g'], ['Carbs', totalCarbs, 'g'], ['Fat', totalFat, 'g']].map(([label, val, unit]) => (
                <div key={label as string} style={{ background: 'var(--cream)', borderRadius: 12, padding: '12px 14px' }}>
                  <div className="label">{label}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                    {Math.round(val as number)}<span style={{ fontSize: 12, color: 'var(--muted)' }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coach insight */}
          <div style={{ background: 'var(--sage-100)', borderRadius: 16, padding: 20, marginBottom: 16, borderLeft: '3px solid var(--sage-700)' }}>
            <div className="label" style={{ color: 'var(--sage-700)', marginBottom: 6 }}>From your coach</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink)' }}>{insightMsg}</div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              ['📷', 'Scan Meal', '/scan'],
              ['💬', 'Health Buddy', '/chat'],
              ['🍛', 'Family', '/family'],
              ['🧪', 'Labs', '/lab'],
            ].map(([icon, label, path]) => (
              <div key={label as string} onClick={() => navigate(path as string)}
                style={{ background: 'var(--sand)', borderRadius: 14, padding: '16px 10px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Meal list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="label">Today's Meals</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/scan')}>+ Add Meal</button>
          </div>
          {todayLogs && todayLogs.length > 0 ? todayLogs.map(log => (
            <div key={log._id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--sand)', borderRadius: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 20, marginRight: 12 }}>{MEAL_ICON[log.mealType]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{log.mealType}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{log.items.map(i => i.name).join(', ')}</div>
              </div>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--sage-700)' }}>{log.totalCal} cal</div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', background: 'var(--sand)', borderRadius: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
              No meals logged yet.{' '}
              <span style={{ color: 'var(--sage-700)', cursor: 'pointer' }} onClick={() => navigate('/scan')}>
                Scan your first meal →
              </span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 20, marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 14 }}>This Week</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} style={{ width: 34, height: 34, borderRadius: 10, background: i < 3 ? 'var(--sage-700)' : 'var(--cream)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: i < 3 ? 'white' : 'var(--muted)' }}>{d}</div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--sand)', borderRadius: 18, padding: 20, marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 10 }}>Your Goal</div>
            <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>{profile?.goal ?? '—'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{calorieGoal} kcal / day</div>
          </div>
        </div>
      </div>
    </div>
  )
}
