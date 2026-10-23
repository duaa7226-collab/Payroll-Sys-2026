-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "PayrollRuleSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ruleMode" TEXT NOT NULL DEFAULT 'orders_based_mode',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "notes" TEXT,
    "snapshotHash" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedBy" TEXT,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRuleValue" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleLabel" TEXT NOT NULL,
    "ruleGroup" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,
    "jsonValue" TEXT,
    "unit" TEXT,
    "validationMin" DOUBLE PRECISION,
    "validationMax" DOUBLE PRECISION,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "helpText" TEXT,

    CONSTRAINT "PayrollRuleValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractOverride" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "ruleLabel" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "booleanValue" BOOLEAN,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContractOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nokhaba Tatweer for Trading',
    "nameAr" TEXT NOT NULL DEFAULT 'مؤسسة نخبة التطوير للتجارة',
    "logo" TEXT,
    "address" TEXT,
    "addressAr" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vatNumber" TEXT,
    "crNumber" TEXT,
    "footerNote" TEXT,
    "footerNoteAr" TEXT,
    "signatureImg" TEXT,
    "riderSignatureImg" TEXT,
    "stampImg" TEXT,
    "accManagerName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractName" TEXT NOT NULL DEFAULT 'nokhaba_tatweer_ftr',
    "vehicleType" TEXT NOT NULL DEFAULT 'car',
    "bankName" TEXT,
    "iban" TEXT,
    "beneficiaryName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "ruleSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "totalDrivers" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPenalties" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVariance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTraffic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importedBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverResult" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "inactiveReason" TEXT,
    "completedOrders" INTEGER NOT NULL,
    "uploadedBasicPayment" DOUBLE PRECISION NOT NULL,
    "uploadedCityPayment" DOUBLE PRECISION NOT NULL,
    "actualWorkingDays" DOUBLE PRECISION NOT NULL,
    "fullyWorkingDays" DOUBLE PRECISION NOT NULL,
    "workingHours" DOUBLE PRECISION NOT NULL,
    "totalMonthlyWorkingHours" DOUBLE PRECISION NOT NULL,
    "activeRuleSetName" TEXT NOT NULL,
    "salaryDivisorMode" TEXT NOT NULL,
    "appliedBaseSalary" DOUBLE PRECISION NOT NULL,
    "appliedStdWorkingDays" DOUBLE PRECISION NOT NULL,
    "appliedMonthlyTarget" DOUBLE PRECISION NOT NULL,
    "appliedDailyTargetRate" DOUBLE PRECISION NOT NULL,
    "appliedSalaryPerOrder" DOUBLE PRECISION NOT NULL,
    "appliedBonusPerExtra" DOUBLE PRECISION NOT NULL,
    "appliedDeductionPerMissing" DOUBLE PRECISION NOT NULL,
    "trafficDeductionsEnabled" BOOLEAN NOT NULL,
    "dailyBaseRate" DOUBLE PRECISION NOT NULL,
    "adjustedBaseSalary" DOUBLE PRECISION NOT NULL,
    "adjustedTargetOrders" DOUBLE PRECISION NOT NULL,
    "selectedTargetThreshold" DOUBLE PRECISION NOT NULL,
    "baseSalaryEquivalent" DOUBLE PRECISION NOT NULL,
    "extraOrders" INTEGER NOT NULL,
    "missingOrders" INTEGER NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL,
    "missingOrderDeduction" DOUBLE PRECISION NOT NULL,
    "segmentPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltiesJson" TEXT NOT NULL,
    "totalOtherPenalties" DOUBLE PRECISION NOT NULL,
    "trafficViolationsDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalaryBeforePenalties" DOUBLE PRECISION NOT NULL,
    "finalNetSalary" DOUBLE PRECISION NOT NULL,
    "varianceAmount" DOUBLE PRECISION NOT NULL,
    "variancePercentage" DOUBLE PRECISION NOT NULL,
    "varianceStatus" TEXT NOT NULL DEFAULT 'ok',
    "reviewStatus" TEXT NOT NULL DEFAULT 'ok',
    "exceptionFlag" BOOLEAN NOT NULL DEFAULT false,
    "performanceBand" TEXT NOT NULL DEFAULT 'average',

    CONSTRAINT "DriverResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollException" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowRef" TEXT,
    "message" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficViolation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "ticketDate" TIMESTAMP(3) NOT NULL,
    "ticketNumber" TEXT,
    "violationType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "notes" TEXT,
    "payrollRunId" TEXT,
    "installmentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "installmentMonthlyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentTotalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentStatus" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualAdjustment" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBonus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'fixed',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "targetRiderIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomDeduction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "applyToAll" BOOLEAN NOT NULL DEFAULT true,
    "targetRiderIds" TEXT,
    "installmentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "installmentMonthlyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentTotalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentStatus" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ruleSetId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "performedBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "driverId" TEXT,
    "riderId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "basicPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distancePayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "segmentPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acceptancePenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contactPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stackingDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "declinedPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latePenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noShowPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noShowSpecialPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyAcceptancePenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missedDaysPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riderBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customFieldsJson" TEXT,
    "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPenalties" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceFile" TEXT,
    "importedBy" TEXT NOT NULL DEFAULT 'admin',
    "importNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "defaultAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocationType" TEXT NOT NULL DEFAULT 'per_driver',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "allocationType" TEXT NOT NULL,
    "assignedDriverId" TEXT,
    "assignedRiderId" TEXT,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverCount" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "activeDriverCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmedBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomIncomeField" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL DEFAULT 'add',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomIncomeField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRuleValue_ruleSetId_ruleKey_key" ON "PayrollRuleValue"("ruleSetId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContractOverride_ruleSetId_contractName_ruleKey_key" ON "ContractOverride"("ruleSetId", "contractName", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_riderId_key" ON "Driver"("riderId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverResult_payrollRunId_driverId_key" ON "DriverResult"("payrollRunId", "driverId");

-- CreateIndex
CREATE INDEX "IncomeRecord_month_idx" ON "IncomeRecord"("month");

-- CreateIndex
CREATE INDEX "IncomeRecord_companyName_idx" ON "IncomeRecord"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeRecord_month_riderId_companyName_key" ON "IncomeRecord"("month", "riderId", "companyName");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Expense_month_idx" ON "Expense"("month");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverCount_month_key" ON "DriverCount"("month");

-- AddForeignKey
ALTER TABLE "PayrollRuleValue" ADD CONSTRAINT "PayrollRuleValue_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PayrollRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractOverride" ADD CONSTRAINT "ContractOverride_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PayrollRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PayrollRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverResult" ADD CONSTRAINT "DriverResult_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverResult" ADD CONSTRAINT "DriverResult_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollException" ADD CONSTRAINT "PayrollException_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficViolation" ADD CONSTRAINT "TrafficViolation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualAdjustment" ADD CONSTRAINT "ManualAdjustment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "PayrollRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

