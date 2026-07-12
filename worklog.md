---
Task ID: redesign-payslip-summary
Agent: main
Task: Redesign one-page summary PDF + payslip PDF to be stunning, modern, fit one A4 page exactly with no whitespace; remove Active Rules section; show ALL riders in per-rider table

Work Log:
- Inspected existing one-page-summary-pdf.ts and payslip-pdf.ts and payslip-preview.tsx
- Confirmed "Active Rules" block existed at lines 402-408 of one-page-summary-pdf.ts — REMOVED
- Confirmed per-rider table only showed topEarners (3 riders) — EXPANDED to all riders sorted by net salary desc
- Restructured one-page summary: flex column layout, header → KPI → 3-col body → ALL-rider table (flex:1) → Final Net Hero → Signatures (immediately adjacent, no whitespace)
- Payslip redesigned: fixed 800x1131 px (A4 @ 96dpi) container with `display: flex; flex-direction: column; overflow: hidden`
- Premium header with radial gradient highlight
- Driver identity cards with green left-border accent
- Performance strip in green pill
- Two-column body (Working Summary + Earnings) using flex: 1 to fill available space
- Compact deductions table with red gradient header
- Optional traffic detail section
- Final Net Salary hero with glass-morphism, radial highlight, banking info embedded
- Signatures placed immediately below net salary hero (no whitespace)
- Updated payslip-preview.tsx React component to mirror new PDF design exactly

Stage Summary:
- Files modified:
  - /home/z/my-project/src/lib/one-page-summary-pdf.ts (full rewrite)
  - /home/z/my-project/src/lib/payslip-pdf.ts (full rewrite of buildPayslipHTML)
  - /home/z/my-project/src/components/payroll/payslip-preview.tsx (full rewrite)
- Active Rules section removed entirely from one-page summary
- Per-rider table now shows ALL riders (not just top 3)
- Both PDFs now use fixed A4 dimensions (800×1131 px) with flex layouts to fill the page completely
- Modern design: gradient headers, glass-morphism hero, premium card styling, banking info prominent
- Signatures placed immediately below Final Net Salary hero (no empty space)
