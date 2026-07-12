'use client'

import { useEffect, useState } from 'react'
import { Download, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generatePayslipPDFDownload, generatePayslipPDFBlob } from '@/lib/payslip-pdf'
import { toast } from 'sonner'

const PENALTY_LABELS: Record<string, { en: string; ar: string }> = {
  acceptance: { en: 'Acceptance Penalty', ar: 'غرامة معدل القبول' },
  contact: { en: 'Contact Penalty', ar: 'غرامة معدل التواصل' },
  stacking: { en: 'Stacking Deduction', ar: 'خصم الطلبات المتعددة' },
  declined: { en: 'Declined Penalty', ar: 'غرامة الرفض' },
  late: { en: 'Late Penalty', ar: 'غرامة التأخير' },
  noshow: { en: 'No-Show Penalty', ar: 'غرامة عدم الحضور' },
  noshow_special: { en: 'No-Show Special Cities', ar: 'غرامة عدم الحضور للمدن الخاصة' },
  daily_acceptance: { en: 'Daily Acceptance Penalty', ar: 'غرامة معدل القبول اليومي' },
  missed_days: { en: 'Missed Days Penalty', ar: 'غرامة الأيام المفقودة' },
  rider_balance: { en: 'Rider Balance Deduction', ar: 'خصم رصيد المندوب' },
  car_deduction: { en: 'Car Deduction', ar: 'خصم السيارة' },
  tga_deduction: { en: 'TGA Deduction', ar: 'خصم TGA' },
}

