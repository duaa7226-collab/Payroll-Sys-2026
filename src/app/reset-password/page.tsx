'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Loader2, AlertCircle, Wallet } from 'lucide-react'
import { getSupabaseBrowserClient, SUPABASE_ENV_CONFIGURED } from '@/lib/supabase/client'

/**
 * Reached from the Supabase recovery email via /auth/callback?next=/reset-password.
 * The recovery code is exchanged by the callback, so the user arrives with a
 * temporary session granted only to update their password.
 */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'ready' | 'invalid' | 'submitting' | 'done'>('ready')
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    // Anonymous visitors cannot update a password — the callback must grant the
    // recovery session first.
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    ;(async () => {
      try {
        await sleep(600)
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          setStatus('invalid')
        }
      } catch {
        setStatus('invalid')
      }
    })()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErrorText('Use at least 8 characters.'); return }
    if (password !== confirm) { setErrorText('Passwords do not match.'); return }
    setErrorText('')
    setStatus('submitting')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setStatus('ready')
        setErrorText('Could not update the password. The recovery link may have expired — request a new one.')
        return
      }
      await supabase.auth.signOut()
      setStatus('done')
    } catch {
      setStatus('ready')
      setErrorText('Network error. Check your connection and try again.')
    }
  }

  if (!SUPABASE_ENV_CONFIGURED || status === 'invalid') {
    return (
      <Shell>
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>This password reset page requires a valid recovery link. Request a new one from the sign-in page.</span>
        </div>
        <Button className="mt-4 w-full h-10" onClick={() => (window.location.href = '/login')}>Back to sign in</Button>
      </Shell>
    )
  }

  if (status === 'done') {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Password updated</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been changed. Please sign in with your new password.
          </p>
        </div>
        <Button className="mt-5 w-full h-10" onClick={() => (window.location.href = '/login')}>Go to sign in</Button>
      </Shell>
    )
  }

  return (
    <Shell>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Choose a strong password of at least 8 characters.</p>
      </div>

      {errorText && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errorText}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-[13px] font-medium">New password</label>
          <div className="relative">
            <Input
              id="new-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              disabled={status === 'submitting'}
              className="h-10 pr-10"
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-[13px] font-medium">Confirm password</label>
          <Input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            minLength={8}
            required
            disabled={status === 'submitting'}
            className="h-10"
          />
        </div>
        <Button type="submit" className="h-10 w-full" disabled={status === 'submitting'}>
          {status === 'submitting' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Updating…</> : 'Update password'}
        </Button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Nokhaba Payroll</div>
            <div className="text-[11px] text-muted-foreground">2026 Enterprise · Saudi Logistics</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </div>
  )
}
