import { useState, useRef, useEffect } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Progress from '../components/ui/Progress'
import { useIsMobile } from '../hooks/useIsMobile'

function getChips(): string[] {
  const hour = new Date().getHours()
  if (hour < 11) return ['Breakfast ideas', 'Protein-rich start', 'My targets today', 'Water target']
  if (hour < 15) return ['Lunch suggestion', 'My progress today', 'Low-calorie snack', 'Water target']
  if (hour < 19) return ['Snack ideas', "Tonight's dinner idea", 'My progress today', 'Water target']
  if (hour < 21) return ["Tonight's dinner idea", 'Post-dinner walk plan', 'My progress today', 'Water target']
  return ['How did I do today?', 'Plan tomorrow', 'I feel hungry — what now?', 'Water target']
}
const CHIPS_DEFAULT = getChips()

export default function Chat() {
  const isMobile = useIsMobile()
  const messages = useQuery(api.chat.getChatHistory)
  const profile = useQuery(api.users.getProfile)
  const todayLogs = useQuery(api.meals.getTodayLogs, { date: new Date().toISOString().split('T')[0] })
  const chatWithCoach = useAction(api.chat.chatWithCoach)

  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const totalCal = todayLogs?.reduce((acc, l) => acc + l.totalCal, 0) ?? 0
  const calorieGoal = profile?.calorieGoal ?? 1800

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  async function send(text: string) {
    if (!text.trim() || thinking) return
    setInput('')
    setError('')
    setThinking(true)
    try {
      await chatWithCoach({ message: text })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Could not reach Health Buddy — please retry.')
      console.error('chatWithCoach failed:', err)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: isMobile ? 12 : 24, minHeight: 'calc(100vh - 64px)', paddingBottom: 0 }}>
        {/* Chat column */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--sage-100)', display: 'grid', placeItems: 'center', fontSize: 20 }}>🧠</div>
            <div>
              <div style={{ fontWeight: 700 }}>Your Health Buddy</div>
              <div style={{ fontSize: 12, color: 'var(--sage-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="online-dot" /> Online · Responds instantly
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {messages?.length === 0 && !thinking && (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
                <div>Ask me anything about your diet or today's meals!</div>
              </div>
            )}
            {messages?.map(msg => (
              <div key={msg._id} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '12px 16px', borderRadius: msg.from === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.from === 'user' ? 'var(--sage-700)' : 'var(--sand)',
                  color: msg.from === 'user' ? 'white' : 'var(--ink)',
                  fontSize: 14, lineHeight: 1.6,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: 'flex', gap: 6, padding: '12px 16px', background: 'var(--sand)', borderRadius: '18px 18px 18px 4px', width: 64, marginBottom: 16 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12 }}>
            {CHIPS_DEFAULT.map(chip => (
              <div key={chip} onClick={() => send(chip)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12.5, background: 'var(--sand)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                {chip}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Ask your coach..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              disabled={thinking}
            />
            <button className="btn btn-primary" onClick={() => send(input)} disabled={thinking || !input.trim()}>Send</button>
          </div>
          {error && <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4 }}>{error}</div>}
        </div>

        {/* Sidebar — hidden on mobile (same info lives on dashboard) */}
        {!isMobile && (
        <div style={{ paddingTop: 16 }}>
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 10 }}>Today's Calories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{totalCal}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {calorieGoal}</span>
            </div>
            <Progress value={totalCal} max={calorieGoal} />
          </div>
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: 18 }}>
            <div className="label" style={{ marginBottom: 10 }}>Your Profile</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>🎯 <b>Goal:</b> {profile?.goal}</div>
              <div>🥦 <b>Diet:</b> {profile?.dietType}</div>
              {profile?.dislikes && profile.dislikes.length > 0 && <div>🚫 <b>Dislikes:</b> {profile.dislikes.join(', ')}</div>}
            </div>
          </div>
        </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
