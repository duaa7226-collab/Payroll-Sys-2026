import { calculateIncome } from '../src/lib/income-expenses-engine'

// Test with rider 4648308 data from the user's example
const test = calculateIncome({
  basicPayment: 4576,
  distancePayment: 3885.19,
  segmentPayment: 1001,
  acceptancePenalty: 0,
  contactPenalty: 0,
  stackingDeduction: 188,
  declinedPenalty: 0,
  latePenalty: 0,
  noShowPenalty: 0,
  noShowSpecialPenalty: 0,
  dailyAcceptancePenalty: 0,
  missedDaysPenalty: 0,
  riderBalance: 348.77,
})

console.log('=== Rider 4648308 Test ===')
console.log(`Basic: ${test.basicPayment}`)
console.log(`Distance: ${test.distancePayment}`)
console.log(`Segment: ${test.segmentPayment}`)
console.log(`Gross (basic+distance+segment): ${test.basicPayment + test.distancePayment + test.segmentPayment}`)
console.log(`Total Penalties (incl. rider balance): ${test.totalPenalties}`)
console.log(`  Stacking: 188`)
console.log(`  Rider Balance: 348.77`)
console.log(`Total Income: ${test.totalIncome}`)
console.log(`Expected: 8926 (approx)`)
console.log(`Match: ${Math.abs(test.totalIncome - 8925.23) < 1}`)
