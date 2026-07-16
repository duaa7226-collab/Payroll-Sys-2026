// Colored Excel generator — creates a styled Excel file for email attachment
// Uses openpyxl-style cell colors via xlsx library
import * as XLSX from 'xlsx'

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

export function generateColoredExcelBase64(results: RiderRow[], payrollMonth: string, company: any): string {
  const wb = XLSX.utils.book_new()

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

  const sorted = [...results].sort((a, b) => b.finalNetSalary - a.finalNetSalary)

  // Sheet 1: Summary with company header
  const summaryData = [
    [company?.name || 'Nokhaba Tatweer for Trading', ''],
    [company?.nameAr || 'مؤسسة نخبة التطوير للتجارة', ''],
    ['', ''],
    ['Payroll Month', payrollMonth],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['=== EXECUTIVE SUMMARY ===', ''],
    ['Total Drivers', totalDrivers],
    ['Total Completed Orders', totalOrders],
    ['Total Target Orders', totalTarget.toFixed(0)],
    ['Total Gross Salary (SAR)', Number(totalGross.toFixed(2))],
    ['Total Performance Bonus (SAR)', Number(totalBonus.toFixed(2))],
    ['Total Segment Payment (SAR)', Number(totalSegment.toFixed(2))],
    ['Total Missing Order Deduction (SAR)', Number(totalMissingDeduct.toFixed(2))],
    ['Total Penalties (SAR)', Number(totalPenalties.toFixed(2))],
    ['Total Traffic Violations (SAR)', Number(totalTraffic.toFixed(2))],
    ['Total Deductions (SAR)', Number(totalDeductions.toFixed(2))],
    ['Total Final Net Salary (SAR)', Number(totalNet.toFixed(2))],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Sheet 2: All Riders Detail
  const headers = [
    '#', 'Driver Name', 'Rider ID', 'Orders', 'Target', 'Extra', 'Missing',
    'Days', 'Base Salary', 'Bonus', 'Segment', 'Missing Deduct',
    'Gross', 'Penalties', 'Traffic', 'Total Deduct', 'Net Salary', 'Band'
  ]
  const dataRows = sorted.map((r, i) => {
    const totalDed = r.totalOtherPenalties + r.trafficViolationsDeduction + r.missingOrderDeduction
    return [
      i + 1, r.driverName, r.riderId, r.completedOrders,
      r.selectedTargetThreshold.toFixed(0), r.extraOrders, r.missingOrders,
      r.actualWorkingDays.toFixed(0), Number(r.baseSalaryEquivalent.toFixed(2)),
      Number(r.bonusAmount.toFixed(2)), Number((r.segmentPayment || 0).toFixed(2)),
      Number(r.missingOrderDeduction.toFixed(2)), Number(r.grossSalaryBeforePenalties.toFixed(2)),
      Number(r.totalOtherPenalties.toFixed(2)), Number(r.trafficViolationsDeduction.toFixed(2)),
      Number(totalDed.toFixed(2)), Number(r.finalNetSalary.toFixed(2)),
      r.performanceBand,
    ]
  })
  // Add total row
  dataRows.push([
    '', 'TOTAL', '', totalOrders, totalTarget.toFixed(0), '', '',
    '', Number((totalGross - totalBonus - totalSegment).toFixed(2)),
    Number(totalBonus.toFixed(2)), Number(totalSegment.toFixed(2)),
    Number(totalMissingDeduct.toFixed(2)), Number(totalGross.toFixed(2)),
    Number(totalPenalties.toFixed(2)), Number(totalTraffic.toFixed(2)),
    Number(totalDeductions.toFixed(2)), Number(totalNet.toFixed(2)), '',
  ])

  const wsData = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  wsData['!cols'] = [
    { wch: 4 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, wsData, 'All Riders Detail')

  // Convert to base64
  const buffer = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
  return buffer
}
