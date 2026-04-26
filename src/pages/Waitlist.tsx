import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import TelegramLogo from '../components/TelegramLogo'
import './Waitlist.css'

function LiveBar() {
  return (
    <div className="launch-bar">
      <span className="pulse" />
      <b>We&rsquo;re live.</b> Sign in or create an account to start using Thalify.
    </div>
  )
}

function HeroCta({ inline = false, dark = false }: { inline?: boolean; dark?: boolean }) {
  const navigate = useNavigate()
  if (inline) {
    return (
      <div className="hero-form-inline" style={{ display: 'flex', gap: 8 }}>
        <button className="hero-submit" onClick={() => navigate('/auth')} style={{ flex: 1 }}>
          Create account <span>&rarr;</span>
        </button>
        <button
          className="hero-submit"
          onClick={() => navigate('/auth?mode=login')}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1.5px solid var(--sage-700)',
            color: 'var(--sage-700)',
          }}
        >
          Sign in
        </button>
      </div>
    )
  }
  return (
    <div>
      <button className="go-btn" onClick={() => navigate('/auth')}>
        Create my account
        <span className="arrow">&rarr;</span>
      </button>
      <div
        style={{
          textAlign: 'center',
          margin: '14px 0',
          fontSize: 13,
          color: dark ? 'rgba(254,252,248,0.55)' : 'var(--muted)',
        }}
      >
        Already have an account?{' '}
        <span
          onClick={() => navigate('/auth?mode=login')}
          style={{
            color: dark ? 'var(--sage-500)' : 'var(--sage-700)',
            cursor: 'pointer',
            fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          Sign in
        </span>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: dark ? 'rgba(254,252,248,0.45)' : 'var(--muted)',
          lineHeight: 1.55,
          marginTop: 8,
        }}
      >
        Free tier includes 5 photo scans + 10 Health Buddy chats per month. Unlock unlimited with the <b style={{ color: dark ? 'var(--sage-500)' : 'var(--sage-700)' }}>₹99 founder offer</b> below.
      </div>
    </div>
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

function FounderOffer() {
  const navigate = useNavigate()
  const slots = useQuery(api.users.getFounderSlotsRemaining)
  const remaining = slots?.remaining ?? 50
  const filled = slots?.filled ?? 0
  const soldOut = remaining === 0
  const fillPct = (filled / 50) * 100

  return (
    <section className="close">
      <div className="close-inner">
        <div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              color: 'var(--sage-500)',
              letterSpacing: '0.18em',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Founder offer · {remaining} of 50 left
          </div>
          <h2 className="close-title">
            Pay <em>once.</em> Use it for <em>life.</em>
          </h2>
          <p className="close-sub">
            The first <b>50 founders</b> get lifetime Thalify for a single ₹99 payment. No monthly bills, ever. After
            that, we move to the regular monthly tier.
          </p>
          <div className="perks">
            <div className="perk">
              <div className="perk-label">PRICE</div>
              <div className="perk-value">₹99 once</div>
              <div className="perk-note">Charged via Razorpay (UPI / card / netbanking).</div>
            </div>
            <div className="perk">
              <div className="perk-label">UNLOCKS</div>
              <div className="perk-value">3,000 actions / month</div>
              <div className="perk-note">Scans, chats, lab analysis — every month, forever.</div>
            </div>
            <div className="perk">
              <div className="perk-label">CHANNELS</div>
              <div className="perk-value">App + Telegram</div>
              <div className="perk-note">Log meals from anywhere, including the bot.</div>
            </div>
            <div className="perk">
              <div className="perk-label">FOUNDER BADGE</div>
              <div className="perk-value">Your number, 1-50</div>
              <div className="perk-note">Visible in the app. Forever yours.</div>
            </div>
          </div>
        </div>

        <div className="close-form">
          <div className="close-form-title">{soldOut ? 'Sold out.' : 'Claim a founder spot.'}</div>
          <div className="close-form-sub">
            {soldOut
              ? 'All 50 founder spots are taken. Subscription tier launching soon.'
              : 'Sign in or create your account, then tap Become a Founder on the dashboard.'}
          </div>

          {/* Live progress bar */}
          <div style={{ margin: '20px 0 18px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                color: 'rgba(254,252,248,0.6)',
                marginBottom: 8,
                fontFamily: 'var(--mono)',
                letterSpacing: 0.5,
              }}
            >
              <span>{filled}/50 founders so far</span>
              <span style={{ color: remaining < 10 ? '#FCA5A5' : 'var(--sage-500)', fontWeight: 700 }}>
                {remaining} spots left
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: 'rgba(254,252,248,0.12)',
                borderRadius: 99,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${fillPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--sage-500) 0%, #4ADE8A 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {soldOut ? (
            <button
              className="go-btn"
              disabled
              style={{ background: 'rgba(254,252,248,0.15)', color: 'rgba(254,252,248,0.5)', cursor: 'not-allowed' }}
            >
              Join waitlist for monthly tier
            </button>
          ) : (
            <>
              <button className="go-btn" onClick={() => navigate('/auth')}>
                Get started · ₹99 lifetime <span className="arrow">&rarr;</span>
              </button>
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 10,
                  fontSize: 12,
                  color: 'rgba(254,252,248,0.55)',
                }}
              >
                Already a member?{' '}
                <span
                  onClick={() => navigate('/auth?mode=login')}
                  style={{ color: 'var(--sage-500)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Sign in
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function MultiChannelLogging() {
  return (
    <section className="wl-section multichannel">
      <div className="multichannel-head">
        <div className="problem-label">log from anywhere</div>
        <h2 className="serif">
          Log a meal from <em>two places.</em>
        </h2>
        <p className="multichannel-sub">
          The Thalify app handles deep work — dashboard, lab reports, family optimizer. The Telegram bot is for the
          one-handed moments: standing at the dinner table, on a wedding plate, mid-tea. Same account, same data,
          same coach.
        </p>
      </div>

      <div className="multichannel-grid">
        <div className="mc-card">
          <div className="mc-card-icon">📷</div>
          <div className="mc-card-tag">In the app</div>
          <div className="mc-card-title">Snap your thali on /scan</div>
          <div className="mc-card-body">
            Drag-and-drop or tap-to-upload. The full breakdown opens with editable items, portion edits, and a
            single-tap log. Best when you have 30 seconds and a screen.
          </div>
        </div>

        <div className="mc-card mc-card-tg">
          <div className="mc-card-icon">
            <TelegramLogo size={32} />
          </div>
          <div className="mc-card-tag">On Telegram</div>
          <div className="mc-card-title">
            Send a photo to <code>@thalify_health_bot</code>
          </div>
          <div className="mc-card-body">
            One photo, three buttons (✓ Log as Lunch / Skip / change meal type). The bot replies with the breakdown
            and logs it into the same dashboard. Best for when you can&rsquo;t open the app.
          </div>
        </div>
      </div>

      <div className="multichannel-foot">
        Both channels write to the <b>same meal log.</b> Whatever you scan in Telegram appears in your dashboard
        instantly — no sync, no separate accounts.
      </div>
    </section>
  )
}

function WhatsNext() {
  return (
    <section className="wl-section whats-next">
      <div className="whats-next-head">
        <div className="problem-label">what&rsquo;s next</div>
        <h2 className="serif">
          What we&rsquo;re shipping <em>next.</em>
        </h2>
        <p className="whats-next-sub">
          We ship every week. Here&rsquo;s what founders get first.
        </p>
      </div>

      <div className="whats-next-grid">
        <div className="next-item">
          <div className="next-when">Next month</div>
          <div className="next-title">WhatsApp nudges</div>
          <div className="next-body">
            Same gentle one-line coaching, delivered on WhatsApp. The branded sender is in Razorpay/Meta review now.
          </div>
        </div>
        <div className="next-item">
          <div className="next-when">Next month</div>
          <div className="next-title">Voice notes on Telegram</div>
          <div className="next-body">
            Send a Hindi/Hinglish voice note to the bot — we transcribe + reply. For moments your hands are full
            (driving, cooking, eating).
          </div>
        </div>
        <div className="next-item">
          <div className="next-when">Q3 2026</div>
          <div className="next-title">Family profiles</div>
          <div className="next-body">
            One household, multiple members, shared meals. Each person sees their own portion guidance off the same
            dinner.
          </div>
        </div>
        <div className="next-item">
          <div className="next-when">Q3 2026</div>
          <div className="next-title">Multi-language UI</div>
          <div className="next-body">
            The AI already speaks Hindi, Tamil, Bengali, Telugu. The app interface follows soon — Hindi UI first.
          </div>
        </div>
        <div className="next-item">
          <div className="next-when">Q4 2026</div>
          <div className="next-title">Doctor + lab integrations</div>
          <div className="next-body">
            Direct integration with Thyrocare / Dr Lal so your reports flow into Thalify automatically. No more
            uploading.
          </div>
        </div>
        <div className="next-item">
          <div className="next-when">Always</div>
          <div className="next-title">Better Indian-food recognition</div>
          <div className="next-body">
            Every correction you make trains the model. Accuracy compounds. Founders see this improvement first.
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Waitlist() {
  const navigate = useNavigate()

  return (
    <div>
      <LiveBar />
      <div className="channel-bar">
        <span className="channel-now">
          <TelegramLogo size={14} style={{ marginRight: 6, verticalAlign: '-3px' }} />
          Live now: Telegram nudges
        </span>
        <span className="channel-sep">·</span>
        <span className="channel-soon">
          <span className="channel-soon-dot" /> Coming next month: WhatsApp nudges
        </span>
      </div>

      {/* Nav */}
      <div className="waitlist-nav">
        <div className="brand">
          <div className="brand-mark">Th</div>
          <span>Thalify</span>
        </div>
        <div className="nav-cta">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/auth?mode=login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13 }}
          >
            Sign in
          </button>
          <button
            className="seat-pill"
            onClick={() => navigate('/auth')}
            style={{ background: 'var(--sage-700)', color: '#fff', cursor: 'pointer', border: 'none' }}
          >
            Create account
          </button>
        </div>
      </div>

      {/* HERO */}
      <section className="wl-section hero">
        <div>
          <div className="hero-eyebrow">
            <span className="line" />
            <span>For Indian households &middot; Live in production</span>
          </div>
          <h1 className="hero-headline">
            Lose weight<br />
            on your <em>mother&rsquo;s</em><br />
            cooking.
          </h1>
          <p className="hero-sub">
            The first AI health coach that speaks <b>&#2342;&#2366;&#2354;, &#2330;&#2366;&#2357;&#2354;, &#2360;&#2366;&#2306;&#2348;&#2366;&#2352;</b> &mdash; not kale.
            Snap your thali in the app. Send a photo to Telegram. Get smart nudges back. Stay on your
            family&rsquo;s dinner table, not off it.
          </p>
          <HeroCta inline />
          <div className="hero-trust">
            <span>&#128274; No spam, ever</span>
            <span>&middot;</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <TelegramLogo size={14} /> App + Telegram
            </span>
            <span>&middot;</span>
            <span>&#127470;&#127475; 5 languages</span>
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
          <div className="manifesto-line">We won&rsquo;t ask you to skip dinner.</div>
          <div className="manifesto-line">We won&rsquo;t tell you rice is the enemy.</div>
          <div className="manifesto-line ink">We won&rsquo;t pretend ghee is poison.</div>
          <div className="manifesto-line">We won&rsquo;t count kale.</div>
          <div className="manifesto-line ink">We&rsquo;ll count <i>katoris</i>.</div>
          <div className="manifesto-line sage">And we&rsquo;ll speak your language &mdash; all five of them.</div>
        </div>
        <div className="manifesto-footer">
          &mdash; from the founder
          <span className="signature">Siddharth Agrawal</span>
        </div>
      </section>

      {/* MULTI-CHANNEL LOGGING */}
      <MultiChannelLogging />

      {/* THREE PILLARS */}
      <section className="wl-section pillars">
        <div className="pillars-head">
          <div className="problem-label">three things &middot; zero friction</div>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 46,
              fontWeight: 400,
              margin: '14px 0 10px',
              letterSpacing: '-0.015em',
            }}
          >
            A real app, with <em style={{ color: 'var(--sage-700)' }}>Telegram nudges</em> when you need them.
          </h2>
          <div style={{ color: 'var(--muted)', fontSize: 15.5 }}>
            Photo scanner, dashboard, lab reports &mdash; all in the app. Quick check-ins and 10 PM nudges land on
            Telegram.{' '}
            <span style={{ color: 'var(--ink-2)' }}>WhatsApp nudges launching next month.</span>
          </div>
        </div>

        <div className="pillars-grid">
          <div className="pillar">
            <div className="pillar-head">
              <div className="pillar-num">01 &middot; SPEAK</div>
              <div className="pillar-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                Quick question?<br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Message <TelegramLogo size={20} style={{ verticalAlign: '-4px' }} /> our Telegram bot.
                </span>
              </div>
            </div>
            <div className="pillar-body">
              <div className="pillar-desc">
                For 10 PM cravings or restaurant menus, Telegram is faster than opening the app. Ask in Hinglish or
                Tamil &mdash; reply in seconds.
              </div>
              <div className="tg-mock">
                <div className="tg-bubble">
                  Gulab jamun at this wedding &mdash; how many? <span className="tg-time">10:58 PM</span>
                </div>
                <div className="tg-bubble out">
                  Go for 1, not 3. Walk 20 min after. You&rsquo;re still under 1,800 today &#10003;{' '}
                  <span className="tg-time">10:58 PM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pillar">
            <div className="pillar-head">
              <div className="pillar-num">02 &middot; SNAP</div>
              <div className="pillar-title">Photograph your plate<br />in the app or Telegram.</div>
            </div>
            <div className="pillar-body">
              <div className="pillar-desc">
                87% accuracy on Indian food. We recognize 2,400+ dishes &mdash; from Pesarattu to Puran Poli. Your
                portion, in katoris.
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
                Your mother cooks rajma-chawal-aloo gobi for everyone. We tell you &mdash; privately &mdash; exactly
                how much to take. No fights.
              </div>
              <div className="family-mock">
                <div className="family-row"><span style={{ flex: 1 }}>Rajma</span><span className="pill pill-keep">Keep</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Aloo gobi</span><span className="pill pill-cut">&frac12; portion</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Jeera rice</span><span className="pill pill-cut">Skip</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>Roti</span><span className="pill pill-keep">2 pcs &#10003;</span></div>
                <div className="family-row"><span style={{ flex: 1 }}>+ cucumber raita</span><span className="pill pill-add">Add</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER OFFER */}
      <FounderOffer />

      {/* WHAT'S NEXT */}
      <WhatsNext />

      {/* FAQ */}
      <section className="wl-section faq-section">
        <div style={{ textAlign: 'center' }}>
          <div className="problem-label">questions we keep getting</div>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 46,
              fontWeight: 400,
              margin: '14px 0 0',
              letterSpacing: '-0.015em',
            }}
          >
            Honest answers to <em style={{ color: 'var(--sage-700)' }}>hard questions.</em>
          </h2>
        </div>
        <div className="faq-grid">
          <div style={{ padding: 28, background: 'var(--sand)', borderRadius: 16 }}>
            <div className="problem-label">still unsure?</div>
            <div className="serif" style={{ fontSize: 24, marginTop: 12, lineHeight: 1.3 }}>
              The 50 founder spots go to people who&rsquo;ll use it &mdash; and tell us what&rsquo;s broken.
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 16 }}>
              We&rsquo;re not trying to go viral. We&rsquo;re trying to build the one diet app an Indian family
              actually keeps for a year. If you&rsquo;re a founder, we onboard you personally.
            </div>
            <div
              style={{
                marginTop: 18,
                padding: 14,
                background: '#fff',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--sage-700)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--serif)',
                  fontSize: 15,
                }}
              >
                SA
              </div>
              <div style={{ fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>Siddharth Agrawal</div>
                <div style={{ color: 'var(--muted)' }}>Founder &middot; reply anytime</div>
              </div>
            </div>
          </div>
          <div>
            <FaqItem
              defaultOpen
              q="What's the founder offer exactly?"
              a="₹99 once = lifetime access for the first 50 paying customers. You get 3,000 AI actions every month, forever — scans, chats, lab analysis, family optimizer. After 50 founders, we move to a monthly subscription tier (TBD pricing). Founders are grandfathered."
            />
            <FaqItem
              q="Can I really log meals from Telegram?"
              a="Yes — send any meal photo to @thalify_health_bot. The bot scans it, shows you the breakdown, and lets you log it as breakfast/lunch/snack/dinner with a single tap. Same data as the app."
            />
            <FaqItem
              q="Is this an app, or a Telegram bot?"
              a="Both. The app (web + mobile) is where the dashboard, lab reports, family optimizer, and pattern insights live. Telegram is the companion for one-handed moments — log a meal at the dinner table, ask a question on the train. WhatsApp nudges launching next month."
            />
            <FaqItem
              q="How accurate is the photo scanner on Indian food?"
              a="87% accuracy across 2,400+ dishes (measured against dietitian estimates). Misses on unusual regional dishes — you can correct portions in one tap, and we learn. Founders see accuracy compound first."
            />
            <FaqItem
              q="What about my medical condition / labs / diabetes?"
              a="Upload your latest blood test (photo or PDF). We read HbA1c, Vitamin D, B12, iron, TSH, cholesterol — and adjust your daily plan automatically. Specific Indian foods, not 'eat more leafy greens.'"
            />
            <FaqItem
              q="Which languages do you support?"
              a="The AI replies in Hindi, English, Hinglish, Tamil, Telugu, Bengali. The app UI is currently English; Hindi UI launching next month. Voice notes on Telegram coming next month too."
            />
            <FaqItem
              q="Why should I trust you with my health data?"
              a="We store the minimum we need to coach you. No third-party ads, ever. Your data never leaves India. Photo storage is opt-in (toggle on the Scan page). Delete everything with one tap from your account settings."
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <section className="wl-section">
        <div className="footer">
          <div>&copy; 2026 Thalify &middot; Koramangala, Bengaluru</div>
          <div>
            <a href="mailto:siddharth.kiit1@gmail.com">siddharth.kiit1@gmail.com</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </section>
    </div>
  )
}
