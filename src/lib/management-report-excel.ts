// Management Report Excel Export — comprehensive multi-sheet workbook
import ExcelJS from 'exceljs'
import { db } from './db'
import { calculateIncome, calculateExpensesFromList, getActiveDriverCount } from './income-expenses-engine'
import { getActiveRuleSnapshot } from './rule-helpers'

const C = { BLUE: '1e3a8a', EMERALD: '059669', ROSE: 'dc2626', ORANGE: 'ea580c', AMBER: 'd97706', WHITE: 'FFFFFF', LIGHT_GRAY: 'f3f4f6', DARK: '374151', LIGHT_BLUE: 'dbeafe', LIGHT_EM: 'd1fae5', LIGHT_RO: 'fecaca', LIGHT_OR: 'fed7aa', LIGHT_AM: 'fef3c7', TEAL: '0d9488', LIGHT_TE: 'ccfbf1' }
const F = '#,##0.00'

export async function generateManagementReportExcel(runId?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokhaba Payroll System'
  wb.created = new Date()

  const company = await db.companyProfile.findFirst()
  const companyName = company?.name || 'Nokhaba Tatweer for Trading'
  const companyNameAr = company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'

  let run = runId ? await db.payrollRun.findUnique({ where: { id: runId } }) : null
  if (!run) run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) throw new Error('No payroll run found')

  const monthMap: Record<string, string> = { 'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06','july':'07','august':'08','september':'09','october':'10','november':'11','december':'12' }
  const parts = run.payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/)
  let month = new Date().toISOString().slice(0,7)
  for (let i=0;i<parts.length;i++){const m=monthMap[parts[i]];if(m){const y=parts.find(p=>/^\d{4}$/.test(p))||String(new Date().getFullYear());month=`${y}-${m}`;break}}

  const activeRules = await getActiveRuleSnapshot()
  const results = await db.driverResult.findMany({ where: { payrollRunId: run.id }, orderBy: { finalNetSalary: 'desc' } })
  const activeDriverCount = await getActiveDriverCount(month)
  const incomeRecords = await db.incomeRecord.findMany({ where: { month }, orderBy: { riderId: 'asc' } })
  const expenses = await db.expense.findMany({ where: { month } })

  const ieResults: any[] = []
  for (const rec of incomeRecords) {
    const income = calculateIncome(rec)
    const exp = calculateExpensesFromList(expenses, rec.riderId, activeDriverCount)
    ieResults.push({ rec, income, expenses: exp, netProfit: income.totalIncome - exp.totalExpenses })
  }

  const totalGross = results.reduce((s,d)=>s+d.grossSalaryBeforePenalties,0)
  const totalNet = results.reduce((s,d)=>s+d.finalNetSalary,0)
  const totalPenalties = results.reduce((s,d)=>s+d.totalOtherPenalties,0)
  const totalBonus = results.reduce((s,d)=>s+d.bonusAmount,0)
  const totalMissing = results.reduce((s,d)=>s+d.missingOrderDeduction,0)
  const totalIncome = ieResults.reduce((s,d)=>s+d.income.totalIncome,0)
  const totalExpenses = ieResults.reduce((s,d)=>s+d.expenses.totalExpenses,0)
  const totalNetProfit = ieResults.reduce((s,d)=>s+d.netProfit,0)
  const profitable = ieResults.filter(d=>d.netProfit>0).length
  const unprofitable = ieResults.filter(d=>d.netProfit<0).length

  const expByCat = new Map<string, number>()
  for (const e of expenses) expByCat.set(e.categoryName, (expByCat.get(e.categoryName)??0)+e.amount)
  const expCategories = Array.from(expByCat.entries()).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount)

  const D: any = { companyName, companyNameAr, run, month, results, ieResults, expenses, expCategories, activeRules, activeDriverCount, totalGross, totalNet, totalPenalties, totalBonus, totalMissing, totalIncome, totalExpenses, totalNetProfit, profitable, unprofitable }

  await buildExecSheet(wb, D)
  await buildSalariesSheet(wb, D)
  await buildIncomeSheet(wb, D)
  await buildExpenseSheet(wb, D)
  await buildProfitSheet(wb, D)
  await buildPlanSheet(wb, D)

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

