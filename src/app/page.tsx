'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { sonnerToast } from '@/lib/sonner'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Settings2,
  FileText,
  CarFront,
  Upload,
  ScrollText,
  Building2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Target,
  Shield,
  Activity,
  ArrowRightLeft,
  Scale,
  Receipt,
} from 'lucide-react'
import { DashboardView } from '@/components/payroll/dashboard-view'
import { DriversView } from '@/components/payroll/drivers-view'
import { DriversRegistrationView } from '@/components/payroll/drivers-registration-view'
import { RulesControlCenter } from '@/components/payroll/rules-control-center'
import { PayslipsView } from '@/components/payroll/payslips-view'
import { TrafficViolationsView } from '@/components/payroll/traffic-violations-view'
import { ImportView } from '@/components/payroll/import-view'
import { AuditLogsView } from '@/components/payroll/audit-logs-view'
import { CompanyBrandingView } from '@/components/payroll/company-branding-view'
import { ExceptionsView } from '@/components/payroll/exceptions-view'
import { IncomeExpensesView } from '@/components/payroll/income-expenses-view'
import { ManualAdjustmentsView } from '@/components/payroll/manual-adjustments-view'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANDING, type Branding } from '@/lib/branding'
import { BrandMark } from '@/components/brand/brand-banner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, CircleUser } from 'lucide-react'

// Dynamically import the Map Rider page (avoids pulling xlsx into the main bundle)
const MapRiderPage = dynamic(() => import('./finance/map-rider/page').then(m => m.default), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-muted-foreground">Loading...</div>,
})

type TabId =
  | 'dashboard'
  | 'drivers'
  | 'drivers_registration'
  | 'manual_adjustments'
  | 'income_expenses'
  | 'rules'
  | 'payslips'
  | 'traffic'
  | 'map_rider'
  | 'import'
  | 'exceptions'
  | 'audit'
  | 'company'

