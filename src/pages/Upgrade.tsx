import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import Section from '../components/ui/Section'
import { openRazorpayCheckout } from '../lib/razorpay'

export default function Upgrade() {
  const navigate = useNavigate()
  const profile = useQuery(api.users.getProfile)
  const currentUser = useQuery(api.users.getCurrentUser)
  const founderSlots = useQuery(api.users.getFounderSlotsRemaining)
  const createOrder = useAction(api.razorpay.orders.createPaymentOrder)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isLifetime = profile?.plan === 'lifetime'
  const isSoldOut = (founderSlots?.remaining ?? 0) === 0
  const founderNumber = profile?.founderNumber

  async function handlePay() {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const order = await createOrder({})
      const result = await openRazorpayCheckout({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Thalify',
        description: 'Founder · ₹99 lifetime access',
        image: '/favicon.svg',
        order_id: order.razorpayOrderId,
        handler: () => {
          // No-op — the webhook on the backend is the source of truth.
          // We poll the profile below, which flips to lifetime when ready.
        },
        prefill: {
          name: currentUser?.name ?? undefined,
          email: currentUser?.email ?? undefined,
        },
        theme: { color: '#2D5F3A' },
        notes: { plan: 'founder_lifetime' },
      })

      if (!result) {
        // user closed the modal or payment failed — they'll see the same page
        setSubmitting(false)
        return
      }

      // Payment successful. Webhook is processing → poll profile until plan flips.
      // Live useQuery already subscribes — we just need to keep the loading state
      // visible for ~3-5 seconds while Razorpay webhook lands and reserves the slot.
      // The profile.plan === 'lifetime' check at the top of this component will
      // re-render automatically.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed — please retry')
      setSubmitting(false)
    }
  }

  // Already lifetime → show success state instead of pricing
  if (isLifetime) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <Navbar />
        <div className="page" style={{ maxWidth: 560, paddingTop: 56 }}>
          <Section
            eyebrow={`Founder · #${founderNumber} of 50`}
            title={<>You&rsquo;re a Thalify Founder.</>}
            subtitle={<>Lifetime access is active. 3,000 AI actions every month, every month, forever. Welcome aboard, {currentUser?.name?.split(/\s+/)[0] ?? 'there'}.</>}
            hero
            bottom="var(--space-7)"
          />
          <div style={{ background: 'var(--sage-100)', borderLeft: '3px solid var(--sage-700)', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
            <div style={{ fontSize: 13, color: 'var(--sage-700)', fontWeight: 600, marginBottom: 6 }}>What you&rsquo;ve unlocked</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: 'var(--ink)' }}>
              <li>Unlimited photo scans, Health Buddy chats, lab analysis</li>
              <li>Telegram bot — connect once, log meals + chat from anywhere</li>
              <li>Family meal optimizer + 28-day pattern insights</li>
              <li>Founder badge in the app</li>
            </ul>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            Open Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar />
      <div className="page" style={{ maxWidth: 560, paddingTop: 40 }}>
        <Section
          eyebrow={`Founder offer · ${founderSlots ? `${founderSlots.remaining} of 50 left` : 'Loading…'}`}
          title="Pay once. Use it for life."
          subtitle={<>The first <strong>50 founders</strong> get lifetime Thalify for a single ₹99 payment — no monthly bills, ever. After that, we switch to the regular monthly plan.</>}
          hero
          bottom="var(--space-7)"
        />

        {/* Founder slot urgency bar */}
        {founderSlots && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontFamily: 'var(--mono)' }}>
              <span>{founderSlots.filled}/50 founders so far</span>
              <span style={{ color: founderSlots.remaining < 10 ? 'var(--red, #D94F4F)' : 'var(--sage-700)', fontWeight: 700 }}>
                {founderSlots.remaining} spots left
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--sand)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                width: `${(founderSlots.filled / 50) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--sage-500) 0%, var(--sage-700) 100%)',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}

        {/* Price card */}
        <div style={{ background: 'linear-gradient(135deg, var(--sand) 0%, #FAF6EE 100%)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg, var(--sage-700) 0%, var(--sage-500) 100%)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 44, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>₹99</span>
            <span style={{ fontSize: 15, color: 'var(--muted)' }}>once · lifetime</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.55 }}>
            Charged in INR. Pay via UPI / card / netbanking through Razorpay.
          </div>
          <div style={{ display: 'grid', gap: 14, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)' }}>
            {[
              ['🍽️', '3,000 AI actions every month — scans, chats, analyses'],
              ['📷', 'Unlimited photo scans of Indian meals'],
              ['💬', 'Health Buddy chat in 5 languages — web + Telegram'],
              ['✈️', 'Two-way Telegram bot — log meals from anywhere'],
              ['🧪', 'Lab report analysis with Indian-food guidance'],
              ['📊', 'Family meal optimizer + 28-day pattern insights'],
              ['🏷️', 'Founder badge — your number 1-50 forever'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 17, lineHeight: 1.1 }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--red, #D94F4F)', background: 'var(--red-bg, #FDF2F2)', border: '1px solid var(--red-br, #F5D0D0)', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {isSoldOut ? (
          <button className="btn btn-secondary" disabled style={{ width: '100%' }}>
            All 50 founder spots taken — subscription tier launching soon
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handlePay}
            disabled={submitting}
            style={{ width: '100%', height: 54, fontSize: 15.5 }}
          >
            {submitting ? 'Opening Razorpay…' : 'Pay ₹99 · Become Founder →'}
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
          <span>🔒 Secured by Razorpay</span>
          <span>·</span>
          <span>UPI / Card / Netbanking</span>
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, lineHeight: 1.6, textAlign: 'center' }}>
          Refunds are automatic if all 50 spots are claimed before your payment processes — your money is never at risk.
        </p>
      </div>
    </div>
  )
}
