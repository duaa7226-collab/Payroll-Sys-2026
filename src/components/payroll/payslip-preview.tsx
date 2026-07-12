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
  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : '0'
  const salaryPerOrder = result.appliedSalaryPerOrder || (result.appliedBaseSalary / result.appliedMonthlyTarget) || 0

  // Driver info fields
  const driverInfoFields = [
    { ar: 'اسم المستفيد', en: 'Beneficiary', val: driver?.beneficiaryName || result.driverName, mono: false },
    { ar: 'معرف المندوب', en: 'Rider ID', val: result.riderId, mono: true },
    { ar: 'العقد', en: 'Contract', val: result.contractName, mono: true },
    { ar: 'البنك', en: 'Bank', val: driver?.bankName || '—', mono: false },
    { ar: 'الآيبان', en: 'IBAN', val: driver?.iban || '—', mono: true },
    { ar: 'نوع المركبة', en: 'Vehicle', val: result.vehicleType, mono: false },
  ]

  // Stats fields
  const statsFields = [
    { ar: 'أيام العمل', en: 'Working Days', val: result.actualWorkingDays.toFixed(0), color: '#0A3D62' },
    { ar: 'الطلبات المكتملة', en: 'Completed', val: result.completedOrders, color: '#0A3D62' },
    { ar: 'الطلبات المتوقعة', en: 'Target', val: result.selectedTargetThreshold.toFixed(0), color: '#666666' },
    { ar: 'سعر الطلب', en: 'Per Order', val: salaryPerOrder.toFixed(2), color: '#0A3D62' },
    { ar: 'طلبات إضافية', en: 'Extra', val: result.extraOrders, color: '#059669' },
    { ar: 'طلبات مفقودة', en: 'Missing', val: result.missingOrders, color: '#dc2626' },
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

      {/* ===== Printable payslip — Elite Development design ===== */}
      <div className="printable-payslip bg-white text-black mx-auto" style={{ width: '800px', height: '1131px', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-cairo), Cairo, sans-serif' }}>
        {/* ===== Header — blue → orange gradient ===== */}
        <div style={{ background: 'linear-gradient(90deg, #0A3D62 0%, #0A3D62 35%, #FF6B35 100%)', color: 'white', borderRadius: '12px', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(10, 61, 98, 0.18)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {company?.logo ? (
              <img src={company.logo} alt="Logo" style={{ height: '48px', width: '48px', objectFit: 'contain', background: 'white', padding: '4px', borderRadius: '50%', border: '2px solid #FF6B35' }} />
            ) : (
              <div style={{ height: '48px', width: '48px', background: 'white', borderRadius: '50%', border: '2px solid #FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A3D62', fontWeight: 800, fontSize: '18px' }}>
                {(company?.name || 'E').charAt(0)}
              </div>
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700 }} dir="rtl">{company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{company?.name || 'Nokhaba Tatweer for Trading'}</div>
              <div style={{ fontSize: '9px', opacity: 0.9, marginTop: '2px' }}>VAT: {company?.vatNumber || 'N/A'} · {company?.address || 'Riyadh, KSA'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 700 }} dir="rtl">بيان المرتب</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFEEC2' }}>PAYSLIP</div>
            <div style={{ fontSize: '11px', opacity: 0.95, marginTop: '2px' }}>{result.payrollMonth}</div>
          </div>
        </div>

        {/* ===== Driver Info Card ===== */}
        <div style={{ marginTop: '12px', background: 'white', border: '1px solid #E0E0E0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', rowGap: '10px' }}>
            {driverInfoFields.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: '11px', color: '#666666', fontWeight: 500 }} dir="rtl">{f.ar}</div>
                <div style={{ fontSize: '9px', color: '#9ca3af' }}>{f.en}</div>
                <div style={{ fontSize: f.mono ? '11px' : '13px', fontWeight: 700, color: '#111111', marginTop: '2px', wordBreak: 'break-all', fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Stats Section ===== */}
        <div style={{ marginTop: '10px', background: 'white', border: '1px solid #E0E0E0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            {statsFields.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '6px 4px', background: '#F8FAFC', borderRadius: '6px', borderBottom: `2px solid ${s.color}` }}>
                <div style={{ fontSize: '9px', color: '#666666', fontWeight: 600 }} dir="rtl">{s.ar}</div>
                <div style={{ fontSize: '8px', color: '#9ca3af' }}>{s.en}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: s.color, marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Earnings + Deductions side-by-side ===== */}
        <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Earnings Card (blue) */}
          <div style={{ background: 'white', border: '1px solid #E0E0E0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 14px', background: '#0A3D62', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>EARNINGS</div>
              <div style={{ fontSize: '11px', fontWeight: 600 }} dir="rtl">الأرباح</div>
            </div>
            <div style={{ padding: '8px 14px', flex: 1 }}>
              {/* Base salary row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>الراتب الأساسي</div>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Base Salary ({result.selectedTargetThreshold.toFixed(0)} × {salaryPerOrder.toFixed(2)})</div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A3D62', fontVariantNumeric: 'tabular-nums' }}>{result.baseSalaryEquivalent.toFixed(2)} SAR</span>
              </div>
              {result.bonusAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>مكافأة الطلبات الإضافية</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>Bonus ({result.extraOrders} × {result.appliedBonusPerExtra.toFixed(2)})</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A3D62', fontVariantNumeric: 'tabular-nums' }}>+ {result.bonusAmount.toFixed(2)} SAR</span>
                </div>
              )}
              {(result.segmentPayment || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>دفعة الشريحة</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>Segment Payment</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A3D62', fontVariantNumeric: 'tabular-nums' }}>+ {result.segmentPayment.toFixed(2)} SAR</span>
                </div>
              )}
              {customBonuses.map((cb: any, i: number) => (
                <div key={`cb-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>{cb.nameAr || cb.name}</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>{cb.name}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0A3D62', fontVariantNumeric: 'tabular-nums' }}>+ {cb.amount.toFixed(2)} SAR</span>
                </div>
              ))}
              {/* Gross total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0 0', marginTop: '4px', borderTop: '2px solid #0A3D62' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#0A3D62', fontWeight: 700 }}>الإجمالي</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Gross</div>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0A3D62', fontVariantNumeric: 'tabular-nums' }}>{result.grossSalaryBeforePenalties.toFixed(2)} SAR</span>
              </div>
            </div>
          </div>

          {/* Deductions Card (orange) */}
          <div style={{ background: 'white', border: '1px solid #E0E0E0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 14px', background: '#FF6B35', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>DEDUCTIONS</div>
              <div style={{ fontSize: '11px', fontWeight: 600 }} dir="rtl">الخصومات</div>
            </div>
            <div style={{ padding: '8px 14px', flex: 1 }}>
              {result.missingOrderDeduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>خصم الطلبات المفقودة</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>Missing-Order Deduction</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>– {result.missingOrderDeduction.toFixed(2)} SAR</span>
                </div>
              )}
              {penaltyEntries.map(([key, val]) => {
                const lbl = PENALTY_LABELS[key] ?? { en: key, ar: key }
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>{lbl.ar}</div>
                      <div style={{ fontSize: '9px', color: '#9ca3af' }}>{lbl.en}</div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>– {(val as number).toFixed(2)} SAR</span>
                  </div>
                )
              })}
              {result.trafficViolationsDeduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>المخالفات المرورية</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>Traffic Violations</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>– {result.trafficViolationsDeduction.toFixed(2)} SAR</span>
                </div>
              )}
              {customDeductions.map((cd: any, i: number) => (
                <div key={`cd-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151', fontWeight: 500 }}>{cd.nameAr || cd.name}</div>
                    <div style={{ fontSize: '9px', color: '#9ca3af' }}>{cd.name}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>– {cd.amount.toFixed(2)} SAR</span>
                </div>
              ))}
              {penaltyEntries.length === 0 && result.missingOrderDeduction === 0 && result.trafficViolationsDeduction === 0 && customDeductions.length === 0 && (
                <div style={{ padding: '10px 0', textAlign: 'center', color: '#9ca3af', fontSize: '10px' }}>لا توجد خصومات · No deductions applied</div>
              )}
              {/* Total deductions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0 0', marginTop: '4px', borderTop: '2px solid #FF6B35' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#FF6B35', fontWeight: 700 }}>إجمالي الخصومات</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Total Deductions</div>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>{totalDeductions.toFixed(2)} SAR</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Traffic Detail (if any) ===== */}
        {traffic && traffic.length > 0 && (
          <div style={{ marginTop: '10px', background: 'white', border: '1px solid #E0E0E0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', flexShrink: 0 }}>
            <div style={{ padding: '6px 14px', background: '#FEF3E2', borderBottom: '2px solid #FF6B35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', letterSpacing: '0.5px' }}>TRAFFIC TICKETS</div>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }} dir="rtl">تفاصيل المخالفات</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#FEF3E2', color: '#92400e' }}>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '3px 12px', fontSize: '9px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '3px 12px', fontSize: '9px' }}>Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '3px 12px', fontSize: '9px' }}>{new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '3px 12px', fontSize: '9px' }}>{t.violationType}</td>
                    <td style={{ padding: '3px 12px', fontSize: '9px', textTransform: 'capitalize' }}>{t.status}</td>
                    <td style={{ padding: '3px 12px', fontSize: '9px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== Net Payable Salary — full-width gradient bar ===== */}
        <div style={{ marginTop: '12px', background: 'linear-gradient(90deg, #0A3D62 0%, #0A3D62 35%, #FF6B35 100%)', borderRadius: '12px', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(10, 61, 98, 0.25)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }} dir="rtl">المرتب الصافي المستحق</div>
            <div style={{ fontSize: '11px', color: '#FFEEC2', marginTop: '2px' }}>NET PAYABLE SALARY · {result.payrollMonth}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.75)', marginTop: '4px' }}>Generated: {new Date().toLocaleDateString('en-GB')} · Attainment: {attainmentPct}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', lineHeight: 1 }}>{result.finalNetSalary.toFixed(2)}</div>
            <div style={{ fontSize: '13px', color: '#FFEEC2', fontWeight: 600, marginTop: '2px' }}>SAR</div>
          </div>
        </div>

        {/* ===== Signature Section — 3 columns: Mgr | Stamp | Driver ===== */}
        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Accounting Manager */}
          <div style={{ textAlign: 'center' }}>
            {company?.signatureImg ? (
              <div style={{ height: '36px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                <img src={company.signatureImg} alt="Accounting Manager Signature" style={{ maxHeight: '34px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '36px', borderBottom: '1.5px solid #0A3D62', marginBottom: '4px' }} />
            )}
            <div style={{ fontSize: '10px', color: '#666666', fontWeight: 600 }}>ACCOUNTING MANAGER</div>
            <div style={{ fontSize: '10px', color: '#666666' }} dir="rtl">مدير الحسابات</div>
          </div>
          {/* Center Stamp */}
          <div style={{ textAlign: 'center' }}>
            {company?.stampImg ? (
              <div style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                <img src={company.stampImg} alt="Stamp" style={{ maxHeight: '56px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '56px', width: '56px', margin: '0 auto 4px', border: '2px dashed #FF6B35', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#FF6B35' }}>
                <div style={{ fontSize: '9px', fontWeight: 700 }}>{(company?.name || 'ELITE').slice(0, 8)}</div>
                <div style={{ fontSize: '7px' }}>KSA</div>
              </div>
            )}
            <div style={{ fontSize: '9px', color: '#9ca3af' }}>{company?.name || 'Nokhaba Tatweer'}</div>
          </div>
          {/* Rider Signature */}
          <div style={{ textAlign: 'center' }}>
            {company?.riderSignatureImg ? (
              <div style={{ height: '36px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                <img src={company.riderSignatureImg} alt="Driver Signature" style={{ maxHeight: '34px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ height: '36px', borderBottom: '1.5px solid #0A3D62', marginBottom: '4px' }} />
            )}
            <div style={{ fontSize: '10px', color: '#666666', fontWeight: 600 }}>RIDER SIGNATURE</div>
            <div style={{ fontSize: '10px', color: '#666666' }} dir="rtl">توقيع السائق</div>
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', color: '#9ca3af', flexShrink: 0 }}>
          <div>{company?.name || 'Nokhaba Tatweer for Trading'} — <span dir="rtl">{company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</span></div>
          <div>Generated {new Date().toLocaleDateString('en-GB')} · {company?.footerNote || 'Computer-generated payslip'}</div>
        </div>
      </div>
    </div>
  )
}
