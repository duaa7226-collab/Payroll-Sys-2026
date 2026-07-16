// One-Page All-Riders Payslip PDF — compact table with ALL riders on a single A4 page
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

interface RiderRow {
  driverName: string
  riderId: string
  completedOrders: number
  selectedTargetThreshold: number
  extraOrders: number
  missingOrders: number
  actualWorkingDays: number
  baseSalaryEquivalent: number
  bonusAmount: number
  segmentPayment: number
  missingOrderDeduction: number
  grossSalaryBeforePenalties: number
  totalOtherPenalties: number
  trafficViolationsDeduction: number
  finalNetSalary: number
  performanceBand: string
  penaltiesJson: string
}

export async function generateAllRidersPayslipPDF(
  results: RiderRow[],
  payrollMonth: string,
  company: any,
  ruleSummary?: any
) {
  if (results.length === 0) return

  const totalDrivers = results.length
  const totalOrders = results.reduce((a, r) => a + r.completedOrders, 0)
  const totalTarget = results.reduce((a, r) => a + r.selectedTargetThreshold, 0)
  const totalGross = results.reduce((a, r) => a + r.grossSalaryBeforePenalties, 0)
  const totalBonus = results.reduce((a, r) => a + r.bonusAmount, 0)
  const totalSegment = results.reduce((a, r) => a + (r.segmentPayment || 0), 0)
  const totalMissingDeduct = results.reduce((a, r) => a + r.missingOrderDeduction, 0)
  const totalPenalties = results.reduce((a, r) => a + r.totalOtherPenalties, 0)
  const totalTraffic = results.reduce((a, r) => a + r.trafficViolationsDeduction, 0)
  const totalDeductions = totalPenalties + totalTraffic + totalMissingDeduct
  const totalNet = results.reduce((a, r) => a + r.finalNetSalary, 0)
  const attainmentPct = totalTarget > 0 ? ((totalOrders / totalTarget) * 100).toFixed(1) : '0'

  // Sort by net salary descending
  const sorted = [...results].sort((a, b) => b.finalNetSalary - a.finalNetSalary)

  const html = buildHTML(sorted, {
    totalDrivers, totalOrders, totalTarget, totalGross, totalBonus, totalSegment,
    totalMissingDeduct, totalPenalties, totalTraffic, totalDeductions, totalNet,
    attainmentPct,
  }, payrollMonth, company, ruleSummary)

  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; z-index: -1;'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    await new Promise(res => setTimeout(res, 300))
    const target = container.firstElementChild as HTMLElement
    if (!target) throw new Error('No element')

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

    const fileName = `all_riders_payslip_${payrollMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    try { document.body.removeChild(container) } catch {}
  }
}

function buildHTML(riders: RiderRow[], totals: any, payrollMonth: string, company: any, ruleSummary: any): string {
  const t = totals

  // Rider rows — compact font to fit all on one page
  const riderRows = riders.map((r, i) => {
    const totalDed = r.totalOtherPenalties + r.trafficViolationsDeduction + r.missingOrderDeduction
    return `
    <tr style="border-bottom: 1px solid #f3f4f6; ${i % 2 === 1 ? 'background: #f9fafb;' : ''}">
      <td style="padding: 2px 4px; font-size: 8px; font-weight: 600;">${r.driverName}</td>
      <td style="padding: 2px 4px; font-size: 8px; font-family: monospace;">${r.riderId}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right;">${r.completedOrders}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right; color: #6b7280;">${r.selectedTargetThreshold.toFixed(0)}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right;">${r.actualWorkingDays.toFixed(0)}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right;">${r.grossSalaryBeforePenalties.toFixed(0)}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right; color: #059669;">${r.bonusAmount > 0 ? '+' + r.bonusAmount.toFixed(0) : '—'}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right; color: #0891b2;">${(r.segmentPayment || 0) > 0 ? '+' + (r.segmentPayment || 0).toFixed(0) : '—'}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right; color: #dc2626;">${totalDed > 0 ? '-' + totalDed.toFixed(0) : '—'}</td>
      <td style="padding: 2px 4px; font-size: 8px; text-align: right; font-weight: 700; color: #064e3b;">${r.finalNetSalary.toFixed(0)}</td>
    </tr>`
  }).join('')

  return `
<div style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; position: relative; overflow: hidden;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%); color: #ffffff; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center;">
    <div style="flex: 1;">
      <div style="font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.75; font-weight: 500;">All Riders Payslip</div>
      <div style="font-size: 18px; font-weight: 700; margin-top: 2px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 11px; opacity: 0.9;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
    </div>
    <div style="text-align: right;">
      ${company?.logo ? `<div style="margin-bottom: 4px;"><img src="${company.logo}" alt="Logo" style="max-height: 36px; max-width: 80px; object-fit: contain; background: white; padding: 3px; border-radius: 4px;" crossorigin="anonymous"/></div>` : ''}
      <div style="background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 5px;">
        <div style="font-size: 8px; opacity: 0.8;">Pay Period</div>
        <div style="font-size: 13px; font-weight: 700;">${payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- KPI Strip -->
  <div style="padding: 6px 28px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; background: #f9fafb; border-bottom: 2px solid #064e3b;">
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">DRIVERS</div><div style="font-size: 14px; font-weight: 800; color: #064e3b;">${t.totalDrivers}</div></div>
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">ORDERS</div><div style="font-size: 14px; font-weight: 800; color: #0891b2;">${t.totalOrders}</div></div>
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">TARGET</div><div style="font-size: 14px; font-weight: 800; color: #6b7280;">${t.totalTarget.toFixed(0)}</div></div>
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">GROSS</div><div style="font-size: 14px; font-weight: 800; color: #059669;">${t.totalGross.toFixed(0)}</div></div>
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">DEDUCT</div><div style="font-size: 14px; font-weight: 800; color: #dc2626;">${t.totalDeductions.toFixed(0)}</div></div>
    <div style="text-align: center; padding: 4px;"><div style="font-size: 7px; color: #6b7280; font-weight: 600;">NET</div><div style="font-size: 14px; font-weight: 800; color: #064e3b;">${t.totalNet.toFixed(0)}</div></div>
  </div>

  <!-- Riders Table -->
  <div style="padding: 4px 28px;">
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #064e3b; color: white;">
          <th style="padding: 3px 4px; font-size: 7px; text-align: left; font-weight: 700;">Driver</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: left; font-weight: 700;">ID</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Ord</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Tgt</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Days</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Gross</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Bonus</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Seg</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Deduct</th>
          <th style="padding: 3px 4px; font-size: 7px; text-align: right; font-weight: 700;">Net (SAR)</th>
        </tr>
      </thead>
      <tbody>
        ${riderRows}
        <!-- Total Row -->
        <tr style="font-weight: 700; background: #ecfdf5; border-top: 2px solid #064e3b;">
          <td style="padding: 4px; font-size: 8px;" colspan="2">TOTAL (${t.totalDrivers})</td>
          <td style="padding: 4px; font-size: 8px; text-align: right;">${t.totalOrders}</td>
          <td style="padding: 4px; font-size: 8px; text-align: right; color: #6b7280;">${t.totalTarget.toFixed(0)}</td>
          <td style="padding: 4px; font-size: 8px; text-align: right;"></td>
          <td style="padding: 4px; font-size: 8px; text-align: right;">${t.totalGross.toFixed(0)}</td>
          <td style="padding: 4px; font-size: 8px; text-align: right; color: #059669;">+${t.totalBonus.toFixed(0)}</td>
          <td style="padding: 4px; font-size: 8px; text-align: right; color: #0891b2;">+${t.totalSegment.toFixed(0)}</td>
          <td style="padding: 4px; font-size: 8px; text-align: right; color: #dc2626;">-${t.totalDeductions.toFixed(0)}</td>
          <td style="padding: 4px; font-size: 9px; text-align: right; color: #064e3b;">${t.totalNet.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Summary Breakdown -->
  <div style="padding: 6px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px;">
      <div style="font-size: 8px; font-weight: 700; color: #064e3b; text-transform: uppercase; margin-bottom: 3px;">Earnings Breakdown</div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Base Salary</span><span style="font-weight: 700;">SAR ${(t.totalGross - t.totalBonus - t.totalSegment).toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Performance Bonus</span><span style="font-weight: 700; color: #059669;">+SAR ${t.totalBonus.toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Segment Payment</span><span style="font-weight: 700; color: #0891b2;">+SAR ${t.totalSegment.toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 2px 0; border-top: 1px solid #e5e7eb; margin-top: 2px;"><span style="font-weight: 700;">Total Gross</span><span style="font-weight: 800; color: #064e3b;">SAR ${t.totalGross.toFixed(2)}</span></div>
    </div>
    <div style="border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px;">
      <div style="font-size: 8px; font-weight: 700; color: #b91c1c; text-transform: uppercase; margin-bottom: 3px;">Deductions Breakdown</div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Missing Order Deduct</span><span style="font-weight: 700; color: #9a3412;">-SAR ${t.totalMissingDeduct.toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Penalties</span><span style="font-weight: 700; color: #dc2626;">-SAR ${t.totalPenalties.toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 1px 0;"><span>Traffic Violations</span><span style="font-weight: 700; color: #92400e;">-SAR ${t.totalTraffic.toFixed(0)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 8px; padding: 2px 0; border-top: 1px solid #fecaca; margin-top: 2px;"><span style="font-weight: 700;">Total Deductions</span><span style="font-weight: 800; color: #b91c1c;">-SAR ${t.totalDeductions.toFixed(2)}</span></div>
    </div>
  </div>

  <!-- Final Net Hero -->
  <div style="margin: 4px 28px; padding: 10px 18px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 8px; border: 2px solid #064e3b;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #065f46; font-weight: 700;">Total Final Net Salary</div>
        <div style="font-size: 8px; color: #047857;">${t.totalDrivers} drivers · Attainment: ${t.attainmentPct}%</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 24px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums;">SAR ${t.totalNet.toFixed(2)}</div>
        <div style="font-size: 8px; color: #047857;">${payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- Rules -->
  <div style="margin: 2px 28px; padding: 4px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 7px; color: #6b7280;">
    <strong>Rules:</strong> ${ruleSummary?.salaryMode || 'Orders-Based'} · Base: SAR ${ruleSummary?.monthlyBaseSalary || 2000} · Target: ${ruleSummary?.monthlyTargetOrders || 450} · Per Order: SAR ${ruleSummary?.salaryPerOrderRate?.toFixed(4) || '4.4444'} · Bonus: SAR ${ruleSummary?.bonusPerExtraOrder || 10}/extra · Deduct: SAR ${ruleSummary?.deductionPerMissingOrder || 7}/missing
  </div>

  <!-- Footer with signatures -->
  <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 28px 10px; border-top: 2px solid #064e3b; background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
      <div style="text-align: center;">
        <div style="height: 28px; border-bottom: 2px solid #064e3b; margin-bottom: 2px; position: relative;">
          ${company?.signatureImg ? `<img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 24px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 9px; font-weight: 700; color: #064e3b;">${company?.accManagerName || 'Accounting Manager'}</div>
        <div style="font-size: 8px; color: #047857;" dir="rtl">مدير الحسابات</div>
      </div>
      <div style="text-align: center;">
        <div style="height: 28px; border-bottom: 2px solid #064e3b; margin-bottom: 2px; position: relative;">
          ${company?.riderSignatureImg ? `<img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 24px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 9px; font-weight: 700; color: #064e3b;">Authorized Signature</div>
        <div style="font-size: 8px; color: #047857;" dir="rtl">التوقيع المعتمد</div>
      </div>
    </div>
    <div style="font-size: 7px; color: #6b7280; margin-top: 4px; text-align: center;">
      Generated: ${new Date().toLocaleString()} · ${company?.footerNote || 'Computer-generated report'}
    </div>
  </div>
</div>`
}
