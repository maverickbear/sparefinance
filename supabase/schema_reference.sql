


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "creditLimit" double precision,
    "userId" "uuid"
);


ALTER TABLE "public"."Account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AccountInvestmentValue" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "totalValue" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."AccountInvestmentValue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Budget" (
    "id" "text" NOT NULL,
    "period" timestamp(3) without time zone NOT NULL,
    "categoryId" "text",
    "amount" double precision NOT NULL,
    "note" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "macroId" "text",
    "userId" "uuid"
);


ALTER TABLE "public"."Budget" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BudgetCategory" (
    "id" "text" NOT NULL,
    "budgetId" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."BudgetCategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Category" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "macroId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid"
);


ALTER TABLE "public"."Category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Debt" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "loanType" "text" NOT NULL,
    "initialAmount" double precision NOT NULL,
    "downPayment" double precision DEFAULT 0 NOT NULL,
    "currentBalance" double precision NOT NULL,
    "interestRate" double precision NOT NULL,
    "totalMonths" integer NOT NULL,
    "firstPaymentDate" timestamp(3) without time zone NOT NULL,
    "monthlyPayment" double precision NOT NULL,
    "principalPaid" double precision DEFAULT 0 NOT NULL,
    "interestPaid" double precision DEFAULT 0 NOT NULL,
    "additionalContributions" boolean DEFAULT false NOT NULL,
    "additionalContributionAmount" double precision DEFAULT 0,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "description" "text",
    "isPaidOff" boolean DEFAULT false NOT NULL,
    "isPaused" boolean DEFAULT false NOT NULL,
    "paidOffAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "paymentFrequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "paymentAmount" double precision,
    "accountId" "text",
    "userId" "uuid",
    CONSTRAINT "Debt_additionalContributionAmount_check" CHECK (("additionalContributionAmount" >= (0)::double precision)),
    CONSTRAINT "Debt_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Debt_downPayment_check" CHECK (("downPayment" >= (0)::double precision)),
    CONSTRAINT "Debt_initialAmount_check" CHECK (("initialAmount" > (0)::double precision)),
    CONSTRAINT "Debt_interestPaid_check" CHECK (("interestPaid" >= (0)::double precision)),
    CONSTRAINT "Debt_interestRate_check" CHECK (("interestRate" >= (0)::double precision)),
    CONSTRAINT "Debt_loanType_check" CHECK (("loanType" = ANY (ARRAY['mortgage'::"text", 'car_loan'::"text", 'personal_loan'::"text", 'credit_card'::"text", 'student_loan'::"text", 'business_loan'::"text", 'other'::"text"]))),
    CONSTRAINT "Debt_monthlyPayment_check" CHECK (("monthlyPayment" > (0)::double precision)),
    CONSTRAINT "Debt_paymentAmount_check" CHECK ((("paymentAmount" > (0)::double precision) OR ("paymentAmount" IS NULL))),
    CONSTRAINT "Debt_paymentFrequency_check" CHECK (("paymentFrequency" = ANY (ARRAY['monthly'::"text", 'biweekly'::"text", 'weekly'::"text", 'semimonthly'::"text", 'daily'::"text"]))),
    CONSTRAINT "Debt_principalPaid_check" CHECK (("principalPaid" >= (0)::double precision)),
    CONSTRAINT "Debt_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "Debt_totalMonths_check" CHECK (("totalMonths" > 0))
);


ALTER TABLE "public"."Debt" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Goal" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "targetAmount" double precision NOT NULL,
    "incomePercentage" double precision NOT NULL,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "description" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "currentBalance" double precision DEFAULT 0 NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "isPaused" boolean DEFAULT false NOT NULL,
    "expectedIncome" double precision,
    "targetMonths" double precision,
    "userId" "uuid",
    CONSTRAINT "Goal_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Goal_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "Goal_targetMonths_check" CHECK ((("targetMonths" IS NULL) OR ("targetMonths" > (0)::double precision)))
);


ALTER TABLE "public"."Goal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."HouseholdMember" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ownerId" "uuid" NOT NULL,
    "memberId" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invitationToken" "text" NOT NULL,
    "invitedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL
);