async function buildExecSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Executive Dashboard', { properties: { tabColor: C.BLUE } })
  ws.columns = [{width:30},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18}]

  ws.mergeCells('A1:G1')
  const t = ws.getCell('A1'); t.value = `${D.companyName} — Management Report`
  t.font = { size: 16, bold: true, color: { argb: C.WHITE } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.BLUE } }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 32

  ws.mergeCells('A2:G2')
  const s = ws.getCell('A2'); s.value = `${D.companyNameAr}  ·  ${D.run.payrollMonth}  ·  ${D.results.length} Drivers`
  s.font = { size: 12, color: { argb: C.DARK } }; s.alignment = { horizontal: 'center' }

  const kpis = [
    { l: 'Drivers', v: D.results.length, c: C.BLUE, b: C.LIGHT_BLUE },
    { l: 'Net Salary', v: D.totalNet, c: C.EMERALD, b: C.LIGHT_EM, f: F },
    { l: 'Total Income', v: D.totalIncome, c: C.EMERALD, b: C.LIGHT_EM, f: F },
    { l: 'Total Expenses', v: D.totalExpenses, c: C.ORANGE, b: C.LIGHT_OR, f: F },
    { l: 'Net Profit', v: D.totalNetProfit, c: D.totalNetProfit>=0?C.EMERALD:C.ROSE, b: D.totalNetProfit>=0?C.LIGHT_EM:C.LIGHT_RO, f: F },
    { l: 'Gross Salary', v: D.totalGross, c: C.BLUE, b: C.LIGHT_BLUE, f: F },
    { l: 'Penalties', v: D.totalPenalties, c: C.ROSE, b: C.LIGHT_RO, f: F },
  ]
  kpis.forEach((k, i) => {
    const lc = ws.getCell(4, i+1); lc.value = k.l; lc.font = { size: 8, bold: true, color: { argb: C.DARK } }
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.b } }; lc.alignment = { horizontal: 'center' }
    lc.border = { top: { style: 'medium', color: { argb: k.c } } }
    const vc = ws.getCell(5, i+1); vc.value = k.v; vc.font = { size: 13, bold: true, color: { argb: k.c } }
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.b } }; vc.alignment = { horizontal: 'center' }
    vc.numFmt = k.f
  })

  // Salary breakdown
  let r = 8
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = 'Salary Breakdown'
  ws.getCell(`A${r}`).font = { size: 12, bold: true, color: { argb: C.WHITE } }
  ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.BLUE } }
  const salRows = [['Gross',D.totalGross,C.BLUE],['Bonus',D.totalBonus,C.EMERALD],['Missing Deduction',D.totalMissing,C.ROSE],['Penalties',D.totalPenalties,C.ROSE],['Net Salary',D.totalNet,C.EMERALD]]
  for (const [l,v,c] of salRows) { r++; ws.getCell(r,1).value=l; ws.getCell(r,2).value=v; ws.getCell(r,2).numFmt=F; ws.getCell(r,2).font={size:10,bold:true,color:{argb:c}}; ws.getCell(r,1).font={size:10} }

  // Income vs Expenses
  r += 3
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = 'Income vs Expenses'
  ws.getCell(`A${r}`).font = { size: 12, bold: true, color: { argb: C.WHITE } }
  ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.EMERALD } }
  const ieRows = [['Total Income',D.totalIncome,C.EMERALD],['Total Expenses',D.totalExpenses,C.ORANGE],['Net Profit',D.totalNetProfit,D.totalNetProfit>=0?C.EMERALD:C.ROSE],['Avg/Driver',D.activeDriverCount>0?D.totalNetProfit/D.activeDriverCount:0,D.totalNetProfit>=0?C.EMERALD:C.ROSE],['Profitable',D.profitable,C.EMERALD],['Loss',D.unprofitable,C.ROSE]]
  for (const [l,v,c] of ieRows) { r++; ws.getCell(r,1).value=l; ws.getCell(r,2).value=v; ws.getCell(r,2).numFmt=typeof v==='number'?F:undefined; ws.getCell(r,2).font={size:10,bold:true,color:{argb:c}}; ws.getCell(r,1).font={size:10} }

  // Expense categories with visual bars
  r += 3
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = 'Expenses by Category — Visual Bar Chart'
  ws.getCell(`A${r}`).font = { size: 12, bold: true, color: { argb: C.WHITE } }
  ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ORANGE } }
  r++; ws.getCell(r,1).value='Category'; ws.getCell(r,2).value='Amount'; ws.getCell(r,3).value='Bar'
  ws.getCell(r,1).font={bold:true,size:10}; ws.getCell(r,2).font={bold:true,size:10}; ws.getCell(r,3).font={bold:true,size:10}
  const maxAmt = Math.max(...D.expCategories.map((c:any)=>c.amount),1)
  for (const c of D.expCategories) {
    r++; ws.getCell(r,1).value=c.name; ws.getCell(r,2).value=c.amount; ws.getCell(r,2).numFmt=F
    const barLen = Math.max(1, Math.round((c.amount/maxAmt)*50))
    ws.getCell(r,3).value='█'.repeat(barLen); ws.getCell(r,3).font={size:10,color:{argb:C.ORANGE}}
    ws.getCell(r,1).font={size:10}; ws.getCell(r,2).font={size:10,bold:true}
  }

  r += 3
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = `Generated: ${new Date().toLocaleString()} · ${D.companyName} · Confidential`
  ws.getCell(`A${r}`).font = { size: 8, italic: true, color: { argb: '9CA3AF' } }; ws.getCell(`A${r}`).alignment = { horizontal: 'center' }
}

