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
      windowWidth: 800,
    })

    const imgData = canvas.toDataURL('image/png')

    // Create A4 PDF
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const margin = 12
    const imgWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    if (imgHeight <= pageHeight - margin * 2) {
      const offsetY = (pageHeight - imgHeight) / 2
      pdf.addImage(imgData, 'PNG', margin, offsetY, imgWidth, imgHeight, undefined, 'FAST')
    } else {
      // Multi-page pagination
      const pageContentHeightPx = (canvas.width * (pageHeight - margin * 2)) / imgWidth
      let srcY = 0
      let page = 1
      while (srcY < canvas.height) {
        const sliceHeight = Math.min(pageContentHeightPx, canvas.height - srcY)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceHeight
        const ctx = sliceCanvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

        const sliceImgData = sliceCanvas.toDataURL('image/png')
        const sliceHeightPt = (sliceHeight * imgWidth) / canvas.width

        if (page > 1) pdf.addPage()
        pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidth, sliceHeightPt, undefined, 'FAST')

        srcY += sliceHeight
        page++
      }
    }

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
// This is used when we want to generate a PDF without showing it on screen
export async function generatePayslipPDFBlobFromData(data: any): Promise<string> {
  const { result, driver, company, traffic, penalties } = data
  // Create a temporary container element
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
  // Store data for filename
  ;(container as any).__payslipData = { result }

  try {
    const { blobUrl } = await generatePayslipPDFFromElement(container)
    return blobUrl
  } finally {
    document.body.removeChild(container)
  }
}

export async function generatePayslipPDFDownload(data: any): Promise<void> {
  const { result } = data
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
  ;(container as any).__payslipData = { result }

  try {
    const { download } = await generatePayslipPDFFromElement(container)
    download()
  } finally {
    document.body.removeChild(container)
  }
}