ALTER TABLE "public"."HouseholdMember" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InvestmentAccount" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "accountId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid"
);


ALTER TABLE "public"."InvestmentAccount" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InvestmentTransaction" (
    "id" "text" NOT NULL,
    "date" timestamp(3) without time zone NOT NULL,
    "accountId" "text" NOT NULL,
    "securityId" "text",
    "type" "text" NOT NULL,
    "quantity" double precision,
    "price" double precision,
    "fees" double precision DEFAULT 0 NOT NULL,
    "notes" "text",
    "transferToId" "text",
    "transferFromId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."InvestmentTransaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Macro" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid"
);


ALTER TABLE "public"."Macro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Plan" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "priceMonthly" numeric(10,2) DEFAULT 0 NOT NULL,
    "priceYearly" numeric(10,2) DEFAULT 0 NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripePriceIdMonthly" "text",
    "stripePriceIdYearly" "text",
    "stripeProductId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Security" (
    "id" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Security" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SecurityPrice" (
    "id" "text" NOT NULL,
    "securityId" "text" NOT NULL,
    "date" timestamp(3) without time zone NOT NULL,
    "price" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SecurityPrice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SimpleInvestmentEntry" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "date" timestamp(3) without time zone NOT NULL,
    "type" "text" NOT NULL,
    "amount" double precision NOT NULL,
    "description" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."SimpleInvestmentEntry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Subcategory" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Subcategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Subscription" (
    "id" "text" NOT NULL,
    "userId" "uuid" NOT NULL,
    "planId" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripeSubscriptionId" "text",
    "stripeCustomerId" "text",
    "currentPeriodStart" timestamp(3) without time zone,
    "currentPeriodEnd" timestamp(3) without time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Subscription" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Transaction" (
    "id" "text" NOT NULL,
    "date" timestamp(3) without time zone NOT NULL,
    "type" "text" NOT NULL,
    "amount" double precision NOT NULL,
    "accountId" "text" NOT NULL,
    "categoryId" "text",
    "subcategoryId" "text",
    "description" "text",
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "transferToId" "text",
    "transferFromId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "recurring" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."Transaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatarUrl" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "phoneNumber" "text"
);


ALTER TABLE "public"."User" OWNER TO "postgres";


ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_accountId_key" UNIQUE ("accountId");



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_invitationToken_key" UNIQUE ("invitationToken");



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Macro"
    ADD CONSTRAINT "Macro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Plan"
    ADD CONSTRAINT "Plan_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SecurityPrice"
    ADD CONSTRAINT "SecurityPrice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Security"
    ADD CONSTRAINT "Security_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



CREATE INDEX "AccountInvestmentValue_accountId_idx" ON "public"."AccountInvestmentValue" USING "btree" ("accountId");



CREATE INDEX "Account_type_idx" ON "public"."Account" USING "btree" ("type");



CREATE INDEX "Account_userId_idx" ON "public"."Account" USING "btree" ("userId");



CREATE UNIQUE INDEX "BudgetCategory_budgetId_categoryId_key" ON "public"."BudgetCategory" USING "btree" ("budgetId", "categoryId");



CREATE INDEX "BudgetCategory_budgetId_idx" ON "public"."BudgetCategory" USING "btree" ("budgetId");



CREATE INDEX "BudgetCategory_categoryId_idx" ON "public"."BudgetCategory" USING "btree" ("categoryId");



CREATE INDEX "Budget_categoryId_period_idx" ON "public"."Budget" USING "btree" ("categoryId", "period");



CREATE INDEX "Budget_macroId_idx" ON "public"."Budget" USING "btree" ("macroId");



CREATE UNIQUE INDEX "Budget_period_categoryId_key" ON "public"."Budget" USING "btree" ("period", "categoryId") WHERE ("categoryId" IS NOT NULL);



CREATE INDEX "Budget_period_idx" ON "public"."Budget" USING "btree" ("period");



CREATE UNIQUE INDEX "Budget_period_macroId_key" ON "public"."Budget" USING "btree" ("period", "macroId") WHERE ("macroId" IS NOT NULL);



CREATE INDEX "Budget_userId_idx" ON "public"."Budget" USING "btree" ("userId");



CREATE INDEX "Category_macroId_idx" ON "public"."Category" USING "btree" ("macroId");



CREATE INDEX "Category_name_idx" ON "public"."Category" USING "btree" ("name");



CREATE INDEX "Category_userId_idx" ON "public"."Category" USING "btree" ("userId");



CREATE INDEX "Debt_accountId_idx" ON "public"."Debt" USING "btree" ("accountId");



CREATE INDEX "Debt_firstPaymentDate_idx" ON "public"."Debt" USING "btree" ("firstPaymentDate");



CREATE INDEX "Debt_isPaidOff_idx" ON "public"."Debt" USING "btree" ("isPaidOff");



CREATE INDEX "Debt_isPaused_idx" ON "public"."Debt" USING "btree" ("isPaused");



CREATE INDEX "Debt_loanType_idx" ON "public"."Debt" USING "btree" ("loanType");



CREATE INDEX "Debt_paymentFrequency_idx" ON "public"."Debt" USING "btree" ("paymentFrequency");



CREATE INDEX "Debt_priority_idx" ON "public"."Debt" USING "btree" ("priority");



CREATE INDEX "Debt_userId_idx" ON "public"."Debt" USING "btree" ("userId");



CREATE INDEX "Goal_isCompleted_idx" ON "public"."Goal" USING "btree" ("isCompleted");



CREATE INDEX "Goal_isPaused_idx" ON "public"."Goal" USING "btree" ("isPaused");



CREATE INDEX "Goal_priority_idx" ON "public"."Goal" USING "btree" ("priority");



CREATE INDEX "Goal_userId_idx" ON "public"."Goal" USING "btree" ("userId");



CREATE INDEX "HouseholdMember_email_idx" ON "public"."HouseholdMember" USING "btree" ("email");



CREATE INDEX "HouseholdMember_invitationToken_idx" ON "public"."HouseholdMember" USING "btree" ("invitationToken");



CREATE INDEX "HouseholdMember_memberId_idx" ON "public"."HouseholdMember" USING "btree" ("memberId");



CREATE INDEX "HouseholdMember_ownerId_idx" ON "public"."HouseholdMember" USING "btree" ("ownerId");



CREATE INDEX "HouseholdMember_role_idx" ON "public"."HouseholdMember" USING "btree" ("role");



CREATE INDEX "HouseholdMember_status_idx" ON "public"."HouseholdMember" USING "btree" ("status");



CREATE INDEX "InvestmentAccount_type_idx" ON "public"."InvestmentAccount" USING "btree" ("type");



CREATE INDEX "InvestmentAccount_userId_idx" ON "public"."InvestmentAccount" USING "btree" ("userId");



CREATE INDEX "InvestmentTransaction_accountId_idx" ON "public"."InvestmentTransaction" USING "btree" ("accountId");



CREATE INDEX "InvestmentTransaction_date_idx" ON "public"."InvestmentTransaction" USING "btree" ("date");



CREATE INDEX "InvestmentTransaction_securityId_idx" ON "public"."InvestmentTransaction" USING "btree" ("securityId");



CREATE INDEX "InvestmentTransaction_type_idx" ON "public"."InvestmentTransaction" USING "btree" ("type");



CREATE INDEX "Macro_name_idx" ON "public"."Macro" USING "btree" ("name");



CREATE UNIQUE INDEX "Macro_name_key_system" ON "public"."Macro" USING "btree" ("name") WHERE ("userId" IS NULL);



CREATE UNIQUE INDEX "Macro_name_userId_key" ON "public"."Macro" USING "btree" ("name", "userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Macro_userId_idx" ON "public"."Macro" USING "btree" ("userId");



CREATE INDEX "Plan_name_idx" ON "public"."Plan" USING "btree" ("name");



CREATE INDEX "SecurityPrice_securityId_date_idx" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE UNIQUE INDEX "SecurityPrice_securityId_date_key" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE INDEX "Security_class_idx" ON "public"."Security" USING "btree" ("class");



CREATE INDEX "Security_symbol_idx" ON "public"."Security" USING "btree" ("symbol");



CREATE UNIQUE INDEX "Security_symbol_key" ON "public"."Security" USING "btree" ("symbol");



CREATE INDEX "SimpleInvestmentEntry_accountId_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("accountId");



CREATE INDEX "SimpleInvestmentEntry_date_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("date");



CREATE INDEX "SimpleInvestmentEntry_type_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("type");



CREATE INDEX "Subcategory_categoryId_idx" ON "public"."Subcategory" USING "btree" ("categoryId");



CREATE INDEX "Subcategory_name_idx" ON "public"."Subcategory" USING "btree" ("name");



CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription" USING "btree" ("planId");



CREATE INDEX "Subscription_status_idx" ON "public"."Subscription" USING "btree" ("status");



CREATE INDEX "Subscription_stripeCustomerId_idx" ON "public"."Subscription" USING "btree" ("stripeCustomerId");



CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "public"."Subscription" USING "btree" ("stripeSubscriptionId");



CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription" USING "btree" ("userId");



CREATE INDEX "Transaction_accountId_idx" ON "public"."Transaction" USING "btree" ("accountId");



CREATE INDEX "Transaction_categoryId_date_idx" ON "public"."Transaction" USING "btree" ("categoryId", "date");



CREATE INDEX "Transaction_date_idx" ON "public"."Transaction" USING "btree" ("date");



CREATE INDEX "Transaction_date_type_idx" ON "public"."Transaction" USING "btree" ("date", "type");



CREATE INDEX "Transaction_recurring_idx" ON "public"."Transaction" USING "btree" ("recurring");



CREATE INDEX "Transaction_type_idx" ON "public"."Transaction" USING "btree" ("type");



CREATE INDEX "User_email_idx" ON "public"."User" USING "btree" ("email");



CREATE INDEX "User_phoneNumber_idx" ON "public"."User" USING "btree" ("phoneNumber") WHERE ("phoneNumber" IS NOT NULL);



CREATE INDEX "User_role_idx" ON "public"."User" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "update_plan_updated_at" BEFORE UPDATE ON "public"."Plan" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_updated_at" BEFORE UPDATE ON "public"."Subscription" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_updated_at" BEFORE UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "public"."Budget"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_macroId_fkey" FOREIGN KEY ("macroId") REFERENCES "public"."Macro"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_macroId_fkey" FOREIGN KEY ("macroId") REFERENCES "public"."Macro"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Macro"
    ADD CONSTRAINT "Macro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SecurityPrice"
    ADD CONSTRAINT "SecurityPrice_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AccountInvestmentValue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Anyone can view by invitation token" ON "public"."HouseholdMember" FOR SELECT USING (true);



CREATE POLICY "Anyone can view securities" ON "public"."Security" FOR SELECT USING (true);



CREATE POLICY "Anyone can view security prices" ON "public"."SecurityPrice" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can delete securities" ON "public"."Security" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete security prices" ON "public"."SecurityPrice" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert securities" ON "public"."Security" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert security prices" ON "public"."SecurityPrice" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update securities" ON "public"."Security" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update security prices" ON "public"."SecurityPrice" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."Budget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."BudgetCategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Debt" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Goal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HouseholdMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentAccount" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentTransaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Macro" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Members can accept invitations" ON "public"."HouseholdMember" FOR UPDATE USING ((("auth"."uid"() = "memberId") OR ("auth"."uid"() = "ownerId"))) WITH CHECK ((("auth"."uid"() = "memberId") OR ("auth"."uid"() = "ownerId")));



CREATE POLICY "Members can view own household relationships" ON "public"."HouseholdMember" FOR SELECT USING (("auth"."uid"() = "memberId"));



CREATE POLICY "Owners can delete own household members" ON "public"."HouseholdMember" FOR DELETE USING (("auth"."uid"() = "ownerId"));



CREATE POLICY "Owners can invite household members" ON "public"."HouseholdMember" FOR INSERT WITH CHECK (("auth"."uid"() = "ownerId"));



CREATE POLICY "Owners can update own household members" ON "public"."HouseholdMember" FOR UPDATE USING (("auth"."uid"() = "ownerId"));



CREATE POLICY "Owners can view own household members" ON "public"."HouseholdMember" FOR SELECT USING (("auth"."uid"() = "ownerId"));



ALTER TABLE "public"."Plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Plans are publicly readable" ON "public"."Plan" FOR SELECT USING (true);



ALTER TABLE "public"."Security" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SecurityPrice" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Service role can delete plans" ON "public"."Plan" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can delete subscriptions" ON "public"."Subscription" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert plans" ON "public"."Plan" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert subscriptions" ON "public"."Subscription" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update plans" ON "public"."Plan" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update subscriptions" ON "public"."Subscription" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."SimpleInvestmentEntry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Subcategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Subscription" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Transaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can delete own account investment values" ON "public"."AccountInvestmentValue" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own accounts" ON "public"."Account" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own budget categories" ON "public"."BudgetCategory" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own budgets" ON "public"."Budget" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own categories" ON "public"."Category" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own debts" ON "public"."Debt" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own goals" ON "public"."Goal" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own investment accounts" ON "public"."InvestmentAccount" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete own investment transactions" ON "public"."InvestmentTransaction" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "InvestmentTransaction"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own macros" ON "public"."Macro" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own subcategories" ON "public"."Subcategory" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND ("Category"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own transactions" ON "public"."Transaction" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "Transaction"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own account investment values" ON "public"."AccountInvestmentValue" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own accounts" ON "public"."Account" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own budget categories" ON "public"."BudgetCategory" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own budgets" ON "public"."Budget" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own categories" ON "public"."Category" FOR INSERT WITH CHECK ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert own debts" ON "public"."Debt" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own goals" ON "public"."Goal" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own investment accounts" ON "public"."InvestmentAccount" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own investment transactions" ON "public"."InvestmentTransaction" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "InvestmentTransaction"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own macros" ON "public"."Macro" FOR INSERT WITH CHECK ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert own profile" ON "public"."User" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own subcategories" ON "public"."Subcategory" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own subscriptions" ON "public"."Subscription" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own transactions" ON "public"."Transaction" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "Transaction"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can read own profile" ON "public"."User" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own subscriptions" ON "public"."Subscription" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own account investment values" ON "public"."AccountInvestmentValue" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own accounts" ON "public"."Account" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own budgets" ON "public"."Budget" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own categories" ON "public"."Category" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own debts" ON "public"."Debt" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own goals" ON "public"."Goal" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own investment accounts" ON "public"."InvestmentAccount" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update own investment transactions" ON "public"."InvestmentTransaction" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "InvestmentTransaction"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own macros" ON "public"."Macro" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."User" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own subcategories" ON "public"."Subcategory" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND ("Category"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own transactions" ON "public"."Transaction" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "Transaction"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own account investment values" ON "public"."AccountInvestmentValue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own accounts" ON "public"."Account" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own budget categories" ON "public"."BudgetCategory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own budgets" ON "public"."Budget" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own debts" ON "public"."Debt" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own goals" ON "public"."Goal" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own investment accounts" ON "public"."InvestmentAccount" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own investment transactions" ON "public"."InvestmentTransaction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "InvestmentTransaction"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own transactions" ON "public"."Transaction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "Transaction"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view system and own categories" ON "public"."Category" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can view system and own macros" ON "public"."Macro" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can view system and own subcategories" ON "public"."Subcategory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users cannot delete own profile" ON "public"."User" FOR DELETE USING (false);



CREATE POLICY "Users cannot update subscriptions" ON "public"."Subscription" FOR UPDATE USING (false);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."Account" TO "anon";
GRANT ALL ON TABLE "public"."Account" TO "authenticated";
GRANT ALL ON TABLE "public"."Account" TO "service_role";



GRANT ALL ON TABLE "public"."AccountInvestmentValue" TO "anon";
GRANT ALL ON TABLE "public"."AccountInvestmentValue" TO "authenticated";
GRANT ALL ON TABLE "public"."AccountInvestmentValue" TO "service_role";



GRANT ALL ON TABLE "public"."Budget" TO "anon";
GRANT ALL ON TABLE "public"."Budget" TO "authenticated";
GRANT ALL ON TABLE "public"."Budget" TO "service_role";



GRANT ALL ON TABLE "public"."BudgetCategory" TO "anon";
GRANT ALL ON TABLE "public"."BudgetCategory" TO "authenticated";
GRANT ALL ON TABLE "public"."BudgetCategory" TO "service_role";



GRANT ALL ON TABLE "public"."Category" TO "anon";
GRANT ALL ON TABLE "public"."Category" TO "authenticated";
GRANT ALL ON TABLE "public"."Category" TO "service_role";



GRANT ALL ON TABLE "public"."Debt" TO "anon";
GRANT ALL ON TABLE "public"."Debt" TO "authenticated";
GRANT ALL ON TABLE "public"."Debt" TO "service_role";



GRANT ALL ON TABLE "public"."Goal" TO "anon";
GRANT ALL ON TABLE "public"."Goal" TO "authenticated";
GRANT ALL ON TABLE "public"."Goal" TO "service_role";



GRANT ALL ON TABLE "public"."HouseholdMember" TO "anon";
GRANT ALL ON TABLE "public"."HouseholdMember" TO "authenticated";
GRANT ALL ON TABLE "public"."HouseholdMember" TO "service_role";



GRANT ALL ON TABLE "public"."InvestmentAccount" TO "anon";
GRANT ALL ON TABLE "public"."InvestmentAccount" TO "authenticated";
GRANT ALL ON TABLE "public"."InvestmentAccount" TO "service_role";



GRANT ALL ON TABLE "public"."InvestmentTransaction" TO "anon";
GRANT ALL ON TABLE "public"."InvestmentTransaction" TO "authenticated";
GRANT ALL ON TABLE "public"."InvestmentTransaction" TO "service_role";



GRANT ALL ON TABLE "public"."Macro" TO "anon";
GRANT ALL ON TABLE "public"."Macro" TO "authenticated";
GRANT ALL ON TABLE "public"."Macro" TO "service_role";



GRANT ALL ON TABLE "public"."Plan" TO "anon";
GRANT ALL ON TABLE "public"."Plan" TO "authenticated";
GRANT ALL ON TABLE "public"."Plan" TO "service_role";



GRANT ALL ON TABLE "public"."Security" TO "anon";
GRANT ALL ON TABLE "public"."Security" TO "authenticated";
GRANT ALL ON TABLE "public"."Security" TO "service_role";



GRANT ALL ON TABLE "public"."SecurityPrice" TO "anon";
GRANT ALL ON TABLE "public"."SecurityPrice" TO "authenticated";
GRANT ALL ON TABLE "public"."SecurityPrice" TO "service_role";



GRANT ALL ON TABLE "public"."SimpleInvestmentEntry" TO "anon";
GRANT ALL ON TABLE "public"."SimpleInvestmentEntry" TO "authenticated";
GRANT ALL ON TABLE "public"."SimpleInvestmentEntry" TO "service_role";



GRANT ALL ON TABLE "public"."Subcategory" TO "anon";
GRANT ALL ON TABLE "public"."Subcategory" TO "authenticated";
GRANT ALL ON TABLE "public"."Subcategory" TO "service_role";



GRANT ALL ON TABLE "public"."Subscription" TO "anon";
GRANT ALL ON TABLE "public"."Subscription" TO "authenticated";
GRANT ALL ON TABLE "public"."Subscription" TO "service_role";



GRANT ALL ON TABLE "public"."Transaction" TO "anon";
GRANT ALL ON TABLE "public"."Transaction" TO "authenticated";
GRANT ALL ON TABLE "public"."Transaction" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







