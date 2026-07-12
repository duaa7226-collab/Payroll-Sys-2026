// Premium 2026 Payslip PDF Generator — Elite Development design
// Uses html2canvas-pro to capture the browser-rendered HTML payslip (which supports
// Arabic perfectly via the browser's font/text engine) and embeds it as an image
// in a jsPDF A4 document. This guarantees Arabic renders correctly.
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

// Capture an HTML element as an A4 PDF — returns a blob URL for printing in new tab
export async function generatePayslipPDFFromElement(element: HTMLElement): Promise<{ blobUrl: string; download: () => void }> {
  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; z-index: -1; font-family: var(--font-cairo), Cairo, sans-serif;'
  container.innerHTML = element.innerHTML
  document.body.appendChild(container)
  ;(container as any).__payslipData = (element as any).__payslipData

  try {
    await new Promise(res => setTimeout(res, 500))
    const target = container.firstElementChild as HTMLElement
    if (!target) throw new Error('No payslip element')

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: 800,
      height: 1131,
      windowWidth: 800,
      windowHeight: 1131,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')

    const blobUrl = pdf.output('bloburl')
    const data = (element as any).__payslipData
    const download = () => {
      const result = data?.result
      const fileName = `payslip_${result?.driverName?.replace(/\s+/g, '_') ?? 'driver'}_${result?.payrollMonth?.replace(/\s+/g, '_') ?? 'month'}.pdf`
      pdf.save(fileName)
    }
    return { blobUrl, download }
  } finally {
    try { document.body.removeChild(container) } catch {}
  }
}

export async function generatePayslipPDFBlobFromData(data: any): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText = `position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; z-index: -1;`
  container.innerHTML = buildPayslipHTML(data)
  document.body.appendChild(container)
  ;(container as any).__payslipData = { result: data.result }
  try {
    const { blobUrl } = await generatePayslipPDFFromElement(container)
    return blobUrl
  } finally {
    document.body.removeChild(container)
  }
}

export async function generatePayslipPDFDownload(data: any): Promise<void> {
  const container = document.createElement('div')
  container.style.cssText = `position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; z-index: -1;`
  container.innerHTML = buildPayslipHTML(data)
  document.body.appendChild(container)
  ;(container as any).__payslipData = { result: data.result }
  try {
    const { download } = await generatePayslipPDFFromElement(container)
    download()
  } finally {
    document.body.removeChild(container)
  }
}

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

