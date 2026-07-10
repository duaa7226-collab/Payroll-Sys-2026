// One-Page Payroll Summary PDF — aggregate totals for ALL riders on a single A4 page
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

interface RiderResult {
  driverName: string
  riderId: string
  completedOrders: number
  selectedTargetThreshold: number
  extraOrders: number
  missingOrders: number
  actualWorkingDays: number
  workingHours: number
  baseSalaryEquivalent: number
  bonusAmount: number
  segmentPayment: number
  missingOrderDeduction: number
  totalOtherPenalties: number
  trafficViolationsDeduction: number
  grossSalaryBeforePenalties: number
  finalNetSalary: number
  performanceBand: string
  penaltiesJson: string
}

const BAND_LABELS: Record<string, string> = {
  top: 'Top',
  high: 'High',
  average: 'Average',
  low: 'Low',
  bottom: 'Bottom',
}

const PENALTY_LABELS: Record<string, string> = {
  acceptance: 'Acceptance Penalty',
  contact: 'Contact Penalty',
  stacking: 'Stacking Deduction',
  declined: 'Declined Penalty',
  late: 'Late Penalty',
  noshow: 'No-Show Penalty',
  noshow_special: 'No-Show Special',
  daily_acceptance: 'Daily Acceptance',
  missed_days: 'Missed Days',
  rider_balance: 'Rider Balance',
  car_deduction: 'Car Deduction',
  tga_deduction: 'TGA Deduction',
}

export async function generateOnePageSummaryPDF(
  results: RiderResult[],
  payrollMonth: string,
  company: any,
  ruleSummary?: any
) {
  if (results.length === 0) return

  // Calculate aggregates
  const totalDrivers = results.length
  const totalCompletedOrders = results.reduce((a, r) => a + r.completedOrders, 0)
  const totalTargetOrders = results.reduce((a, r) => a + r.selectedTargetThreshold, 0)
  const totalExtraOrders = results.reduce((a, r) => a + r.extraOrders, 0)
  const totalMissingOrders = results.reduce((a, r) => a + r.missingOrders, 0)
  const totalWorkingDays = results.reduce((a, r) => a + r.actualWorkingDays, 0)
  const totalWorkingHours = results.reduce((a, r) => a + r.workingHours, 0)
  const totalBaseSalary = results.reduce((a, r) => a + r.baseSalaryEquivalent, 0)
  const totalBonus = results.reduce((a, r) => a + r.bonusAmount, 0)
  const totalSegment = results.reduce((a, r) => a + (r.segmentPayment || 0), 0)
  const totalMissingDeduction = results.reduce((a, r) => a + r.missingOrderDeduction, 0)
  const totalGross = results.reduce((a, r) => a + r.grossSalaryBeforePenalties, 0)
  const totalPenalties = results.reduce((a, r) => a + r.totalOtherPenalties, 0)
  const totalTraffic = results.reduce((a, r) => a + r.trafficViolationsDeduction, 0)
  const totalDeductions = totalPenalties + totalTraffic + totalMissingDeduction
  const totalNet = results.reduce((a, r) => a + r.finalNetSalary, 0)

  // Penalty breakdown across all riders
  const penaltyTotals: Record<string, number> = {}
  for (const r of results) {
    try {
      const p = JSON.parse(r.penaltiesJson || '{}')
      for (const [k, v] of Object.entries(p)) {
        penaltyTotals[k] = (penaltyTotals[k] ?? 0) + (v as number)
      }
    } catch {}
  }
  const penaltyEntries = Object.entries(penaltyTotals)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  // Performance band distribution
  const bandCounts: Record<string, number> = { top: 0, high: 0, average: 0, low: 0, bottom: 0 }
  for (const r of results) bandCounts[r.performanceBand] = (bandCounts[r.performanceBand] ?? 0) + 1

  // Top 3 earners
  const topEarners = [...results].sort((a, b) => b.finalNetSalary - a.finalNetSalary).slice(0, 3)
  // Top 3 deductions
  const topDeductions = [...results].sort((a, b) =>
    (b.totalOtherPenalties + b.trafficViolationsDeduction + b.missingOrderDeduction) -
    (a.totalOtherPenalties + a.trafficViolationsDeduction + a.missingOrderDeduction)
  ).slice(0, 3)

  const html = buildSummaryHTML({
    totalDrivers, totalCompletedOrders, totalTargetOrders, totalExtraOrders, totalMissingOrders,
    totalWorkingDays, totalWorkingHours, totalBaseSalary, totalBonus, totalSegment,
    totalMissingDeduction, totalGross, totalPenalties, totalTraffic, totalDeductions, totalNet,
    penaltyEntries, bandCounts, topEarners, topDeductions,
    payrollMonth, company, ruleSummary,
  })

  // Render in hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed; top:-10000px; left:0; width:850px; height:1200px; border:0; z-index:-1;'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) throw new Error('Cannot access iframe document')

    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; width: 800px; height: 1131px; overflow: hidden; }
          body { font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; }
          table { border-collapse: collapse; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `)
    iframeDoc.close()

    await new Promise(res => setTimeout(res, 800))
    if (iframe.contentWindow?.document.fonts) {
      try { await iframe.contentWindow.document.fonts.ready } catch {}
    }

    const target = iframeDoc.body.firstElementChild as HTMLElement
    if (!target) throw new Error('No summary element in iframe')

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

    const fileName = `payroll_one_page_summary_${payrollMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    try { document.body.removeChild(iframe) } catch {}
  }
}

