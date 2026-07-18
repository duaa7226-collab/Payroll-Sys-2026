'use client'

import { useEffect, useState } from 'react'
import { Download, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generatePayslipPDFDownload, generatePayslipPDFBlob } from '@/lib/payslip-pdf'
import { toast } from 'sonner'

// Exact colors from reference PDF
const BLUE = '#1e3a8a'
const ORANGE = '#ea580c'
const LIGHT_BG = '#f8fafc'

// Format number with thousand separators and 2 decimals — matches reference "1,998.00"
function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PayslipPreview({ resultId }: { resultId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch(`/api/payslip?resultId=${resultId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [resultId])

  if (loading || !data) {
    return <div className="p-12 text-center text-muted-foreground">Loading payslip...</div>
  }

  const { result, driver, company, traffic, penalties, customBonuses = [], customDeductions = [] } = data

  const handleDownload = async () => {
    setGenerating(true)
    try {
      await generatePayslipPDFDownload(data)
      toast.success('PDF downloaded')
    } catch (e: any) {
      console.error(e)
      toast.error('Download failed: ' + (e.message || 'unknown error'))
    } finally {
      setGenerating(false)
    }
  }
  const handlePrint = async () => {
    setGenerating(true)
    try {
      const blobUrl = await generatePayslipPDFBlob(data)
      const newWindow = window.open(blobUrl, '_blank')
      if (!newWindow) {
        toast.error('Pop-up blocked — please allow pop-ups to print')
        await generatePayslipPDFDownload(data)
      } else {
        toast.success('PDF opened in new tab — use Ctrl+P or Cmd+P to print')
      }
    } catch (e: any) {
      console.error(e)
      toast.error('Print failed: ' + (e.message || 'unknown error'))
      try { await generatePayslipPDFDownload(data) } catch {}
    } finally {
      setGenerating(false)
    }
  }

  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : '0'
  const salaryPerOrder = result.appliedSalaryPerOrder || (result.appliedBaseSalary / result.appliedMonthlyTarget) || 0

  // Penalties — extract specific ones
  const p = penalties || {}
  const stacking = Math.abs(p.stacking || 0)
  const declined = Math.abs(p.declined || 0)
  const late = Math.abs(p.late || 0)
  const noshow = Math.abs(p.noshow || 0)
  const missedDays = Math.abs(p.missed_days || 0)
  const riderBalance = Math.abs(p.rider_balance || 0)

  // Driver info fields (6 separate bordered boxes, 2x3 grid)
  const driverInfoFields = [
    { ar: 'اسم المستفيد', en: 'BENEFICIARY', val: driver?.beneficiaryName || result.driverName, mono: false },
    { ar: 'معرف المندوب', en: 'RIDER ID', val: result.riderId, mono: true },
    { ar: 'العقد', en: 'CONTRACT', val: result.contractName, mono: true },
    { ar: 'نوع المركبة', en: 'VEHICLE', val: result.vehicleType, mono: false },
    { ar: 'البنك', en: 'BANK', val: driver?.bankName || '—', mono: false },
    { ar: 'الآيبان', en: 'IBAN', val: driver?.iban || '—', mono: true },
  ]

  // Stats fields (1 row of 6, accent bar UNDER each)
  const statsFields = [
    { ar: 'أيام العمل', en: 'Working Days', val: result.actualWorkingDays.toFixed(0), color: BLUE },
    { ar: 'الطلبات المكتملة', en: 'Completed', val: result.completedOrders, color: BLUE },
    { ar: 'الطلبات المتوقعة', en: 'Expected', val: result.selectedTargetThreshold.toFixed(0), color: '#666666' },
    { ar: 'سعر الطلب', en: 'Order Price', val: salaryPerOrder.toFixed(2), color: BLUE },
    { ar: 'طلبات إضافية', en: 'Extra', val: result.extraOrders, color: '#059669' },
    { ar: 'طلبات مفقودة', en: 'Missing', val: result.missingOrders, color: '#dc2626' },
  ]

  // All deductions — ALWAYS SHOWN (matching reference)
  const allDeductions = [
    { ar: 'خصم الطلبات المفقودة', en: 'Missing-Order Deduction', amount: result.missingOrderDeduction },
    { ar: 'خصم التجميع', en: 'Stacking Deduction', amount: stacking },
    { ar: 'الغرامات المرفوضة', en: 'Declined Penalties', amount: declined },
    { ar: 'غرامة التأخير', en: 'Late Penalty', amount: late },
    { ar: 'غرامة عدم الحضور', en: 'No-Show Penalty', amount: noshow },
    { ar: 'غرامة الأيام المفقودة', en: 'Missed-Days Penalty', amount: missedDays },
    { ar: 'خصم رصيد السائق', en: 'Rider Balance Deduction', amount: riderBalance },
    ...(result.trafficViolationsDeduction > 0 ? [{ ar: 'المخالفات المرورية', en: 'Traffic Violations', amount: result.trafficViolationsDeduction }] : []),
    ...customDeductions.map((cd: any) => ({ ar: cd.nameAr || cd.name, en: cd.name, amount: cd.amount })),
  ]

  // Earnings items
  const earningsItems = [
    { ar: 'إجمالي الأرباح من الطلبات', en: `Order Earnings (${result.selectedTargetThreshold.toFixed(0)} × ${salaryPerOrder.toFixed(2)})`, amount: result.baseSalaryEquivalent, sign: '' as const },
    ...(result.bonusAmount > 0 ? [{ ar: 'العمولة الإضافية', en: `Bonus (Extra Orders: ${result.extraOrders} × ${result.appliedBonusPerExtra.toFixed(2)})`, amount: result.bonusAmount, sign: '+' as const }] : []),
    ...((result.segmentPayment || 0) > 0 ? [{ ar: 'دفعة الشريحة', en: 'Segment Payment', amount: result.segmentPayment, sign: '+' as const }] : []),
    ...customBonuses.map((cb: any) => ({ ar: cb.nameAr || cb.name, en: cb.name, amount: cb.amount, sign: '+' as const })),
  ]

  return (
    <div className="space-y-3 p-4 no-print">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payslip Preview · {result.payrollMonth}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={generating}>
            {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-1 h-3.5 w-3.5" />}
            {generating ? 'Generating...' : 'Print'}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
            {generating ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* ===== Printable payslip — Elite Development design (EXACT clone) ===== */}
      <div className="printable-payslip bg-white text-black mx-auto" style={{ width: '800px', height: '1131px', padding: '22px', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-cairo), Cairo, sans-serif' }}>
        {/* ===== HEADER — blue 60% → orange 40% gradient ===== */}
        <div style={{ background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 60%, ${ORANGE} 100%)`, color: 'white', borderRadius: '10px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 3px 10px rgba(30, 58, 138, 0.2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {company?.logo ? (
              <img src={company.logo} alt="Logo" style={{ height: '44px', width: '44px', objectFit: 'contain', background: 'white', padding: '3px', borderRadius: '50%', border: `2px solid ${ORANGE}` }} />
            ) : (
              <div style={{ height: '44px', width: '44px', background: 'white', borderRadius: '50%', border: `2px solid ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE, fontWeight: 800, fontSize: '16px' }}>
                {(company?.name || 'N').charAt(0)}
              </div>
            )}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }} dir="rtl">{company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{company?.name || 'Nokhaba Tatweer for Trading'}</div>
              <div style={{ fontSize: '9px', opacity: 0.9, marginTop: '1px' }}>VAT: {company?.vatNumber || 'N/A'} · {company?.address || 'Riyadh, KSA'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 700 }} dir="rtl">بيان المرتب</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFEEC2' }}>PAYSLIP</div>
            <div style={{ fontSize: '10px', opacity: 0.95, marginTop: '2px' }}>{result.payrollMonth}</div>
          </div>
        </div>

        {/* ===== Driver Info — 6 separate bordered boxes (2 rows × 3 cols), label ABOVE each box ===== */}
        <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', rowGap: '12px', flexShrink: 0 }}>
          {driverInfoFields.map((f, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px', padding: '0 2px' }}>
                <div style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 700, letterSpacing: '0.8px' }}>{f.en}</div>
                <div style={{ fontSize: '11px', color: '#374151', fontWeight: 600 }} dir="rtl">{f.ar}</div>
              </div>
              <div style={{ background: 'white', border: '1px solid #E0E0E0', borderRadius: '6px', padding: '8px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', minHeight: '32px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: f.mono ? '11px' : '13px', fontWeight: 700, color: '#111111', wordBreak: 'break-all', fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.val}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ===== Stats Section — 1 row of 6 cells, accent bar UNDER each ===== */}
        <div style={{ marginTop: '8px', background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
            {statsFields.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '5px 3px', background: LIGHT_BG, borderRadius: '5px', borderBottom: `3px solid ${s.color}` }}>
                <div style={{ fontSize: '9px', color: '#666666', fontWeight: 600 }} dir="rtl">{s.ar}</div>
                <div style={{ fontSize: '8px', color: '#9ca3af' }}>{s.en}</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: s.color, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Earnings + Deductions side-by-side ===== */}
        <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1, minHeight: 0 }}>
          {/* Earnings Card (blue) */}
          <div style={{ background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '7px 12px', background: BLUE, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>EARNINGS</div>
              <div style={{ fontSize: '11px', fontWeight: 600 }} dir="rtl">الأرباح</div>
            </div>
            <div style={{ padding: '8px 12px', flex: 1 }}>
              {earningsItems.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }} dir="rtl">{e.ar}</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>{e.en}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{e.sign} {fmt(e.amount)} SAR</span>
                </div>
              ))}
              {/* Gross Total Row — light bg */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', margin: '6px -12px 0', background: LIGHT_BG, borderTop: `2px solid ${BLUE}` }}>
                <div>
                  <div style={{ fontSize: '13px', color: BLUE, fontWeight: 700 }} dir="rtl">الإجمالي</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Gross</div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{fmt(result.grossSalaryBeforePenalties)} SAR</span>
              </div>
            </div>
          </div>

          {/* Deductions Card (orange) */}
          <div style={{ background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '7px 12px', background: ORANGE, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>DEDUCTIONS</div>
              <div style={{ fontSize: '11px', fontWeight: 600 }} dir="rtl">الخصومات</div>
            </div>
            <div style={{ padding: '8px 12px', flex: 1 }}>
              {allDeductions.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }} dir="rtl">{d.ar}</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>{d.en}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>– {fmt(d.amount)} SAR</span>
                </div>
              ))}
              {/* Total Deductions Row — light bg */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 12px', margin: '6px -12px 0', background: LIGHT_BG, borderTop: `2px solid ${ORANGE}` }}>
                <div>
                  <div style={{ fontSize: '13px', color: ORANGE, fontWeight: 700 }} dir="rtl">إجمالي الخصومات</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Total Deductions</div>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalDeductions)} SAR</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Traffic Detail (if any) — with installment info ===== */}
        {traffic && traffic.length > 0 && (
          <div style={{ marginTop: '8px', background: 'white', border: '1px solid #E0E0E0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexShrink: 0 }}>
            <div style={{ padding: '5px 12px', background: '#FEF3E2', borderBottom: `2px solid ${ORANGE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', letterSpacing: '0.5px' }}>TRAFFIC TICKETS</div>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }} dir="rtl">تفاصيل المخالفات</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#FEF3E2', color: '#92400e' }}>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Mode</th>
                  <th style={{ textAlign: 'right', padding: '3px 12px', fontSize: '9px' }}>Total (SAR)</th>
                  <th style={{ textAlign: 'right', padding: '3px 12px', fontSize: '9px' }}>This Month (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((t: any) => {
                  const isInst = t.installmentEnabled
                  const remaining = isInst ? Math.max(0, t.amount - (t.installmentTotalPaid || 0)) : 0
                  const monthly = isInst && t.installmentStatus === 'active'
                    ? Math.min(t.installmentMonthlyAmount || 0, remaining)
                    : (isInst ? 0 : t.amount)
                  const modeLabel = isInst
                    ? (t.installmentStatus === 'completed' ? 'Installment ✓' : 'Installment')
                    : 'One-time'
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '3px 12px', fontSize: '9px' }}>{new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '3px 12px', fontSize: '9px' }}>{t.violationType}</td>
                      <td style={{ padding: '3px 12px', fontSize: '9px' }}>
                        {modeLabel}
                        {isInst && t.installmentStatus !== 'completed' && (
                          <div style={{ fontSize: '7px', color: '#9ca3af' }}>Paid: {(t.installmentTotalPaid || 0).toFixed(0)} / {t.amount.toFixed(0)}</div>
                        )}
                      </td>
                      <td style={{ padding: '3px 12px', fontSize: '9px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isInst ? '#92400e' : '#111' }}>{t.amount.toFixed(2)}</td>
                      <td style={{ padding: '3px 12px', fontSize: '9px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: ORANGE }}>{monthly.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== Net Payable Salary — same gradient as header ===== */}
        <div style={{ marginTop: '10px', background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 60%, ${ORANGE} 100%)`, borderRadius: '10px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 3px 12px rgba(30, 58, 138, 0.25)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }} dir="rtl">الراتب الصافي المستحق</div>
            <div style={{ fontSize: '11px', color: '#FFEEC2', marginTop: '1px' }}>Net Payable Salary · {result.payrollMonth}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.75)', marginTop: '3px' }}>Generated: {new Date().toLocaleDateString('en-GB')} · Attainment: {attainmentPct}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmt(result.finalNetSalary)}</div>
            <div style={{ fontSize: '12px', color: '#FFEEC2', fontWeight: 600, marginTop: '2px' }}>SAR</div>
          </div>
        </div>

        {/* ===== Signature Section — 3 columns: Mgr | Stamp | Driver ===== */}
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Accounting Manager */}
          <div style={{ textAlign: 'center' }}>
            {company?.signatureImg ? (
              <div style={{ height: '34px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '3px' }}>
                <img src={company.signatureImg} alt="Accounting Manager Signature" style={{ maxHeight: '32px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '34px', borderBottom: `1.5px solid ${BLUE}`, marginBottom: '3px' }} />
            )}
            <div style={{ fontSize: '10px', color: '#666666', fontWeight: 600 }}>ACCOUNTING MANAGER</div>
            <div style={{ fontSize: '10px', color: '#666666' }} dir="rtl">مدير الحسابات</div>
          </div>
          {/* Center Stamp */}
          <div style={{ textAlign: 'center' }}>
            {company?.stampImg ? (
              <div style={{ height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3px' }}>
                <img src={company.stampImg} alt="Stamp" style={{ maxHeight: '54px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '54px', width: '54px', margin: '0 auto 3px', border: `2px dashed ${ORANGE}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: ORANGE }}>
                <div style={{ fontSize: '8px', fontWeight: 700 }}>{(company?.name || 'NT').slice(0, 6)}</div>
                <div style={{ fontSize: '7px' }}>KSA</div>
              </div>
            )}
            <div style={{ fontSize: '9px', color: '#9ca3af' }}>{company?.name || 'Nokhaba Tatweer'}</div>
          </div>
          {/* Rider Signature */}
          <div style={{ textAlign: 'center' }}>
            {company?.riderSignatureImg ? (
              <div style={{ height: '34px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '3px' }}>
                <img src={company.riderSignatureImg} alt="Driver Signature" style={{ maxHeight: '32px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '34px', borderBottom: `1.5px solid ${BLUE}`, marginBottom: '3px' }} />
            )}
            <div style={{ fontSize: '10px', color: '#666666', fontWeight: 600 }}>RIDER SIGNATURE</div>
            <div style={{ fontSize: '10px', color: '#666666' }} dir="rtl">توقيع السائق</div>
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div style={{ marginTop: '10px', paddingTop: '6px', borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', color: '#9ca3af', flexShrink: 0 }}>
          <div>{company?.name || 'Nokhaba Tatweer for Trading'} — <span dir="rtl">{company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</span></div>
          <div>Generated {new Date().toLocaleDateString('en-GB')} · {company?.footerNote || 'Computer-generated payslip'}</div>
        </div>
      </div>
    </div>
  )
}
