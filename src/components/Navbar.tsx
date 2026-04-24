import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

const LINKS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'scan', label: 'Scan Meal' },
  { id: 'chat', label: 'AI Coach' },
  { id: 'family', label: 'Family Meal' },
  { id: 'lab', label: 'Lab Reports' },
  { id: 'patterns', label: 'Patterns' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const current = location.pathname.replace('/', '')
  const { signOut } = useAuthActions()
  const currentUser = useQuery(api.users.getCurrentUser)
  const profile = useQuery(api.users.getProfile)
  const setPhotoStorage = useMutation(api.users.setPhotoStoragePreference)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const photoStorageAllowed = profile?.allowPhotoStorage !== false // default true
  async function togglePhotoStorage() {
    if (!profile) return
    try { await setPhotoStorage({ allow: !photoStorageAllowed }) } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const displayName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'User')
  const initials = currentUser?.name
    ? currentUser.name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : currentUser?.email
    ? currentUser.email[0].toUpperCase()
    : 'U'

  return (
    <div className="nav">
      <div className="nav-inner">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">Th</div>
          <span>Thalify</span>
        </div>
        <div className="nav-links">
          {LINKS.map(s => (
            <div
              key={s.id}
              className={`nav-link ${current === s.id ? 'active' : ''}`}
              onClick={() => navigate(`/${s.id}`)}
            >{s.label}</div>
          ))}
        </div>
        <div className="nav-right" ref={menuRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 10px 4px 4px', borderRadius: 99, background: menuOpen ? 'var(--sand)' : 'transparent', transition: 'background 0.15s' }}
          >
            <div className="avatar">{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName.split(' ')[0]}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.5, transition: 'transform 0.15s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
              <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              minWidth: 240,
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>
                  {displayName}
                </div>
                {currentUser?.email && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.email}
                  </div>
                )}
              </div>
              <div
                onClick={() => { setMenuOpen(false); navigate('/dashboard') }}
                style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Dashboard
              </div>
              {currentUser?.isAdmin && (
                <div
                  onClick={() => { setMenuOpen(false); navigate('/admin') }}
                  style={{ padding: '10px 16px', fontSize: 13, color: 'var(--sage-700)', fontWeight: 600, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cream)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🛠️ Admin
                </div>
              )}
              <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ink-2)', borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={photoStorageAllowed} onChange={togglePhotoStorage} style={{ cursor: 'pointer' }} />
                  <span>Store my meal photos</span>
                </label>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginLeft: 22 }}>Helps us improve scan accuracy over time</div>
              </div>
              <div
                onClick={handleSignOut}
                style={{ padding: '10px 16px', fontSize: 13, color: '#b91c1c', cursor: 'pointer', borderTop: '1px solid var(--border)', transition: 'background 0.1s', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5.5 3.5V2a1 1 0 011-1h5a1 1 0 011 1v10a1 1 0 01-1 1h-5a1 1 0 01-1-1v-1.5M8 7H1m0 0l2.5-2.5M1 7l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Log out
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