// Build the payslip HTML string — mirrors the on-screen payslip-preview.tsx layout
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

  const band = BAND_LABELS[result.performanceBand] ?? { en: result.performanceBand, ar: '' }

  // Build deductions rows — compact inline (English + Arabic on same line, small font)
  const deductionRows: string[] = []
  if (result.missingOrderDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fff7ed;">
        <td style="padding: 3px 8px; font-size: 10px; font-weight: 500;">
          Missing Order Deduction <span style="font-size: 9px; color: #9ca3af;" dir="rtl">خصم الطلبات الناقصة</span>
        </td>
        <td style="padding: 3px 8px; text-align: right; font-variant-numeric: tabular-nums; color: #9a3412; font-size: 10px;">-${result.missingOrderDeduction.toFixed(2)}</td>
      </tr>`)
  }
  for (const [key, val] of penaltyEntries) {
    const lbl = PENALTY_LABELS[key] ?? { en: key, ar: '' }
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 3px 8px; font-size: 10px;">
          ${lbl.en} <span style="font-size: 9px; color: #9ca3af;" dir="rtl">${lbl.ar}</span>
        </td>
        <td style="padding: 3px 8px; text-align: right; font-variant-numeric: tabular-nums; color: #b91c1c; font-size: 10px;">-${(val as number).toFixed(2)}</td>
      </tr>`)
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fffbeb;">
        <td style="padding: 3px 8px; font-size: 10px; font-weight: 500;">
          Traffic Violations <span style="font-size: 9px; color: #9ca3af;" dir="rtl">المخالفات المرورية</span>
        </td>
        <td style="padding: 3px 8px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e; font-size: 10px;">-${result.trafficViolationsDeduction.toFixed(2)}</td>
      </tr>`)
  }
  // Custom deductions (from Rules Control Center)
  for (const cd of (data.customDeductions || [])) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fef3c7;">
        <td style="padding: 3px 8px; font-size: 10px; font-weight: 500;">
          ${cd.name} ${cd.nameAr ? `<span style="font-size: 9px; color: #9ca3af;" dir="rtl">${cd.nameAr}</span>` : ''}
        </td>
        <td style="padding: 3px 8px; text-align: right; font-variant-numeric: tabular-nums; color: #b45309; font-size: 10px;">-${cd.amount.toFixed(2)}</td>
      </tr>`)
  }
  if (deductionRows.length === 0) {
    deductionRows.push(`<tr><td colspan="2" style="padding: 6px; text-align: center; color: #9ca3af; font-size: 10px;">No deductions applied</td></tr>`)
  }

  // Build traffic detail rows — compact
  const trafficRows: string[] = (traffic || []).map((t: any) => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 2px 6px; font-size: 9px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
      <td style="padding: 2px 6px; font-size: 9px;">${t.violationType}</td>
      <td style="padding: 2px 6px; font-size: 9px; text-transform: capitalize;">${t.status}</td>
      <td style="padding: 2px 6px; font-size: 9px; text-align: right; font-variant-numeric: tabular-nums;">${t.amount.toFixed(2)}</td>
    </tr>`).join('')

  return `
<div style="background: #ffffff; color: #000000; width: 800px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif;">
  <!-- Premium Header — compact -->
  <div style="background: #047857; background-image: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #ffffff; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center;">
    <div style="flex: 1;">
      <div style="font-size: 8px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7;">Salary Statement · <span dir="rtl">كشف راتب</span></div>
      <div style="font-size: 18px; font-weight: 700; margin-top: 2px; letter-spacing: -0.3px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 11px; opacity: 0.9; margin-top: 0;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
      <div style="font-size: 9px; opacity: 0.7; margin-top: 3px;">${company?.address || 'Riyadh, Saudi Arabia'} · VAT: ${company?.vatNumber || 'N/A'} · ${result.payrollMonth}</div>
    </div>
    ${company?.logo
      ? `<div style="margin-left: 16px;"><img src="${company.logo}" alt="Logo" style="max-height: 50px; max-width: 110px; object-fit: contain; background: white; padding: 4px; border-radius: 4px;" crossorigin="anonymous"/></div>`
      : ''
    }
  </div>

  <!-- Driver Identity — compact -->
  <div style="padding: 8px 28px; border-bottom: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
    ${[
      ['Driver Name', 'اسم السائق', result.driverName, false],
      ['Rider ID', 'معرف المندوب', result.riderId, true],
      ['Contract', 'العقد', result.contractName, true],
      ['Vehicle Type', 'نوع المركبة', result.vehicleType, false],
    ].map(([en, ar, val, mono]: any) => `
      <div>
        <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">${en} · <span dir="rtl">${ar}</span></div>
        <div style="font-size: 12px; font-weight: 600; margin-top: 1px; ${mono ? 'font-family: monospace;' : ''}">${val}</div>
      </div>
    `).join('')}
  </div>

  <!-- Performance strip — compact -->
  <div style="padding: 4px 28px; background: #f0fdf4; border-bottom: 1px solid #e5e7eb; font-size: 10px;">
    <span style="color: #6b7280;">Performance: </span>
    <span style="font-weight: 600; color: #065f46;">${band.en}</span>
    <span style="color: #9ca3af; margin-left: 3px;" dir="rtl">(${band.ar})</span>
    <span style="color: #6b7280; margin-left: 16px;">Attainment: </span>
    <span style="font-weight: 600; color: #065f46;">${attainmentPct}%</span>
  </div>

  <!-- Body two columns — compact -->
  <div style="padding: 10px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    <!-- Working Summary -->
    <div>
      <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase;">Working Summary · <span dir="rtl">ملخص العمل</span></div>
      </div>
      ${[
        ['Completed Orders', 'الطلبات المكتملة', result.completedOrders],
        ['Target Orders', 'الهدف', result.selectedTargetThreshold.toFixed(0)],
        ['Working Days', 'أيام العمل', result.actualWorkingDays.toFixed(0)],
        ['Working Hours', 'ساعات العمل', result.workingHours.toFixed(1)],
      ].map(([en, ar, val]: any) => `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151;">${en}</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">${ar}</span>
          </div>
          <span style="font-size: 10px; font-weight: 500; color: #111827; font-variant-numeric: tabular-nums;">${val}</span>
        </div>
      `).join('')}
    </div>
    <!-- Earnings -->
    <div>
      <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase;">Earnings · <span dir="rtl">الأرباح</span></div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; border-bottom: 1px dotted #e5e7eb;">
        <div>
          <span style="font-size: 10px; color: #374151;">${baseSalaryLabel}</span>
          <span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">الراتب الأساسي</span>
        </div>
        <span style="font-size: 10px; font-weight: 500; color: #111827; font-variant-numeric: tabular-nums;">SAR ${baseSalaryValue.toFixed(2)}</span>
      </div>
      ${result.bonusAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151;">Performance Bonus</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">مكافأة الأداء</span>
          </div>
          <span style="font-size: 10px; font-weight: 500; color: #059669; font-variant-numeric: tabular-nums;">+SAR ${result.bonusAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${(result.segmentPayment || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151;">Segment Payment</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">دفعة الشريحة</span>
          </div>
          <span style="font-size: 10px; font-weight: 500; color: #0891b2; font-variant-numeric: tabular-nums;">+SAR ${result.segmentPayment.toFixed(2)}</span>
        </div>
      ` : ''}
      ${(result.customBonuses || []).map((cb: any) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <span style="font-size: 10px; color: #374151;">${cb.name}</span>
            ${cb.nameAr ? `<span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">${cb.nameAr}</span>` : ''}
          </div>
          <span style="font-size: 10px; font-weight: 500; color: #d97706; font-variant-numeric: tabular-nums;">+SAR ${cb.amount.toFixed(2)}</span>
        </div>
      `).join('')}
      <div style="margin-top: 4px; padding-top: 4px; border-top: 2px solid #064e3b;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <span style="font-size: 12px; color: #374151; font-weight: 600;">Gross Salary</span>
            <span style="font-size: 9px; color: #9ca3af; margin-left: 3px;" dir="rtl">إجمالي الراتب</span>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums;">SAR ${result.grossSalaryBeforePenalties.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Deductions table — compact -->
  <div style="padding: 0 28px 8px;">
    <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 2px solid #b91c1c;">
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase;">Deductions · <span dir="rtl">الخصومات</span></div>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
      <thead>
        <tr style="background: #fef2f2; color: #7f1d1d;">
          <th style="text-align: left; padding: 3px 8px; font-weight: 600; font-size: 9px;">Description</th>
          <th style="text-align: right; padding: 3px 8px; font-weight: 600; font-size: 9px;">Amount (SAR)</th>
        </tr>
      </thead>
      <tbody>
        ${deductionRows.join('')}
        <tr style="font-weight: 700; background: #fef2f2; color: #7f1d1d;">
          <td style="padding: 4px 8px; border-top: 2px solid #b91c1c;">
            <span>Total Deductions</span>
            <span style="font-size: 9px; color: #7f1d1d; margin-left: 4px;" dir="rtl">إجمالي الخصومات</span>
          </td>
          <td style="padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums; border-top: 2px solid #b91c1c;">-${totalDeductions.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Traffic detail (if any) — compact -->
  ${traffic && traffic.length > 0 ? `
    <div style="padding: 0 28px 8px;">
      <div style="margin-bottom: 3px; padding-bottom: 2px; border-bottom: 2px solid #92400e;">
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase;">Traffic Tickets · <span dir="rtl">تفاصيل المخالفات</span></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: #fffbeb; color: #92400e;">
            <th style="text-align: left; padding: 2px 6px; font-size: 8px;">Date</th>
            <th style="text-align: left; padding: 2px 6px; font-size: 8px;">Type</th>
            <th style="text-align: left; padding: 2px 6px; font-size: 8px;">Status</th>
            <th style="text-align: right; padding: 2px 6px; font-size: 8px;">Amount (SAR)</th>
          </tr>
        </thead>
        <tbody>${trafficRows}</tbody>
      </table>
    </div>
  ` : ''}

  <!-- Final Net Salary — compact -->
  <div style="margin: 0 28px 8px; padding: 10px 18px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 8px; border: 2px solid #064e3b;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #065f46; font-weight: 600;">Final Net Salary</div>
        <div style="font-size: 13px; color: #065f46; font-weight: 700; margin-top: 2px;" dir="rtl">صافي الراتب النهائي</div>
        <div style="margin-top: 6px; font-size: 10px; color: #047857; line-height: 1.5;">
          <div><strong>Beneficiary:</strong> ${driver?.beneficiaryName || result.driverName}</div>
          ${driver?.bankName ? `<div><strong>Bank:</strong> ${driver.bankName}</div>` : ''}
          ${driver?.iban ? `<div><strong>IBAN:</strong> <span style="font-family: monospace;">${driver.iban}</span></div>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 24px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; letter-spacing: -0.5px;">SAR ${result.finalNetSalary.toFixed(2)}</div>
        <div style="font-size: 9px; color: #047857; margin-top: 0;">${company?.currency || 'SAR'} · ${result.payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- Footer + Two signatures — compact -->
  <div style="padding: 8px 28px 10px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
    <div style="font-size: 8px; color: #6b7280; margin-bottom: 6px; text-align: center;">
      ${company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
      <div style="margin-top: 1px;" dir="rtl">${company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 8px;">
      <!-- Accounting Manager -->
      <div style="text-align: center;">
        ${company?.signatureImg
          ? `<div style="height: 30px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;"><img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 28px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 30px; border-bottom: 1.5px solid #374151; margin-bottom: 2px;"></div>`
        }
        <div style="font-size: 10px; font-weight: 600; color: #374151;">${company?.accManagerName || 'Accounting Manager'} · <span dir="rtl">مدير الحسابات</span></div>
      </div>
      <!-- Driver -->
      <div style="text-align: center;">
        ${company?.riderSignatureImg
          ? `<div style="height: 30px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;"><img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 28px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 30px; border-bottom: 1.5px solid #374151; margin-bottom: 2px;"></div>`
        }
        <div style="font-size: 10px; font-weight: 600; color: #374151;">Driver Signature · <span dir="rtl">توقيع السائق</span></div>
      </div>
    </div>
  </div>
</div>`
}

// Legacy sync stubs (for backward compat — but async now)
export function generatePayslipPDF(data: any) {
  // Fire-and-forget async download — caller doesn't await
  generatePayslipPDFDownload(data).catch(err => {
    console.error('PDF generation failed:', err)
    alert('PDF generation failed. Please try again.')
  })
}

export async function generatePayslipPDFBlob(data: any): Promise<string> {
  return generatePayslipPDFBlobFromData(data)
}
