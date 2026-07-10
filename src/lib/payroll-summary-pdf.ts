// Payroll Summary PDF — generates a multi-page PDF with all riders, one page per rider
// Each page shows: identity, earnings breakdown, deductions breakdown, traffic violations, final net
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

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

interface RiderData {
  result: any
  driver: any
  traffic: any[]
  penalties: Record<string, number>
}

export async function generatePayrollSummaryPDF(riders: RiderData[], payrollMonth: string, company: any) {
  if (riders.length === 0) return

  // Build HTML for all riders — one page per rider (800×1131px = A4 ratio)
  const pagesHtml = riders.map((data, idx) => buildRiderPageHtml(data, idx + 1, riders.length, payrollMonth, company)).join('<div style="page-break-after: always; height: 20px;"></div>')

  // Create hidden container
  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; top: -10000px; left: 0; width: 800px; background: white; color: black; z-index: -1;'
  container.innerHTML = pagesHtml
  document.body.appendChild(container)

  try {
    // Create iframe for isolated rendering
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed; top:-10000px; left:0; width:850px; height:1200px; border:0; z-index:-1;'
    document.body.appendChild(iframe)

    let pdf: jsPDF | null = null

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
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; width: 800px; }
            body { font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; }
            table { border-collapse: collapse; }
            img { max-width: 100%; }
            .rider-page { width: 800px; height: 1131px; overflow: hidden; page-break-after: always; }
          </style>
        </head>
        <body>${container.innerHTML}</body>
        </html>
      `)
      iframeDoc.close()

      // Wait for fonts
      await new Promise(res => setTimeout(res, 800))
      if (iframe.contentWindow?.document.fonts) {
        try { await iframe.contentWindow.document.fonts.ready } catch {}
      }

      // Render each page separately
      const pageElements = iframeDoc.querySelectorAll('.rider-page')
      if (pageElements.length === 0) throw new Error('No rider pages found')

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement
        const canvas = await html2canvas(pageEl, {
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

        if (i === 0) {
          pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
        } else {
          pdf!.addPage()
        }

        const pageWidth = pdf!.internal.pageSize.getWidth()
        const pageHeight = pdf!.internal.pageSize.getHeight()
        pdf!.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
      }
    } finally {
      try { document.body.removeChild(iframe) } catch {}
    }

    if (!pdf) throw new Error('PDF generation failed')

    const fileName = `payroll_summary_${payrollMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
  } finally {
    try { document.body.removeChild(container) } catch {}
  }
}

