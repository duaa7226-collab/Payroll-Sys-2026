// Premium 2026 Payslip PDF Generator — Elite Development design (EXACT clone)
// Uses html2canvas-pro to capture the browser-rendered HTML payslip (which supports
// Arabic perfectly via the browser's font/text engine) and embeds it as an image
// in a jsPDF A4 document.
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

// Exact colors from reference PDF
const BLUE = '#1e3a8a'     // Earnings / blue side of gradient
const ORANGE = '#ea580c'   // Deductions / orange side of gradient
const LIGHT_BG = '#f8fafc' // Total row background

// Format number with thousand separators and 2 decimals — matches reference "1,998.00"
function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Helper: build a deduction row — always shown, even when 0.00
function deductionRow(ar: string, en: string, amount: number): string {
  return `
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
      <div>
        <div style="font-size: 11px; color: #374151; font-weight: 500;" dir="rtl">${ar}</div>
        <div style="font-size: 9px; color: #9ca3af;">${en}</div>
      </div>
      <span style="font-size: 12px; font-weight: 700; color: ${ORANGE}; font-variant-numeric: tabular-nums;">– ${fmt(amount)} SAR</span>
    </div>`
}

// Helper: build an earnings row
function earningsRow(ar: string, en: string, amount: number, sign: '' | '+' = ''): string {
  return `
    <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
      <div>
        <div style="font-size: 11px; color: #374151; font-weight: 500;" dir="rtl">${ar}</div>
        <div style="font-size: 9px; color: #9ca3af;">${en}</div>
      </div>
      <span style="font-size: 12px; font-weight: 700; color: ${BLUE}; font-variant-numeric: tabular-nums;">${sign} ${fmt(amount)} SAR</span>
    </div>`
}