async function buildSalariesSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Salaries', { properties: { tabColor: C.BLUE } })
  ws.columns = [{width:8},{width:12},{width:22},{width:10},{width:14},{width:10},{width:10},{width:10},{width:10},{width:10},{width:12},{width:10},{width:10},{width:10},{width:10},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14}]
  ws.mergeCells('A1:U1')
  const t = ws.getCell('A1'); t.value = `Driver Salaries — ${D.run.payrollMonth} (Comprehensive)`
  t.font = { size: 14, bold: true, color: { argb: C.WHITE } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.BLUE } }; t.alignment = { horizontal: 'center' }
  const headers = ['#','Rider ID','Driver Name','Vehicle','Contract','Work Days','Full Days','Work Hrs','Total Hrs','Inactive','Per-Order','Completed','Target','Extra','Missing','Base Salary','Bonus','Missing Ded.','Penalties','Traffic','Net Salary']
  headers.forEach((h,i)=>{const c=ws.getCell(3,i+1);c.value=h;c.font={size:8,bold:true,color:{argb:C.WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.BLUE}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true}})
  ws.getRow(3).height = 30
  const sp = D.activeRules.snapshot.monthly_base_salary / D.activeRules.snapshot.monthly_target_orders
  let r = 4
  for (const d of D.results) {
    const vals = [r-3,d.riderId,d.driverName,d.vehicleType,d.contractName,d.actualWorkingDays,d.fullyWorkingDays,d.workingHours?.toFixed(1)||0,d.totalMonthlyWorkingHours?.toFixed(1)||0,d.inactiveReason||'Active',sp.toFixed(4),d.completedOrders,d.selectedTargetThreshold?.toFixed(0)||0,d.extraOrders,d.missingOrders,d.baseSalaryEquivalent,d.bonusAmount,d.missingOrderDeduction,d.totalOtherPenalties,d.trafficViolationsDeduction,d.finalNetSalary]
    vals.forEach((v,i)=>{const c=ws.getCell(r,i+1);c.value=v;c.font={size:9};c.alignment={horizontal:i<5?(i===2?'left':'center'):i===9?'left':'right'};if(i>=15&&i<=20)c.numFmt=F;c.border={bottom:{style:'hair',color:{argb:'E5E7EB'}}};if(i===20)c.font={size:10,bold:true,color:{argb:v>=0?C.EMERALD:C.ROSE}}})
    r++
  }
  ws.getCell(r,3).value='TOTAL'
  for (let col=6;col<=21;col++){const cl=String.fromCharCode(64+col);ws.getCell(r,col).value={formula:`SUM(${cl}4:${cl}${r-1})`}}
  for (let col=1;col<=21;col++){const c=ws.getCell(r,col);c.font={size:10,bold:true,color:{argb:C.BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.LIGHT_BLUE}};c.border={top:{style:'double',color:{argb:C.BLUE}}};c.alignment={horizontal:col<=3?'left':'right'};if(col>=15)c.numFmt=F}
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 3 }]; ws.autoFilter = `A3:U${r-1}`
}

