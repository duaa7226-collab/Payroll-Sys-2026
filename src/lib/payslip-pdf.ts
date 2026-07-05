// Premium 2026 Payslip PDF Generator
// Uses html2canvas-pro to capture the browser-rendered HTML payslip (which supports
// Arabic perfectly via the browser's font/text engine) and embeds it as an image
// in a jsPDF A4 document. This guarantees Arabic renders correctly.
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

// Capture an HTML element as an A4 PDF — returns a blob URL for printing in new tab
export async function generatePayslipPDFFromElement(element: HTMLElement): Promise<{ blobUrl: string; download: () => void }> {
  // Clone the element into an isolated iframe to avoid parent CSS (Tailwind oklch) bleed
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed; top:-10000px; left:0; width:850px; height:1200px; border:0; z-index:-1;'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) throw new Error('Cannot access iframe document')

    // Write minimal HTML with the payslip content — no Tailwind, no parent CSS
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
          body { font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; }
          table { border-collapse: collapse; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>${element.innerHTML}</body>
      </html>
    `)
    iframeDoc.close()

    // Wait for fonts to load
    await new Promise(res => setTimeout(res, 500))
    if (iframe.contentWindow?.document.fonts) {
      try { await iframe.contentWindow.document.fonts.ready } catch {}
    }

    const target = iframeDoc.body.firstElementChild as HTMLElement
    if (!target) throw new Error('No payslip element in iframe')

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
    document.body.removeChild(iframe)
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

  // Build deductions rows — Arabic on separate line below English
  const deductionRows: string[] = []
  if (result.missingOrderDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fff7ed;">
        <td style="padding: 6px 10px; font-weight: 500;">
          <div style="font-size: 11px;">Missing Order Deduction</div>
          <div style="font-size: 10px; color: #9ca3af;" dir="rtl">خصم الطلبات الناقصة</div>
        </td>
        <td style="padding: 6px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #9a3412; vertical-align: top;">-${result.missingOrderDeduction.toFixed(2)}</td>
      </tr>`)
  }
  for (const [key, val] of penaltyEntries) {
    const lbl = PENALTY_LABELS[key] ?? { en: key, ar: '' }
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 6px 10px;">
          <div style="font-size: 11px;">${lbl.en}</div>
          <div style="font-size: 10px; color: #9ca3af;" dir="rtl">${lbl.ar}</div>
        </td>
        <td style="padding: 6px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #b91c1c; vertical-align: top;">-${(val as number).toFixed(2)}</td>
      </tr>`)
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fffbeb;">
        <td style="padding: 6px 10px; font-weight: 500;">
          <div style="font-size: 11px;">Traffic Violations</div>
          <div style="font-size: 10px; color: #9ca3af;" dir="rtl">المخالفات المرورية</div>
        </td>
        <td style="padding: 6px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e; vertical-align: top;">-${result.trafficViolationsDeduction.toFixed(2)}</td>
      </tr>`)
  }
  if (deductionRows.length === 0) {
    deductionRows.push(`<tr><td colspan="2" style="padding: 10px; text-align: center; color: #9ca3af;">No deductions applied</td></tr>`)
  }

  // Build traffic detail rows
  const trafficRows: string[] = (traffic || []).map((t: any) => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 4px 8px; font-size: 10px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
      <td style="padding: 4px 8px; font-size: 10px;">${t.violationType}</td>
      <td style="padding: 4px 8px; font-size: 10px; text-transform: capitalize;">${t.status}</td>
      <td style="padding: 4px 8px; font-size: 10px; text-align: right; font-variant-numeric: tabular-nums;">${t.amount.toFixed(2)}</td>
    </tr>`).join('')

  // Logo (if present)
  const logoBlock = company?.logo
    ? `<div style="margin-left: 20px;"><img src="${company.logo}" alt="Logo" style="max-height: 70px; max-width: 140px; object-fit: contain; background: white; padding: 6px; border-radius: 6px;" crossorigin="anonymous"/></div>`
    : `<div style="text-align: right;">
        <div style="font-size: 9px; opacity: 0.7; letter-spacing: 2px; text-transform: uppercase;">Pay Period</div>
        <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${result.payrollMonth}</div>
        <div style="font-size: 9px; opacity: 0.6; margin-top: 4px;">${new Date().toLocaleDateString('en-GB')}</div>
      </div>`

  const payPeriodStrip = company?.logo
    ? `<div style="padding: 8px 36px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 10px; color: #6b7280;"><span style="font-weight: 600;">Pay Period:</span> ${result.payrollMonth}</div>
        <div style="font-size: 10px; color: #9ca3af;">Generated: ${new Date().toLocaleDateString('en-GB')}</div>
      </div>`
    : ''

  return `
<div style="background: #ffffff; color: #000000; width: 800px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif;">
  <!-- Premium Header -->
  <div style="background: #047857; background-image: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #ffffff; padding: 32px 36px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div style="flex: 1;">
      <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.7;">Salary Statement</div>
      <div style="font-size: 14px; opacity: 0.9; margin-top: 1px;" dir="rtl">كشف راتب</div>
      <div style="font-size: 22px; font-weight: 700; margin-top: 6px; letter-spacing: -0.3px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 14px; opacity: 0.9; margin-top: 2px;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
      <div style="font-size: 10px; opacity: 0.7; margin-top: 8px;">${company?.address || 'Riyadh, Saudi Arabia'} · VAT: ${company?.vatNumber || 'N/A'}</div>
    </div>
    ${logoBlock}
  </div>
  ${payPeriodStrip}

  <!-- Driver Identity -->
  <div style="padding: 18px 36px; border-bottom: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
    ${[
      ['Driver Name', 'اسم السائق', result.driverName, false],
      ['Rider ID', 'معرف المندوب', result.riderId, true],
      ['Contract', 'العقد', result.contractName, true],
      ['Vehicle Type', 'نوع المركبة', result.vehicleType, false],
    ].map(([en, ar, val, mono]: any) => `
      <div>
        <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280;">${en}</div>
        <div style="font-size: 9px; color: #9ca3af;" dir="rtl">${ar}</div>
        <div style="font-size: 14px; font-weight: 600; margin-top: 3px; ${mono ? 'font-family: monospace;' : ''}">${val}</div>
      </div>
    `).join('')}
  </div>

  <!-- Performance strip -->
  <div style="padding: 10px 36px; background: #f0fdf4; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
    <div>
      <span style="color: #6b7280;">Performance: </span>
      <span style="font-weight: 600; color: #065f46;">${band.en}</span>
      <span style="font-size: 10px; color: #9ca3af; margin-left: 4px;" dir="rtl">(${band.ar})</span>
    </div>
    <div>
      <span style="color: #6b7280;">Target Attainment: </span>
      <span style="font-weight: 600; color: #065f46;">${attainmentPct}%</span>
    </div>
  </div>

  <!-- Body two columns -->
  <div style="padding: 20px 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px;">
    <!-- Working Summary -->
    <div>
      <div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase;">Working Summary</div>
        <div style="font-size: 11px; color: #6b7280;" dir="rtl">ملخص العمل</div>
      </div>
      ${[
        ['Completed Orders', 'الطلبات المكتملة', result.completedOrders],
        ['Target Orders', 'الهدف', result.selectedTargetThreshold.toFixed(0)],
        ['Working Days', 'أيام العمل', result.actualWorkingDays.toFixed(0)],
        ['Working Hours', 'ساعات العمل', result.workingHours.toFixed(1)],
        ...(result.inactiveReason && result.inactiveReason !== 'Active' ? [['Inactive Reason', 'سبب عدم النشاط', result.inactiveReason]] : []),
      ].map(([en, ar, val]: any) => `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <div style="font-size: 11px; color: #374151;">${en}</div>
            <div style="font-size: 10px; color: #9ca3af;" dir="rtl">${ar}</div>
          </div>
          <span style="font-size: 11px; font-weight: 500; color: #111827; font-variant-numeric: tabular-nums;">${val}</span>
        </div>
      `).join('')}
    </div>
    <!-- Earnings -->
    <div>
      <div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #064e3b;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase;">Earnings</div>
        <div style="font-size: 11px; color: #6b7280;" dir="rtl">الأرباح</div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px dotted #e5e7eb;">
        <div>
          <div style="font-size: 11px; color: #374151;">${baseSalaryLabel}</div>
          <div style="font-size: 10px; color: #9ca3af;" dir="rtl">الراتب الأساسي</div>
        </div>
        <span style="font-size: 11px; font-weight: 500; color: #111827; font-variant-numeric: tabular-nums;">SAR ${baseSalaryValue.toFixed(2)}</span>
      </div>
      ${result.bonusAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px dotted #e5e7eb;">
          <div>
            <div style="font-size: 11px; color: #374151;">Performance Bonus</div>
            <div style="font-size: 10px; color: #9ca3af;" dir="rtl">مكافأة الأداء</div>
          </div>
          <span style="font-size: 11px; font-weight: 500; color: #059669; font-variant-numeric: tabular-nums;">+SAR ${result.bonusAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div style="margin-top: 8px; padding-top: 10px; border-top: 2px solid #064e3b;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <div style="font-size: 13px; color: #374151; font-weight: 600;">Gross Salary</div>
            <div style="font-size: 10px; color: #9ca3af;" dir="rtl">إجمالي الراتب</div>
          </div>
          <span style="font-size: 13px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums;">SAR ${result.grossSalaryBeforePenalties.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Deductions table -->
  <div style="padding: 0 36px 18px;">
    <div style="margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #b91c1c;">
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase;">Deductions</div>
      <div style="font-size: 11px; color: #6b7280;" dir="rtl">الخصومات</div>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #fef2f2; color: #7f1d1d;">
          <th style="text-align: left; padding: 7px 10px; font-weight: 600; font-size: 10px;">Description</th>
          <th style="text-align: right; padding: 7px 10px; font-weight: 600; font-size: 10px;">Amount (SAR)</th>
        </tr>
      </thead>
      <tbody>
        ${deductionRows.join('')}
        <tr style="font-weight: 700; background: #fef2f2; color: #7f1d1d;">
          <td style="padding: 9px 10px; border-top: 2px solid #b91c1c;">
            <div>Total Deductions</div>
            <div style="font-size: 10px; color: #7f1d1d;" dir="rtl">إجمالي الخصومات</div>
          </td>
          <td style="padding: 9px 10px; text-align: right; font-variant-numeric: tabular-nums; border-top: 2px solid #b91c1c; vertical-align: top;">-${totalDeductions.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Traffic detail (if any) -->
  ${traffic && traffic.length > 0 ? `
    <div style="padding: 0 36px 18px;">
      <div style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #92400e;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase;">Traffic Tickets Detail</div>
        <div style="font-size: 11px; color: #6b7280;" dir="rtl">تفاصيل المخالفات</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #fffbeb; color: #92400e;">
            <th style="text-align: left; padding: 4px 8px; font-size: 9px;">Date</th>
            <th style="text-align: left; padding: 4px 8px; font-size: 9px;">Type</th>
            <th style="text-align: left; padding: 4px 8px; font-size: 9px;">Status</th>
            <th style="text-align: right; padding: 4px 8px; font-size: 9px;">Amount (SAR)</th>
          </tr>
        </thead>
        <tbody>${trafficRows}</tbody>
      </table>
    </div>
  ` : ''}

  <!-- Final Net Salary -->
  <div style="margin: 0 36px 18px; padding: 22px 26px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 10px; border: 2px solid #064e3b;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #065f46; font-weight: 600;">Final Net Salary</div>
        <div style="font-size: 13px; color: #065f46; font-weight: 600; margin-top: 2px;" dir="rtl">صافي الراتب النهائي</div>
        <div style="font-size: 10px; color: #047857; margin-top: 4px;">Payable to: ${driver?.beneficiaryName || result.driverName}${driver?.bankName ? ' · ' + driver.bankName : ''}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 30px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; letter-spacing: -0.8px;">SAR ${result.finalNetSalary.toFixed(2)}</div>
        <div style="font-size: 10px; color: #047857; margin-top: 2px;">${company?.currency || 'SAR'} · ${result.payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- Footer + Two signatures -->
  <div style="padding: 20px 36px; border-top: 1px solid #e5e7eb; background: #f9fafb; border-radius: 0 0 10px 10px;">
    <div style="font-size: 10px; color: #6b7280; margin-bottom: 18px; text-align: center;">
      ${company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.'}
      <div style="margin-top: 3px;" dir="rtl">${company?.footerNoteAr || 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.'}</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 24px;">
      <!-- Accounting Manager -->
      <div style="text-align: center;">
        ${company?.signatureImg
          ? `<div style="height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;"><img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 45px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 50px; border-bottom: 1.5px solid #374151; margin-bottom: 4px;"></div>`
        }
        <div style="font-size: 11px; font-weight: 600; color: #374151;">${company?.accManagerName || 'Accounting Manager'}</div>
        <div style="font-size: 10px; color: #6b7280;" dir="rtl">مدير الحسابات</div>
      </div>
      <!-- Driver -->
      <div style="text-align: center;">
        ${company?.riderSignatureImg
          ? `<div style="height: 50px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px;"><img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 45px; object-fit: contain;" crossorigin="anonymous"/></div>`
          : `<div style="height: 50px; border-bottom: 1.5px solid #374151; margin-bottom: 4px;"></div>`
        }
        <div style="font-size: 11px; font-weight: 600; color: #374151;">Driver Signature</div>
        <div style="font-size: 10px; color: #6b7280;" dir="rtl">توقيع السائق</div>
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
