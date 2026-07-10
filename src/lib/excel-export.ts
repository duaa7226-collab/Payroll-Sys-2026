// Premium Excel Export for Driver Results
import * as XLSX from 'xlsx'

const BAND_LABELS: Record<string, string> = {
  top: 'Top Performer',
  high: 'High',
  average: 'Average',
  low: 'Low',
  bottom: 'Bottom',
}

const PENALTY_LABELS: Record<string, string> = {
  acceptance: 'Acceptance',
  contact: 'Contact',
  stacking: 'Stacking',
  declined: 'Declined',
  late: 'Late',
  noshow: 'No-Show',
  noshow_special: 'No-Show Special',
  daily_acceptance: 'Daily Acceptance',
  missed_days: 'Missed Days',
  rider_balance: 'Rider Balance',
  car_deduction: 'Car Deduction',
  tga_deduction: 'TGA Deduction',
}

interface ExportOptions {
  results: any[]
  payrollMonth: string
  ruleSummary?: any
  companyName?: string
}

export function exportDriversToExcel({ results, payrollMonth, ruleSummary, companyName }: ExportOptions) {
  const wb = XLSX.utils.book_new()

  // ===== Sheet 1: Summary =====
  const totalDrivers = results.length
  const totalOrders = results.reduce((a, r) => a + r.completedOrders, 0)
  const totalGross = results.reduce((a, r) => a + r.grossSalaryBeforePenalties, 0)
  const totalPenalties = results.reduce((a, r) => a + r.totalOtherPenalties, 0)
  const totalTraffic = results.reduce((a, r) => a + r.trafficViolationsDeduction, 0)
  const totalNet = results.reduce((a, r) => a + r.finalNetSalary, 0)
  const totalMissingDeduction = results.reduce((a, r) => a + r.missingOrderDeduction, 0)
  const totalBonus = results.reduce((a, r) => a + r.bonusAmount, 0)
  const totalSegment = results.reduce((a, r) => a + (r.segmentPayment || 0), 0)

  const summaryData = [
    [companyName || 'Nokhaba Tatweer for Trading', ''],
    ['Payroll Month', payrollMonth],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['=== SUMMARY ===', ''],
    ['Total Drivers', totalDrivers],
    ['Total Completed Orders', totalOrders],
    ['Total Gross Salary (SAR)', Number(totalGross.toFixed(2))],
    ['Total Performance Bonus (SAR)', Number(totalBonus.toFixed(2))],
    ['Total Segment Payment (SAR)', Number(totalSegment.toFixed(2))],
    ['Total Missing Order Deduction (SAR)', Number(totalMissingDeduction.toFixed(2))],
    ['Total Penalties (SAR)', Number(totalPenalties.toFixed(2))],
    ['Total Traffic Violations (SAR)', Number(totalTraffic.toFixed(2))],
    ['Total Net Salary (SAR)', Number(totalNet.toFixed(2))],
    ['', ''],
    ['=== ACTIVE RULES ===', ''],
    ['Salary Mode', ruleSummary?.salaryMode || 'Orders-Based'],
    ['Monthly Base Salary (SAR)', ruleSummary?.monthlyBaseSalary || 2000],
    ['Standard Working Days', ruleSummary?.standardWorkingDays || 30],
    ['Monthly Target Orders', ruleSummary?.monthlyTargetOrders || 450],
    ['Daily Target Rate', ruleSummary?.dailyTargetRate?.toFixed(1) || '15.0'],
    ['Salary Per Order (SAR)', ruleSummary?.salaryPerOrderRate?.toFixed(4) || '4.4444'],
    ['Bonus Per Extra Order (SAR)', ruleSummary?.bonusPerExtraOrder || 10],
    ['Deduction Per Missing Order (SAR)', ruleSummary?.deductionPerMissingOrder || 7],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ===== Sheet 2: Driver Results =====
  const headers = [
    'Driver Name', 'Rider ID', 'Contract', 'Vehicle Type', 'Performance Band',
    'Completed Orders', 'Target Orders', 'Extra Orders', 'Missing Orders',
    'Working Days', 'Working Hours',
    'Base Salary (SAR)', 'Performance Bonus (SAR)', 'Segment Payment (SAR)',
    'Missing Order Deduction (SAR)', 'Gross Salary (SAR)',
    'Total Penalties (SAR)', 'Traffic Violations (SAR)', 'Total Deductions (SAR)',
    'Final Net Salary (SAR)',
    'Uploaded Basic Payment (SAR)', 'Variance Amount (SAR)', 'Variance %',
    'Variance Status', 'Review Status', 'Inactive Reason',
  ]

  const dataRows = results.map(r => {
    const totalDeductions = r.totalOtherPenalties + r.trafficViolationsDeduction + r.missingOrderDeduction
    return [
      r.driverName, r.riderId, r.contractName, r.vehicleType,
      BAND_LABELS[r.performanceBand] || r.performanceBand,
      r.completedOrders, Number(r.selectedTargetThreshold.toFixed(0)),
      r.extraOrders, r.missingOrders,
      Number(r.actualWorkingDays.toFixed(0)), Number(r.workingHours.toFixed(1)),
      Number(r.baseSalaryEquivalent.toFixed(2)), Number(r.bonusAmount.toFixed(2)),
      Number((r.segmentPayment || 0).toFixed(2)),
      Number(r.missingOrderDeduction.toFixed(2)),
      Number(r.grossSalaryBeforePenalties.toFixed(2)),
      Number(r.totalOtherPenalties.toFixed(2)),
      Number(r.trafficViolationsDeduction.toFixed(2)),
      Number(totalDeductions.toFixed(2)),
      Number(r.finalNetSalary.toFixed(2)),
      Number(r.uploadedBasicPayment.toFixed(2)),
      Number(r.varianceAmount.toFixed(2)), Number(r.variancePercentage.toFixed(2)),
      r.varianceStatus, r.reviewStatus, r.inactiveReason || 'Active',
    ]
  })

  const wsData = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  wsData['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsData, 'Driver Results')

  // ===== Sheet 3: Penalties Breakdown =====
  const penaltyHeaders = ['Driver Name', 'Rider ID', ...Object.values(PENALTY_LABELS), 'Total Penalties (SAR)']
  const penaltyRows = results.map(r => {
    const penalties = (() => { try { return JSON.parse(r.penaltiesJson || '{}') } catch { return {} } })()
    return [
      r.driverName, r.riderId,
      ...Object.keys(PENALTY_LABELS).map(k => Number((penalties[k] || 0).toFixed(2))),
      Number(r.totalOtherPenalties.toFixed(2)),
    ]
  })
  const totalRow = [
    'TOTAL', '',
    ...Object.keys(PENALTY_LABELS).map(k => {
      const sum = results.reduce((a, r) => {
        const p = (() => { try { return JSON.parse(r.penaltiesJson || '{}') } catch { return {} } })()
        return a + (p[k] || 0)
      }, 0)
      return Number(sum.toFixed(2))
    }),
    Number(results.reduce((a, r) => a + r.totalOtherPenalties, 0).toFixed(2)),
  ]
  const wsPenalties = XLSX.utils.aoa_to_sheet([penaltyHeaders, ...penaltyRows, totalRow])
  wsPenalties['!cols'] = [{ wch: 18 }, { wch: 14 }, ...Object.keys(PENALTY_LABELS).map(() => ({ wch: 14 })), { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsPenalties, 'Penalties Breakdown')

  // Generate and download
  const fileName = `payroll_results_${payrollMonth.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}