async function buildIncomeSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Incomes', { properties: { tabColor: C.EMERALD } })
  ws.columns = [{width:8},{width:12},{width:22},{width:14},{width:14},{width:14},{width:12},{width:12},{width:12},{width:12},{width:12},{width:12},{width:12},{width:12},{width:12},{width:12},{width:14},{width:16}]
  ws.mergeCells('A1:R1')
  const t = ws.getCell('A1'); t.value = `Driver Income Breakdown — ${D.run.payrollMonth} (All Fields)`
  t.font = { size: 14, bold: true, color: { argb: C.WHITE } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.EMERALD } }; t.alignment = { horizontal: 'center' }
  const headers = ['#','Rider ID','Driver Name','Basic Pay','Distance Pay','Segment Pay','Acceptance','Contact','Stacking','Declined','Late','No-Show','NoShow-Spec','Daily-Acc','Missed Days','Rider Bal.','Total Penalties','Total Income']
  headers.forEach((h,i)=>{const c=ws.getCell(3,i+1);c.value=h;c.font={size:8,bold:true,color:{argb:C.WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.EMERALD}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true}})
  ws.getRow(3).height = 30
  let r = 4
  for (const d of D.ieResults) {
    const vals = [r-3,d.rec.riderId,d.rec.driverName,d.rec.basicPayment,d.rec.distancePayment,d.rec.segmentPayment,d.rec.acceptancePenalty,d.rec.contactPenalty,d.rec.stackingDeduction,d.rec.declinedPenalty,d.rec.latePenalty,d.rec.noShowPenalty,d.rec.noShowSpecialPenalty,d.rec.dailyAcceptancePenalty,d.rec.missedDaysPenalty,d.rec.riderBalance,d.income.totalPenalties,d.income.totalIncome]
    vals.forEach((v,i)=>{const c=ws.getCell(r,i+1);c.value=v;c.font={size:9};c.alignment={horizontal:i<3?(i===2?'left':'center'):'right'};if(i>=3)c.numFmt=F;c.border={bottom:{style:'hair',color:{argb:'E5E7EB'}}};if(i>=6&&i<=15)c.font={size:9,color:{argb:C.ROSE}};if(i===16)c.font={size:9,bold:true,color:{argb:C.ROSE}};if(i===17)c.font={size:10,bold:true,color:{argb:C.EMERALD}}})
    r++
  }
  ws.getCell(r,3).value='TOTAL'
  for (let col=4;col<=18;col++){const cl=String.fromCharCode(64+col);ws.getCell(r,col).value={formula:`SUM(${cl}4:${cl}${r-1})`};const c=ws.getCell(r,col);c.font={size:10,bold:true,color:{argb:C.EMERALD}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.LIGHT_EM}};c.border={top:{style:'double',color:{argb:C.EMERALD}}};c.alignment={horizontal:'right'};c.numFmt=F}
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 3 }]
}

