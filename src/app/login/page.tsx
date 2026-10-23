'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Wallet, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Notice = { kind: 'error' | 'warning' | 'success'; text: string } | null

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  )
}

function LoginView() {
  const [mode, setMode] = useState<'sign-in' | 'forgot'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [notice, setNotice] = useState<Notice>(null)
  const [submitting, setSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Read URL context once (banners for not-configured / bad auth link, ?next target)
  const [urlState, setUrlState] = useState<{ reason: string | null; next: string; error: string | null }>({
    reason: null, next: '/', error: null,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextParam = params.get('next') ?? '/'
    setUrlState({
      reason: params.get('reason'),
      next: /^\/(?!\/)/.test(nextParam) ? nextParam : '/',
      error: params.get('error'),
    })
    if (params.get('reason') === 'not-configured') {
      setNotice({
        kind: 'warning',
        text: 'Authentication is not configured on this deployment yet. Supabase environment variables are required (see .env.example).',
      })
    } else if (params.get('error') === 'link') {
      setNotice({ kind: 'error', text: 'This sign-in link is invalid or has expired. Please sign in again.' })
    }
  }, [])

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    const errors: typeof fieldErrors = {}
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.'
    if (password.length === 0) errors.password = 'Password is required.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setNotice(null)
    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setNotice({ kind: 'error', text: data?.error ?? 'Sign-in failed. Please try again.' })
        return
      }
      // Full navigation so middleware picks up the fresh session cookie.
      window.location.href = urlState.next
    } catch {
      setNotice({ kind: 'error', text: 'Network error. Check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setFieldErrors({ email: 'Enter a valid email address.' })
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    setNotice(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) {
        setNotice({ kind: 'error', text: 'Could not start password recovery. Please try again.' })
        return
      }
      setEmailSent(true)
      setNotice({
        kind: 'success',
        text: `If an account exists for ${email.trim()}, a recovery email has been sent (check Spam if it does not arrive).`,
      })
    } catch {
      setNotice({ kind: 'error', text: 'Network error. Check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const dim = submitting

  if (emailSent) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Check your email</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a password recovery link. The link works once and expires shortly for security.
            </p>
          </div>
          <Button variant="outline" className="mt-2" onClick={() => { setEmailSent(false); setMode('sign-in'); setNotice(null) }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>

      {notice && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-2.5 rounded-lg border p-3 text-[13px] leading-snug',
            notice.kind === 'error' && 'border-red-200 bg-red-50 text-red-700',
            notice.kind === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
            notice.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800'
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{notice.text}</span>
        </div>
      )}

      <h1 className="sr-only">{mode === 'sign-in' ? 'Sign in' : 'Password recovery'}</h1>

      {mode === 'sign-in' ? (
        <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-foreground">Work email</label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@nokhaba.com"
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              aria-invalid={!!fieldErrors.email}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={dim}
              autoFocus
              className="h-10"
            />
            {fieldErrors.email && <p id="email-error" className="text-xs text-red-600">{fieldErrors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-foreground">Password</label>
              <button
                type="button"
                className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => { setMode('forgot'); setNotice(null); setFieldErrors({}) }}
                disabled={dim}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                aria-invalid={!!fieldErrors.password}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={dim}
                className="h-10 pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {fieldErrors.password && <p id="password-error" className="text-xs text-red-600">{fieldErrors.password}</p>}
          </div>

          <Button type="submit" className="h-10 w-full" disabled={dim}>
            {dim ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Signing in…</> : 'Sign in'}
          </Button>

          <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Access is restricted to authorized members of Nokhaba Tatweer.
          </p>
        </form>
      ) : (
        <form onSubmit={handleForgot} noValidate className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Reset your password</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Enter your work email and we&apos;ll send you a recovery link.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-email" className="text-[13px] font-medium text-foreground">Work email</label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@nokhaba.com"
              aria-describedby={fieldErrors.email ? 'reset-email-error' : undefined}
              aria-invalid={!!fieldErrors.email}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={dim}
              autoFocus
              className="h-10"
            />
            {fieldErrors.email && <p id="reset-email-error" className="text-xs text-red-600">{fieldErrors.email}</p>}
          </div>
          <Button type="submit" className="h-10 w-full" disabled={dim}>
            {dim ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Sending…</> : 'Send recovery link'}
          </Button>
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => { setMode('sign-in'); setNotice(null); setFieldErrors({}) }}
            disabled={dim}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-emerald-950 lg:block" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 600px at 20% -10%, oklch(0.55 0.17 165 / 0.55), transparent 60%),' +
              'radial-gradient(900px 500px at 90% 110%, oklch(0.62 0.14 165 / 0.35), transparent 60%),' +
              'linear-gradient(160deg, oklch(0.22 0.05 165) 0%, oklch(0.16 0.03 200) 100%)',
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-emerald-50/90">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-white">Nokhaba Payroll</div>
              <div className="text-[11px] text-emerald-100/60">2026 Enterprise · Saudi Logistics</div>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight text-white">
              One system for every payroll decision.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-emerald-100/70">
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Centralized rules engine with immutable rule snapshots
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Bilingual payslips, traffic deductions and monthly imports
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Income vs expenses with per-driver cost allocation
              </li>
            </ul>
          </div>

          <div className="text-xs text-emerald-100/50">
            © {new Date().getFullYear()} Nokhaba Tatweer for Trading · مؤسسة نخبة التطوير للتجارة
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-gradient-bg p-4 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Nokhaba Payroll</div>
              <div className="text-[11px] text-muted-foreground">2026 Enterprise · Saudi Logistics</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Authorized users only. All activity is audited.
          </p>
        </div>
      </div>
    </div>
  )
}
