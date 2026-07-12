'use client'

import { useEffect, useState, useRef } from 'react'
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

  const { result, driver, company, traffic, penalties } = data

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
        // Fallback to download
        await generatePayslipPDFDownload(data)
      } else {
        toast.success('PDF opened in new tab — use Ctrl+P or Cmd+P to print')
      }
    } catch (e: any) {
      console.error(e)
      toast.error('Print failed: ' + (e.message || 'unknown error'))
      // Fallback to download
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

      {/* The actual printable payslip — modern, professional, minimal */}
      <div className="printable-payslip bg-white text-black mx-auto" style={{ maxWidth: '800px' }}>
        {/* Premium Header with optional logo */}
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: 'white', padding: '32px 36px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.7 }}>
              Salary Statement · كشف راتب
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px', letterSpacing: '-0.3px' }}>
              {company?.name || 'Nokhaba Tatweer for Trading'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '2px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
              {company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '8px' }}>
              {company?.address || 'Riyadh, Saudi Arabia'} · VAT: {company?.vatNumber || 'N/A'}
            </div>
          </div>
          {company?.logo ? (
            <div style={{ marginLeft: '20px' }}>
              <img
                src={company.logo}
                alt="Company Logo"
                style={{ maxHeight: '70px', maxWidth: '140px', objectFit: 'contain', background: 'white', padding: '6px', borderRadius: '6px' }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', opacity: 0.7, letterSpacing: '2px', textTransform: 'uppercase' }}>Pay Period</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>{result.payrollMonth}</div>
              <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px' }}>
                {new Date().toLocaleDateString('en-GB')}
              </div>
            </div>
          )}
        </div>

        {/* If logo present, show pay period below */}
        {company?.logo && (
          <div style={{ padding: '8px 36px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>
              <span style={{ fontWeight: 600 }}>Pay Period:</span> {result.payrollMonth}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
              Generated: {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        )}

        {/* Driver Identity */}
        <div style={{ padding: '18px 36px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Info label="Driver Name" labelAr="اسم السائق" value={result.driverName} />
            <Info label="Rider ID" labelAr="معرف المندوب" value={result.riderId} />
            <Info label="Contract" labelAr="العقد" value={result.contractName} mono />
            <Info label="Vehicle Type" labelAr="نوع المركبة" value={result.vehicleType} />
          </div>
        </div>

        {/* Performance summary — minimal */}
        <div style={{ padding: '10px 36px', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Performance · الأداء: </span>
              <span style={{ fontWeight: 600, color: '#065f46' }}>
                {BAND_LABELS[result.performanceBand]?.en ?? result.performanceBand}
              </span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Target Attainment · الإنجاز: </span>
              <span style={{ fontWeight: 600, color: '#065f46' }}>{attainmentPct}%</span>
            </div>
          </div>
        </div>

        {/* Body — two columns: Working Stats + Earnings */}
        <div style={{ padding: '20px 36px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
          {/* Left: Working Stats */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #064e3b' }}>
              Working Summary · ملخص العمل
            </div>
            <Row label="Completed Orders" labelAr="الطلبات المكتملة" value={`${result.completedOrders}`} />
            <Row label="Target Orders" labelAr="الهدف" value={result.selectedTargetThreshold.toFixed(0)} />
            <Row label="Working Days" labelAr="أيام العمل" value={`${result.actualWorkingDays.toFixed(0)}`} />
            <Row label="Working Hours" labelAr="ساعات العمل" value={result.workingHours.toFixed(1)} />
            {result.inactiveReason && result.inactiveReason !== 'Active' && (
              <Row label="Inactive Reason" labelAr="سبب عدم النشاط" value={result.inactiveReason} />
            )}
          </div>

          {/* Right: Earnings — clean, no calc details */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #064e3b' }}>
              Earnings · الأرباح
            </div>
            <Row label={baseSalaryLabel} labelAr="الراتب الأساسي" value={`SAR ${baseSalaryValue.toFixed(2)}`} />
            {result.bonusAmount > 0 && (
              <Row label="Performance Bonus" labelAr="مكافأة الأداء" value={`+SAR ${result.bonusAmount.toFixed(2)}`} accent="emerald" />
            )}
            {(result.segmentPayment || 0) > 0 && (
              <Row label="Segment Payment" labelAr="دفعة الشريحة" value={`+SAR ${result.segmentPayment.toFixed(2)}`} accent="emerald" />
            )}
            <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '2px solid #064e3b' }}>
              <Row label="Gross Salary" labelAr="إجمالي الراتب" value={`SAR ${result.grossSalaryBeforePenalties.toFixed(2)}`} bold />
            </div>
          </div>
        </div>

        {/* Deductions Table — now includes Missing Order Deduction */}
        <div style={{ padding: '0 36px 18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: '2px solid #b91c1c' }}>
            Deductions · الخصومات
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#fef2f2', color: '#7f1d1d' }}>
                <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600, fontSize: '10px', letterSpacing: '0.5px' }}>Description · الوصف</th>
                <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600, fontSize: '10px', letterSpacing: '0.5px' }}>Amount (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {result.missingOrderDeduction > 0 && (
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fff7ed' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                    Missing Order Deduction
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px', fontFamily: 'var(--font-arabic)' }} dir="rtl">خصم الطلبات الناقصة</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#9a3412' }}>
                    -{result.missingOrderDeduction.toFixed(2)}
                  </td>
                </tr>
              )}
              {penaltyEntries.length === 0 && result.missingOrderDeduction === 0 && (
                <tr><td colSpan={2} style={{ padding: '10px', textAlign: 'center', color: '#9ca3af' }}>No deductions applied</td></tr>
              )}
              {penaltyEntries.map(([key, val]) => (
                <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px' }}>
                    {PENALTY_LABELS[key]?.en ?? key}
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                      {PENALTY_LABELS[key]?.ar ?? ''}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#b91c1c' }}>
                    -{(val as number).toFixed(2)}
                  </td>
                </tr>
              ))}
              {result.trafficViolationsDeduction > 0 && (
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                    Traffic Violations
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '6px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                      المخالفات المرورية
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#92400e' }}>
                    -{result.trafficViolationsDeduction.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ fontWeight: 700, background: '#fef2f2', color: '#7f1d1d' }}>
                <td style={{ padding: '9px 10px', borderTop: '2px solid #b91c1c' }}>Total Deductions · إجمالي الخصومات</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #b91c1c' }}>
                  -{totalDeductions.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Traffic Violations Detail (if any) */}
        {traffic && traffic.length > 0 && (
          <div style={{ padding: '0 36px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #92400e' }}>
              Traffic Tickets Detail · تفاصيل المخالفات
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#fffbeb', color: '#92400e' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '9px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '9px' }}>Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px' }}>{new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '4px 8px' }}>{t.violationType}</td>
                    <td style={{ padding: '4px 8px', textTransform: 'capitalize' }}>{t.status}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Final Net Salary — Premium Hero */}
        <div style={{ margin: '0 36px 18px', padding: '22px 26px', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderRadius: '10px', border: '2px solid #064e3b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#065f46', fontWeight: 600 }}>
                Final Net Salary · صافي الراتب النهائي
              </div>
              <div style={{ fontSize: '10px', color: '#047857', marginTop: '6px', lineHeight: '1.5' }}>
                <div><strong>Beneficiary:</strong> {driver?.beneficiaryName || result.driverName}</div>
                {driver?.bankName && <div><strong>Bank:</strong> {driver.bankName}</div>}
                {driver?.iban && <div><strong>IBAN:</strong> <span style={{ fontFamily: 'monospace' }}>{driver.iban}</span></div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#064e3b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.8px' }}>
                SAR {result.finalNetSalary.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                {company?.currency || 'SAR'} · {result.payrollMonth}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with TWO signature blocks */}
        <div style={{ padding: '20px 36px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 10px 10px' }}>
          {/* Footer note */}
          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '18px', textAlign: 'center' }}>
            {company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
            <div style={{ marginTop: '3px', fontFamily: 'var(--font-arabic)' }} dir="rtl">
              {company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}
            </div>
          </div>

          {/* Two signature blocks side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '24px' }}>
            {/* Accounting Manager Signature */}
            <div style={{ textAlign: 'center' }}>
              {company?.signatureImg ? (
                <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                  <img src={company.signatureImg} alt="Accounting Manager Signature" style={{ maxHeight: '45px', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ height: '50px', borderBottom: '1.5px solid #374151', marginBottom: '4px' }} />
              )}
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                {company?.accManagerName || 'Accounting Manager'}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                مدير الحسابات
              </div>
            </div>

            {/* Driver Signature */}
            <div style={{ textAlign: 'center' }}>
              {company?.riderSignatureImg ? (
                <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>
                  <img src={company.riderSignatureImg} alt="Driver Signature" style={{ maxHeight: '45px', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ height: '50px', borderBottom: '1.5px solid #374151', marginBottom: '4px' }} />
              )}
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                Driver Signature
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'var(--font-arabic)' }} dir="rtl">
                توقيع السائق
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, labelAr, value, mono }: { label: string; labelAr: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'var(--font-arabic)' }} dir="rtl">{labelAr}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '3px', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}

function Row({ label, labelAr, value, accent, bold }: {
  label: string
  labelAr: string
  value: string
  accent?: 'emerald' | 'rose'
  bold?: boolean
}) {
  const color = accent === 'emerald' ? '#059669' : accent === 'rose' ? '#dc2626' : '#111827'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px dotted #e5e7eb' }}>
      <div>
        <span style={{ fontSize: '11px', color: '#374151', fontWeight: bold ? 600 : 400 }}>{label}</span>
        <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '5px', fontFamily: 'var(--font-arabic)' }} dir="rtl">{labelAr}</span>
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
