import { useNavigate } from 'react-router-dom'

export default function LandingNav() {
  const navigate = useNavigate()
  return (
    <div className="nav">
      <div className="nav-inner">
        <div className="brand">
          <div className="brand-mark">HC</div>
          <span>HealthCoach AI</span>
        </div>
        <div className="nav-links" style={{ justifyContent: 'center' }}>
          <div className="nav-link">Features</div>
          <div className="nav-link">How It Works</div>
          <div className="nav-link">Pricing</div>
        </div>
        <div className="nav-right">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/auth')}>Sign In</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/auth')}>Try Free</button>
        </div>
      </div>
    </div>
  )
}