async function buildExpenseSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Expenses', { properties: { tabColor: C.ORANGE } })
  const cats = D.expCategories.map((c:any)=>c.name)
  ws.columns = [{width:12},{width:22},...cats.map(()=>({width:14})),{width:16}]
  const tc = 2+cats.length+1; const lc = String.fromCharCode(64+tc)
  ws.mergeCells(`A1:${lc}1`)
  const t = ws.getCell('A1'); t.value = `Per-Driver Expense Allocation — ${D.run.payrollMonth} · ${D.activeDriverCount} Drivers`
  t.font = { size: 14, bold: true, color: { argb: C.WHITE } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ORANGE } }; t.alignment = { horizontal: 'center' }
  const headers = ['Rider ID','Driver Name',...cats,'Total Expenses']
  headers.forEach((h,i)=>{const c=ws.getCell(3,i+1);c.value=h;c.font={size:8,bold:true,color:{argb:C.WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.ORANGE}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true}})
  ws.getRow(3).height = 30
  let r = 4
  for (const d of D.ieResults) {
    ws.getCell(r,1).value=d.rec.riderId; ws.getCell(r,2).value=d.rec.driverName
    ws.getCell(r,1).font={size:9}; ws.getCell(r,2).font={size:9}
    ws.getCell(r,1).alignment={horizontal:'center'}; ws.getCell(r,2).alignment={horizontal:'left'}
    cats.forEach((cat:string,ci:number)=>{const col=3+ci;let amt=0;const pd=d.expenses.perDriverBreakdown?.find((p:any)=>p.categoryName===cat);const sh=d.expenses.sharedBreakdown?.find((s:any)=>s.categoryName===cat);const as=d.expenses.assignedBreakdown?.find((a:any)=>a.categoryName===cat);if(pd)amt+=pd.amount;if(sh)amt+=sh.perDriver;if(as)amt+=as.amount;const c=ws.getCell(r,col);c.value=amt;c.font={size:9};c.numFmt=F;c.alignment={horizontal:'right'}})
    const tc2=ws.getCell(r,tc);tc2.value=d.expenses.totalExpenses;tc2.font={size:10,bold:true,color:{argb:C.ORANGE}};tc2.numFmt=F;tc2.alignment={horizontal:'right'}
    r++
  }
  ws.getCell(r,2).value='TOTAL'
  for (let ci=0;ci<cats.length;ci++){const col=3+ci;const cl=String.fromCharCode(64+col);ws.getCell(r,col).value={formula:`SUM(${cl}4:${cl}${r-1})`}}
  ws.getCell(r,tc).value={formula:`SUM(${String.fromCharCode(64+tc)}4:${String.fromCharCode(64+tc)}${r-1})`}
  for (let col=1;col<=tc;col++){const c=ws.getCell(r,col);c.font={size:10,bold:true,color:{argb:C.ORANGE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.LIGHT_OR}};c.border={top:{style:'double',color:{argb:C.ORANGE}}};c.alignment={horizontal:col<=2?'left':'right'};if(col>=3)c.numFmt=F}
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 2 }]
}

async function buildProfitSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Net Profit', { properties: { tabColor: C.EMERALD } })
  ws.columns = [{width:8},{width:12},{width:22},{width:16},{width:16},{width:16},{width:16},{width:16}]
  ws.mergeCells('A1:H1')
  const t = ws.getCell('A1'); t.value = `Net Profit Analysis — ${D.run.payrollMonth}`
  t.font = { size: 14, bold: true, color: { argb: C.WHITE } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.EMERALD } }; t.alignment = { horizontal: 'center' }
  const headers = ['#','Rider ID','Driver Name','Total Income','Per-Driver Exp','Shared Exp','Total Exp','Net Profit']
  headers.forEach((h,i)=>{const c=ws.getCell(3,i+1);c.value=h;c.font={size:10,bold:true,color:{argb:C.WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.EMERALD}};c.alignment={horizontal:'center',vertical:'middle'}})
  const sorted = [...D.ieResults].sort((a,b)=>b.netProfit-a.netProfit)
  let r = 4
  sorted.forEach((d,idx)=>{const vals=[idx+1,d.rec.riderId,d.rec.driverName,d.income.totalIncome,d.expenses.perDriverTotal,d.expenses.sharedTotal,d.expenses.totalExpenses,d.netProfit];vals.forEach((v,i)=>{const c=ws.getCell(r,i+1);c.value=v;c.font={size:10};c.alignment={horizontal:i===0?'center':i<3?'left':'right'};if(i>=3)c.numFmt=F;c.border={bottom:{style:'hair',color:{argb:'E5E7EB'}}};if(i===7){c.font={size:11,bold:true,color:{argb:v>=0?C.EMERALD:C.ROSE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:v>=0?C.LIGHT_EM:C.LIGHT_RO}}}});r++})
  ws.getCell(r,3).value='TOTAL'
  for (let col=4;col<=8;col++){const cl=String.fromCharCode(64+col);ws.getCell(r,col).value={formula:`SUM(${cl}4:${cl}${r-1})`};const c=ws.getCell(r,col);c.font={size:11,bold:true,color:{argb:C.EMERALD}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.LIGHT_EM}};c.border={top:{style:'double',color:{argb:C.EMERALD}}};c.alignment={horizontal:'right'};c.numFmt=F}
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }]
}

