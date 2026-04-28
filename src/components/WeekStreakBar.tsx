import { useState } from 'react'

type MealLog = {
  _id: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  totalCal: number
  items: { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number }[]
}

interface Props {
  recentLogs: MealLog[] | undefined
}

const MEAL_ORDER: MealLog['mealType'][] = ['breakfast', 'lunch', 'snack', 'dinner']

function localDateStr(d: Date): string {
  // YYYY-MM-DD in local time (matches what the app stores via toISOString().split('T')[0]
  // when called at midnight local; we use Date methods to be timezone-safe).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function WeekStreakBar({ recentLogs }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  // Anchor: this week's Monday (in local time, midnight)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = localDateStr(today)
  const dayOfWeek = today.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  const monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + monOffset + i)
    const dateStr = localDateStr(d)
    const isFuture = d.getTime() > today.getTime()
    const isToday = dateStr === todayStr
    const logs = (recentLogs ?? []).filter(l => l.date === dateStr)
    return { d, dateStr, isFuture, isToday, logs, label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i] }
  })

  // Mark days as red if part of a 3+ consecutive past-miss streak.
  // We walk past days only (today + earlier this week) — future is neutral.
  const redIdx = new Set<number>()
  let streakStart = -1
  for (let i = 0; i < days.length; i++) {
    const ds = days[i]
    if (ds.isFuture) {
      // close any open streak before future days
      if (streakStart !== -1) {
        const len = i - streakStart
        if (len >= 3) for (let j = streakStart; j < i; j++) redIdx.add(j)
        streakStart = -1
      }
      break
    }
    if (ds.logs.length === 0) {
      if (streakStart === -1) streakStart = i
    } else {
      if (streakStart !== -1) {
        const len = i - streakStart
        if (len >= 3) for (let j = streakStart; j < i; j++) redIdx.add(j)
        streakStart = -1
      }
    }
  }
  // close trailing streak (running through today)
  if (streakStart !== -1) {
    const lastPastIdx = (() => {
      const fIdx = days.findIndex(d => d.isFuture)
      return fIdx === -1 ? days.length - 1 : fIdx - 1
    })()
    const len = lastPastIdx - streakStart + 1
    if (len >= 3) for (let j = streakStart; j <= lastPastIdx; j++) redIdx.add(j)
  }

  const cellStyle = (idx: number) => {
    const ds = days[idx]
    if (ds.logs.length > 0) {
      // GREEN — logged
      return { bg: 'var(--sage-700)', fg: '#fff', border: 'transparent' }
    }
    if (ds.isFuture) {
      // FUTURE — neutral
      return { bg: 'var(--cream)', fg: 'var(--muted)', border: 'var(--border)' }
    }
    if (redIdx.has(idx)) {
      // RED — 3+ consecutive misses
      return { bg: '#FCE9E9', fg: '#B91C1C', border: 'rgba(217,79,79,0.45)' }
    }
    // YELLOW — past day, missed but not in a 3+ streak
    return { bg: '#FDF6E6', fg: '#B45309', border: 'rgba(232,168,48,0.5)' }
  }

  const opened = openIdx !== null ? days[openIdx] : null
  const orderedLogs = opened
    ? [...opened.logs].sort(
        (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType),
      )
    : []
  const totalCalForDay = orderedLogs.reduce((s, l) => s + l.totalCal, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {days.map((ds, i) => {
          const c = cellStyle(i)
          const isOpen = openIdx === i
          return (
            <button
              key={i}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              aria-label={`${ds.d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} — ${ds.logs.length === 0 ? 'no meals logged' : `${ds.logs.length} meal${ds.logs.length === 1 ? '' : 's'}`}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: c.bg,
                color: c.fg,
                border: `1.5px solid ${c.border}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                outline: ds.isToday ? '2px solid var(--sage-700)' : 'none',
                outlineOffset: 1,
                transition: 'transform 0.1s ease',
                padding: 0,
                fontFamily: 'inherit',
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)' }}
              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
            >
              {ds.label}
            </button>
          )
        })}
      </div>

      {opened && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12.5,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: orderedLogs.length === 0 ? 0 : 10,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                letterSpacing: '0.16em',
                color: 'var(--sage-700)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {opened.d.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              {opened.isToday && ' · today'}
            </div>
            {orderedLogs.length > 0 && (
              <div className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)' }}>
                {totalCalForDay} cal
              </div>
            )}
          </div>

          {orderedLogs.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>
              {opened.isFuture ? 'Future day — not yet.' : 'No meals logged.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orderedLogs.map((log, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 12 }}>
                      {log.mealType}
                    </span>
                    <span
                      className="mono"
                      style={{ color: 'var(--sage-700)', fontWeight: 700, fontSize: 11.5 }}
                    >
                      {log.totalCal} cal
                    </span>
                  </div>
                  {log.items.length > 0 && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--muted)',
                        marginTop: 2,
                        lineHeight: 1.45,
                      }}
                    >
                      {log.items.map(it => it.name).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 10,
          fontSize: 10,
          color: 'var(--muted)',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--sage-700)' }} />
          Logged
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#FDF6E6', border: '1px solid #E8A830' }} />
          Missed
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#FCE9E9', border: '1px solid #D94F4F' }} />
          3+ days off
        </span>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
