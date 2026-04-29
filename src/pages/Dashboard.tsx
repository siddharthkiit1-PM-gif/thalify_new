import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Progress from '../components/ui/Progress'
import Card from '../components/ui/Card'
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
  breakfast: '☀️', lunch: '🌤️', snack: '🌅', dinner: '🌙',
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
  const remainingCal = Math.max(0, calorieGoal - totalCal)
  const overBudget = totalCal > calorieGoal

  if (profile === undefined) {
    return <div style={{ minHeight: '100vh', background: 'var(--cream)' }}><Navbar /></div>
  }

  const insightMsg = totalCal === 0
    ? "You haven't logged any meals today. Scan your breakfast to get started."
    : totalCal < calorieGoal * 0.5
    ? "You're under halfway to your goal. Add a balanced lunch with dal and roti."
    : overBudget
    ? "You've crossed your goal. Try a light dinner — khichdi or vegetable soup."
    : "On track. Keep going with a balanced dinner."

  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = currentUser?.name?.split(' ')[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ paddingTop: 'var(--space-7)', paddingBottom: 'var(--space-10)' }}>
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: isMobile ? 'var(--space-7)' : 'var(--space-10)' }}>
          <div>
            {/* HERO — editorial display, mono date eyebrow */}
            <header style={{ marginBottom: 'var(--space-9)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-label)', letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>
                {greeting()} · {dateLine}
              </div>
              <h1
                className="serif"
                style={{
                  fontSize: 'var(--fs-hero)',
                  margin: 0,
                  lineHeight: 1.05,
                  letterSpacing: '-0.025em',
                  color: 'var(--ink)',
                }}
              >
                {firstName ? <>Here&rsquo;s where you stand,<br /><span style={{ color: 'var(--sage-700)' }}>{firstName}.</span></> : <>Here&rsquo;s where you stand.</>}
              </h1>
            </header>

            <NotificationBanner />

            {/* Founder offer / admin state — minimal, hairline edge */}
            {profile && currentUser?.isAdmin ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                padding: 'var(--space-4) var(--space-5)',
                border: '1px dashed var(--border-2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-7)',
              }}>
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                    Admin
                  </div>
                  <div style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--ink)' }}>
                    Lifetime access on the house. <span onClick={() => navigate('/admin')} style={{ color: 'var(--sage-700)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>View ops</span>.
                  </div>
                </div>
              </div>
            ) : profile && profile.plan !== 'lifetime' ? (
              <div
                onClick={() => navigate('/upgrade')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                  padding: 'var(--space-4) var(--space-5)',
                  background: 'var(--ink)', color: 'var(--cream)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  marginBottom: 'var(--space-7)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sage-500)', marginBottom: 4 }}>
                    Founder · ₹99 once
                  </div>
                  <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 500 }}>
                    Lifetime access. Limited to first 50.
                  </div>
                </div>
                <span style={{ fontSize: 22 }}>→</span>
              </div>
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

            {/* CALORIE — numerals as visual hero */}
            <section style={{ marginBottom: 'var(--space-9)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
                <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                  Calories · Today
                </div>
                <div className="mono" style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)' }}>
                  Goal {calorieGoal.toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span
                  className="mono"
                  style={{ fontSize: 'var(--fs-numeral-xl)', fontWeight: 700, lineHeight: 1, color: overBudget ? 'var(--red)' : 'var(--ink)', letterSpacing: '-0.04em' }}
                >
                  {totalCal.toLocaleString()}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-body-lg)' }}>
                  {overBudget ? <>over by {(totalCal - calorieGoal).toLocaleString()}</> : <>{remainingCal.toLocaleString()} left</>}
                </span>
              </div>
              <Progress value={totalCal} max={calorieGoal} />
              <div
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  marginTop: 'var(--space-5)',
                  border: 'var(--hairline)', borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}
              >
                {[
                  { label: 'Protein', val: totalProtein, unit: 'g' },
                  { label: 'Carbs',   val: totalCarbs,   unit: 'g' },
                  { label: 'Fat',     val: totalFat,     unit: 'g' },
                ].map((m, i) => (
                  <div key={m.label} style={{ padding: 'var(--space-4)', borderLeft: i === 0 ? 'none' : 'var(--hairline)' }}>
                    <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 'var(--space-1)' }}>
                      {m.label}
                    </div>
                    <div className="mono" style={{ fontSize: 'var(--fs-numeral-lg)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {Math.round(m.val)}
                      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--muted)', fontWeight: 500, marginLeft: 2 }}>{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* COACH NOTE — quiet, single accent line */}
            <section
              style={{
                paddingLeft: 'var(--space-5)',
                borderLeft: '2px solid var(--sage-700)',
                marginBottom: 'var(--space-9)',
              }}
            >
              <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--sage-700)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                From your coach
              </div>
              <div style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.55, color: 'var(--ink)' }}>{insightMsg}</div>
            </section>

            {/* QUICK ACTIONS — hairline tiles, no fill */}
            <section style={{ marginBottom: 'var(--space-9)' }}>
              <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                Take action
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 0, border: 'var(--hairline)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                {[
                  { icon: '📷', label: 'Scan Meal', path: '/scan' },
                  { icon: '💬', label: 'Health Buddy', path: '/chat' },
                  { icon: '🍛', label: 'Family', path: '/family' },
                  { icon: '🧪', label: 'Labs', path: '/lab' },
                ].map((a, i) => (
                  <div
                    key={a.label}
                    onClick={() => navigate(a.path)}
                    style={{
                      padding: 'var(--space-5) var(--space-3)',
                      borderLeft: !isMobile && i > 0 ? 'var(--hairline)' : 'none',
                      borderTop: isMobile && i > 1 ? 'var(--hairline)' : 'none',
                      borderLeftStyle: 'solid',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sand)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 24, marginBottom: 'var(--space-2)' }}>{a.icon}</div>
                    <div style={{ fontSize: 'var(--fs-small)', fontWeight: 600, color: 'var(--ink)' }}>{a.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* MEALS — tight rhythm, hairline dividers */}
            <section style={{ marginBottom: 'var(--space-7)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
                <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                  Today&rsquo;s meals
                </div>
                <button onClick={() => navigate('/scan')} style={{ background: 'none', border: 'none', color: 'var(--sage-700)', fontSize: 'var(--fs-small)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  + Add meal
                </button>
              </div>
              {todayLogs && todayLogs.length > 0 ? (
                <div style={{ border: 'var(--hairline)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {todayLogs.map((log, i) => (
                    <div
                      key={log._id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                        padding: 'var(--space-4) var(--space-5)',
                        borderTop: i === 0 ? 'none' : 'var(--hairline)',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{MEAL_ICON[log.mealType]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 'var(--fs-body)' }}>
                          {log.mealType}
                        </div>
                        <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.items.map(i => i.name).join(' · ')}
                        </div>
                      </div>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--sage-700)' }}>
                        {log.totalCal}
                        <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--muted)', fontWeight: 500, marginLeft: 2 }}>cal</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    border: '1px dashed var(--border-2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-7) var(--space-5)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 'var(--space-3)' }}>🍽️</div>
                  <div className="serif" style={{ fontSize: 'var(--fs-h3)', marginBottom: 'var(--space-2)' }}>Nothing logged yet today.</div>
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)', marginBottom: 'var(--space-5)' }}>
                    Snap a photo, or open Telegram and type what you ate.
                  </div>
                  <button onClick={() => navigate('/scan')} className="btn btn-primary">Scan your first meal</button>
                </div>
              )}
            </section>
          </div>

          {/* SIDEBAR — hairline cards, restrained */}
          <div>
            <Card variant="hairline" pad="md" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                This week
              </div>
              <WeekStreakBar recentLogs={recentLogs as never} />
            </Card>
            <Card variant="hairline" pad="md">
              <div className="mono" style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                Your goal
              </div>
              <div style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 'var(--fs-body-lg)', marginBottom: 'var(--space-1)' }}>
                {profile?.goal ?? '—'}
              </div>
              <div className="mono" style={{ fontSize: 'var(--fs-small)', color: 'var(--muted)' }}>
                {calorieGoal.toLocaleString()} kcal / day
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