async function buildPlanSheet(wb: ExcelJS.Workbook, D: any) {
  const ws = wb.addWorksheet('Improvement Plan', { properties: { tabColor: C.AMBER } })
  ws.columns = [{width:5},{width:35},{width:20},{width:20},{width:40}]
  ws.mergeCells('A1:E1')
  const t = ws.getCell('A1'); t.value = 'Plan to Improve · خطة التحسين'
  t.font = { size: 16, bold: true, color: { argb: C.WHITE } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.AMBER } }; t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30
  ws.mergeCells('A3:E3'); ws.getCell('A3').value='Current Situation'; ws.getCell('A3').font={size:12,bold:true,color:{argb:C.WHITE}}; ws.getCell('A3').fill={type:'pattern',pattern:'solid',fgColor:{argb:C.DARK}}
  const sit = [['Total Drivers',D.results.length],['Net Salary',D.totalNet.toFixed(2)],['Total Income',D.totalIncome.toFixed(2)],['Total Expenses',D.totalExpenses.toFixed(2)],['Net Profit',D.totalNetProfit.toFixed(2)],['Profitable',D.profitable],['Loss',D.unprofitable],['Avg/Driver',D.activeDriverCount>0?(D.totalNetProfit/D.activeDriverCount).toFixed(2):'0']]
  let r = 4; for (const [l,v] of sit) { ws.getCell(r,2).value=l; ws.getCell(r,3).value=v; ws.getCell(r,2).font={size:10}; ws.getCell(r,3).font={size:10,bold:true}; ws.getCell(r,3).alignment={horizontal:'right'}; r++ }
  r += 2; ws.mergeCells(`A${r}:E${r}`); ws.getCell(`A${r}`).value='Key Issues'; ws.getCell(`A${r}`).font={size:12,bold:true,color:{argb:C.WHITE}}; ws.getCell(`A${r}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:C.ROSE}}; r++
  const lossDrivers = D.ieResults.filter((d:any)=>d.netProfit<0).sort((a:any,b:any)=>a.netProfit-b.netProfit).slice(0,5)
  const issues: any[] = []
  if (D.totalNetProfit<0) issues.push(['Overall net loss',D.totalNetProfit.toFixed(2),'Positive','Reduce shared expenses or increase driver count'])
  if (D.unprofitable>0) issues.push([`${D.unprofitable} unprofitable drivers`,`${D.unprofitable}`,`0`,`Review: ${lossDrivers.map((d:any)=>d.rec.riderId).join(', ')}`])
  if (D.totalPenalties>0) issues.push(['High penalties',D.totalPenalties.toFixed(2),'Reduce 20%','Enforce acceptance rate policies'])
  if (issues.length===0) issues.push(['No major issues','All healthy','Maintain','Continue current operations'])
  issues.forEach((iss,i)=>{r++;ws.getCell(r,1).value=i+1;ws.getCell(r,2).value=iss[0];ws.getCell(r,3).value=iss[1];ws.getCell(r,4).value=iss[2];ws.getCell(r,5).value=iss[3];for(let col=1;col<=5;col++){const c=ws.getCell(r,col);c.font={size:10};c.border={bottom:{style:'hair',color:{argb:'E5E7EB'}}}}})
  r += 2; ws.mergeCells(`A${r}:E${r}`); ws.getCell(`A${r}`).value='Recommendations'; ws.getCell(`A${r}`).font={size:12,bold:true,color:{argb:C.WHITE}}; ws.getCell(`A${r}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:C.EMERALD}}; r++
  const recs = ['1. Increase driver count to reduce shared expenses per driver','2. Renegotiate car rent (1,500 SAR/driver)','3. Enforce acceptance rate to reduce stacking penalties','4. Performance incentives for top performers','5. Review bottom performers for training/replacement','6. Monitor rider balance deductions','7. Add more delivery company contracts','8. Track monthly trends','9. Audit expense categories quarterly','10. Set up automated alerts for low net profit']
  for (const rec of recs) { r++; ws.mergeCells(`A${r}:E${r}`); ws.getCell(`A${r}`).value=rec; ws.getCell(`A${r}`).font={size:10}; ws.getCell(`A${r}`).alignment={horizontal:'left',wrapText:true,indent:1} }
}
