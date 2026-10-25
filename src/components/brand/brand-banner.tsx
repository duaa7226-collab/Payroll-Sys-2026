'use client'

import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { brandInitials, type Branding } from '@/lib/branding'

/**
 * Company logo tile. Renders the uploaded logo when present, otherwise a
 * monogram derived from the company name — so the sign-in screen and the app
 * header always look intentional, even before a logo is uploaded.
 */
export function BrandMark({
  branding,
  size = 40,
  className,
}: {
  branding: Branding
  size?: number
  className?: string
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-2xl',
        branding.logo
          ? 'bg-white ring-1 ring-black/5 shadow-sm'
          : 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-emerald-900/20 ring-1 ring-white/20',
        className
      )}
    >
      {branding.logo ? (
        <img
          src={branding.logo}
          alt={`${branding.name} logo`}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span
          style={{ fontSize: Math.round(size * 0.36) }}
          className="font-semibold tracking-tight text-white"
        >
          {brandInitials(branding.name)}
        </span>
      )}
    </div>
  )
}

/**
 * The branded panel shown on the sign-in screen (and previewed in Company
 * Branding). Uses the uploaded logo, company name and Arabic name so the
 * banner always reflects the company rather than the product.
 */
export function BrandBanner({
  branding,
  className,
}: {
  branding: Branding
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative isolate flex h-full min-h-[420px] flex-col justify-between overflow-hidden bg-emerald-950 p-8 text-emerald-50/90 sm:p-10',
        className
      )}
    >
      {/* Aurora + grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1100px 560px at 15% -10%, oklch(0.6 0.17 165 / 0.55), transparent 62%),' +
            'radial-gradient(900px 520px at 95% 112%, oklch(0.65 0.15 195 / 0.4), transparent 60%),' +
            'linear-gradient(160deg, oklch(0.22 0.05 165) 0%, oklch(0.15 0.03 200) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/3 -z-10 h-72 w-72 rounded-full border border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-1/3 -z-10 h-44 w-44 rounded-full border border-white/10"
      />

      {/* Brand row */}
      <header className="flex items-center gap-3">
        <BrandMark branding={branding} size={44} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-white">
            {branding.name}
          </div>
          <div className="text-[11px] text-emerald-100/60">
            Nokhaba Payroll · 2026 Enterprise
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-50 backdrop-blur">
          <Sparkles className="h-3 w-3" aria-hidden />
          Saudi logistics payroll
        </span>
        <p className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight text-white">
          One system for every payroll decision.
        </p>
        {branding.nameAr && (
          <p
            dir="rtl"
            className="mt-3 text-sm text-emerald-100/70"
            style={{ fontFamily: 'var(--font-arabic)' }}
          >
            {branding.nameAr}
          </p>
        )}
        <ul className="mt-8 space-y-3 text-sm text-emerald-100/75">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
            Centralized rules engine with immutable rule snapshots
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
            Bilingual payslips, traffic deductions and monthly imports
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden />
            Income vs expenses with per-driver cost allocation
          </li>
        </ul>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11px] text-emerald-100/50">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Audited access · © {new Date().getFullYear()} {branding.name}
        </span>
        <span dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>
          {branding.nameAr}
        </span>
      </footer>
    </div>
  )
}
