import { useState, useEffect } from 'react'
import { useAction } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import './Waitlist.css'

// Launch target: Friday 25 April 2026, 9:00 AM IST
const LAUNCH_TARGET_MS = new Date('2026-04-25T09:00:00+05:30').getTime()

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function useIsLaunched() {
  const now = useNow()
  return now >= LAUNCH_TARGET_MS
}

function useCountdown() {
  const now = useNow()
  const diff = Math.max(0, LAUNCH_TARGET_MS - now)
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s }
}

function LaunchBar() {
  const { d, h, m, s } = useCountdown()
  const launched = useIsLaunched()
  if (launched) {
    return (
      <div className="launch-bar">
        <span className="pulse" />
        <b>We're live!</b> &middot; Sign in or create an account to start using Thalify
      </div>
    )
  }
  return (
    <div className="launch-bar">
      <span className="pulse" />
      Launching <b>Friday 25 April</b> &middot;{' '}
      <b>{String(d).padStart(2, '0')}d {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</b>
      {' '}&middot; First <b>247 of 500</b> seats claimed
    </div>
  )
}

interface PostLaunchAuthCtaProps {
  dark?: boolean
  inline?: boolean
}

function PostLaunchAuthCta({ dark = false, inline = false }: PostLaunchAuthCtaProps) {
  const navigate = useNavigate()
  if (inline) {
    return (
      <div className="hero-form-inline" style={{ display: 'flex', gap: 8 }}>
        <button className="hero-submit" onClick={() => navigate('/auth?mode=login')} style={{ flex: 1 }}>
          Sign in <span>&#8594;</span>
        </button>
        <button className="hero-submit" onClick={() => navigate('/auth')} style={{ flex: 1, background: 'transparent', border: '1.5px solid var(--sage-700)', color: 'var(--sage-700)' }}>
          Create account
        </button>
      </div>
    )
  }
  return (
    <div>
      <button className="go-btn" onClick={() => navigate('/auth')}>
        Create my account
        <span className="arrow">&#8594;</span>
      </button>
      <div style={{ textAlign: 'center', margin: '14px 0', fontSize: 13, color: dark ? 'rgba(254,252,248,0.55)' : 'var(--muted)' }}>
        Already have an account?{' '}
        <span onClick={() => navigate('/auth?mode=login')} style={{ color: dark ? 'var(--sage-500)' : 'var(--sage-700)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
          Sign in
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: dark ? 'rgba(254,252,248,0.45)' : 'var(--muted)', lineHeight: 1.55, marginTop: 8 }}>
        Free tier includes 5 photo scans and 5 Health Buddy chats per day. Full access with your lifetime Pro seat if you were on the waitlist.
      </div>
    </div>
  )
}

interface HeroFormProps {
  dark?: boolean
  inline?: boolean
}

function HeroForm({ dark = false, inline = false }: HeroFormProps) {
  const launched = useIsLaunched()
  if (launched) return <PostLaunchAuthCta dark={dark} inline={inline} />

  return <HeroFormLive dark={dark} inline={inline} />
}

function HeroFormLive({ dark = false, inline = false }: HeroFormProps) {
  const joinWaitlist = useAction(api.waitlist.joinWaitlist)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [done, setDone] = useState(false)
  const [position, setPosition] = useState<number | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [alreadyJoined, setAlreadyJoined] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setErrorMsg('')
    setSubmitting(true)
    try {
      const res = await joinWaitlist({ email: email.trim() })
      setPosition(res.position)
      setEmailSent(res.emailSent)
      setAlreadyJoined(res.emailError === 'already_joined')
      setEmailError(res.emailError && res.emailError !== 'already_joined' ? res.emailError : null)
      setDone(true)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong — please retry.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="success-state">
        <div className="success-check">&#10003;</div>
        <div className="serif" style={{ fontSize: 24, marginBottom: 6, color: dark ? 'var(--cream)' : 'var(--ink)' }}>
          {alreadyJoined ? `You're already in — seat #${position}.` : `Seat #${position ?? '—'} reserved.`}
        </div>
        <div style={{ fontSize: 14, color: dark ? 'rgba(254,252,248,0.7)' : 'var(--muted)', lineHeight: 1.6 }}>
          {emailSent ? (
            <>We just sent a confirmation to <b style={{ color: dark ? 'var(--cream)' : 'var(--ink)' }}>{email}</b>. Check your inbox (and spam folder, just in case).</>
          ) : alreadyJoined ? (
            <>This email is already on the waitlist. We'll notify you on <b style={{ color: dark ? 'var(--sage-500)' : 'var(--sage-700)' }}>25 April at 9:00 AM IST</b>.</>
          ) : (
            <>You're saved. Activation link lands on <b style={{ color: dark ? 'var(--sage-500)' : 'var(--sage-700)' }}>25 April at 9:00 AM IST</b> at <b style={{ color: dark ? 'var(--cream)' : 'var(--ink)' }}>{email}</b>.</>
          )}
          {emailError && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Note: we couldn't send the confirmation email right now, but your spot is saved.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (inline) {
    return (
      <form className="hero-form-inline" onSubmit={submit}>
        <input
          className="hero-input"
          type="email"
          placeholder="your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button className="hero-submit" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : <>Claim my seat <span>&#8594;</span></>}
        </button>
        {errorMsg && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}>{errorMsg}</div>}
      </form>
    )
  }

  return (
    <form onSubmit={submit}>
      <input
        className="dark-input"
        type="email"
        placeholder="your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        className="dark-input"
        type="tel"
        placeholder="WhatsApp number (optional &mdash; for nudges)"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      />
      <div style={{ fontSize: 11.5, color: 'rgba(254,252,248,0.55)', marginBottom: 10, fontFamily: 'var(--mono)', letterSpacing: 0.5 }}>
        WHICH CITY?
      </div>
      <div className="chip-select">
        {['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Other'].map(c => (
          <div
            key={c}
            className={`chip-opt ${city === c ? 'on' : ''}`}
            onClick={() => setCity(c)}
          >
            {c}
          </div>
        ))}
      </div>
      <button className="go-btn" type="submit" disabled={submitting}>
        {submitting ? 'Saving your seat…' : <>Claim seat #248 of 500<span className="arrow">&#8594;</span></>}
      </button>
      {errorMsg && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{errorMsg}</div>}
      <div className="seats-bar">
        <span style={{ color: 'var(--sage-500)', fontWeight: 700, fontFamily: 'var(--mono)' }}>247/500</span>
        <div className="seats-progress">
          <div className="seats-fill" />
        </div>
        <span style={{ color: 'rgba(254,252,248,0.6)', fontFamily: 'var(--mono)' }}>253 left</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'rgba(254,252,248,0.45)', marginTop: 12, lineHeight: 1.55 }}>
        Lifetime Pro, locked in. Not a trial. Not &ldquo;free for 30 days.&rdquo; Free forever &mdash; if you&apos;re in by Friday.
      </div>
    </form>
  )
}

