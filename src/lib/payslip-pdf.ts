// Premium 2026 Payslip PDF Generator
// Uses html2canvas-pro to capture the browser-rendered HTML payslip (which supports
// Arabic perfectly via the browser's font/text engine) and embeds it as an image
// in a jsPDF A4 document. This guarantees Arabic renders correctly.
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

// Capture an HTML element as an A4 PDF — returns a blob URL for printing in new tab
export async function generatePayslipPDFFromElement(element: HTMLElement): Promise<{ blobUrl: string; download: () => void }> {
  // Render in hidden container in MAIN document — Cairo font already loaded via next/font/google
  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; z-index: -1; font-family: var(--font-cairo), Cairo, sans-serif;'
  container.innerHTML = element.innerHTML
  document.body.appendChild(container)
  ;(container as any).__payslipData = (element as any).__payslipData

  try {
    // Wait briefly for font to apply
    await new Promise(res => setTimeout(res, 500))

    const target = container.firstElementChild as HTMLElement
    if (!target) throw new Error('No payslip element')

    // Render with html2canvas
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

    // Create A4 PDF — single page, fills entire page
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

// Helper: build a hidden HTML element for the payslip, render it, capture as PDF
export async function generatePayslipPDFBlobFromData(data: any): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -10000px;
    left: 0;
    width: 800px;
    background: white;
    color: black;
    font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif;
    z-index: -1;
  `
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
  container.style.cssText = `
    position: fixed;
    top: -10000px;
    left: 0;
    width: 800px;
    background: white;
    color: black;
    font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif;
    z-index: -1;
  `
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

const BAND_LABELS: Record<string, { en: string; ar: string }> = {
  top: { en: 'Top Performer', ar: 'أفضل أداء' },
  high: { en: 'High', ar: 'عالي' },
  average: { en: 'Average', ar: 'متوسط' },
  low: { en: 'Low', ar: 'منخفض' },
  bottom: { en: 'Bottom', ar: 'الأقل' },
}

// Build the payslip HTML string — premium, modern, fills exactly one A4 page (800x1131 px)
function buildPayslipHTML(data: any): string {
  const { result, driver, company, traffic, penalties } = data
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

  // ===== Build deductions rows =====
  const deductionRows: string[] = []
  if (result.missingOrderDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fff7ed;">
        <td style="padding: 4px 10px; font-size: 10px; font-weight: 500;">
          Missing Order Deduction <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">خصم الطلبات الناقصة</span>
        </td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #9a3412; font-size: 10px; font-weight: 600;">-${result.missingOrderDeduction.toFixed(2)}</td>
      </tr>`)
  }
  for (const [key, val] of penaltyEntries) {
    const lbl = PENALTY_LABELS[key] ?? { en: key, ar: '' }
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 4px 10px; font-size: 10px;">
          ${lbl.en} <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">${lbl.ar}</span>
        </td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #b91c1c; font-size: 10px; font-weight: 600;">-${(val as number).toFixed(2)}</td>
      </tr>`)
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fffbeb;">
        <td style="padding: 4px 10px; font-size: 10px; font-weight: 500;">
          Traffic Violations <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">المخالفات المرورية</span>
        </td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e; font-size: 10px; font-weight: 600;">-${result.trafficViolationsDeduction.toFixed(2)}</td>
      </tr>`)
  }
  // Custom deductions (from Rules Control Center)
  for (const cd of (data.customDeductions || [])) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fef3c7;">
        <td style="padding: 4px 10px; font-size: 10px; font-weight: 500;">
          ${cd.name} ${cd.nameAr ? `<span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">${cd.nameAr}</span>` : ''}
        </td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #b45309; font-size: 10px; font-weight: 600;">-${cd.amount.toFixed(2)}</td>
      </tr>`)
  }
  if (deductionRows.length === 0) {
    deductionRows.push(`<tr><td colspan="2" style="padding: 8px 10px; text-align: center; color: #9ca3af; font-size: 10px;">No deductions applied · لا توجد خصومات</td></tr>`)
  }

  // ===== Build traffic detail rows =====
  const trafficRows: string = (traffic || []).map((t: any) => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 3px 8px; font-size: 9px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
      <td style="padding: 3px 8px; font-size: 9px;">${t.violationType}</td>
      <td style="padding: 3px 8px; font-size: 9px; text-transform: capitalize;">${t.status}</td>
      <td style="padding: 3px 8px; font-size: 9px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600;">${t.amount.toFixed(2)}</td>
    </tr>`).join('')

  // ===== Build custom bonuses list =====
  const customBonusRows: string = (data.customBonuses || []).map((cb: any) => `
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; border-bottom: 1px dotted #e5e7eb;">
      <div>
        <span style="font-size: 10px; color: #374151;">${cb.name}</span>
        ${cb.nameAr ? `<span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">${cb.nameAr}</span>` : ''}
      </div>
      <span style="font-size: 10px; font-weight: 600; color: #d97706; font-variant-numeric: tabular-nums;">+SAR ${cb.amount.toFixed(2)}</span>
    </div>
  `).join('')

  return `
<div style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; display: flex; flex-direction: column; overflow: hidden;">

  <!-- ===== Premium Header ===== -->
  <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%); color: #ffffff; padding: 18px 30px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; position: relative; overflow: hidden;">
    <div style="position: absolute; top: -40px; right: -40px; width: 180px; height: 180px; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%); border-radius: 50%;"></div>
    <div style="flex: 1; position: relative;">
      <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75; font-weight: 500;">Salary Statement · <span dir="rtl">كشف راتب</span></div>
      <div style="font-size: 20px; font-weight: 700; margin-top: 3px; letter-spacing: -0.5px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 1px;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
      <div style="font-size: 9px; opacity: 0.7; margin-top: 4px; letter-spacing: 0.3px;">${company?.address || 'Riyadh, Saudi Arabia'} · VAT: ${company?.vatNumber || 'N/A'}</div>
    </div>
    <div style="text-align: right; position: relative;">
      ${company?.logo ? `<div style="margin-bottom: 6px;"><img src="${company.logo}" alt="Logo" style="max-height: 48px; max-width: 110px; object-fit: contain; background: white; padding: 5px; border-radius: 6px;" crossorigin="anonymous"/></div>` : ''}
      <div style="background: rgba(255,255,255,0.15); padding: 5px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); backdrop-filter: blur(4px);">
        <div style="font-size: 8px; opacity: 0.85; letter-spacing: 1.5px; text-transform: uppercase;">Pay Period</div>
        <div style="font-size: 14px; font-weight: 700;">${result.payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- ===== Driver Identity — premium card ===== -->
  <div style="padding: 10px 30px; background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%); border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
      ${[
        ['Driver Name', 'اسم السائق', result.driverName, false],
        ['Rider ID', 'معرف المندوب', result.riderId, true],
        ['Contract', 'العقد', result.contractName, true],
        ['Vehicle Type', 'نوع المركبة', result.vehicleType, false],
      ].map(([en, ar, val, mono]: any) => `
        <div style="padding: 6px 10px; background: white; border-radius: 6px; border-left: 3px solid #047857; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
          <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">${en}</div>
          <div style="font-size: 8px; color: #9ca3af;" dir="rtl">${ar}</div>
          <div style="font-size: 13px; font-weight: 700; margin-top: 2px; color: #111827; ${mono ? 'font-family: monospace; font-size: 11px;' : ''}">${val}</div>
        </div>
      `).join('')}
    </div>
    <!-- Performance strip -->
    <div style="margin-top: 8px; padding: 5px 12px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
      <div>
        <span style="color: #6b7280; font-weight: 500;">Performance: </span>
        <span style="font-weight: 700; color: #065f46;">${band.en}</span>
        <span style="color: #9ca3af; margin-left: 4px;" dir="rtl">(${band.ar})</span>
      </div>
      <div>
        <span style="color: #6b7280; font-weight: 500;">Target Attainment: </span>
        <span style="font-weight: 700; color: #065f46;">${attainmentPct}%</span>
      </div>
    </div>
  </div>

  <!-- ===== Body two columns — flex: 1 fills available space ===== -->
  <div style="padding: 12px 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex: 1; min-height: 0;">
    <!-- Working Summary -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase;">Working Summary</div>
        <div style="font-size: 11px; color: #6b7280;" dir="rtl">ملخص العمل</div>
      </div>
      ${[
        ['Completed Orders', 'الطلبات المكتملة', result.completedOrders, '#111827'],
        ['Target Orders', 'الهدف', result.selectedTargetThreshold.toFixed(0), '#6b7280'],
        ['Working Days', 'أيام العمل', result.actualWorkingDays.toFixed(0), '#111827'],
        ['Working Hours', 'ساعات العمل', result.workingHours.toFixed(1), '#111827'],
      ].map(([en, ar, val, color]: any) => `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151; font-weight: 500;">${en}</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">${ar}</span>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: ${color}; font-variant-numeric: tabular-nums;">${val}</span>
        </div>
      `).join('')}
      ${result.inactiveReason && result.inactiveReason !== 'Active' ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151; font-weight: 500;">Inactive Reason</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">سبب عدم النشاط</span>
          </div>
          <span style="font-size: 10px; font-weight: 600; color: #dc2626;">${result.inactiveReason}</span>
        </div>
      ` : ''}
    </div>

    <!-- Earnings -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase;">Earnings</div>
        <div style="font-size: 11px; color: #6b7280;" dir="rtl">الأرباح</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e5e7eb;">
        <div>
          <span style="font-size: 10px; color: #374151; font-weight: 500;">${baseSalaryLabel}</span>
          <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">الراتب الأساسي</span>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums;">SAR ${baseSalaryValue.toFixed(2)}</span>
      </div>
      ${result.bonusAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151; font-weight: 500;">Performance Bonus</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">مكافأة الأداء</span>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #059669; font-variant-numeric: tabular-nums;">+SAR ${result.bonusAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${(result.segmentPayment || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151; font-weight: 500;">Segment Payment</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">دفعة الشريحة</span>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #0891b2; font-variant-numeric: tabular-nums;">+SAR ${result.segmentPayment.toFixed(2)}</span>
        </div>
      ` : ''}
      ${customBonusRows}
      <div style="margin-top: 6px; padding-top: 6px; border-top: 2px solid #064e3b;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <span style="font-size: 11px; color: #374151; font-weight: 700;">Gross Salary</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 4px;" dir="rtl">إجمالي الراتب</span>
          </div>
          <span style="font-size: 13px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums;">SAR ${result.grossSalaryBeforePenalties.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Deductions table ===== -->
  <div style="padding: 0 30px 8px; flex-shrink: 0;">
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <div style="padding: 6px 12px; background: linear-gradient(90deg, #fef2f2 0%, #ffffff 100%); border-bottom: 2px solid #b91c1c;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #b91c1c; text-transform: uppercase;">Deductions · <span style="color: #6b7280; font-weight: 500;" dir="rtl">الخصومات</span></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #fef2f2; color: #7f1d1d;">
            <th style="text-align: left; padding: 4px 10px; font-weight: 600; font-size: 9px;">Description</th>
            <th style="text-align: right; padding: 4px 10px; font-weight: 600; font-size: 9px;">Amount (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${deductionRows.join('')}
          <tr style="font-weight: 800; background: #fef2f2; color: #7f1d1d;">
            <td style="padding: 6px 10px; border-top: 2px solid #b91c1c;">
              <span style="font-size: 10px;">Total Deductions</span>
              <span style="font-size: 9px; color: #7f1d1d; margin-left: 4px;" dir="rtl">إجمالي الخصومات</span>
            </td>
            <td style="padding: 6px 10px; text-align: right; font-variant-numeric: tabular-nums; border-top: 2px solid #b91c1c; font-size: 11px;">-${totalDeductions.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ===== Traffic detail (if any) — compact, fills space when present ===== -->
  ${traffic && traffic.length > 0 ? `
    <div style="padding: 0 30px 8px; flex-shrink: 0;">
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="padding: 5px 12px; background: linear-gradient(90deg, #fffbeb 0%, #ffffff 100%); border-bottom: 2px solid #92400e;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #92400e; text-transform: uppercase;">Traffic Tickets Detail · <span style="color: #6b7280; font-weight: 500;" dir="rtl">تفاصيل المخالفات</span></div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background: #fffbeb; color: #92400e;">
              <th style="text-align: left; padding: 3px 10px; font-size: 8px;">Date</th>
              <th style="text-align: left; padding: 3px 10px; font-size: 8px;">Type</th>
              <th style="text-align: left; padding: 3px 10px; font-size: 8px;">Status</th>
              <th style="text-align: right; padding: 3px 10px; font-size: 8px;">Amount (SAR)</th>
            </tr>
          </thead>
          <tbody>${trafficRows}</tbody>
        </table>
      </div>
    </div>
  ` : ''}

  <!-- ===== Final Net Salary — premium hero, immediately above signatures ===== -->
  <div style="margin: 0 30px 6px; padding: 14px 22px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%); border-radius: 12px; border: 2px solid #064e3b; box-shadow: 0 4px 14px rgba(6, 78, 59, 0.18); position: relative; overflow: hidden; flex-shrink: 0;">
    <div style="position: absolute; top: 0; left: 0; width: 5px; height: 100%; background: #064e3b;"></div>
    <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(6,78,59,0.08) 0%, transparent 70%); border-radius: 50%;"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; position: relative;">
      <div>
        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #065f46; font-weight: 700;">Final Net Salary</div>
        <div style="font-size: 13px; color: #065f46; font-weight: 700; margin-top: 2px;" dir="rtl">صافي الراتب النهائي</div>
        <div style="margin-top: 6px; font-size: 10px; color: #047857; line-height: 1.55;">
          <div><strong>Beneficiary:</strong> ${driver?.beneficiaryName || result.driverName}</div>
          ${driver?.bankName ? `<div><strong>Bank:</strong> ${driver.bankName}</div>` : ''}
          ${driver?.iban ? `<div><strong>IBAN:</strong> <span style="font-family: monospace; font-size: 9px;">${driver.iban}</span></div>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 30px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1;">SAR ${result.finalNetSalary.toFixed(2)}</div>
        <div style="font-size: 9px; color: #047857; margin-top: 3px;">${company?.currency || 'SAR'} · ${result.payrollMonth}</div>
        <div style="font-size: 8px; color: #047857; margin-top: 1px;">Generated: ${new Date().toLocaleDateString('en-GB')}</div>
      </div>
    </div>
  </div>

  <!-- ===== Footer + Two signatures — immediately after net salary ===== -->
  <div style="padding: 10px 30px 12px; border-top: 2px solid #064e3b; background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%); flex-shrink: 0;">
    <div style="font-size: 8px; color: #6b7280; margin-bottom: 6px; text-align: center;">
      ${company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
      <div style="margin-top: 1px;" dir="rtl">${company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 8px;">
      <!-- Accounting Manager -->
      <div style="text-align: center;">
        ${company?.signatureImg
          ? `<div style="height: 32px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 3px;"><img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 30px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 32px; border-bottom: 1.5px solid #064e3b; margin-bottom: 3px;"></div>`
        }
        <div style="font-size: 10px; font-weight: 700; color: #064e3b;">${company?.accManagerName || 'Accounting Manager'}</div>
        <div style="font-size: 9px; color: #047857;" dir="rtl">مدير الحسابات</div>
      </div>
      <!-- Driver -->
      <div style="text-align: center;">
        ${company?.riderSignatureImg
          ? `<div style="height: 32px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 3px;"><img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 30px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 32px; border-bottom: 1.5px solid #064e3b; margin-bottom: 3px;"></div>`
        }
        <div style="font-size: 10px; font-weight: 700; color: #064e3b;">Driver Signature</div>
        <div style="font-size: 9px; color: #047857;" dir="rtl">توقيع السائق</div>
      </div>
    </div>
  </div>
</div>`
}

// Legacy sync stubs (for backward compat — but async now)
export function generatePayslipPDF(data: any) {
  generatePayslipPDFDownload(data).catch(err => {
    console.error('PDF generation failed:', err)
    alert('PDF generation failed. Please try again.')
  })
}

export async function generatePayslipPDFBlob(data: any): Promise<string> {
  return generatePayslipPDFBlobFromData(data)
}