function buildSummaryHTML(data: any): string {
  const {
    totalDrivers, totalCompletedOrders, totalTargetOrders, totalExtraOrders, totalMissingOrders,
    totalWorkingDays, totalWorkingHours, totalBaseSalary, totalBonus, totalSegment,
    totalMissingDeduction, totalGross, totalPenalties, totalTraffic, totalDeductions, totalNet,
    penaltyEntries, bandCounts, topEarners, topDeductions,
    payrollMonth, company, ruleSummary,
  } = data

  const attainmentPct = totalTargetOrders > 0 ? ((totalCompletedOrders / totalTargetOrders) * 100).toFixed(1) : '0'

  return `
<div style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; position: relative; overflow: hidden;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%); color: #ffffff; padding: 18px 32px; display: flex; justify-content: space-between; align-items: center;">
    <div style="flex: 1;">
      <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75; font-weight: 500;">Payroll Summary Report · <span dir="rtl">تقرير ملخص الرواتب</span></div>
      <div style="font-size: 20px; font-weight: 700; margin-top: 3px; letter-spacing: -0.5px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 1px;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
    </div>
    <div style="text-align: right;">
      ${company?.logo ? `<div style="margin-bottom: 4px;"><img src="${company.logo}" alt="Logo" style="max-height: 40px; max-width: 90px; object-fit: contain; background: white; padding: 4px; border-radius: 6px;" crossorigin="anonymous"/></div>` : ''}
      <div style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25);">
        <div style="font-size: 8px; opacity: 0.8; letter-spacing: 1.5px; text-transform: uppercase;">Pay Period</div>
        <div style="font-size: 14px; font-weight: 700;">${payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- KPI Strip — 6 cards -->
  <div style="padding: 10px 32px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; background: #f9fafb; border-bottom: 2px solid #064e3b;">
    ${[
      { label: 'Drivers', value: totalDrivers, color: '#064e3b' },
      { label: 'Total Orders', value: totalCompletedOrders, color: '#0891b2' },
      { label: 'Target Orders', value: totalTargetOrders.toFixed(0), color: '#6b7280' },
      { label: 'Working Days', value: totalWorkingDays.toFixed(0), color: '#7c3aed' },
      { label: 'Gross (SAR)', value: totalGross.toFixed(0), color: '#059669' },
      { label: 'Net (SAR)', value: totalNet.toFixed(0), color: '#dc2626' },
    ].map(k => `
      <div style="text-align: center; padding: 6px 4px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
        <div style="font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600;">${k.label}</div>
        <div style="font-size: 16px; font-weight: 800; color: ${k.color}; margin-top: 2px; font-variant-numeric: tabular-nums;">${k.value}</div>
      </div>
    `).join('')}
  </div>

  <!-- Body: Three columns -->
  <div style="padding: 10px 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">

    <!-- Column 1: Orders & Performance -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;">
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 2px solid #064e3b;">Orders & Performance</div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Completed Orders</span>
        <span style="font-size: 10px; font-weight: 700; color: #111827;">${totalCompletedOrders}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Target Orders</span>
        <span style="font-size: 10px; font-weight: 700; color: #6b7280;">${totalTargetOrders.toFixed(0)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Extra Orders</span>
        <span style="font-size: 10px; font-weight: 700; color: #059669;">+${totalExtraOrders}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Missing Orders</span>
        <span style="font-size: 10px; font-weight: 700; color: #dc2626;">-${totalMissingOrders}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Attainment %</span>
        <span style="font-size: 10px; font-weight: 700; color: #065f46;">${attainmentPct}%</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Working Hours</span>
        <span style="font-size: 10px; font-weight: 700; color: #111827;">${totalWorkingHours.toFixed(0)}</span>
      </div>
      <div style="margin-top: 5px; padding-top: 3px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 8px; color: #6b7280; margin-bottom: 3px;">Performance Bands:</div>
        ${Object.entries(bandCounts).filter(([_, v]) => v > 0).map(([band, count]) => `
          <div style="display: flex; justify-content: space-between; padding: 1px 0;">
            <span style="font-size: 9px; color: #374151;">${BAND_LABELS[band] || band}</span>
            <span style="font-size: 9px; font-weight: 700; color: #111827;">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Column 2: Earnings Breakdown -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;">
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 2px solid #064e3b;">Earnings · <span dir="rtl">الأرباح</span></div>
      <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Base Salary</span>
        <span style="font-size: 10px; font-weight: 700; color: #111827;">SAR ${totalBaseSalary.toFixed(2)}</span>
      </div>
      ${totalBonus > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 9px; color: #374151;">Performance Bonus</span>
          <span style="font-size: 10px; font-weight: 700; color: #059669;">+SAR ${totalBonus.toFixed(2)}</span>
        </div>
      ` : ''}
      ${totalSegment > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 9px; color: #374151;">Segment Payment</span>
          <span style="font-size: 10px; font-weight: 700; color: #0891b2;">+SAR ${totalSegment.toFixed(2)}</span>
        </div>
      ` : ''}
      <div style="margin-top: 5px; padding-top: 3px; border-top: 2px solid #064e3b; display: flex; justify-content: space-between;">
        <span style="font-size: 10px; font-weight: 700; color: #064e3b;">Total Gross</span>
        <span style="font-size: 12px; font-weight: 800; color: #064e3b;">SAR ${totalGross.toFixed(2)}</span>
      </div>

      <!-- Deductions breakdown -->
      <div style="margin-top: 8px; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid #b91c1c;">Deductions · <span dir="rtl">الخصومات</span></div>
      ${totalMissingDeduction > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 9px; color: #374151;">Missing Order Deduct</span>
          <span style="font-size: 9px; font-weight: 700; color: #9a3412;">-${totalMissingDeduction.toFixed(2)}</span>
        </div>
      ` : ''}
      ${penaltyEntries.slice(0, 5).map(([key, val]) => `
        <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 9px; color: #374151;">${PENALTY_LABELS[key] || key}</span>
          <span style="font-size: 9px; font-weight: 700; color: #b91c1c;">-${(val as number).toFixed(2)}</span>
        </div>
      `).join('')}
      <div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 9px; color: #374151;">Traffic Violations</span>
        <span style="font-size: 9px; font-weight: 700; color: #92400e;">-${totalTraffic.toFixed(2)}</span>
      </div>
      <div style="margin-top: 4px; padding-top: 3px; border-top: 2px solid #b91c1c; display: flex; justify-content: space-between;">
        <span style="font-size: 10px; font-weight: 700; color: #b91c1c;">Total Deductions</span>
        <span style="font-size: 12px; font-weight: 800; color: #b91c1c;">-${totalDeductions.toFixed(2)}</span>
      </div>
    </div>

    <!-- Column 3: Top Earners & Top Deductions -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px;">
      <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 2px solid #064e3b;">Top Earners</div>
      ${topEarners.map((r: any, i: number) => `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <div>
            <span style="font-size: 9px; font-weight: 700; color: #111827;">${i + 1}. ${r.driverName}</span>
            <div style="font-size: 8px; color: #9ca3af; font-family: monospace;">${r.riderId}</div>
          </div>
          <span style="font-size: 10px; font-weight: 700; color: #059669;">${r.finalNetSalary.toFixed(2)}</span>
        </div>
      `).join('')}

      <div style="margin-top: 8px; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 2px solid #b91c1c;">Highest Deductions</div>
      ${topDeductions.map((r: any, i: number) => {
        const totalDed = r.totalOtherPenalties + r.trafficViolationsDeduction + r.missingOrderDeduction
        return `
          <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
            <div>
              <span style="font-size: 9px; font-weight: 700; color: #111827;">${i + 1}. ${r.driverName}</span>
              <div style="font-size: 8px; color: #9ca3af; font-family: monospace;">${r.riderId}</div>
            </div>
            <span style="font-size: 10px; font-weight: 700; color: #dc2626;">-${totalDed.toFixed(2)}</span>
          </div>
        `
      }).join('')}
    </div>
  </div>

  <!-- Per-Rider Summary Table -->
  <div style="padding: 0 32px 8px;">
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="padding: 5px 10px; background: linear-gradient(90deg, #f9fafb 0%, #ffffff 100%); border-bottom: 2px solid #064e3b;">
        <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase;">Per-Rider Summary · <span dir="rtl">ملخص لكل سائق</span></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: #f9fafb; color: #374151; border-bottom: 1px solid #e5e7eb;">
            <th style="text-align: left; padding: 3px 8px; font-weight: 600; font-size: 8px;">Driver</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Orders</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Days</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Gross</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Bonus</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Penalties</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Traffic</th>
            <th style="text-align: right; padding: 3px 6px; font-weight: 600; font-size: 8px;">Deduct</th>
            <th style="text-align: right; padding: 3px 8px; font-weight: 700; font-size: 8px; color: #065f46;">Net (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${topEarners.length > 0 ? topEarners.map((r: any) => {
            const totalDed = r.totalOtherPenalties + r.trafficViolationsDeduction + r.missingOrderDeduction
            return `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 3px 8px; font-weight: 600;">${r.driverName}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums;">${r.completedOrders}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums;">${r.actualWorkingDays.toFixed(0)}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums;">${r.grossSalaryBeforePenalties.toFixed(0)}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #059669;">${r.bonusAmount > 0 ? '+' + r.bonusAmount.toFixed(0) : '—'}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #dc2626;">${r.totalOtherPenalties > 0 ? '-' + r.totalOtherPenalties.toFixed(0) : '—'}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e;">${r.trafficViolationsDeduction > 0 ? '-' + r.trafficViolationsDeduction.toFixed(0) : '—'}</td>
                <td style="padding: 3px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #dc2626;">-${totalDed.toFixed(0)}</td>
                <td style="padding: 3px 8px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: #065f46;">${r.finalNetSalary.toFixed(2)}</td>
              </tr>
            `
          }).join('') : ''}
          <!-- Total Row -->
          <tr style="font-weight: 700; background: #f0fdf4; border-top: 2px solid #064e3b;">
            <td style="padding: 4px 8px;">TOTAL (${totalDrivers})</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums;">${totalCompletedOrders}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums;">${totalWorkingDays.toFixed(0)}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums;">${totalGross.toFixed(0)}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #059669;">+${totalBonus.toFixed(0)}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #dc2626;">-${totalPenalties.toFixed(0)}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e;">-${totalTraffic.toFixed(0)}</td>
            <td style="padding: 4px 6px; text-align: right; font-variant-numeric: tabular-nums; color: #dc2626;">-${totalDeductions.toFixed(0)}</td>
            <td style="padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums; color: #065f46; font-size: 11px;">${totalNet.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Final Net Salary Hero -->
  <div style="margin: 0 32px 8px; padding: 12px 20px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%); border-radius: 10px; border: 2px solid #064e3b; box-shadow: 0 4px 12px rgba(6, 78, 59, 0.15); position: relative; overflow: hidden;">
    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #064e3b;"></div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #065f46; font-weight: 700;">Total Final Net Salary · <span dir="rtl">إجمالي صافي الرواتب</span></div>
        <div style="font-size: 9px; color: #047857; margin-top: 2px;">${totalDrivers} drivers · ${payrollMonth} · Attainment: ${attainmentPct}%</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 28px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1;">SAR ${totalNet.toFixed(2)}</div>
        <div style="font-size: 9px; color: #047857; margin-top: 2px;">Gross: SAR ${totalGross.toFixed(0)} · Deductions: SAR ${totalDeductions.toFixed(0)}</div>
      </div>
    </div>
  </div>

  <!-- Active Rules Summary -->
  <div style="margin: 0 32px 8px; padding: 6px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 9px; color: #6b7280;">
    <strong style="color: #374151;">Active Rules:</strong>
    ${ruleSummary ? `
      Mode: ${ruleSummary.salaryMode} · Base: SAR ${ruleSummary.monthlyBaseSalary} · Target: ${ruleSummary.monthlyTargetOrders} orders · Per Order: SAR ${ruleSummary.salaryPerOrderRate?.toFixed(4)} · Bonus: SAR ${ruleSummary.bonusPerExtraOrder}/extra · Deduct: SAR ${ruleSummary.deductionPerMissingOrder}/missing
    ` : 'Rules not available'}
  </div>

  <!-- Footer -->
  <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 32px 10px; border-top: 2px solid #064e3b; background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div style="text-align: center;">
        <div style="height: 30px; border-bottom: 2px solid #064e3b; margin-bottom: 3px; position: relative;">
          ${company?.signatureImg ? `<img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 26px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 10px; font-weight: 700; color: #064e3b;">${company?.accManagerName || 'Accounting Manager'}</div>
        <div style="font-size: 8px; color: #047857;" dir="rtl">مدير الحسابات</div>
      </div>
      <div style="text-align: center;">
        <div style="height: 30px; border-bottom: 2px solid #064e3b; margin-bottom: 3px; position: relative;">
          ${company?.riderSignatureImg ? `<img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 26px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 10px; font-weight: 700; color: #064e3b;">Authorized Signature</div>
        <div style="font-size: 8px; color: #047857;" dir="rtl">التوقيع المعتمد</div>
      </div>
    </div>
    <div style="font-size: 7px; color: #6b7280; margin-top: 6px; text-align: center;">
      Generated: ${new Date().toLocaleString()} · ${company?.footerNote || 'Computer-generated summary report'}
    </div>
  </div>
</div>`
}