// Build the payslip HTML string — EXACT clone of Elite Development reference
function buildPayslipHTML(data: any): string {
  const { result, driver, company, traffic, penalties } = data
  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : '0'

  // Salary per order rate
  const salaryPerOrder = result.appliedSalaryPerOrder || (result.appliedBaseSalary / result.appliedMonthlyTarget) || 0

  // Penalties from JSON — extract specific ones (others ignored)
  const p = penalties || {}
  const stacking = Math.abs(p.stacking || 0)
  const declined = Math.abs(p.declined || 0)
  const late = Math.abs(p.late || 0)
  const noshow = Math.abs(p.noshow || 0)
  const missedDays = Math.abs(p.missed_days || 0)
  const riderBalance = Math.abs(p.rider_balance || 0)

  // ===== Earnings rows (3 items + total) =====
  const earningsRows: string[] = []
  // 1. Order Earnings = Expected Orders × Price
  earningsRows.push(earningsRow(
    'إجمالي الأرباح من الطلبات',
    `Order Earnings (${result.selectedTargetThreshold.toFixed(0)} × ${salaryPerOrder.toFixed(2)})`,
    result.baseSalaryEquivalent
  ))
  // 2. Bonus (Extra Orders)
  if (result.bonusAmount > 0) {
    earningsRows.push(earningsRow(
      'العمولة الإضافية',
      `Bonus (Extra Orders: ${result.extraOrders} × ${result.appliedBonusPerExtra.toFixed(2)})`,
      result.bonusAmount,
      '+'
    ))
  }
  // 3. Segment Payment
  if ((result.segmentPayment || 0) > 0) {
    earningsRows.push(earningsRow(
      'دفعة الشريحة',
      'Segment Payment',
      result.segmentPayment,
      '+'
    ))
  }
  // 4. Custom bonuses
  for (const cb of (data.customBonuses || [])) {
    earningsRows.push(earningsRow(
      cb.nameAr || cb.name,
      cb.name,
      cb.amount,
      '+'
    ))
  }

  // ===== Deductions rows — ALL ALWAYS SHOWN (matching reference) =====
  const deductionRows: string[] = []
  // 1. Missing-Order Deduction
  deductionRows.push(deductionRow('خصم الطلبات المفقودة', 'Missing-Order Deduction', result.missingOrderDeduction))
  // 2. Stacking Deduction
  deductionRows.push(deductionRow('خصم التجميع', 'Stacking Deduction', stacking))
  // 3. Declined Penalties
  deductionRows.push(deductionRow('الغرامات المرفوضة', 'Declined Penalties', declined))
  // 4. Late Penalty
  deductionRows.push(deductionRow('غرامة التأخير', 'Late Penalty', late))
  // 5. No-Show Penalty
  deductionRows.push(deductionRow('غرامة عدم الحضور', 'No-Show Penalty', noshow))
  // 6. Missed-Days Penalty
  deductionRows.push(deductionRow('غرامة الأيام المفقودة', 'Missed-Days Penalty', missedDays))
  // 7. Rider Balance Deduction
  deductionRows.push(deductionRow('خصم رصيد السائق', 'Rider Balance Deduction', riderBalance))
  // 8. Traffic Violations (if any)
  if (result.trafficViolationsDeduction > 0) {
    deductionRows.push(deductionRow('المخالفات المرورية', 'Traffic Violations', result.trafficViolationsDeduction))
  }
  // 9. Custom deductions
  for (const cd of (data.customDeductions || [])) {
    deductionRows.push(deductionRow(cd.nameAr || cd.name, cd.name, cd.amount))
  }

  return `
<div style="background: #ffffff; color: #000000; width: 800px; height: 1131px; box-sizing: border-box; font-family: 'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif; display: flex; flex-direction: column; overflow: hidden; padding: 22px;">

  <!-- ===== HEADER — blue 60% → orange 40% gradient ===== -->
  <div style="background: linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 60%, ${ORANGE} 100%); color: #ffffff; border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 3px 10px rgba(30, 58, 138, 0.2); flex-shrink: 0;">
    <!-- Left: Logo + Company info -->
    <div style="display: flex; align-items: center; gap: 12px;">
      ${company?.logo
        ? `<img src="${company.logo}" alt="Logo" style="height: 44px; width: 44px; object-fit: contain; background: white; padding: 3px; border-radius: 50%; border: 2px solid ${ORANGE};" crossorigin="anonymous"/>`
        : `<div style="height: 44px; width: 44px; background: white; border-radius: 50%; border: 2px solid ${ORANGE}; display: flex; align-items: center; justify-content: center; color: ${BLUE}; font-weight: 800; font-size: 16px;">${(company?.name || 'N').charAt(0)}</div>`
      }
      <div>
        <div style="font-size: 14px; font-weight: 700;" dir="rtl">${company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'}</div>
        <div style="font-size: 12px; font-weight: 600;">${company?.name || 'Nokhaba Tatweer for Trading'}</div>
        <div style="font-size: 9px; opacity: 0.9; margin-top: 1px;">VAT: ${company?.vatNumber || 'N/A'} · ${company?.address || 'Riyadh, KSA'}</div>
      </div>
    </div>
    <!-- Right: Payslip title -->
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 700;" dir="rtl">بيان المرتب</div>
      <div style="font-size: 13px; font-weight: 700; color: #FFEEC2;">PAYSLIP</div>
      <div style="font-size: 10px; opacity: 0.95; margin-top: 2px;">${result.payrollMonth}</div>
    </div>
  </div>

  <!-- ===== Driver Info — 6 separate bordered boxes (2 rows × 3 cols), label ABOVE each box ===== -->
  <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; row-gap: 12px; flex-shrink: 0;">
    ${[
      { ar: 'اسم المستفيد', en: 'BENEFICIARY', val: driver?.beneficiaryName || result.driverName, mono: false },
      { ar: 'معرف المندوب', en: 'RIDER ID', val: result.riderId, mono: true },
      { ar: 'العقد', en: 'CONTRACT', val: result.contractName, mono: true },
      { ar: 'نوع المركبة', en: 'VEHICLE', val: result.vehicleType, mono: false },
      { ar: 'البنك', en: 'BANK', val: driver?.bankName || '—', mono: false },
      { ar: 'الآيبان', en: 'IBAN', val: driver?.iban || '—', mono: true },
    ].map(f => `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; padding: 0 2px;">
          <div style="font-size: 8px; color: #9ca3af; font-weight: 700; letter-spacing: 0.8px;">${f.en}</div>
          <div style="font-size: 11px; color: #374151; font-weight: 600;" dir="rtl">${f.ar}</div>
        </div>
        <div style="background: white; border: 1px solid #E0E0E0; border-radius: 6px; padding: 8px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); min-height: 32px; display: flex; align-items: center;">
          <span style="font-size: 13px; font-weight: 700; color: #111111; word-break: break-all; ${f.mono ? 'font-family: monospace; font-size: 11px;' : ''}">${f.val}</span>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- ===== Stats Section — 1 row of 6 cells, accent bar UNDER each ===== -->
  <div style="margin-top: 8px; background: white; border: 1px solid #E0E0E0; border-radius: 8px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); flex-shrink: 0;">
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;">
      ${[
        { ar: 'أيام العمل', en: 'Working Days', val: result.actualWorkingDays.toFixed(0), color: BLUE },
        { ar: 'الطلبات المكتملة', en: 'Completed', val: result.completedOrders, color: BLUE },
        { ar: 'الطلبات المتوقعة', en: 'Expected', val: result.selectedTargetThreshold.toFixed(0), color: '#666666' },
        { ar: 'سعر الطلب', en: 'Order Price', val: salaryPerOrder.toFixed(2), color: BLUE },
        { ar: 'طلبات إضافية', en: 'Extra', val: result.extraOrders, color: '#059669' },
        { ar: 'طلبات مفقودة', en: 'Missing', val: result.missingOrders, color: '#dc2626' },
      ].map(s => `
        <div style="text-align: center; padding: 5px 3px; background: ${LIGHT_BG}; border-radius: 5px; border-bottom: 3px solid ${s.color};">
          <div style="font-size: 9px; color: #666666; font-weight: 600;" dir="rtl">${s.ar}</div>
          <div style="font-size: 8px; color: #9ca3af;">${s.en}</div>
          <div style="font-size: 15px; font-weight: 800; color: ${s.color}; margin-top: 2px; font-variant-numeric: tabular-nums;">${s.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- ===== Earnings + Deductions side-by-side ===== -->
  <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; min-height: 0;">
    <!-- Earnings Card (blue) -->
    <div style="background: white; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
      <div style="padding: 7px 12px; background: ${BLUE}; color: white; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px;">EARNINGS</div>
        <div style="font-size: 11px; font-weight: 600;" dir="rtl">الأرباح</div>
      </div>
      <div style="padding: 8px 12px; flex: 1;">
        ${earningsRows.join('')}
        <!-- Gross Total Row -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 8px 12px; margin: 6px -12px 0; background: ${LIGHT_BG}; border-top: 2px solid ${BLUE};">
          <div>
            <div style="font-size: 13px; color: ${BLUE}; font-weight: 700;" dir="rtl">الإجمالي</div>
            <div style="font-size: 10px; color: #6b7280;">Gross</div>
          </div>
          <span style="font-size: 15px; font-weight: 800; color: ${BLUE}; font-variant-numeric: tabular-nums;">${fmt(result.grossSalaryBeforePenalties)} SAR</span>
        </div>
      </div>
    </div>
    <!-- Deductions Card (orange) -->
    <div style="background: white; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
      <div style="padding: 7px 12px; background: ${ORANGE}; color: white; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px;">DEDUCTIONS</div>
        <div style="font-size: 11px; font-weight: 600;" dir="rtl">الخصومات</div>
      </div>
      <div style="padding: 8px 12px; flex: 1;">
        ${deductionRows.join('')}
        <!-- Total Deductions Row -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 8px 12px; margin: 6px -12px 0; background: ${LIGHT_BG}; border-top: 2px solid ${ORANGE};">
          <div>
            <div style="font-size: 13px; color: ${ORANGE}; font-weight: 700;" dir="rtl">إجمالي الخصومات</div>
            <div style="font-size: 10px; color: #6b7280;">Total Deductions</div>
          </div>
          <span style="font-size: 15px; font-weight: 800; color: ${ORANGE}; font-variant-numeric: tabular-nums;">${fmt(totalDeductions)} SAR</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Traffic Detail (if any) — compact, optional ===== -->
  ${traffic && traffic.length > 0 ? `
    <div style="margin-top: 8px; background: white; border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); flex-shrink: 0;">
      <div style="padding: 5px 12px; background: #FEF3E2; border-bottom: 2px solid ${ORANGE}; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 11px; font-weight: 700; color: #92400e; letter-spacing: 0.5px;">TRAFFIC TICKETS</div>
        <div style="font-size: 11px; color: #92400e; font-weight: 600;" dir="rtl">تفاصيل المخالفات</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #FEF3E2; color: #92400e;">
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Date</th>
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Type</th>
            <th style="text-align: left; padding: 3px 12px; font-size: 9px;">Mode</th>
            <th style="text-align: right; padding: 3px 12px; font-size: 9px;">Total (SAR)</th>
            <th style="text-align: right; padding: 3px 12px; font-size: 9px;">This Month (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${traffic.map((t: any) => {
            const isInst = t.installmentEnabled
            const remaining = isInst ? Math.max(0, t.amount - (t.installmentTotalPaid || 0)) : 0
            const monthly = isInst && t.installmentStatus === 'active'
              ? Math.min(t.installmentMonthlyAmount || 0, remaining)
              : (isInst ? 0 : t.amount)
            const modeLabel = isInst
              ? (t.installmentStatus === 'completed' ? 'Installment ✓' : 'Installment')
              : 'One-time'
            return `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 3px 12px; font-size: 9px;">${new Date(t.ticketDate).toLocaleDateString('en-GB')}</td>
              <td style="padding: 3px 12px; font-size: 9px;">${t.violationType}</td>
              <td style="padding: 3px 12px; font-size: 9px;">
                ${modeLabel}
                ${isInst && t.installmentStatus !== 'completed' ? `<div style="font-size: 7px; color: #9ca3af;">Paid: ${(t.installmentTotalPaid || 0).toFixed(0)} / ${t.amount.toFixed(0)}</div>` : ''}
              </td>
              <td style="padding: 3px 12px; font-size: 9px; text-align: right; font-variant-numeric: tabular-nums; color: ${isInst ? '#92400e' : '#111'};">${t.amount.toFixed(2)}</td>
              <td style="padding: 3px 12px; font-size: 9px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: ${ORANGE};">${monthly.toFixed(2)}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  <!-- ===== Net Payable Salary — same gradient as header ===== -->
  <div style="margin-top: 10px; background: linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 60%, ${ORANGE} 100%); border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 3px 12px rgba(30, 58, 138, 0.25); flex-shrink: 0;">
    <div>
      <div style="font-size: 14px; font-weight: 700; color: white;" dir="rtl">الراتب الصافي المستحق</div>
      <div style="font-size: 11px; color: #FFEEC2; margin-top: 1px;">Net Payable Salary · ${result.payrollMonth}</div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.75); margin-top: 3px;">Generated: ${new Date().toLocaleDateString('en-GB')} · Attainment: ${attainmentPct}%</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 26px; font-weight: 800; color: white; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1;">${fmt(result.finalNetSalary)}</div>
      <div style="font-size: 12px; color: #FFEEC2; font-weight: 600; margin-top: 2px;">SAR</div>
    </div>
  </div>

  <!-- ===== Signature Section — 3 columns: Mgr | Stamp | Driver ===== -->
  <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: flex-end; flex-shrink: 0;">
    <!-- Accounting Manager -->
    <div style="text-align: center;">
      ${company?.signatureImg
        ? `<div style="height: 34px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 3px;"><img src="${company.signatureImg}" alt="Acc Mgr" style="max-height: 32px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 34px; border-bottom: 1.5px solid ${BLUE}; margin-bottom: 3px;"></div>`
      }
      <div style="font-size: 10px; color: #666666; font-weight: 600;">ACCOUNTING MANAGER</div>
      <div style="font-size: 10px; color: #666666;" dir="rtl">مدير الحسابات</div>
    </div>
    <!-- Center Stamp -->
    <div style="text-align: center;">
      ${company?.stampImg
        ? `<div style="height: 54px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px;"><img src="${company.stampImg}" alt="Stamp" style="max-height: 54px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 54px; width: 54px; margin: 0 auto 3px; border: 2px dashed ${ORANGE}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: ${ORANGE};">
            <div style="font-size: 8px; font-weight: 700;">${(company?.name || 'NT').slice(0, 6)}</div>
            <div style="font-size: 7px;">KSA</div>
          </div>`
      }
      <div style="font-size: 9px; color: #9ca3af;">${company?.name || 'Nokhaba Tatweer'}</div>
    </div>
    <!-- Rider Signature -->
    <div style="text-align: center;">
      ${company?.riderSignatureImg
        ? `<div style="height: 34px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 3px;"><img src="${company.riderSignatureImg}" alt="Driver" style="max-height: 32px; object-fit: contain;" crossorigin="anonymous"/></div>`
        : `<div style="height: 34px; border-bottom: 1.5px solid ${BLUE}; margin-bottom: 3px;"></div>`
      }
      <div style="font-size: 10px; color: #666666; font-weight: 600;">RIDER SIGNATURE</div>
      <div style="font-size: 10px; color: #666666;" dir="rtl">توقيع السائق</div>
    </div>
  </div>

  <!-- ===== Footer ===== -->
  <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #E0E0E0; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9ca3af; flex-shrink: 0;">
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