function buildRiderPageHtml(data: RiderData, pageNum: number, totalPages: number, payrollMonth: string, company: any): string {
  const { result, driver, traffic, penalties } = data
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

  // Build deductions rows
  const deductionRows: string[] = []
  if (result.missingOrderDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fff7ed;">
        <td style="padding: 4px 10px; font-size: 10px; font-weight: 500;">Missing Order Deduction <span style="font-size: 9px; color: #9ca3af;" dir="rtl">خصم الطلبات الناقصة</span></td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #9a3412; font-size: 10px;">-${result.missingOrderDeduction.toFixed(2)}</td>
      </tr>`)
  }
  for (const [key, val] of penaltyEntries) {
    const lbl = PENALTY_LABELS[key] ?? { en: key, ar: '' }
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 4px 10px; font-size: 10px;">${lbl.en} <span style="font-size: 9px; color: #9ca3af;" dir="rtl">${lbl.ar}</span></td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #b91c1c; font-size: 10px;">-${(val as number).toFixed(2)}</td>
      </tr>`)
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(`
      <tr style="border-bottom: 1px solid #f3f4f6; background: #fffbeb;">
        <td style="padding: 4px 10px; font-size: 10px; font-weight: 500;">Traffic Violations <span style="font-size: 9px; color: #9ca3af;" dir="rtl">المخالفات المرورية</span></td>
        <td style="padding: 4px 10px; text-align: right; font-variant-numeric: tabular-nums; color: #92400e; font-size: 10px;">-${result.trafficViolationsDeduction.toFixed(2)}</td>
      </tr>`)
  }

  // Build traffic detail rows
  const trafficRows: string[] = (traffic || []).map((t: any) => {
    const isInstallment = t.installmentEnabled && t.installmentStatus === 'active'
    const remaining = t.installmentEnabled ? Math.max(0, t.amount - t.installmentTotalPaid) : t.amount
    const deductedThisMonth = isInstallment ? t.installmentMonthlyAmount : t.amount
    return `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 3px 8px; font-size: 9px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
        <td style="padding: 3px 8px; font-size: 9px;">${t.violationType}${isInstallment ? ' (installment)' : ''}</td>
        <td style="padding: 3px 8px; font-size: 9px; text-align: right;">${deductedThisMonth.toFixed(2)}${isInstallment ? ` / ${t.amount.toFixed(0)}` : ''}</td>
      </tr>`
  }).join('')

  return `
<div class="rider-page" style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; position: relative; overflow: hidden;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%); color: #ffffff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center;">
    <div style="flex: 1;">
      <div style="font-size: 9px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75; font-weight: 500;">Payroll Summary · <span dir="rtl">ملخص الرواتب</span></div>
      <div style="font-size: 20px; font-weight: 700; margin-top: 4px; letter-spacing: -0.5px;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
      <div style="font-size: 12px; opacity: 0.9; margin-top: 1px;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
    </div>
    <div style="text-align: right;">
      ${company?.logo ? `<div style="margin-bottom: 6px;"><img src="${company.logo}" alt="Logo" style="max-height: 45px; max-width: 100px; object-fit: contain; background: white; padding: 4px; border-radius: 6px;" crossorigin="anonymous"/></div>` : ''}
      <div style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25);">
        <div style="font-size: 8px; opacity: 0.8; letter-spacing: 1.5px; text-transform: uppercase;">Pay Period</div>
        <div style="font-size: 14px; font-weight: 700;">${payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- Rider Identity -->
  <div style="padding: 12px 32px; background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%); border-bottom: 3px solid #064e3b;">
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
      <div style="border-left: 3px solid #059669; padding-left: 8px;">
        <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">Driver Name</div>
        <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px;">${result.driverName}</div>
      </div>
      <div style="border-left: 3px solid #059669; padding-left: 8px;">
        <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">Rider ID</div>
        <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; font-family: monospace;">${result.riderId}</div>
      </div>
      <div style="border-left: 3px solid #059669; padding-left: 8px;">
        <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">Contract</div>
        <div style="font-size: 11px; font-weight: 700; color: #111827; margin-top: 2px; font-family: monospace;">${result.contractName}</div>
      </div>
      <div style="border-left: 3px solid #059669; padding-left: 8px;">
        <div style="font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">Performance</div>
        <div style="font-size: 12px; font-weight: 700; color: #065f46; margin-top: 2px;">${band.en} · ${attainmentPct}%</div>
      </div>
    </div>
  </div>

  <!-- Body: Two columns -->
  <div style="padding: 12px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

    <!-- Left: Working Summary + Earnings -->
    <div>
      <!-- Working Summary -->
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px;">
        <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #064e3b;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase;">Working Summary · <span dir="rtl">ملخص العمل</span></div>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 10px; color: #374151;">Completed Orders</span>
          <span style="font-size: 10px; font-weight: 700; color: #111827;">${result.completedOrders}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 10px; color: #374151;">Target Orders</span>
          <span style="font-size: 10px; font-weight: 700; color: #111827;">${result.selectedTargetThreshold.toFixed(0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 10px; color: #374151;">Extra / Missing</span>
          <span style="font-size: 10px; font-weight: 700; color: ${result.extraOrders > 0 ? '#059669' : '#dc2626'};">${result.extraOrders > 0 ? '+' + result.extraOrders : '-' + result.missingOrders}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 10px; color: #374151;">Working Days</span>
          <span style="font-size: 10px; font-weight: 700; color: #111827;">${result.actualWorkingDays.toFixed(0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 3px 0;">
          <span style="font-size: 10px; color: #374151;">Working Hours</span>
          <span style="font-size: 10px; font-weight: 700; color: #111827;">${result.workingHours.toFixed(1)}</span>
        </div>
      </div>

      <!-- Earnings -->
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px;">
        <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #064e3b;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #064e3b; text-transform: uppercase;">Earnings · <span dir="rtl">الأرباح</span></div>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
          <span style="font-size: 10px; color: #374151;">${baseSalaryLabel}</span>
          <span style="font-size: 10px; font-weight: 700; color: #111827;">SAR ${baseSalaryValue.toFixed(2)}</span>
        </div>
        ${result.bonusAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 10px; color: #374151;">Performance Bonus</span>
            <span style="font-size: 10px; font-weight: 700; color: #059669;">+SAR ${result.bonusAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${(result.segmentPayment || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 10px; color: #374151;">Segment Payment</span>
            <span style="font-size: 10px; font-weight: 700; color: #0891b2;">+SAR ${result.segmentPayment.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="margin-top: 6px; padding-top: 4px; border-top: 2px solid #064e3b; display: flex; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; color: #064e3b;">Gross Salary</span>
          <span style="font-size: 14px; font-weight: 800; color: #064e3b;">SAR ${result.grossSalaryBeforePenalties.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Right: Deductions + Traffic -->
    <div>
      <!-- Deductions -->
      <div style="background: #ffffff; border: 1px solid #fecaca; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
        <div style="padding: 6px 14px; background: linear-gradient(90deg, #fef2f2 0%, #ffffff 100%); border-bottom: 2px solid #b91c1c;">
          <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #7f1d1d; text-transform: uppercase;">Deductions · <span dir="rtl">الخصومات</span></div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${deductionRows.length > 0 ? deductionRows.join('') : '<tr><td style="padding: 8px; text-align: center; color: #9ca3af; font-size: 10px;">No deductions</td></tr>'}
            <tr style="font-weight: 700; background: #fef2f2; color: #7f1d1d;">
              <td style="padding: 6px 10px; border-top: 2px solid #b91c1c; font-size: 11px;">Total Deductions <span style="font-size: 9px;" dir="rtl">إجمالي الخصومات</span></td>
              <td style="padding: 6px 10px; text-align: right; font-variant-numeric: tabular-nums; border-top: 2px solid #b91c1c; font-size: 12px;">-${totalDeductions.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Traffic Violations -->
      ${traffic && traffic.length > 0 ? `
        <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 8px; overflow: hidden;">
          <div style="padding: 5px 14px; background: linear-gradient(90deg, #fffbeb 0%, #ffffff 100%); border-bottom: 2px solid #92400e;">
            <div style="font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #92400e; text-transform: uppercase;">Traffic Violations · <span dir="rtl">المخالفات المرورية</span></div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead>
              <tr style="background: #fffbeb; color: #92400e;">
                <th style="text-align: left; padding: 3px 8px; font-size: 8px;">Date</th>
                <th style="text-align: left; padding: 3px 8px; font-size: 8px;">Type</th>
                <th style="text-align: right; padding: 3px 8px; font-size: 8px;">Amount (SAR)</th>
              </tr>
            </thead>
            <tbody>${trafficRows}</tbody>
          </table>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Final Net Salary Hero -->
  <div style="margin: 8px 32px 8px; padding: 14px 22px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%); border-radius: 10px; border: 2px solid #064e3b; box-shadow: 0 4px 12px rgba(6, 78, 59, 0.15); position: relative; overflow: hidden;">
    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #064e3b;"></div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #065f46; font-weight: 700;">Final Net Salary · <span dir="rtl">صافي الراتب النهائي</span></div>
        <div style="font-size: 10px; color: #047857; margin-top: 3px;">Payable to: ${driver?.beneficiaryName || result.driverName}${driver?.bankName ? ' · ' + driver.bankName : ''}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 28px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1;">SAR ${result.finalNetSalary.toFixed(2)}</div>
        <div style="font-size: 9px; color: #047857; margin-top: 3px;">${company?.currency || 'SAR'} · ${payrollMonth}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 32px 12px; border-top: 2px solid #064e3b; background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 4px;">
      <div style="text-align: center;">
        <div style="height: 36px; border-bottom: 2px solid #064e3b; margin-bottom: 4px; position: relative;">
          ${company?.signatureImg ? `<img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 32px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #064e3b;">${company?.accManagerName || 'Accounting Manager'}</div>
        <div style="font-size: 9px; color: #047857;" dir="rtl">مدير الحسابات</div>
      </div>
      <div style="text-align: center;">
        <div style="height: 36px; border-bottom: 2px solid #064e3b; margin-bottom: 4px; position: relative;">
          ${company?.riderSignatureImg ? `<img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 32px; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);" crossorigin="anonymous"/>` : ''}
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #064e3b;">Driver Signature</div>
        <div style="font-size: 9px; color: #047857;" dir="rtl">توقيع السائق</div>
      </div>
    </div>
    <div style="font-size: 8px; color: #6b7280; margin-top: 8px; text-align: center;">
      Page ${pageNum} of ${totalPages} · ${company?.footerNote || 'Computer-generated payslip'}
    </div>
  </div>
</div>`
}