interface FaqItemProps {
  q: string
  a: string
  defaultOpen?: boolean
}

function FaqItem({ q, a, defaultOpen }: FaqItemProps) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <div className="faq-q" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <div className="faq-toggle">+</div>
      </div>
      <div className="faq-a">{a}</div>
    </div>
  )
}

export default function Waitlist() {
  return (
    <div>
      <LaunchBar />

      {/* Nav */}
      <div className="waitlist-nav">
        <div className="brand">
          <div className="brand-mark">Th</div>
          <span>Thalify</span>
        </div>
        <div className="nav-cta">
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Launching 25 April</span>
          <span className="seat-pill"><span className="online-dot" /> 253 seats left</span>
        </div>
      </div>

      {/* HERO */}
      <section className="wl-section hero">
        <div>
          <div className="hero-eyebrow">
            <span className="line" />
            <span>For Indian households &middot; Free forever for the first 500</span>
          </div>
          <h1 className="hero-headline">
            Lose weight<br />
            on your <em>mother&apos;s</em><br />
            cooking.
          </h1>
          <p className="hero-sub">
            The first AI health coach that speaks <b>&#2342;&#2366;&#2354;, &#2330;&#2366;&#2357;&#2354;, &#2360;&#2366;&#2306;&#2348;&#2366;&#2352;</b> &mdash; not kale.
            Snap your thali in the app. Get smart nudges on WhatsApp. Stay on your
            family&apos;s dinner table, not off it.
          </p>
          <HeroForm inline />
          <div className="hero-trust">
            <span>&#128274; No spam, ever</span>
            <span>&middot;</span>
            <span>&#128241; App + WhatsApp nudges</span>
            <span>&middot;</span>
            <span>&#127470;&#127475; 5 languages at launch</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-photo" />
          <div className="hero-plate-note">
            <div className="hn-label">AI read your plate</div>
            <div className="hn-text">
              Rajma + 1 roti + jeera rice <span style={{ color: 'var(--muted)' }}>(half portion)</span>
            </div>
            <div className="hn-cal" style={{ marginTop: 6 }}>420 cal &middot; perfect</div>
          </div>
          <div className="hero-visual-overlay">
            <div className="hero-visual-quote">&ldquo;I ate what Mummy made. I still lost 4 kg.&rdquo;</div>
            <div className="hero-visual-attr">&mdash; Ananya, 31 &middot; Koramangala &middot; week 6</div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem">
        <div className="problem-inner">
          <div className="problem-label">why now</div>
          <h2>Every diet app was built for a different country.</h2>
          <div className="problem-grid">
            <div className="wrong-app">
              <div className="wrong-tag">What they give you</div>
              <div className="wrong-meal"><span className="x">&times;</span><span>Quinoa bowl, 340 cal</span></div>
              <div className="wrong-meal"><span className="x">&times;</span><span>Avocado toast, 290 cal</span></div>
              <div className="wrong-meal"><span className="x">&times;</span><span>Grilled chicken salad</span></div>
              <div className="wrong-meal"><span className="x">&times;</span><span>Greek yogurt + berries</span></div>
              <div className="wrong-footer">
                So you cook twice. Fight with your mother. Quit in three weeks. Blame yourself.
              </div>
            </div>
            <div className="right-app">
              <div className="right-tag">What we give you</div>
              <div className="right-meal"><span className="check">&#10003;</span><span>Rajma chawal <span style={{ opacity: 0.6 }}>&mdash; optimized portion</span></span></div>
              <div className="right-meal"><span className="check">&#10003;</span><span>Curd rice + achar <span style={{ opacity: 0.6 }}>&mdash; rice swapped to brown</span></span></div>
              <div className="right-meal"><span className="check">&#10003;</span><span>Masala dosa <span style={{ opacity: 0.6 }}>&mdash; 1 instead of 2</span></span></div>
              <div className="right-meal"><span className="check">&#10003;</span><span>Filter coffee with jaggery</span></div>
              <div className="right-footer">
                Same pot. Your portions. No separate &ldquo;diet food.&rdquo; No guilt. Lose weight eating what you love.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="wl-section manifesto">
        <div className="problem-label">our promise</div>
        <div className="manifesto-lines" style={{ marginTop: 30 }}>
          <div className="manifesto-line">We won&apos;t ask you to skip dinner.</div>
          <div className="manifesto-line">We won&apos;t tell you rice is the enemy.</div>
          <div className="manifesto-line ink">We won&apos;t pretend ghee is poison.</div>
          <div className="manifesto-line">We won&apos;t count kale.</div>
          <div className="manifesto-line ink">We&apos;ll count <i>katoris</i>.</div>
          <div className="manifesto-line sage">And we&apos;ll speak your language &mdash; all five of them.</div>
        </div>
        <div className="manifesto-footer">
          &mdash; from the founder
          <span className="signature">Siddharth Agrawal</span>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="wl-section pillars">
        <div className="pillars-head">
          <div className="problem-label">three things &middot; zero friction</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 400, margin: '14px 0 10px', letterSpacing: '-0.015em' }}>
            A real app, with <em style={{ color: 'var(--sage-700)' }}>WhatsApp nudges</em> when you need them.
          </h2>
          <div style={{ color: 'var(--muted)', fontSize: 15.5 }}>
            Photo scanner, dashboard, lab reports &mdash; all in the app. Quick check-ins and 10 PM nudges land on WhatsApp.
          </div>
        </div>

        <div className="pillars-grid">
          <div className="pillar">
            <div className="pillar-head">
              <div className="pillar-num">01 &middot; SPEAK</div>
              <div className="pillar-title">Quick question?<br />Voice-note us on WhatsApp.</div>
            </div>
            <div className="pillar-body">
              <div className="pillar-desc">
                For 10 PM cravings or restaurant menus, WhatsApp is faster than opening the app. Ask in Hinglish or Tamil &mdash; reply in seconds.
              </div>
              <div className="wa-mock">
                <div className="wa-bubble">&#127908; 0:06 <span className="wa-time">10:58 PM</span></div>
                <div className="wa-bubble out">
                  Gulab jamun @ wedding? Go for 1, not 3. Walk 20 min after. You&apos;re still under 1,800 today &#10003;{' '}
                  <span className="wa-time">10:58 PM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pillar">
            <div className="pillar-head">
              <div className="pillar-num">02 &middot; SNAP</div>
              <div className="pillar-title">Photograph your plate<br />in the app.</div>
            </div>
            <div className="pillar-body">
              <div className="pillar-desc">
                87% accuracy on Indian food. We recognize 2,400+ dishes &mdash; from Pesarattu to Puran Poli. Your portion, in katoris.
              </div>
              <div className="scan-mock">
                <div className="scan-row"><span>Aloo paratha (2)</span><span style={{ fontFamily: 'var(--mono)' }}>340 cal</span></div>
                <div className="scan-row"><span>Curd</span><span style={{ fontFamily: 'var(--mono)' }}>80 cal</span></div>
                <div className="scan-row"><span>Masala chai w/ sugar</span><span style={{ fontFamily: 'var(--mono)' }}>85 cal</span></div>
                <div className="scan-row"><span>Total</span><span style={{ fontFamily: 'var(--mono)' }}>505 cal</span></div>
              </div>
            </div>
          </div>

          <div className="pillar">
            <div className="pillar-head">
              <div className="pillar-num">03 &middot; STAY</div>
              <div className="pillar-title">Family meal? Open the app.<br />Get your portions.</div>
            </div>
            <div className="pillar-body">
              <div className="pillar-desc">
                Your mother cooks rajma-chawal-aloo gobi for everyone. We tell you &mdash; privately &mdash; exactly how much to take. No fights.
              </div>
              <div className="family-mock">
                <div className="family-row"><span style={{ flex: 1 }}>Rajma</span><span className="pill pill-keep">Keep</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Aloo gobi</span><span className="pill pill-cut">&#189; portion</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Jeera rice</span><span className="pill pill-cut">Skip</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Roti</span><span className="pill pill-keep">2 pcs &#10003;</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>+ cucumber raita</span><span className="pill pill-add">Add</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="close">
        <div className="close-inner">
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--sage-500)', letterSpacing: 1.5, fontWeight: 700 }}>
              FOUNDING 500
            </div>
            <h2 className="close-title">
              The last time you&apos;ll <em>pay</em> for this app <em>is never.</em>
            </h2>
            <p className="close-sub">
              We&apos;re onboarding 500 people by hand on 25 April. Everyone who joins gets Pro free for life,
              a direct line to our founder, and credit in our launch.
            </p>
            <div className="perks">
              <div className="perk">
                <div className="perk-label">PRICE</div>
                <div className="perk-value"><s>&#8377;199/mo</s> Free forever</div>
                <div className="perk-note">Grandfathered in. Locked.</div>
              </div>
              <div className="perk">
                <div className="perk-label">ONBOARDING</div>
                <div className="perk-value">Personal, in-app</div>
                <div className="perk-note">One of us. 25 minutes.</div>
              </div>
              <div className="perk">
                <div className="perk-label">FAMILY PLAN</div>
                <div className="perk-value">Free for 3 members</div>
                <div className="perk-note">Spouse + parents + kids.</div>
              </div>
              <div className="perk">
                <div className="perk-label">SHIP DATE</div>
                <div className="perk-value">Fri 25 Apr, 9 AM IST</div>
                <div className="perk-note">Your link arrives then.</div>
              </div>
            </div>
          </div>

          <div className="close-form">
            <div className="close-form-title">Claim your seat.</div>
            <div className="close-form-sub">30 seconds. We&apos;ll do the rest on 25 April.</div>
            <HeroForm dark />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="wl-section faq-section">
        <div style={{ textAlign: 'center' }}>
          <div className="problem-label">questions we keep getting</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 46, fontWeight: 400, margin: '14px 0 0', letterSpacing: '-0.015em' }}>
            Honest answers to <em style={{ color: 'var(--sage-700)' }}>hard questions.</em>
          </h2>
        </div>
        <div className="faq-grid">
          <div style={{ padding: 28, background: 'var(--sand)', borderRadius: 16 }}>
            <div className="problem-label">still unsure?</div>
            <div className="serif" style={{ fontSize: 24, marginTop: 12, lineHeight: 1.3 }}>
              The 500 seats go to people who&apos;ll use it &mdash; and tell us what&apos;s broken.
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 16 }}>
              We&apos;re not trying to go viral. We&apos;re trying to build the one diet app an Indian family actually
              keeps for a year. If you&apos;re in, we onboard you personally.
            </div>
            <div style={{ marginTop: 18, padding: 14, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--sage-700)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontSize: 15 }}>SA</div>
              <div style={{ fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>Siddharth Agrawal</div>
                <div style={{ color: 'var(--muted)' }}>Founder &middot; reply anytime</div>
              </div>
            </div>
          </div>
          <div>
            <FaqItem defaultOpen
              q="Is it really free forever if I join by Friday?"
              a="Yes. The first 500 pay Rs 0, ever. No trial tricks, no feature-gating later. We'll grandfather your account and note it in our records. Anyone joining after 500 pays Rs 199/month."
            />
            <FaqItem
              q="Is this an app, or a WhatsApp bot?"
              a="It's a real app (web + mobile) — that's where the photo scanner, dashboard, lab reports, and meal planner live. WhatsApp is an optional companion for quick voice-note questions and nudges."
            />
            <FaqItem
              q="How accurate is the photo scanner on Indian food?"
              a="87% accuracy across 2,400+ dishes (measured against dietitian estimates). We miss on unusual regional dishes — you can correct portions in one tap, and we learn."
            />
            <FaqItem
              q="What about my medical condition / labs / diabetes?"
              a="Upload your latest blood test (PDF). We read HbA1c, Vitamin D, B12, iron, TSH, cholesterol — and adjust your daily plan automatically."
            />
            <FaqItem
              q="Which languages do you support?"
              a="Hindi, English, Tamil, Telugu, Bengali at launch. Plus voice notes in code-mixed Hinglish. Adding Marathi and Kannada by June."
            />
            <FaqItem
              q="Why should I trust you with my health data?"
              a="We store the minimum we need to coach you. No third-party ads, ever. Your data never leaves India. Delete everything with one WhatsApp message."
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section className="wl-section">
        <div className="footer">
          <div>&copy; 2026 Thalify &middot; Koramangala, Bengaluru</div>
          <div>
            <a href="mailto:hello@thalify.com">hello@thalify.com</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </section>
    </div>
  )
}