const TABS: { id: TabId; label: string; labelAr: string; icon: any; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة القيادة', icon: LayoutDashboard, group: 'main' },
  { id: 'drivers', label: 'Driver Results', labelAr: 'نتائج السائقين', icon: Users, group: 'main' },
  { id: 'drivers_registration', label: 'Drivers Registration', labelAr: 'تسجيل السائقين', icon: UserPlus, group: 'main' },
  { id: 'manual_adjustments', label: 'Manual Adjustments', labelAr: 'التعديلات اليدوية', icon: Receipt, group: 'main' },
  { id: 'payslips', label: 'Payslips', labelAr: 'قسائم الرواتب', icon: FileText, group: 'main' },
  { id: 'income_expenses', label: 'Income vs Expenses', labelAr: 'دخل ومصروفات', icon: Scale, group: 'main' },
  { id: 'exceptions', label: 'Exceptions', labelAr: 'الاستثناءات', icon: AlertTriangle, group: 'main' },
  { id: 'rules', label: 'Rules Control Center', labelAr: 'مركز القواعد', icon: Settings2, group: 'config' },
  { id: 'traffic', label: 'Traffic Violations', labelAr: 'المخالفات المرورية', icon: CarFront, group: 'config' },
  { id: 'map_rider', label: 'Map Rider Calculations', labelAr: 'تعيين حسابات المندوبين', icon: ArrowRightLeft, group: 'config' },
  { id: 'import', label: 'Monthly Import', labelAr: 'الاستيراد الشهري', icon: Upload, group: 'config' },
  { id: 'company', label: 'Company Branding', labelAr: 'هوية الشركة', icon: Building2, group: 'config' },
  { id: 'audit', label: 'Audit Logs', labelAr: 'سجل التدقيق', icon: ScrollText, group: 'config' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [runId, setRunId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [session, setSession] = useState<{ email: string; role: string } | null>(null)
  const [quickKpis, setQuickKpis] = useState<{ drivers: string; payroll: string; mode: string; rules: string }>({
    drivers: '—', payroll: '—', mode: '—', rules: '—',
  })
  const [signingOut, setSigningOut] = useState(false)
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)

  // Load session + latest run / KPIs + company branding
  useEffect(() => {
    fetch('/api/branding')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.branding) setBranding(d.branding as Branding)
      })
      .catch(() => {})
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => {
        if (d?.user) setSession(d.user)
      })
      .catch(() => {})
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d?.run?.id) setRunId(d.run.id)
        const k = d?.kpis
        const mode = String(d?.ruleSummary?.salaryMode ?? '').replace('_mode', '').replace(/^./, c => c.toUpperCase())
        setQuickKpis({
          drivers: k ? String(k.totalDrivers) : '—',
          payroll: k && typeof k.totalNet === 'number' ? `SAR ${k.totalNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
          mode: d?.ruleSummary?.salaryMode ? mode : '—',
          rules: d?.ruleSummary?.ruleSetName ? 'Active' : '—',
        })
      })
      .catch(() => {})
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } catch {
      // Continue to the login page regardless — cookies are cleared there.
    }
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-bg">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          {/* Company logo / brand */}
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark branding={branding} size={40} />
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold tracking-tight">{branding.name}</div>
              <div className="text-[11px] text-muted-foreground">Payroll &amp; Operations · 2026</div>
            </div>
          </div>

          {/* Center: Quick KPIs (real data from the latest payroll run) */}
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <QuickStat icon={Users} label="Drivers" value={quickKpis.drivers} color="text-chart-1" />
            <QuickStat icon={Wallet} label="Net Payroll" value={quickKpis.payroll} color="text-chart-2" />
            <QuickStat icon={TrendingUp} label="Mode" value={quickKpis.mode} color="text-chart-3" />
            <QuickStat icon={Shield} label="Rules" value={quickKpis.rules} color="text-emerald-600" />
          </div>

          {/* Account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'ml-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-accent',
                  signingOut && 'opacity-60'
                )}
                aria-label="Account menu"
              >
                <CircleUser className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="truncate text-sm font-medium">{session?.email ?? 'Account'}</p>
                  <p className="text-xs capitalize text-muted-foreground">Role: {session?.role ?? '—'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleSignOut()} disabled={signingOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile sidebar toggle */}
          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed md:sticky top-16 z-30 h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border bg-card/50 backdrop-blur-xl transition-transform',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Operations
            </div>
            {TABS.filter(t => t.group === 'main').map(t => (
              <TabButton key={t.id} tab={t} active={activeTab === t.id} onClick={() => { setActiveTab(t.id); setSidebarOpen(false) }} />
            ))}
            <div className="px-3 py-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Configuration
            </div>
            {TABS.filter(t => t.group === 'config').map(t => (
              <TabButton key={t.id} tab={t} active={activeTab === t.id} onClick={() => { setActiveTab(t.id); setSidebarOpen(false) }} />
            ))}

            <div className="mt-auto p-3">
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System</div>
                <div className="mt-1 text-xs">v2026.1 · Premium</div>
                <div className="text-[10px] text-muted-foreground">Production-ready</div>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {activeTab === 'dashboard' && <DashboardView runId={runId} setRunId={setRunId} onNavigate={setActiveTab} />}
          {activeTab === 'drivers' && <DriversView runId={runId} setRunId={setRunId} onNavigate={setActiveTab} />}
          {activeTab === 'drivers_registration' && <DriversRegistrationView />}
          {activeTab === 'manual_adjustments' && <ManualAdjustmentsView />}
          {activeTab === 'income_expenses' && <IncomeExpensesView />}
          {activeTab === 'rules' && <RulesControlCenter />}
          {activeTab === 'payslips' && <PayslipsView runId={runId} />}
          {activeTab === 'traffic' && <TrafficViolationsView />}
          {activeTab === 'map_rider' && <MapRiderPage />}
          {activeTab === 'import' && <ImportView onImported={(id) => { setRunId(id); setActiveTab('dashboard') }} />}
          {activeTab === 'exceptions' && <ExceptionsView runId={runId} />}
          {activeTab === 'audit' && <AuditLogsView />}
          {activeTab === 'company' && <CompanyBrandingView />}
        </main>
      </div>
    </div>
  )
}

function QuickStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold">{value}</span>
      </div>
    </div>
  )
}

function TabButton({ tab, active, onClick }: { tab: any; active: boolean; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{tab.label}</span>
    </button>
  )
}