// Build the payslip HTML string — Elite Development design, fills exactly one A4 page
function buildPayslipHTML(data: any): string {
  const { result, driver, company, traffic, penalties } = data
  const penaltyEntries = Object.entries(penalties).filter(([_, v]) => (v as number) > 0)
  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : '0'

  // Salary per order rate
  const salaryPerOrder = result.appliedSalaryPerOrder || (result.appliedBaseSalary / result.appliedMonthlyTarget) || 0

  // ===== Earnings rows =====
  const earningsRows: string[] = []
  // Base earnings = Target × Per-Order rate
  earningsRows.push(`
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
      <div>
        <div style="font-size: 11px; color: #374151; font-weight: 500;">الراتب الأساسي</div>
        <div style="font-size: 9px; color: #9ca3af;">Base Salary (${result.selectedTargetThreshold.toFixed(0)} × ${salaryPerOrder.toFixed(2)})</div>
      </div>
      <span style="font-size: 12px; font-weight: 700; color: #0A3D62; font-variant-numeric: tabular-nums;">${result.baseSalaryEquivalent.toFixed(2)} SAR</span>
    </div>`)
  if (result.bonusAmount > 0) {
    earningsRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">مكافأة الطلبات الإضافية</div>
          <div style="font-size: 9px; color: #9ca3af;">Bonus (${result.extraOrders} × ${result.appliedBonusPerExtra.toFixed(2)})</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #0A3D62; font-variant-numeric: tabular-nums;">+ ${result.bonusAmount.toFixed(2)} SAR</span>
      </div>`)
  }
  if ((result.segmentPayment || 0) > 0) {
    earningsRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">دفعة الشريحة</div>
          <div style="font-size: 9px; color: #9ca3af;">Segment Payment</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #0A3D62; font-variant-numeric: tabular-nums;">+ ${result.segmentPayment.toFixed(2)} SAR</span>
      </div>`)
  }
  for (const cb of (data.customBonuses || [])) {
    earningsRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">${cb.nameAr || cb.name}</div>
          <div style="font-size: 9px; color: #9ca3af;">${cb.name}</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #0A3D62; font-variant-numeric: tabular-nums;">+ ${cb.amount.toFixed(2)} SAR</span>
      </div>`)
  }
  // Gross total
  earningsRows.push(`
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0 0; margin-top: 4px; border-top: 2px solid #0A3D62;">
      <div>
        <div style="font-size: 13px; color: #0A3D62; font-weight: 700;">الإجمالي</div>
        <div style="font-size: 10px; color: #6b7280;">Gross</div>
      </div>
      <span style="font-size: 16px; font-weight: 800; color: #0A3D62; font-variant-numeric: tabular-nums;">${result.grossSalaryBeforePenalties.toFixed(2)} SAR</span>
    </div>`)

  // ===== Deductions rows =====
  const deductionRows: string[] = []
  if (result.missingOrderDeduction > 0) {
    deductionRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">خصم الطلبات المفقودة</div>
          <div style="font-size: 9px; color: #9ca3af;">Missing-Order Deduction</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #FF6B35; font-variant-numeric: tabular-nums;">– ${result.missingOrderDeduction.toFixed(2)} SAR</span>
      </div>`)
  }
  for (const [key, val] of penaltyEntries) {
    const lbl = PENALTY_LABELS[key] ?? { en: key, ar: key }
    deductionRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">${lbl.ar}</div>
          <div style="font-size: 9px; color: #9ca3af;">${lbl.en}</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #FF6B35; font-variant-numeric: tabular-nums;">– ${(val as number).toFixed(2)} SAR</span>
      </div>`)
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">المخالفات المرورية</div>
          <div style="font-size: 9px; color: #9ca3af;">Traffic Violations</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #FF6B35; font-variant-numeric: tabular-nums;">– ${result.trafficViolationsDeduction.toFixed(2)} SAR</span>
      </div>`)
  }
  for (const cd of (data.customDeductions || [])) {
    deductionRows.push(`
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
        <div>
          <div style="font-size: 11px; color: #374151; font-weight: 500;">${cd.nameAr || cd.name}</div>
          <div style="font-size: 9px; color: #9ca3af;">${cd.name}</div>
        </div>
        <span style="font-size: 12px; font-weight: 700; color: #FF6B35; font-variant-numeric: tabular-nums;">– ${cd.amount.toFixed(2)} SAR</span>
      </div>`)
  }
  if (deductionRows.length === 0) {
    deductionRows.push(`<div style="padding: 10px 0; text-align: center; color: #9ca3af; font-size: 10px;">لا توجد خصومات · No deductions applied</div>`)
  }
  // Total deductions row
  deductionRows.push(`
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0 0; margin-top: 4px; border-top: 2px solid #FF6B35;">
      <div>
        <div style="font-size: 13px; color: #FF6B35; font-weight: 700;">إجمالي الخصومات</div>
        <div style="font-size: 10px; color: #6b7280;">Total Deductions</div>
      </div>
      <span style="font-size: 16px; font-weight: 800; color: #FF6B35; font-variant-numeric: tabular-nums;">${totalDeductions.toFixed(2)} SAR</span>
    </div>`)

  return `
<div style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; display: flex; flex-direction: column; overflow: hidden; padding: 24px;">

  <!-- ===== Header — blue → orange gradient ===== -->
  <div style="background: linear-gradient(90deg, #0A3D62 0%, #0A3D62 35%, #FF6B35 100%); color: #ffffff; border-radius: 12px; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(10, 61, 98, 0.18); flex-shrink: 0;">
    <!-- Left: Logo + Company info -->
    <div style="display: flex; align-items: center; gap: 14px;">
      ${company?.logo
        ? `<img src="${company.logo}" alt="Logo" style="height: 48px; width: 48px; object-fit: contain; background: white; padding: 4px; border-radius: 50%; border: 2px solid #FF6B35;" crossorigin="anonymous"/>`
        : `<div style="height: 48px; width: 48px; background: white; border-radius: 50%; border: 2px solid #FF6B35; display: flex; align-items: center; justify-content: center; color: #0A3D62; font-weight: 800; font-size: 18px;">${(company?.name || 'E').charAt(0)}</div>`
      }
      <div>
        <div style="font-size: 15px; font-weight: 700;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
        <div style="font-size: 13px; font-weight: 600;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
        <div style="font-size: 9px; opacity: 0.9; margin-top: 2px;">VAT: ${company?.vatNumber || 'N/A'} · ${company?.address || 'Riyadh, KSA'}</div>
      </div>
    </div>
    <!-- Right: Payslip title -->
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 700;" dir="rtl">بيان المرتب</div>
      <div style="font-size: 14px; font-weight: 700; color: #FFEEC2;">PAYSLIP</div>
      <div style="font-size: 11px; opacity: 0.95; margin-top: 2px;">${result.payrollMonth}</div>
    </div>
  </div>

  <!-- ===== Driver Info Card — 2 rows × 3 cols ===== -->
  <div style="margin-top: 12px; background: white; border: 1px solid #E0E0E0; border-radius: 10px; padding: 12px 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); flex-shrink: 0;">
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; row-gap: 10px;">
      ${[
        { ar: 'اسم المستفيد', en: 'Beneficiary', val: driver?.beneficiaryName || result.driverName },
        { ar: 'معرف المندوب', en: 'Rider ID', val: result.riderId },
        { ar: 'العقد', en: 'Contract', val: result.contractName },
        { ar: 'البنك', en: 'Bank', val: driver?.bankName || '—' },
        { ar: 'الآيبان', en: 'IBAN', val: driver?.iban || '—' },
        { ar: 'نوع المركبة', en: 'Vehicle', val: result.vehicleType },
      ].map(f => `
        <div>
          <div style="font-size: 11px; color: #666666; font-weight: 500;" dir="rtl">${f.ar}</div>
          <div style="font-size: 9px; color: #9ca3af;">${f.en}</div>
          <div style="font-size: 13px; font-weight: 700; color: #111111; margin-top: 2px; word-break: break-all; ${f.en === 'IBAN' || f.en === 'Rider ID' || f.en === 'Contract' ? 'font-family: monospace; font-size: 11px;' : ''}">${f.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- ===== Stats Section — 6 cards ===== -->
  <div style="margin-top: 10px; background: white; border: 1px solid #E0E0E0; border-radius: 10px; padding: 12px 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); flex-shrink: 0;">
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
      ${[
        { ar: 'أيام العمل', en: 'Working Days', val: result.actualWorkingDays.toFixed(0), color: '#0A3D62' },
        { ar: 'الطلبات المكتملة', en: 'Completed', val: result.completedOrders, color: '#0A3D62' },
        { ar: 'الطلبات المتوقعة', en: 'Target', val: result.selectedTargetThreshold.toFixed(0), color: '#666666' },
        { ar: 'سعر الطلب', en: 'Per Order', val: salaryPerOrder.toFixed(2), color: '#0A3D62' },
        { ar: 'طلبات إضافية', en: 'Extra', val: result.extraOrders, color: '#059669' },
        { ar: 'طلبات مفقودة', en: 'Missing', val: result.missingOrders, color: '#dc2626' },
      ].map(s => `
        <div style="text-align: center; padding: 6px 4px; background: #F8FAFC; border-radius: 6px; border-bottom: 2px solid ${s.color};">
          <div style="font-size: 9px; color: #666666; font-weight: 600;" dir="rtl">${s.ar}</div>
          <div style="font-size: 8px; color: #9ca3af;">${s.en}</div>
          <div style="font-size: 16px; font-weight: 800; color: ${s.color}; margin-top: 3px; font-variant-numeric: tabular-nums;">${s.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- ===== Earnings + Deductions side-by-side ===== -->
  <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0;">
    <!-- Earnings Card (blue) -->
    <div style="background: white; border: 1px solid #E0E0E0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
      <div style="padding: 8px 14px; background: #0A3D62; color: white; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px;">EARNINGS</div>
        <div style="font-size: 11px; font-weight: 600;" dir="rtl">الأرباح</div>
      </div>
      <div style="padding: 8px 14px; flex: 1;">
        ${earningsRows.join('')}
      </div>
    </div>
    <!-- Deductions Card (orange) -->
    <div style="background: white; border: 1px solid #E0E0E0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
      <div style="padding: 8px 14px; background: #FF6B35; color: white; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px;">DEDUCTIONS</div>
        <div style="font-size: 11px; font-weight: 600;" dir="rtl">الخصومات</div>
      </div>
      <div style="padding: 8px 14px; flex: 1;">
        ${deductionRows.join('')}
      </div>
    </div>
  </div>

  <!-- ===== Traffic Detail (if any) — compact, optional ===== -->
  ${traffic && traffic.length > 0 ? `
    <div style="margin-top: 10px; background: white; border: 1px solid #E0E0E0; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.04); flex-shrink: 0;">
      <div style="padding: 6px 14px; background: #FEF3E2; border-bottom: 2px solid #FF6B35; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 11px; font-weight: 700; color: #92400e; letter-spacing: 0.5px;">TRAFFIC TICKETS</div>
        <div style="font-size: 11px; color: #92400e; font-weight: 600;" dir="rtl">تفاصيل المخالفات</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #FEF3E2; color: #92400e;">
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Date</th>
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Type</th>
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Status</th>
            <th style="text-align: right; padding: 3px 12px; font-size: 9px;">Amount (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${traffic.map((t: any) => `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 3px 12px; font-size: 9px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
              <td style="padding: 3px 12px; font-size: 9px;">${t.violationType}</td>
              <td style="padding: 3px 12px; font-size: 9px; text-transform: capitalize;">${t.status}</td>
              <td style="padding: 3px 12px; font-size: 9px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600;">${t.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  <!-- ===== Net Payable Salary — full-width gradient bar ===== -->
  <div style="margin-top: 12px; background: linear-gradient(90deg, #0A3D62 0%, #0A3D62 35%, #FF6B35 100%); border-radius: 12px; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 14px rgba(10, 61, 98, 0.25); flex-shrink: 0;">
    <div>
      <div style="font-size: 14px; font-weight: 700; color: white;" dir="rtl">المرتب الصافي المستحق</div>
      <div style="font-size: 11px; color: #FFEEC2; margin-top: 2px;">NET PAYABLE SALARY · ${result.payrollMonth}</div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.75); margin-top: 4px;">Generated: ${new Date().toLocaleDateString('en-GB')} · Attainment: ${attainmentPct}%</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 28px; font-weight: 800; color: white; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1;">${result.finalNetSalary.toFixed(2)}</div>
      <div style="font-size: 13px; color: #FFEEC2; font-weight: 600; margin-top: 2px;">SAR</div>
    </div>
  </div>

  <!-- ===== Signature Section — 3 columns: Mgr | Stamp | Driver ===== -->
  <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; align-items: flex-end; flex-shrink: 0;">
    <!-- Accounting Manager -->
    <div style="text-align: center;">
      ${company?.signatureImg
        ? `<div style="height: 36px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;"><img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 34px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 36px; border-bottom: 1.5px solid #0A3D62; margin-bottom: 4px;"></div>`
      }
      <div style="font-size: 10px; color: #666666; font-weight: 600;">ACCOUNTING MANAGER</div>
      <div style="font-size: 10px; color: #666666;" dir="rtl">مدير الحسابات</div>
    </div>
    <!-- Center Stamp -->
    <div style="text-align: center;">
      ${company?.stampImg
        ? `<div style="height: 56px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;"><img src="${company.stampImg}" alt="Stamp" style="max-height: 56px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 56px; width: 56px; margin: 0 auto 4px; border: 2px dashed #FF6B35; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #FF6B35;">
            <div style="font-size: 9px; font-weight: 700;">${(company?.name || 'ELITE').slice(0, 8)}</div>
            <div style="font-size: 7px;">KSA</div>
          </div>`
      }
      <div style="font-size: 9px; color: #9ca3af;">${company?.name || 'Nokhaba Tatweer'}</div>
    </div>
    <!-- Rider Signature -->
    <div style="text-align: center;">
      ${company?.riderSignatureImg
        ? `<div style="height: 36px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;"><img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 34px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 36px; border-bottom: 1.5px solid #0A3D62; margin-bottom: 4px;"></div>`
      }
      <div style="font-size: 10px; color: #666666; font-weight: 600;">RIDER SIGNATURE</div>
      <div style="font-size: 10px; color: #666666;" dir="rtl">توقيع السائق</div>
    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #E0E0E0; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af; flex-shrink: 0;">
    <div>${company?.name || 'Nokhaba Tatweer for Trading'} — <span dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</span></div>
    <div>Generated ${new Date().toLocaleDateString('en-GB')} · ${company?.footerNote || 'Computer-generated payslip'}</div>
  </div>
</div>`
}

export function generatePayslipPDF(data: any) {
  generatePayslipPDFDownload(data).catch(err => {
    console.error('PDF generation failed:', err)
    alert('PDF generation failed. Please try again.')
  })
}

export async function generatePayslipPDFBlob(data: any): Promise<string> {
  return generatePayslipPDFBlobFromData(data)
}
