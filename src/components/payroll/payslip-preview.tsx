'use client'

import { useEffect, useState, useRef } from 'react'
import { Download, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generatePayslipPDF } from '@/lib/payslip-pdf'

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
  const payslipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/payslip?resultId=${resultId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [resultId])

  if (loading || !data) {
    return <div className="p-12 text-center text-muted-foreground">Loading payslip...</div>
  }

  const { result, driver, company, traffic, penalties } = data

  const handleDownload = () => {
    generatePayslipPDF(data)
  }

  const handlePrint = () => {
    window.print()
  }

  const fmt = (v: number) => `${v.toFixed(2)}`
  const penaltyEntries = Object.entries(penalties).filter(([_, v]) => (v as number) > 0)

  return (
    <div className="space-y-3 p-4 no-print">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payslip Preview · {result.payrollMonth}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {/* The actual printable payslip */}
      <div ref={payslipRef} className="printable-payslip bg-white text-black mx-auto" style={{ maxWidth: '800px' }}>
        {/* Premium Header */}
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: 'white', padding: '28px 32px', borderRadius: '8px 8px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.8 }}>
                Salary Statement · كشف راتب
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {company?.name || 'Nokhaba Tatweer for Trading'}
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '2px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                {company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '6px' }}>
                {company?.address || 'Riyadh, Saudi Arabia'} · VAT: {company?.vatNumber || 'N/A'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', opacity: 0.8, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Pay Period</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{result.payrollMonth}</div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                Generated: {new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </div>

        {/* Driver Identity */}
        <div style={{ padding: '16px 32px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Info label="Driver Name" labelAr="اسم السائق" value={result.driverName} />
            <Info label="Rider ID" labelAr="معرف المندوب" value={result.riderId} />
            <Info label="Contract" labelAr="العقد" value={result.contractName} mono />
            <Info label="Vehicle Type" labelAr="نوع المركبة" value={result.vehicleType} />
          </div>
        </div>

        {/* Performance summary banner */}
        <div style={{ padding: '12px 32px', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Performance Band · فئة الأداء: </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#065f46' }}>
                {BAND_LABELS[result.performanceBand]?.en ?? result.performanceBand} · {BAND_LABELS[result.performanceBand]?.ar ?? ''}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Attainment · الإنجاز: </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#065f46' }}>
                {result.selectedTargetThreshold > 0
                  ? `${((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Body — two columns */}
        <div style={{ padding: '20px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Working Stats */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #064e3b' }}>
              Working Stats · إحصائيات العمل
            </div>
            <Row label="Completed Orders" labelAr="الطلبات المكتملة" value={`${result.completedOrders}`} />
            <Row label="Adjusted Target" labelAr="الهدف المعدل" value={result.selectedTargetThreshold.toFixed(0)} />
            <Row label="Extra Orders (+)" labelAr="طلبات إضافية" value={`+${result.extraOrders}`} accent="emerald" />
            <Row label="Missing Orders (-)" labelAr="طلبات ناقصة" value={`-${result.missingOrders}`} accent="rose" />
            <Row label="Actual Working Days" labelAr="أيام العمل الفعلية" value={result.actualWorkingDays.toFixed(0)} />
            <Row label="Working Hours" labelAr="ساعات العمل" value={result.workingHours.toFixed(1)} />
            <Row label="Inactive Reason" labelAr="سبب عدم النشاط" value={result.inactiveReason || 'Active'} />
          </div>

          {/* Right: Earnings Calculation */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #064e3b' }}>
              Earnings Calculation · حساب الأرباح
            </div>
            <Row label="Monthly Base Salary" labelAr="الراتب الأساسي" value={`SAR ${result.appliedBaseSalary.toFixed(2)}`} />
            <Row label="Salary Per Order" labelAr="راتب كل طلب" value={`SAR ${result.appliedSalaryPerOrder.toFixed(4)}`} muted />
            <Row label="Base Salary By Orders" labelAr="الراتب حسب الطلبات" value={`SAR ${result.baseSalaryEquivalent.toFixed(2)}`} />
            <Row label="Bonus Amount" labelAr="المكافأة" value={`+SAR ${result.bonusAmount.toFixed(2)}`} accent="emerald" />
            <Row label="Missing Order Deduction" labelAr="خصم الطلبات الناقصة" value={`-SAR ${result.missingOrderDeduction.toFixed(2)}`} accent="rose" />
            <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
              <Row label="Gross Salary" labelAr="إجمالي الراتب" value={`SAR ${result.grossSalaryBeforePenalties.toFixed(2)}`} bold />
            </div>
          </div>
        </div>

        {/* Penalties & Deductions Table */}
        <div style={{ padding: '0 32px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #b91c1c' }}>
            Penalties & Deductions · الغرامات والخصومات
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#fef2f2', color: '#7f1d1d' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Penalty Type</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Amount (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {penaltyEntries.length === 0 && (
                <tr><td colSpan={2} style={{ padding: '8px', textAlign: 'center', color: '#9ca3af' }}>No penalties applied</td></tr>
              )}
              {penaltyEntries.map(([key, val]) => (
                <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '5px 8px' }}>
                    {PENALTY_LABELS[key]?.en ?? key}
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                      {PENALTY_LABELS[key]?.ar ?? ''}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>
                    -{(val as number).toFixed(2)}
                  </td>
                </tr>
              ))}
              {result.trafficViolationsDeduction > 0 && (
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 500 }}>
                    Traffic Violations
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                      المخالفات المرورية
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#92400e' }}>
                    -{result.trafficViolationsDeduction.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ fontWeight: 700, background: '#fef2f2', color: '#7f1d1d' }}>
                <td style={{ padding: '8px', borderTop: '2px solid #b91c1c' }}>Total Deductions · إجمالي الخصومات</td>
                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #b91c1c' }}>
                  -{(result.totalOtherPenalties + result.trafficViolationsDeduction).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Traffic Violations Detail (if any) */}
        {traffic && traffic.length > 0 && (
          <div style={{ padding: '0 32px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #92400e' }}>
              Traffic Tickets Detail · تفاصيل المخالفات المرورية
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#fffbeb', color: '#92400e' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 6px' }}>{new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '4px 6px' }}>{t.violationType}</td>
                    <td style={{ padding: '4px 6px' }}><span style={{ textTransform: 'capitalize' }}>{t.status}</span></td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Final Net Salary — Premium Hero */}
        <div style={{ margin: '0 32px 16px', padding: '20px 24px', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderRadius: '8px', border: '2px solid #064e3b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#065f46', fontWeight: 600 }}>
                Final Net Salary · صافي الراتب النهائي
              </div>
              <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                Payable to: {driver?.beneficiaryName || result.driverName}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#064e3b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                SAR {result.finalNetSalary.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                {company?.currency || 'SAR'} · {result.payrollMonth}
              </div>
            </div>
          </div>
        </div>

        {/* Variance / Control */}
        {result.varianceStatus !== 'ok' && (
          <div style={{ margin: '0 32px 16px', padding: '10px 14px', background: result.varianceStatus === 'major' ? '#fef2f2' : '#fffbeb', border: `1px solid ${result.varianceStatus === 'major' ? '#fecaca' : '#fde68a'}`, borderRadius: '6px', fontSize: '11px' }}>
            <strong>Variance Notice · تنبيه الفرق:</strong>{' '}
            Calculated net differs from uploaded basic payment by SAR {Math.abs(result.varianceAmount).toFixed(2)} ({result.variancePercentage.toFixed(2)}%).
            Status: <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{result.varianceStatus}</span>
          </div>
        )}

        {/* Applied Rules Summary */}
        <div style={{ margin: '0 32px 16px', padding: '12px 14px', background: '#f9fafb', borderRadius: '6px', fontSize: '10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Applied Rule Set · مجموعة القواعد المطبقة</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 12px' }}>
            <span>Rule Set: <strong>{result.activeRuleSetName}</strong></span>
            <span>Mode: <strong>{result.salaryDivisorMode === 'orders_based_mode' ? 'Orders-Based' : 'Days-Prorated'}</strong></span>
            <span>Base: <strong>SAR {result.appliedBaseSalary}</strong></span>
            <span>Std Days: <strong>{result.appliedStdWorkingDays}</strong></span>
            <span>Monthly Target: <strong>{result.appliedMonthlyTarget}</strong></span>
            <span>Per Order: <strong>SAR {result.appliedSalaryPerOrder.toFixed(4)}</strong></span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 8px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', maxWidth: '60%' }}>
              {company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
              <div style={{ marginTop: '4px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                {company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}
              </div>
            </div>
            {company?.signatureImg ? (
              <img src={company.signatureImg} alt="Signature" style={{ maxHeight: '40px' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #9ca3af', width: '120px', paddingTop: '4px', fontSize: '10px', color: '#6b7280' }}>
                  Authorized Signature
                </div>
                <div style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'var(--font-arabic)' }} dir="rtl">التوقيع المعتمد</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, labelAr, value, mono }: { label: string; labelAr: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'var(--font-arabic)' }} dir="rtl">{labelAr}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}

function Row({ label, labelAr, value, accent, bold, muted }: {
  label: string
  labelAr: string
  value: string
  accent?: 'emerald' | 'rose'
  bold?: boolean
  muted?: boolean
}) {
  const color = accent === 'emerald' ? '#059669' : accent === 'rose' ? '#dc2626' : muted ? '#6b7280' : '#111827'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px dotted #e5e7eb' }}>
      <div>
        <span style={{ fontSize: '11px', color: '#374151', fontWeight: bold ? 600 : 400 }}>{label}</span>
        <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px', fontFamily: 'var(--font-arabic)' }} dir="rtl">{labelAr}</span>
      </div>
      <span style={{
        fontSize: bold ? '13px' : '11px',
        fontWeight: bold ? 700 : 500,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  )
}
