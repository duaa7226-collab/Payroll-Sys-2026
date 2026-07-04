// Premium 2026 Payslip PDF Generator — bilingual Arabic/English
// Modern, professional layout — no calculation method details exposed.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

const BAND_LABELS: Record<string, string> = {
  top: 'Top Performer',
  high: 'High',
  average: 'Average',
  low: 'Low',
  bottom: 'Bottom',
}

export function generatePayslipPDF(data: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  drawPayslipOnDoc(doc, data)
  const { result } = data
  const fileName = `payslip_${result.driverName.replace(/\s+/g, '_')}_${result.payrollMonth.replace(/\s+/g, '_')}.pdf`
  doc.save(fileName)
}

// Generate PDF and return blob URL — used for Print (opens in new tab)
export function generatePayslipPDFBlob(data: any): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  drawPayslipOnDoc(doc, data)
  return doc.output('bloburl')
}

// Internal: draw payslip content on a provided jsPDF doc
function drawPayslipOnDoc(doc: jsPDF, data: any) {
  const { result, driver, company, traffic, penalties } = data
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36

  // ===== Premium Header with optional logo =====
  doc.setFillColor(6, 78, 59)
  doc.rect(0, 0, pageWidth, 96, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(0, 96, pageWidth, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('SALARY STATEMENT  ·  كشف راتب', margin, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(company?.name || 'Nokhaba Tatweer for Trading', margin, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(company?.nameAr || 'مؤسسة نخبة التطوير للتجارة', margin, 70)
  doc.setFontSize(9)
  doc.text(
    `${company?.address || 'Riyadh, Saudi Arabia'}   ·   VAT: ${company?.vatNumber || 'N/A'}`,
    margin, 86
  )

  if (company?.logo) {
    try {
      const imgFormat = company.logo.startsWith('data:image/png') ? 'PNG'
        : company.logo.startsWith('data:image/jpeg') ? 'JPEG'
        : 'PNG'
      doc.addImage(company.logo, imgFormat, pageWidth - margin - 110, 18, 110, 60, undefined, 'FAST')
    } catch (e) {
      doc.setFontSize(8)
      doc.text('PAY PERIOD', pageWidth - margin, 28, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(result.payrollMonth, pageWidth - margin, 46, { align: 'right' })
    }
  } else {
    doc.setFontSize(8)
    doc.text('PAY PERIOD', pageWidth - margin, 28, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(result.payrollMonth, pageWidth - margin, 46, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-GB')}`,
      pageWidth - margin, 62, { align: 'right' }
    )
  }

  let y = 116
  if (company?.logo) {
    doc.setFillColor(249, 250, 251)
    doc.rect(0, 98, pageWidth, 22, 'F')
    doc.setTextColor(107, 114, 128)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Pay Period: ${result.payrollMonth}`, margin, 112)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin, 112, { align: 'right' })
    y = 130
  }

  // Driver Identity
  doc.setFillColor(249, 250, 251)
  doc.rect(margin, y - 4, pageWidth - margin * 2, 56, 'F')
  doc.setTextColor(107, 114, 128)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  const colW = (pageWidth - margin * 2) / 4
  const labels = ['DRIVER NAME', 'RIDER ID', 'CONTRACT', 'VEHICLE TYPE']
  const values = [result.driverName, result.riderId, result.contractName, result.vehicleType]
  for (let i = 0; i < 4; i++) {
    doc.text(labels[i], margin + 10 + i * colW, y + 8)
    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(values[i], margin + 10 + i * colW, y + 26)
    doc.setTextColor(107, 114, 128)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
  }
  y += 68

  // Performance summary
  doc.setFillColor(240, 253, 244)
  doc.rect(margin, y - 4, pageWidth - margin * 2, 22, 'F')
  doc.setTextColor(6, 95, 70)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const attainmentPct = result.selectedTargetThreshold > 0
    ? ((result.completedOrders / result.selectedTargetThreshold) * 100).toFixed(1)
    : 'N/A'
  doc.text(
    `Performance: ${BAND_LABELS[result.performanceBand] ?? result.performanceBand}    ·    Target Attainment: ${attainmentPct}%`,
    margin + 10, y + 10
  )
  y += 30

  // Two columns: Working Summary + Earnings
  const colGap = 20
  const innerColW = (pageWidth - margin * 2 - colGap) / 2

  // Left: Working Summary
  doc.setTextColor(107, 114, 128)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('WORKING SUMMARY', margin, y)
  doc.setDrawColor(6, 78, 59)
  doc.setLineWidth(1.2)
  doc.line(margin, y + 4, margin + innerColW, y + 4)

  const leftRows: [string, string][] = [
    ['Completed Orders', `${result.completedOrders}`],
    ['Target Orders', result.selectedTargetThreshold.toFixed(0)],
    ['Working Days', `${result.actualWorkingDays.toFixed(0)}`],
    ['Working Hours', result.workingHours.toFixed(1)],
  ]
  if (result.inactiveReason && result.inactiveReason !== 'Active') {
    leftRows.push(['Inactive Reason', result.inactiveReason])
  }
  let ly = y + 20
  for (const [label, value] of leftRows) {
    doc.setTextColor(55, 65, 81)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(label, margin, ly)
    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.text(value, margin + innerColW - 4, ly, { align: 'right' })
    ly += 15
  }

  // Right: Earnings
  const rx = margin + innerColW + colGap
  doc.setTextColor(107, 114, 128)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('EARNINGS', rx, y)
  doc.setDrawColor(6, 78, 59)
  doc.line(rx, y + 4, rx + innerColW, y + 4)

  const baseSalaryLabel = result.salaryDivisorMode === 'orders_based_mode' ? 'Base Salary' : 'Adjusted Base Salary'
  const baseSalaryValue = result.salaryDivisorMode === 'orders_based_mode'
    ? result.baseSalaryEquivalent
    : result.adjustedBaseSalary

  let rry = y + 20
  doc.setTextColor(55, 65, 81)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(baseSalaryLabel, rx, rry)
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.text(`SAR ${baseSalaryValue.toFixed(2)}`, rx + innerColW - 4, rry, { align: 'right' })
  rry += 15
  if (result.bonusAmount > 0) {
    doc.setTextColor(55, 65, 81)
    doc.setFont('helvetica', 'normal')
    doc.text('Performance Bonus', rx, rry)
    doc.setTextColor(5, 150, 105)
    doc.setFont('helvetica', 'bold')
    doc.text(`+SAR ${result.bonusAmount.toFixed(2)}`, rx + innerColW - 4, rry, { align: 'right' })
    rry += 15
  }
  rry += 6
  doc.setDrawColor(6, 78, 59)
  doc.setLineWidth(1)
  doc.line(rx, rry - 4, rx + innerColW, rry - 4)
  doc.setTextColor(6, 78, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Gross Salary', rx, rry + 8)
  doc.text(`SAR ${result.grossSalaryBeforePenalties.toFixed(2)}`, rx + innerColW - 4, rry + 8, { align: 'right' })
  rry += 18

  // Deductions table
  y = Math.max(ly, rry) + 14
  const penaltyEntries = Object.entries(penalties).filter(([_, v]) => (v as number) > 0)
  const totalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction + result.missingOrderDeduction

  const deductionBody: any[] = []
  if (result.missingOrderDeduction > 0) {
    deductionBody.push([
      'Missing Order Deduction  ·  خصم الطلبات الناقصة',
      `- ${result.missingOrderDeduction.toFixed(2)}`,
    ])
  }
  for (const [key, val] of penaltyEntries) {
    deductionBody.push([
      `${PENALTY_LABELS[key]?.en ?? key}  ·  ${PENALTY_LABELS[key]?.ar ?? ''}`,
      `- ${(val as number).toFixed(2)}`,
    ])
  }
  if (result.trafficViolationsDeduction > 0) {
    deductionBody.push([
      'Traffic Violations  ·  المخالفات المرورية',
      `- ${result.trafficViolationsDeduction.toFixed(2)}`,
    ])
  }

  autoTable(doc, {
    startY: y,
    head: [['Description  ·  الوصف', 'Amount (SAR)']],
    body: deductionBody.length > 0 ? deductionBody : [['No deductions applied', '0.00']],
    foot: [[
      'Total Deductions  ·  إجمالي الخصومات',
      `- ${totalDeductions.toFixed(2)}`,
    ]],
    theme: 'striped',
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [17, 24, 39] },
    footStyles: { fillColor: [254, 242, 242], textColor: [127, 29, 29], fontSize: 10, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: (pageWidth - margin * 2) * 0.7 },
      1: { cellWidth: (pageWidth - margin * 2) * 0.3, halign: 'right', font: 'courier' },
    },
    margin: { left: margin, right: margin },
  })

  let tableEndY = (doc as any).lastAutoTable?.finalY ?? y + 60

  if (traffic && traffic.length > 0) {
    autoTable(doc, {
      startY: tableEndY + 12,
      head: [['Date', 'Type', 'Status', 'Amount (SAR)']],
      body: traffic.map((t: any) => [
        new Date(t.ticketDate).toLocaleDateString('en-GB'),
        t.violationType,
        t.status,
        t.amount.toFixed(2),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [146, 64, 14], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right', font: 'courier' } },
      margin: { left: margin, right: margin },
    })
    tableEndY = (doc as any).lastAutoTable?.finalY ?? tableEndY + 40
  }

  // Final Net Salary
  y = tableEndY + 20
  if (y > pageHeight - 200) { doc.addPage(); y = 50 }

  doc.setFillColor(236, 253, 245)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 82, 10, 10, 'F')
  doc.setDrawColor(6, 78, 59)
  doc.setLineWidth(2)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 82, 10, 10, 'S')

  doc.setTextColor(6, 95, 70)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('FINAL NET SALARY  ·  صافي الراتب النهائي', margin + 18, y + 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(4, 120, 87)
  const payableLine = `Payable to: ${driver?.beneficiaryName || result.driverName}${driver?.bankName ? '  ·  ' + driver.bankName : ''}`
  doc.text(payableLine, margin + 18, y + 40)

  doc.setTextColor(6, 78, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text(`SAR ${result.finalNetSalary.toFixed(2)}`, pageWidth - margin - 18, y + 40, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(4, 120, 87)
  doc.text(`${company?.currency || 'SAR'}  ·  ${result.payrollMonth}`, pageWidth - margin - 18, y + 58, { align: 'right' })

  // Footer + Two signatures
  y += 102
  if (y > pageHeight - 140) { doc.addPage(); y = 50 }

  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    company?.footerNote || 'This is a computer-generated payslip and does not require a physical signature.',
    pageWidth / 2, y + 14, { align: 'center' }
  )

  y += 40
  const sigColW = (pageWidth - margin * 2) / 2
  const sigGap = 30

  // Accounting Manager signature
  const sig1X = margin + 30
  const sig1LineEnd = sig1X + sigColW - sigGap - 30
  if (company?.signatureImg) {
    try {
      const imgFormat = company.signatureImg.startsWith('data:image/png') ? 'PNG'
        : company.signatureImg.startsWith('data:image/jpeg') ? 'JPEG'
        : 'PNG'
      doc.addImage(company.signatureImg, imgFormat, sig1X, y - 20, Math.min(sigColW - sigGap - 60, 120), 30, undefined, 'FAST')
    } catch (e) {
      doc.setDrawColor(55, 65, 81); doc.setLineWidth(1); doc.line(sig1X, y, sig1LineEnd, y)
    }
  } else {
    doc.setDrawColor(55, 65, 81); doc.setLineWidth(1); doc.line(sig1X, y, sig1LineEnd, y)
  }
  doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(company?.accManagerName || 'Accounting Manager', (sig1X + sig1LineEnd) / 2, y + 14, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(107, 114, 128)
  doc.text('مدير الحسابات', (sig1X + sig1LineEnd) / 2, y + 26, { align: 'center' })

  // Driver signature
  const sig2X = margin + sigColW + 30
  const sig2LineEnd = sig2X + sigColW - sigGap - 30
  if (company?.riderSignatureImg) {
    try {
      const imgFormat = company.riderSignatureImg.startsWith('data:image/png') ? 'PNG'
        : company.riderSignatureImg.startsWith('data:image/jpeg') ? 'JPEG'
        : 'PNG'
      doc.addImage(company.riderSignatureImg, imgFormat, sig2X, y - 20, Math.min(sigColW - sigGap - 60, 120), 30, undefined, 'FAST')
    } catch (e) {
      doc.setDrawColor(55, 65, 81); doc.setLineWidth(1); doc.line(sig2X, y, sig2LineEnd, y)
    }
  } else {
    doc.setDrawColor(55, 65, 81); doc.setLineWidth(1); doc.line(sig2X, y, sig2LineEnd, y)
  }
  doc.setTextColor(55, 65, 81); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Driver Signature', (sig2X + sig2LineEnd) / 2, y + 14, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(107, 114, 128)
  doc.text('توقيع السائق', (sig2X + sig2LineEnd) / 2, y + 26, { align: 'center' })
}
