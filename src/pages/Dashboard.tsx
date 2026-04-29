import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Progress from '../components/ui/Progress'
import Card from '../components/ui/Card'
import Section from '../components/ui/Section'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import BodyStatsCard from '../components/BodyStatsCard'
import NotificationBanner from '../components/NotificationBanner'
import TelegramConnectModal from '../components/TelegramConnectModal'
import TelegramLogo from '../components/TelegramLogo'
import WeekStreakBar from '../components/WeekStreakBar'
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
  const recentLogs = useQuery(api.meals.getRecentLogs)

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

  const heroEyebrow = `${greeting()} · ${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
  const heroTitle = currentUser?.name
    ? <>Hi {currentUser.name.split(' ')[0]}, here's where you stand.</>
    : <>Here's where you stand.</>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? 'var(--space-4)' : 'var(--space-7)' }}>
        <div>
          <Section eyebrow={heroEyebrow} title={heroTitle} hero bottom="var(--space-7)" />

          <NotificationBanner />

          {/* Founder offer — admin (disabled), free (clickable), other lifetime (hidden) */}
          {profile && currentUser?.isAdmin ? (
            <Card
              variant="cream"
              pad="md"
              style={{
                marginBottom: 'var(--space-4)',
                border: '1px dashed var(--sage-700)',
                opacity: 0.85,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ fontSize: 26 }}>🛠️</div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', marginBottom: 2 }}>
                  You're the admin — no need to pay
                </div>
                <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                  Lifetime access is on the house. Open <span style={{ color: 'var(--sage-700)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/admin')}>/admin</span> for stats.
                </div>
              </div>
              <Badge tone="neutral" mono>admin</Badge>
            </Card>
          ) : profile && profile.plan !== 'lifetime' ? (
            <Card
              variant="sage"
              pad="md"
              onClick={() => navigate('/upgrade')}
              style={{
                marginBottom: 'var(--space-4)',
                border: '1px solid var(--sage-700)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ fontSize: 26 }}>🌿</div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', marginBottom: 2 }}>
                  Become a Founder · ₹99 once, lifetime
                </div>
                <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                  3,000 AI actions every month, forever. Limited to first 50.
                </div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--sage-700)' }}>→</span>
            </Card>
          ) : null}

          {profile && !profile.telegramOptIn && (
            <div className="tg-card">
              <div className="tg-card-logo"><TelegramLogo size={28} /></div>
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
          <Card variant="sand" pad="lg" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="label" style={{ marginBottom: 'var(--space-3)' }}>Calories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <span className="mono" style={{ fontSize: 'var(--fs-display-1)', fontWeight: 700, lineHeight: 1 }}>{totalCal.toLocaleString()}</span>
              <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)' }}>/ {calorieGoal.toLocaleString()} kcal</span>
            </div>
            <Progress value={totalCal} max={calorieGoal} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              {[['Protein', totalProtein, 'g'], ['Carbs', totalCarbs, 'g'], ['Fat', totalFat, 'g']].map(([label, val, unit]) => (
                <Card key={label as string} variant="cream" pad="sm">
                  <div className="label">{label}</div>
                  <div className="mono" style={{ fontSize: 'var(--fs-h2)', fontWeight: 700 }}>
                    {Math.round(val as number)}<span style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>{unit}</span>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Coach insight */}
          <Card
            variant="sage"
            pad="md"
            style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--sage-700)' }}
          >
            <div className="label" style={{ color: 'var(--sage-700)', marginBottom: 'var(--space-2)' }}>From your coach</div>
            <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.65, color: 'var(--ink)' }}>{insightMsg}</div>
          </Card>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {[
              ['📷', 'Scan Meal', '/scan'],
              ['💬', 'Health Buddy', '/chat'],
              ['🍛', 'Family', '/family'],
              ['🧪', 'Labs', '/lab'],
            ].map(([icon, label, path]) => (
              <Card
                key={label as string}
                variant="sand"
                pad="sm"
                onClick={() => navigate(path as string)}
                style={{ textAlign: 'center', padding: '16px 10px' }}
              >
                <div style={{ fontSize: 22, marginBottom: 'var(--space-2)' }}>{icon}</div>
                <div style={{ fontSize: 'var(--fs-small)', fontWeight: 500 }}>{label}</div>
              </Card>
            ))}
          </div>

          {/* Meal list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div className="label">Today's Meals</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/scan')}>+ Add Meal</button>
          </div>
          {todayLogs && todayLogs.length > 0 ? todayLogs.map(log => (
            <Card
              key={log._id}
              variant="sand"
              pad="sm"
              style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}
            >
              <span style={{ fontSize: 20, marginRight: 'var(--space-3)' }}>{MEAL_ICON[log.mealType]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{log.mealType}</div>
                <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.items.map(i => i.name).join(', ')}
                </div>
              </div>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--sage-700)' }}>{log.totalCal} cal</div>
            </Card>
          )) : (
            <EmptyState
              icon="🍽️"
              title="No meals logged yet"
              helper={<>Snap a photo or open Telegram to log by typing.</>}
              cta={<button className="btn btn-primary" onClick={() => navigate('/scan')}>Scan your first meal</button>}
            />
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card variant="sand" pad="md" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="label" style={{ marginBottom: 'var(--space-4)' }}>This Week</div>
            <WeekStreakBar recentLogs={recentLogs as never} />
          </Card>
          <Card variant="sand" pad="md" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="label" style={{ marginBottom: 'var(--space-3)' }}>Your Goal</div>
            <div style={{ fontWeight: 600, textTransform: 'capitalize', marginBottom: 'var(--space-1)' }}>{profile?.goal ?? '—'}</div>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>{calorieGoal} kcal / day</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
