// Income vs Expenses Excel Export
import ExcelJS from 'exceljs'
import { db } from './db'
import { calculateIncome, calculateExpensesFromList, getActiveDriverCount } from './income-expenses-engine'

const C = { BLUE:'1e3a8a',EMERALD:'059669',ROSE:'dc2626',ORANGE:'ea580c',WHITE:'FFFFFF',LIGHT_GRAY:'f3f4f6',DARK:'374151',LIGHT_BLUE:'dbeafe',LIGHT_EM:'d1fae5',LIGHT_RO:'fecaca',LIGHT_OR:'fed7aa' }
const F = '#,##0.00'

export async function generateIncomeExpensesExcel(month: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nokhaba Payroll System'; wb.created = new Date()
  const company = await db.companyProfile.findFirst()
  const companyName = company?.name || 'Nokhaba Tatweer for Trading'
  const companyNameAr = company?.nameAr || 'مؤسسة نخبة التطوير للتجارة'
  const activeDriverCount = await getActiveDriverCount(month)
  const incomeRecords = await db.incomeRecord.findMany({ where: { month }, orderBy: { riderId: 'asc' } })
  const expenses = await db.expense.findMany({ where: { month } })
  const driverResults: any[] = []
  for (const rec of incomeRecords) {
    const income = calculateIncome(rec)
    const exp = calculateExpensesFromList(expenses, rec.riderId, activeDriverCount)
    const netProfit = income.totalIncome - exp.totalExpenses
    driverResults.push({ rec, income, expenses: exp, netProfit })
  }
  const totalIncome = driverResults.reduce((s,d)=>s+d.income.totalIncome,0)
  const totalExpenses = driverResults.reduce((s,d)=>s+d.expenses.totalExpenses,0)
  const totalNetProfit = driverResults.reduce((s,d)=>s+d.netProfit,0)
  const profitable = driverResults.filter(d=>d.netProfit>0).length
  const unprofitable = driverResults.filter(d=>d.netProfit<0).length
  const expByCat = new Map<string,number>(); for (const e of expenses) expByCat.set(e.categoryName,(expByCat.get(e.categoryName)??0)+e.amount)
  const expCategories = Array.from(expByCat.entries()).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount)
  const D:any = { companyName, companyNameAr, month, driverResults, expenses, expCategories, activeDriverCount, totalIncome, totalExpenses, totalNetProfit, profitable, unprofitable, avgNet: activeDriverCount>0?totalNetProfit/activeDriverCount:0 }

  // Sheet 1: Executive Summary
  const ws = wb.addWorksheet('Executive Summary', { properties: { tabColor: C.BLUE } })
  ws.columns = [{width:35},{width:20},{width:20},{width:20},{width:20},{width:20}]
  ws.mergeCells('A1:F1'); const t=ws.getCell('A1'); t.value=`${companyName} — Income vs Expenses`; t.font={size:16,bold:true,color:{argb:C.WHITE}}; t.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.BLUE}}; t.alignment={horizontal:'center'}
  ws.mergeCells('A2:F2'); ws.getCell('A2').value=`${companyNameAr} · ${month} · ${driverResults.length} Drivers`; ws.getCell('A2').font={size:12,color:{argb:C.DARK}}; ws.getCell('A2').alignment={horizontal:'center'}
  const kpis = [
    {l:'Active Drivers',v:driverResults.length,c:C.BLUE,b:C.LIGHT_BLUE},
    {l:'Total Income (SAR)',v:totalIncome,c:C.EMERALD,b:C.LIGHT_EM,f:F},
    {l:'Total Expenses (SAR)',v:totalExpenses,c:C.ORANGE,b:C.LIGHT_OR,f:F},
    {l:'Net Profit (SAR)',v:totalNetProfit,c:totalNetProfit>=0?C.EMERALD:C.ROSE,b:totalNetProfit>=0?C.LIGHT_EM:C.LIGHT_RO,f:F},
    {l:'Avg Net/Driver',v:D.avgNet,c:D.avgNet>=0?C.EMERALD:C.ROSE,b:D.avgNet>=0?C.LIGHT_EM:C.LIGHT_RO,f:F},
    {l:'Profitable/Loss',v:`${profitable} / ${unprofitable}`,c:C.DARK,b:C.LIGHT_GRAY},
  ]
  kpis.forEach((k,i)=>{const lc=ws.getCell(4,i+1);lc.value=k.l;lc.font={size:8,bold:true,color:{argb:C.DARK}};lc.fill={type:'pattern',pattern:'solid',fgColor:{argb:k.b}};lc.alignment={horizontal:'center'};lc.border={top:{style:'medium',color:{argb:k.c}}};const vc=ws.getCell(5,i+1);vc.value=k.v;vc.font={size:13,bold:true,color:{argb:k.c}};vc.fill={type:'pattern',pattern:'solid',fgColor:{argb:k.b}};vc.alignment={horizontal:'center'};vc.numFmt=k.f})
  let r=8; ws.mergeCells(`A${r}:F${r}`); ws.getCell(`A${r}`).value='Income by Delivery Company'; ws.getCell(`A${r}`).font={size:12,bold:true,color:{argb:C.WHITE}}; ws.getCell(`A${r}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:C.BLUE}}; r++
  ws.getCell(r,1).value='Company'; ws.getCell(r,2).value='Drivers'; ws.getCell(r,3).value='Income'; ws.getCell(r,4).value='Expenses'; ws.getCell(r,5).value='Net'
  const compMap=new Map<string,{inc:number,exp:number,net:number,cnt:number}>()
  for (const d of driverResults) { const e=compMap.get(d.rec.companyName)||{inc:0,exp:0,net:0,cnt:0}; e.inc+=d.income.totalIncome; e.exp+=d.expenses.totalExpenses; e.net+=d.netProfit; e.cnt++; compMap.set(d.rec.companyName,e) }
  for (const [name,v] of compMap) { r++; ws.getCell(r,1).value=name; ws.getCell(r,2).value=v.cnt; ws.getCell(r,3).value=v.inc; ws.getCell(r,4).value=v.exp; ws.getCell(r,5).value=v.net; for (let col=1;col<=5;col++){ws.getCell(r,col).font={size:10};ws.getCell(r,col).alignment={horizontal:col===1?'left':'right'};if(col>=3)ws.getCell(r,col).numFmt=F} ws.getCell(r,5).font={size:10,bold:true,color:{argb:v.net>=0?C.EMERALD:C.ROSE}} }
  r+=3; ws.mergeCells(`A${r}:F${r}`); ws.getCell(`A${r}`).value='Expenses by Category'; ws.getCell(`A${r}`).font={size:12,bold:true,color:{argb:C.WHITE}}; ws.getCell(`A${r}`).fill={type:'pattern',pattern:'solid',fgColor:{argb:C.ORANGE}}; r++
  ws.getCell(r,1).value='Category'; ws.getCell(r,2).value='Amount'; ws.getCell(r,3).value='Per Driver'
  for (const c of expCategories) { r++; ws.getCell(r,1).value=c.name; ws.getCell(r,2).value=c.amount; ws.getCell(r,3).value=activeDriverCount>0?c.amount/activeDriverCount:0; for (let col=1;col<=3;col++){ws.getCell(r,col).font={size:10};if(col>=2)ws.getCell(r,col).numFmt=F} }
  r+=2; ws.getCell(r,1).value='Income'; ws.getCell(r,2).value=totalIncome; ws.getCell(r,2).numFmt=F; ws.getCell(r,2).font={bold:true,color:{argb:C.EMERALD}}
  r++; ws.getCell(r,1).value='Expenses'; ws.getCell(r,2).value=totalExpenses; ws.getCell(r,2).numFmt=F; ws.getCell(r,2).font={bold:true,color:{argb:C.ROSE}}
  r++; ws.getCell(r,1).value='Net Profit'; ws.getCell(r,2).value=totalNetProfit; ws.getCell(r,2).numFmt=F; ws.getCell(r,2).font={bold:true,color:{argb:totalNetProfit>=0?C.EMERALD:C.ROSE}}

  // Sheet 2: Driver Details
  const ws2 = wb.addWorksheet('Driver Details', { properties: { tabColor: C.BLUE } })
  ws2.columns = [{width:12},{width:22},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14}]
  ws2.mergeCells('A1:N1'); ws2.getCell('A1').value=`Driver Details — ${month}`; ws2.getCell('A1').font={size:14,bold:true,color:{argb:C.WHITE}}; ws2.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:C.BLUE}}; ws2.getCell('A1').alignment={horizontal:'center'}
  const hdrs=['Rider ID','Driver Name','Basic Pay','Distance Pay','Segment Pay','Total Penalties','Rider Balance','Total Income','Per-Driver Exp','Shared Exp','Assigned Exp','Total Expenses','Net Profit']
  hdrs.forEach((h,i)=>{const c=ws2.getCell(3,i+1);c.value=h;c.font={size:9,bold:true,color:{argb:C.WHITE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.BLUE}};c.alignment={horizontal:'center',wrapText:true}})
  let r2=4
  for (const d of driverResults) {
    const vals=[d.rec.riderId,d.rec.driverName,d.rec.basicPayment,d.rec.distancePayment,d.rec.segmentPayment,d.income.totalPenalties,d.rec.riderBalance,d.income.totalIncome,d.expenses.perDriverTotal,d.expenses.sharedTotal,d.expenses.assignedTotal,d.expenses.totalExpenses,d.netProfit]
    vals.forEach((v,i)=>{const c=ws2.getCell(r2,i+1);c.value=v;c.font={size:10};c.alignment={horizontal:i<2?'left':'right'};if(i>=2)c.numFmt=F;c.border={bottom:{style:'hair',color:{argb:'E5E7EB'}}};if(i===12)c.font={size:11,bold:true,color:{argb:v>=0?C.EMERALD:C.ROSE}}})
    r2++
  }
  ws2.getCell(r2,2).value='TOTAL'
  for (let col=3;col<=13;col++){const cl=String.fromCharCode(64+col);ws2.getCell(r2,col).value={formula:`SUM(${cl}4:${cl}${r2-1})`};const c=ws2.getCell(r2,col);c.font={bold:true,color:{argb:C.BLUE}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.LIGHT_BLUE}};c.numFmt=F;c.alignment={horizontal:'right'}}
  ws2.views = [{ state: 'frozen', ySplit: 3, xSplit: 2 }]; ws2.autoFilter = `A3:M${r2-1}`

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