const BAND_LABELS: Record<string, { en: string; ar: string }> = {
  top: { en: 'Top Performer', ar: 'أفضل أداء' },
  high: { en: 'High', ar: 'عالي' },
  average: { en: 'Average', ar: 'متوسط' },
  low: { en: 'Low', ar: 'منخفض' },
  bottom: { en: 'Bottom', ar: 'الأقل' },
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

  const penaltyEntries = Object.entries(penalties).filter(([_, v]) => (v as number) > 0)
  const baseSalaryLabel = result.salaryDivisorMode === 'orders_based_mode' ? 'Base Salary' : 'Adjusted Base Salary'
  const baseSalaryValue = result.salaryDivisorMode === 'orders_based_mode'
    ? result.baseSalaryEquivalent
    : result.adjustedBaseSalary
  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : 'N/A'
  const band = BAND_LABELS[result.performanceBand] ?? { en: result.performanceBand, ar: '' }

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

      {/* The actual printable payslip — premium, modern, fills one A4 page */}
      <div className="printable-payslip bg-white text-black mx-auto" style={{ width: '800px', height: '1131px', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-cairo), Cairo, sans-serif' }}>
        {/* ===== Premium Header ===== */}
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)', color: 'white', padding: '18px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.75, fontWeight: 500 }}>
              Salary Statement · <span dir="rtl">كشف راتب</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '3px', letterSpacing: '-0.5px' }}>
              {company?.name || 'Nokhaba Tatweer for Trading'}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '1px' }} dir="rtl">
              {company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}
            </div>
            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '4px', letterSpacing: '0.3px' }}>
              {company?.address || 'Riyadh, Saudi Arabia'} · VAT: {company?.vatNumber || 'N/A'}
            </div>
          </div>
          <div style={{ textAlign: 'right', position: 'relative' }}>
            {company?.logo ? (
              <div style={{ marginBottom: '6px' }}>
                <img src={company.logo} alt="Logo" style={{ maxHeight: '48px', maxWidth: '110px', objectFit: 'contain', background: 'white', padding: '5px', borderRadius: '6px' }} />
              </div>
            ) : null}
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '5px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '8px', opacity: 0.85, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Pay Period</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{result.payrollMonth}</div>
            </div>
          </div>
        </div>

        {/* ===== Driver Identity ===== */}
        <div style={{ padding: '10px 30px', background: 'linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[
              { en: 'Driver Name', ar: 'اسم السائق', val: result.driverName, mono: false },
              { en: 'Rider ID', ar: 'معرف المندوب', val: result.riderId, mono: true },
              { en: 'Contract', ar: 'العقد', val: result.contractName, mono: true },
              { en: 'Vehicle Type', ar: 'نوع المركبة', val: result.vehicleType, mono: false },
            ].map((info, i) => (
              <div key={i} style={{ padding: '6px 10px', background: 'white', borderRadius: '6px', borderLeft: '3px solid #047857', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', fontWeight: 600 }}>{info.en}</div>
                <div style={{ fontSize: '8px', color: '#9ca3af' }} dir="rtl">{info.ar}</div>
                <div style={{ fontSize: info.mono ? '11px' : '13px', fontWeight: 700, marginTop: '2px', color: '#111827', fontFamily: info.mono ? 'monospace' : 'inherit' }}>{info.val}</div>
              </div>
            ))}
          </div>
          {/* Performance strip */}
          <div style={{ marginTop: '8px', padding: '5px 12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 500 }}>Performance: </span>
              <span style={{ fontWeight: 700, color: '#065f46' }}>{band.en}</span>
              <span style={{ color: '#9ca3af', marginLeft: '4px' }} dir="rtl">({band.ar})</span>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontWeight: 500 }}>Target Attainment: </span>
              <span style={{ fontWeight: 700, color: '#065f46' }}>{attainmentPct}%</span>
            </div>
          </div>
        </div>

        {/* ===== Body two columns ===== */}
        <div style={{ padding: '12px 30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
          {/* Working Summary */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '2px solid #064e3b' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#064e3b', textTransform: 'uppercase' }}>Working Summary</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }} dir="rtl">ملخص العمل</div>
            </div>
            {[
              { en: 'Completed Orders', ar: 'الطلبات المكتملة', val: result.completedOrders, color: '#111827' },
              { en: 'Target Orders', ar: 'الهدف', val: result.selectedTargetThreshold.toFixed(0), color: '#6b7280' },
              { en: 'Working Days', ar: 'أيام العمل', val: result.actualWorkingDays.toFixed(0), color: '#111827' },
              { en: 'Working Hours', ar: 'ساعات العمل', val: result.workingHours.toFixed(1), color: '#111827' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>{row.en}</span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">{row.ar}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{row.val}</span>
              </div>
            ))}
            {result.inactiveReason && result.inactiveReason !== 'Active' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>Inactive Reason</span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">سبب عدم النشاط</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#dc2626' }}>{result.inactiveReason}</span>
              </div>
            )}
          </div>

          {/* Earnings */}
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '2px solid #064e3b' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#064e3b', textTransform: 'uppercase' }}>Earnings</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }} dir="rtl">الأرباح</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>{baseSalaryLabel}</span>
                <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">الراتب الأساسي</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>SAR {baseSalaryValue.toFixed(2)}</span>
            </div>
            {result.bonusAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>Performance Bonus</span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">مكافأة الأداء</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>+SAR {result.bonusAmount.toFixed(2)}</span>
              </div>
            )}
            {(result.segmentPayment || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#374151', fontWeight: 500 }}>Segment Payment</span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">دفعة الشريحة</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0891b2', fontVariantNumeric: 'tabular-nums' }}>+SAR {result.segmentPayment.toFixed(2)}</span>
              </div>
            )}
            {customBonuses.map((cb: any, i: number) => (
              <div key={`cb-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#374151' }}>{cb.name}</span>
                  {cb.nameAr && <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">{cb.nameAr}</span>}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>+SAR {cb.amount.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '2px solid #064e3b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#374151', fontWeight: 700 }}>Gross Salary</span>
                  <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">إجمالي الراتب</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#064e3b', fontVariantNumeric: 'tabular-nums' }}>SAR {result.grossSalaryBeforePenalties.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Deductions table ===== */}
        <div style={{ padding: '0 30px 8px', flexShrink: 0 }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '6px 12px', background: 'linear-gradient(90deg, #fef2f2 0%, #ffffff 100%)', borderBottom: '2px solid #b91c1c' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#b91c1c', textTransform: 'uppercase' }}>
                Deductions · <span style={{ color: '#6b7280', fontWeight: 500 }} dir="rtl">الخصومات</span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#fef2f2', color: '#7f1d1d' }}>
                  <th style={{ textAlign: 'left', padding: '4px 10px', fontWeight: 600, fontSize: '9px' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 600, fontSize: '9px' }}>Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {result.missingOrderDeduction > 0 && (
                  <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fff7ed' }}>
                    <td style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 500 }}>
                      Missing Order Deduction <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">خصم الطلبات الناقصة</span>
                    </td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#9a3412', fontSize: '10px', fontWeight: 600 }}>-{result.missingOrderDeduction.toFixed(2)}</td>
                  </tr>
                )}
                {penaltyEntries.map(([key, val]) => {
                  const lbl = PENALTY_LABELS[key] ?? { en: key, ar: '' }
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 10px', fontSize: '10px' }}>
                        {lbl.en} <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">{lbl.ar}</span>
                      </td>
                      <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c', fontSize: '10px', fontWeight: 600 }}>-{(val as number).toFixed(2)}</td>
                    </tr>
                  )
                })}
                {result.trafficViolationsDeduction > 0 && (
                  <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
                    <td style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 500 }}>
                      Traffic Violations <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">المخالفات المرورية</span>
                    </td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#92400e', fontSize: '10px', fontWeight: 600 }}>-{result.trafficViolationsDeduction.toFixed(2)}</td>
                  </tr>
                )}
                {customDeductions.map((cd: any, i: number) => (
                  <tr key={`cd-${i}`} style={{ borderBottom: '1px solid #f3f4f6', background: '#fef3c7' }}>
                    <td style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 500 }}>
                      {cd.name} {cd.nameAr && <span style={{ fontSize: '9px', color: '#9ca3af', marginLeft: '4px' }} dir="rtl">{cd.nameAr}</span>}
                    </td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b45309', fontSize: '10px', fontWeight: 600 }}>-{cd.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {penaltyEntries.length === 0 && result.missingOrderDeduction === 0 && result.trafficViolationsDeduction === 0 && customDeductions.length === 0 && (
                  <tr><td colSpan={2} style={{ padding: '8px 10px', textAlign: 'center', color: '#9ca3af', fontSize: '10px' }}>No deductions applied · لا توجد خصومات</td></tr>
                )}
                <tr style={{ fontWeight: 800, background: '#fef2f2', color: '#7f1d1d' }}>
                  <td style={{ padding: '6px 10px', borderTop: '2px solid #b91c1c' }}>
                    <span style={{ fontSize: '10px' }}>Total Deductions</span>
                    <span style={{ fontSize: '9px', color: '#7f1d1d', marginLeft: '4px' }} dir="rtl">إجمالي الخصومات</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #b91c1c', fontSize: '11px' }}>-{totalDeductions.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== Traffic detail (if any) ===== */}
        {traffic && traffic.length > 0 && (
          <div style={{ padding: '0 30px 8px', flexShrink: 0 }}>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '5px 12px', background: 'linear-gradient(90deg, #fffbeb 0%, #ffffff 100%)', borderBottom: '2px solid #92400e' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#92400e', textTransform: 'uppercase' }}>
                  Traffic Tickets Detail · <span style={{ color: '#6b7280', fontWeight: 500 }} dir="rtl">تفاصيل المخالفات</span>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                <thead>
                  <tr style={{ background: '#fffbeb', color: '#92400e' }}>
                    <th style={{ textAlign: 'left', padding: '3px 10px', fontSize: '8px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '3px 10px', fontSize: '8px' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '3px 10px', fontSize: '8px' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '3px 10px', fontSize: '8px' }}>Amount (SAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.map((t: any) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '3px 10px', fontSize: '9px' }}>{new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '3px 10px', fontSize: '9px' }}>{t.violationType}</td>
                      <td style={{ padding: '3px 10px', fontSize: '9px', textTransform: 'capitalize' }}>{t.status}</td>
                      <td style={{ padding: '3px 10px', fontSize: '9px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Final Net Salary — premium hero, immediately above signatures ===== */}
        <div style={{ margin: '0 30px 6px', padding: '14px 22px', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)', borderRadius: '12px', border: '2px solid #064e3b', boxShadow: '0 4px 14px rgba(6, 78, 59, 0.18)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: '#064e3b' }} />
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(6,78,59,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#065f46', fontWeight: 700 }}>
                Final Net Salary
              </div>
              <div style={{ fontSize: '13px', color: '#065f46', fontWeight: 700, marginTop: '2px' }} dir="rtl">
                صافي الراتب النهائي
              </div>
              <div style={{ marginTop: '6px', fontSize: '10px', color: '#047857', lineHeight: 1.55 }}>
                <div><strong>Beneficiary:</strong> {driver?.beneficiaryName || result.driverName}</div>
                {driver?.bankName && <div><strong>Bank:</strong> {driver.bankName}</div>}
                {driver?.iban && <div><strong>IBAN:</strong> <span style={{ fontFamily: 'monospace', fontSize: '9px' }}>{driver.iban}</span></div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#064e3b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px', lineHeight: 1 }}>
                SAR {result.finalNetSalary.toFixed(2)}
              </div>
              <div style={{ fontSize: '9px', color: '#047857', marginTop: '3px' }}>
                {company?.currency || 'SAR'} · {result.payrollMonth}
              </div>
              <div style={{ fontSize: '8px', color: '#047857', marginTop: '1px' }}>
                Generated: {new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Footer + Two signatures ===== */}
        <div style={{ padding: '10px 30px 12px', borderTop: '2px solid #064e3b', background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)', flexShrink: 0 }}>
          <div style={{ fontSize: '8px', color: '#6b7280', marginBottom: '6px', textAlign: 'center' }}>
            {company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
            <div style={{ marginTop: '1px' }} dir="rtl">
              {company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px', marginTop: '8px' }}>
            {/* Accounting Manager */}
            <div style={{ textAlign: 'center' }}>
              {company?.signatureImg ? (
                <div style={{ height: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '3px' }}>
                  <img src={company.signatureImg} alt="Accounting Manager Signature" style={{ maxHeight: '30px', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ height: '32px', borderBottom: '1.5px solid #064e3b', marginBottom: '3px' }} />
              )}
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#064e3b' }}>
                {company?.accManagerName || 'Accounting Manager'}
              </div>
              <div style={{ fontSize: '9px', color: '#047857' }} dir="rtl">
                مدير الحسابات
              </div>
            </div>
            {/* Driver */}
            <div style={{ textAlign: 'center' }}>
              {company?.riderSignatureImg ? (
                <div style={{ height: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '3px' }}>
                  <img src={company.riderSignatureImg} alt="Driver Signature" style={{ maxHeight: '30px', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ height: '32px', borderBottom: '1.5px solid #064e3b', marginBottom: '3px' }} />
              )}
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#064e3b' }}>
                Driver Signature
              </div>
              <div style={{ fontSize: '9px', color: '#047857' }} dir="rtl">
                توقيع السائق
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
