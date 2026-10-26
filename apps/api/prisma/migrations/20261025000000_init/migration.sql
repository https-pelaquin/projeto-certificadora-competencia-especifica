-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PROFESSOR', 'HEAD', 'COUNCIL_MEMBER', 'FINANCIAL_ADMIN');

-- CreateEnum
CREATE TYPE "PasswordTokenPurpose" AS ENUM ('INVITE', 'RESET');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('AWAITING_VOTING', 'AWAITING_COMPLEMENT', 'AWAITING_BALANCE', 'IN_VOTING', 'PROVISIONED', 'PAID', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'PROVISION', 'RELEASE', 'SPEND');

-- CreateEnum
CREATE TYPE "VotingStatus" AS ENUM ('OPEN', 'AWAITING_TIE_BREAK', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "VotingResult" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "TieBreakChoice" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "assignedById" INTEGER,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "PasswordTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "initialAmount" DECIMAL(14,2) NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLimit" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "periodMonths" INTEGER NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),
    "createdById" INTEGER,

    CONSTRAINT "ApprovalLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "budgetId" INTEGER NOT NULL,
    "approvalLimitId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" SERIAL NOT NULL,
    "budgetId" INTEGER NOT NULL,
    "requestId" INTEGER,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "justification" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL,
    "justification" TEXT,
    "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplementRequest" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voting" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "openedById" INTEGER NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "status" "VotingStatus" NOT NULL DEFAULT 'OPEN',
    "result" "VotingResult",
    "approveCount" INTEGER,
    "rejectCount" INTEGER,
    "abstainCount" INTEGER,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Voting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingEligibleMember" (
    "votingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "VotingEligibleMember_pkey" PRIMARY KEY ("votingId","userId")
);

-- CreateTable
CREATE TABLE "Vote" (
    "votingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("votingId","userId")
);

-- CreateTable
CREATE TABLE "TieBreak" (
    "votingId" INTEGER NOT NULL,
    "headId" INTEGER NOT NULL,
    "choice" "TieBreakChoice" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TieBreak_pkey" PRIMARY KEY ("votingId")
);

-- CreateTable
CREATE TABLE "VotingComment" (
    "id" SERIAL NOT NULL,
    "votingId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" INTEGER,
    "job" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "justification" TEXT,
    "ip" TEXT,
    "requestId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" SERIAL NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_role_idx" ON "RoleAssignment"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordToken_tokenHash_key" ON "PasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordToken_userId_idx" ON "PasswordToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_year_key" ON "Budget"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Request_requesterId_createdAt_idx" ON "Request"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "LedgerEntry_budgetId_type_idx" ON "LedgerEntry"("budgetId", "type");

-- CreateIndex
CREATE INDEX "LedgerEntry_requestId_idx" ON "LedgerEntry"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_requestId_key" ON "Payment"("requestId");

-- CreateIndex
CREATE INDEX "ComplementRequest_requestId_idx" ON "ComplementRequest"("requestId");

-- CreateIndex
CREATE INDEX "Voting_status_deadline_idx" ON "Voting"("status", "deadline");

-- CreateIndex
CREATE INDEX "Voting_requestId_idx" ON "Voting"("requestId");

-- CreateIndex
CREATE INDEX "VotingEligibleMember_userId_idx" ON "VotingEligibleMember"("userId");

-- CreateIndex
CREATE INDEX "VotingComment_votingId_createdAt_idx" ON "VotingComment"("votingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordToken" ADD CONSTRAINT "PasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLimit" ADD CONSTRAINT "ApprovalLimit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_approvalLimitId_fkey" FOREIGN KEY ("approvalLimitId") REFERENCES "ApprovalLimit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplementRequest" ADD CONSTRAINT "ComplementRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplementRequest" ADD CONSTRAINT "ComplementRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingEligibleMember" ADD CONSTRAINT "VotingEligibleMember_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingEligibleMember" ADD CONSTRAINT "VotingEligibleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_votingId_userId_fkey" FOREIGN KEY ("votingId", "userId") REFERENCES "VotingEligibleMember"("votingId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TieBreak" ADD CONSTRAINT "TieBreak_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TieBreak" ADD CONSTRAINT "TieBreak_headId_fkey" FOREIGN KEY ("headId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingComment" ADD CONSTRAINT "VotingComment_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "Voting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingComment" ADD CONSTRAINT "VotingComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------
-- Regras que o Prisma não expressa
-- ---------------------------------------------------------------

-- Dinheiro: o efeito do lançamento vem do type, nunca do sinal.
ALTER TABLE "Budget"        ADD CONSTRAINT "Budget_initialAmount_check"      CHECK ("initialAmount" >= 0);
ALTER TABLE "ApprovalLimit" ADD CONSTRAINT "ApprovalLimit_amount_check"      CHECK ("amount" > 0);
ALTER TABLE "ApprovalLimit" ADD CONSTRAINT "ApprovalLimit_periodMonths_check" CHECK ("periodMonths" > 0);
ALTER TABLE "Request"       ADD CONSTRAINT "Request_amount_check"            CHECK ("amount" > 0);
ALTER TABLE "LedgerEntry"   ADD CONSTRAINT "LedgerEntry_amount_check"        CHECK ("amount" > 0);
ALTER TABLE "Payment"       ADD CONSTRAINT "Payment_paidAmount_check"        CHECK ("paidAmount" > 0);
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_period_check"    CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt");

-- No máximo uma votação não encerrada por solicitação.
CREATE UNIQUE INDEX "Voting_requestId_active_key" ON "Voting"("requestId")
  WHERE "status" IN ('OPEN', 'AWAITING_TIE_BREAK');

-- Ledger e auditoria são só de inclusão.
CREATE FUNCTION "reject_update_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% é só de inclusão: % não é permitido', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_update_delete"();

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "reject_update_delete"();
