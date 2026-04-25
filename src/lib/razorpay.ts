/**
 * Lazy-loads Razorpay's Checkout JS from their CDN. Returns the global
 * Razorpay constructor — call `new Razorpay(options).open()` to launch
 * the overlay.
 *
 * We don't bundle their script so the initial page load isn't affected
 * (their JS is ~150KB, only fetched when the user clicks "Pay").
 */

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string
  order_id: string
  handler: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  notes?: Record<string, string>
  theme?: {
    color?: string
    backdrop_color?: string
  }
  modal?: {
    ondismiss?: () => void
    confirm_close?: boolean
    backdropclose?: boolean
  }
}

type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', handler: (response: { error: { description?: string; reason?: string; code?: string } }) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

let scriptPromise: Promise<void> | null = null

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Razorpay script failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export type CheckoutSuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<CheckoutSuccess | null> {
  await loadRazorpayScript()
  if (!window.Razorpay) throw new Error('Razorpay not loaded')

  const Razorpay = window.Razorpay
  return new Promise((resolve) => {
    let resolved = false
    const inst = new Razorpay({
      ...options,
      handler: (response) => {
        resolved = true
        resolve(response as CheckoutSuccess)
      },
      modal: {
        ...(options.modal ?? {}),
        ondismiss: () => {
          if (!resolved) resolve(null) // user closed without paying
          options.modal?.ondismiss?.()
        },
      },
    })
    inst.on('payment.failed', () => {
      if (!resolved) resolve(null)
    })
    inst.open()
  })
}
