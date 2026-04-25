import { useState } from 'react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import { useIsMobile } from '../hooks/useIsMobile'

type ScanItem = { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number }

export default function Admin() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const currentUser = useQuery(api.users.getCurrentUser)
  const [filter, setFilter] = useState<'all' | 'edited' | 'inaccurate'>('all')

  const scans = useQuery(api.adminScans.recentScans, {
    limit: 100,
    onlyEdited: filter === 'edited',
    onlyNegativeFeedback: filter === 'inaccurate',
  })
  const stats = useQuery(api.adminScans.scanStats)

  if (currentUser === undefined) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>
  if (!currentUser?.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <Navbar />
        <div className="page" style={{ maxWidth: 480, textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h1 className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Admin only</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>This area is restricted to Thalify admins.</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">Back to dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 1080 }}>
        <h1 className="serif" style={{ fontSize: 28, marginBottom: 4 }}>Scan Admin</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Review scans, spot systematic errors, feed insights back into the prompt.</p>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total scans" value={stats.total} />
            <StatCard label="Edited" value={`${stats.edited} (${Math.round(stats.editRate * 100)}%)`} />
            <StatCard label="👍 Accurate" value={stats.accurate} />
            <StatCard label="🤔 Partial" value={stats.partial} />
            <StatCard label="👎 Inaccurate" value={stats.inaccurate} />
            <StatCard label="With photo" value={stats.withPhoto} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--sand)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
          {(['all', 'edited', 'inaccurate'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: filter === f ? 'var(--sage-700)' : 'transparent', color: filter === f ? 'white' : 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}
            >{f}</button>
          ))}
        </div>

        {scans === undefined && <div>Loading scans…</div>}
        {scans && scans.length === 0 && <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center', background: 'var(--sand)', borderRadius: 12 }}>No scans match this filter yet.</div>}

        {scans && scans.map(scan => (
          <ScanRow key={scan._id} scan={scan} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: 'var(--sand)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

type ScanSummary = {
  _id: string
  userEmail: string | null
  userName: string | null
  createdAt: number
  edited: boolean
  userFeedback: 'accurate' | 'inaccurate' | 'partial' | null
  feedbackNotes: string | null
  rawItems: ScanItem[]
  finalItems: ScanItem[]
  totalCal: number
  imageUrl: string | null
}

function ScanRow({ scan }: { scan: ScanSummary }) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const feedbackEmoji = scan.userFeedback === 'accurate' ? '👍' : scan.userFeedback === 'inaccurate' ? '👎' : scan.userFeedback === 'partial' ? '🤔' : ''
  const date = new Date(scan.createdAt)

  return (
    <div style={{ background: 'var(--sand)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', border: scan.edited ? '2px solid var(--sage-700)' : '1px solid var(--border)' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'grid', gridTemplateColumns: isMobile ? '48px 1fr auto' : '60px 1fr auto auto auto', gap: isMobile ? 10 : 16, alignItems: 'center' }}>
        {scan.imageUrl ? (
          <img src={scan.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍽️</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.userName || scan.userEmail || 'Unknown'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scan.finalItems.map(i => i.name).slice(0, 3).join(', ')}{scan.finalItems.length > 3 ? '…' : ''}
          </div>
        </div>
        {!isMobile && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
        <div className="mono" style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, whiteSpace: 'nowrap' }}>{scan.totalCal}{isMobile ? ' cal' : ' cal'}{feedbackEmoji ? ' ' + feedbackEmoji : ''}{scan.edited ? ' ✎' : ''}</div>
        {!isMobile && <div style={{ fontSize: 16, minWidth: 24 }}>{feedbackEmoji}{scan.edited ? ' ✎' : ''}</div>}
      </div>

      {open && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
          {scan.imageUrl && (
            <img src={scan.imageUrl} alt="" style={{ maxWidth: isMobile ? '100%' : 320, maxHeight: 240, borderRadius: 10, marginBottom: 16 }} />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Gemini's Prediction (raw)</div>
              <ItemList items={scan.rawItems} />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 8, color: scan.edited ? 'var(--sage-700)' : 'var(--muted)' }}>User Logged (final) {scan.edited ? '← edited' : ''}</div>
              <ItemList items={scan.finalItems} />
            </div>
          </div>
          {scan.feedbackNotes && (
            <div style={{ marginTop: 12, padding: 10, background: 'white', borderRadius: 8, fontSize: 13 }}>
              <b>Notes:</b> {scan.feedbackNotes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemList({ items }: { items: ScanItem[] }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
      {items.length === 0 && <div style={{ padding: 10, color: 'var(--muted)' }}>No items</div>}
      {items.map((i, idx) => (
        <div key={idx} style={{ padding: '8px 12px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 500 }}>{i.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{i.portion}</div>
          </div>
          <div className="mono" style={{ fontWeight: 600 }}>{i.cal} cal</div>
        </div>
      ))}
    </div>
  )
}
