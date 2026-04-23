import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
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
  const profile = useQuery(api.users.getProfile)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = (profile as any)?.name
    ? (profile as any).name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
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
        <div className="nav-right">
          <div className="avatar" style={{ cursor: 'pointer' }} onClick={handleSignOut} title="Sign out">
            {initials}
          </div>
        </div>
      </div>
    </div>
  )
}
