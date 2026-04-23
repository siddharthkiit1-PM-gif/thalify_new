import Navbar from '../components/Navbar'

export default function Lab() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🧪</div>
        <h1 className="serif" style={{ fontSize: 32, marginBottom: 10 }}>Lab Report Analysis</h1>
        <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
          Upload your blood work and get an AI-powered nutrition plan tailored to your actual health markers.
          Coming in Month 2.
        </p>
        <div style={{ background: 'var(--sage-100)', borderRadius: 16, padding: 24, display: 'inline-block' }}>
          <div style={{ fontSize: 13, color: 'var(--sage-700)', fontWeight: 600 }}>What's coming:</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.7 }}>
            HbA1c · Cholesterol · Vitamin D · Iron<br />
            Auto-adjusted meal plan · Trend tracking
          </div>
        </div>
      </div>
    </div>
  )
}
