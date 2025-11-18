


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



CREATE OR REPLACE FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get the authenticated user's email from auth.users
  -- Using fully qualified schema name for security
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Return true if emails match
  RETURN user_email = invitation_email;
END;
$$;


ALTER FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_planned_payment "public"."PlannedPayment"%ROWTYPE;
    v_transaction_id "text";
    v_encrypted_amount "text";
    v_user_id "uuid";
BEGIN
    -- Get the planned payment
    SELECT * INTO v_planned_payment
    FROM "public"."PlannedPayment"
    WHERE "id" = p_planned_payment_id
    AND "userId" = "auth"."uid"()
    AND "status" = 'scheduled'::"text";
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PlannedPayment not found or already processed';
    END IF;
    
    -- Check if already has a linked transaction (idempotency)
    IF v_planned_payment."linkedTransactionId" IS NOT NULL THEN
        RETURN v_planned_payment."linkedTransactionId";
    END IF;
    
    v_user_id := v_planned_payment."userId";
    
    -- Encrypt amount (using same logic as Transaction)
    -- Note: This assumes amount encryption function exists
    -- For now, we'll store as numeric and let the application layer handle encryption
    -- The Transaction table expects encrypted text, so we need to handle this
    
    -- Generate transaction ID
    v_transaction_id := "gen_random_uuid"()::"text";
    
    -- Create the transaction
    INSERT INTO "public"."Transaction" (
        "id",
        "date",
        "type",
        "amount",
        "accountId",
        "categoryId",
        "subcategoryId",
        "description",
        "userId",
        "recurring",
        "createdAt",
        "updatedAt"
    ) VALUES (
        v_transaction_id,
        v_planned_payment."date",
        v_planned_payment."type",
        v_planned_payment."amount"::"text", -- Will be encrypted by application layer
        v_planned_payment."accountId",
        v_planned_payment."categoryId",
        v_planned_payment."subcategoryId",
        v_planned_payment."description",
        v_user_id,
        false, -- Planned payments are not recurring by default
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    
    -- Update planned payment status and link transaction
    UPDATE "public"."PlannedPayment"
    SET 
        "status" = 'paid'::"text",
        "linkedTransactionId" = v_transaction_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_planned_payment_id;
    
    RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") IS 'Converts a PlannedPayment to a Transaction. Idempotent - returns existing transaction if already converted.';



CREATE OR REPLACE FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text" DEFAULT NULL::"text", "p_subcategory_id" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_description_search" "text" DEFAULT NULL::"text", "p_recurring" boolean DEFAULT false, "p_expense_type" "text" DEFAULT NULL::"text", "p_created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP, "p_updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP, "p_max_transactions" integer DEFAULT '-1'::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_month_date date;
  v_current_count integer;
  v_new_count integer;
  v_transaction_id text;
BEGIN
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "user_monthly_usage"
    WHERE "user_id" = p_user_id AND "month_date" = v_month_date;
    
    IF v_current_count >= p_max_transactions THEN
      RAISE EXCEPTION 'Transaction limit reached for this month';
    END IF;
  END IF;
  
  -- Increment counter
  v_new_count := "increment_transaction_count"(p_user_id, v_month_date);
  
  -- Insert transaction
  INSERT INTO "Transaction" (
    "id", "date", "type", "amount", "amount_numeric", "accountId", "userId",
    "categoryId", "subcategoryId", "description", "description_search",
    "recurring", "expenseType", "createdAt", "updatedAt"
  ) VALUES (
    p_id, p_date, p_type, p_amount, p_amount_numeric, p_account_id, p_user_id,
    p_category_id, p_subcategory_id, p_description, p_description_search,
    p_recurring, p_expense_type, p_created_at, p_updated_at
  );
  
  -- Return JSON with transaction ID and new count
  RETURN jsonb_build_object(
    'transaction_id', p_id,
    'new_count', v_new_count
  );
END;
$$;


ALTER FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp without time zone, "p_updated_at" timestamp without time zone, "p_max_transactions" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp without time zone, "p_updated_at" timestamp without time zone, "p_max_transactions" integer) IS 'Creates a regular transaction atomically with limit checking. All operations in one transaction.';



CREATE OR REPLACE FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_date" "date", "p_description" "text" DEFAULT NULL::"text", "p_description_search" "text" DEFAULT NULL::"text", "p_recurring" boolean DEFAULT false, "p_max_transactions" integer DEFAULT '-1'::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_outgoing_id text;
  v_incoming_id text;
  v_month_date date;
  v_current_count integer;
  v_new_count integer;
  v_now timestamp(3) without time zone;
  v_outgoing_description text;
  v_incoming_description text;
BEGIN
  -- Generate IDs
  v_outgoing_id := gen_random_uuid()::text;
  v_incoming_id := gen_random_uuid()::text;
  v_now := CURRENT_TIMESTAMP;
  
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "user_monthly_usage"
    WHERE "user_id" = p_user_id AND "month_date" = v_month_date;
    
    IF v_current_count >= p_max_transactions THEN
      RAISE EXCEPTION 'Transaction limit reached for this month';
    END IF;
  END IF;
  
  -- Increment counter ONCE (transfer = 1 action, not 2)
  v_new_count := "increment_transaction_count"(p_user_id, v_month_date);
  
  -- Prepare descriptions
  v_outgoing_description := COALESCE(p_description, 'Transfer to account');
  v_incoming_description := COALESCE(p_description, 'Transfer from account');
  
  -- Create outgoing transaction (transfer from source account)
  INSERT INTO "Transaction" (
    "id", "date", "type", "amount", "amount_numeric", "accountId", "userId",
    "categoryId", "subcategoryId", "description", "description_search",
    "recurring", "transferToId", "createdAt", "updatedAt"
  ) VALUES (
    v_outgoing_id, p_date, 'transfer', p_amount, p_amount_numeric, p_from_account_id, p_user_id,
    NULL, NULL, v_outgoing_description, p_description_search,
    p_recurring, v_incoming_id, v_now, v_now
  );
  
  -- Create incoming transaction (transfer to destination account)
  INSERT INTO "Transaction" (
    "id", "date", "type", "amount", "amount_numeric", "accountId", "userId",
    "categoryId", "subcategoryId", "description", "description_search",
    "recurring", "transferFromId", "createdAt", "updatedAt"
  ) VALUES (
    v_incoming_id, p_date, 'transfer', p_amount, p_amount_numeric, p_to_account_id, p_user_id,
    NULL, NULL, v_incoming_description, p_description_search,
    p_recurring, v_outgoing_id, v_now, v_now
  );
  
  -- Return JSON with transaction IDs and new count
  RETURN jsonb_build_object(
    'outgoing_id', v_outgoing_id,
    'incoming_id', v_incoming_id,
    'new_count', v_new_count
  );
END;
$$;


ALTER FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_max_transactions" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_max_transactions" integer) IS 'Creates a transfer (2 transactions) atomically with limit checking. Counts as 1 transaction. All operations in one transaction.';



CREATE OR REPLACE FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") RETURNS TABLE("table_name" "text", "last_update" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    -- Transaction
    SELECT 
      'Transaction' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000 as last_update
    FROM "Transaction"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Account
    SELECT 
      'Account' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000
    FROM "Account"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Budget
    SELECT 
      'Budget' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000
    FROM "Budget"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Goal
    SELECT 
      'Goal' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000
    FROM "Goal"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Debt
    SELECT 
      'Debt' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000
    FROM "Debt"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- SimpleInvestmentEntry (via Account)
    SELECT 
      'SimpleInvestmentEntry' as table_name,
      EXTRACT(EPOCH FROM MAX(GREATEST(sie."updatedAt", sie."createdAt"))) * 1000
    FROM "SimpleInvestmentEntry" sie
    JOIN "Account" a ON a.id = sie."accountId"
    WHERE a."userId" = p_user_id
      AND (sie."updatedAt" IS NOT NULL OR sie."createdAt" IS NOT NULL)
  )
  SELECT * FROM updates WHERE last_update IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") IS 'Retorna timestamp da última atualização de cada tabela para um usuário. Usado pelo endpoint check-updates.';



CREATE OR REPLACE FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO "user_monthly_usage" ("user_id", "month_date", "transactions_count")
  VALUES (p_user_id, p_month_date, 1)
  ON CONFLICT ("user_id", "month_date")
  DO UPDATE SET
    "transactions_count" = "user_monthly_usage"."transactions_count" + 1;
  
  SELECT "transactions_count" INTO v_count
  FROM "user_monthly_usage"
  WHERE "user_id" = p_user_id AND "month_date" = p_month_date;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") IS 'Atomically increments transaction count for a user/month. Used within transaction functions.';



CREATE OR REPLACE FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "Account"
    WHERE "Account"."id" = account_id
    AND "Account"."userId" = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "AccountOwner"
    WHERE "AccountOwner"."accountId" = account_id
    AND "AccountOwner"."ownerId" = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_refresh_holdings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Notificar que houve mudança (para background worker)
  -- Não podemos usar NEW.user_id porque InvestmentTransaction não tem essa coluna
  PERFORM pg_notify('refresh_holdings', 'refresh_needed');
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."notify_refresh_holdings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_portfolio_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Refresh holdings_view (tem índice único, pode usar CONCURRENTLY)
  REFRESH MATERIALIZED VIEW CONCURRENTLY holdings_view;
  
  -- Refresh portfolio_summary_view (tem índice único, pode usar CONCURRENTLY)
  REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_summary_view;
  
  -- Refresh outras views (sem índice único, não pode usar CONCURRENTLY)
  -- Estas views são pequenas e rápidas, então não precisa de CONCURRENTLY
  REFRESH MATERIALIZED VIEW asset_allocation_view;
  REFRESH MATERIALIZED VIEW sector_allocation_view;
END;
$$;


ALTER FUNCTION "public"."refresh_portfolio_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_portfolio_views"() IS 'Refresh manual de todas as views de portfolio. Executar via cron job ou API.';



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
    "userId" "uuid",
    "initialBalance" double precision,
    "plaidItemId" "text",
    "plaidAccountId" "text",
    "isConnected" boolean DEFAULT false,
    "lastSyncedAt" timestamp(3) without time zone,
    "syncEnabled" boolean DEFAULT true,
    "plaidMask" "text",
    "plaidOfficialName" "text",
    "plaidVerificationStatus" "text",
    "dueDayOfMonth" integer,
    "extraCredit" numeric(15,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "Account_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'checking'::"text", 'savings'::"text", 'credit'::"text", 'investment'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."Account" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Account"."initialBalance" IS 'Initial balance for checking and savings accounts. Used as starting point for balance calculations.';



COMMENT ON COLUMN "public"."Account"."dueDayOfMonth" IS 'Day of month when credit card bill is due (1-31). Only used for type=''credit'' accounts.';



COMMENT ON COLUMN "public"."Account"."extraCredit" IS 'Extra prepaid credit on this credit card. Used when user pays more than the current debt balance.';



CREATE TABLE IF NOT EXISTS "public"."AccountInvestmentValue" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "totalValue" double precision NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."AccountInvestmentValue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."AccountOwner" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "accountId" "text" NOT NULL,
    "ownerId" "uuid" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."AccountOwner" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Budget" (
    "id" "text" NOT NULL,
    "period" timestamp(3) without time zone NOT NULL,
    "categoryId" "text",
    "amount" double precision NOT NULL,
    "note" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "groupId" "text",
    "userId" "uuid" NOT NULL,
    "subcategoryId" "text",
    "isRecurring" boolean DEFAULT true NOT NULL,
    CONSTRAINT "budget_amount_positive" CHECK (("amount" > (0)::double precision))
);


ALTER TABLE "public"."Budget" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Budget"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."Budget"."isRecurring" IS 'Indicates if the budget is recurring monthly. When true, the budget will be automatically created for future months.';



CREATE TABLE IF NOT EXISTS "public"."BudgetCategory" (
    "id" "text" NOT NULL,
    "budgetId" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."BudgetCategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Candle" (
    "id" "text" NOT NULL,
    "securityId" "text" NOT NULL,
    "symbolId" bigint NOT NULL,
    "start" timestamp(3) without time zone NOT NULL,
    "end" timestamp(3) without time zone NOT NULL,
    "low" numeric(15,4) NOT NULL,
    "high" numeric(15,4) NOT NULL,
    "open" numeric(15,4) NOT NULL,
    "close" numeric(15,4) NOT NULL,
    "volume" bigint DEFAULT 0 NOT NULL,
    "VWAP" numeric(15,4),
    "interval" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Candle" OWNER TO "postgres";


COMMENT ON TABLE "public"."Candle" IS 'Stores historical price data (candles) from Questrade';



CREATE TABLE IF NOT EXISTS "public"."Category" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "groupId" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid"
);


ALTER TABLE "public"."Category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ContactForm" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "adminNotes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ContactForm_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'read'::"text", 'replied'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."ContactForm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Debt" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "loanType" "text" NOT NULL,
    "initialAmount" double precision NOT NULL,
    "downPayment" double precision DEFAULT 0,
    "currentBalance" double precision NOT NULL,
    "interestRate" double precision NOT NULL,
    "totalMonths" integer,
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
    "userId" "uuid" NOT NULL,
    "startDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "nextDueDate" "date",
    CONSTRAINT "Debt_additionalContributionAmount_check" CHECK (("additionalContributionAmount" >= (0)::double precision)),
    CONSTRAINT "Debt_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Debt_downPayment_check" CHECK ((("downPayment" IS NULL) OR ("downPayment" >= (0)::double precision))),
    CONSTRAINT "Debt_initialAmount_check" CHECK (("initialAmount" > (0)::double precision)),
    CONSTRAINT "Debt_interestPaid_check" CHECK (("interestPaid" >= (0)::double precision)),
    CONSTRAINT "Debt_interestRate_check" CHECK (("interestRate" >= (0)::double precision)),
    CONSTRAINT "Debt_loanType_check" CHECK (("loanType" = ANY (ARRAY['mortgage'::"text", 'car_loan'::"text", 'personal_loan'::"text", 'credit_card'::"text", 'student_loan'::"text", 'business_loan'::"text", 'other'::"text"]))),
    CONSTRAINT "Debt_monthlyPayment_check" CHECK (("monthlyPayment" > (0)::double precision)),
    CONSTRAINT "Debt_paymentAmount_check" CHECK ((("paymentAmount" > (0)::double precision) OR ("paymentAmount" IS NULL))),
    CONSTRAINT "Debt_paymentFrequency_check" CHECK (("paymentFrequency" = ANY (ARRAY['monthly'::"text", 'biweekly'::"text", 'weekly'::"text", 'semimonthly'::"text", 'daily'::"text"]))),
    CONSTRAINT "Debt_principalPaid_check" CHECK (("principalPaid" >= (0)::double precision)),
    CONSTRAINT "Debt_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "Debt_totalMonths_check" CHECK ((("totalMonths" IS NULL) OR ("totalMonths" > 0))),
    CONSTRAINT "debt_first_payment_date_valid" CHECK ((("firstPaymentDate" IS NULL) OR (("firstPaymentDate" >= '1900-01-01'::"date") AND ("firstPaymentDate" <= (CURRENT_DATE + '50 years'::interval))))),
    CONSTRAINT "debt_initialamount_positive" CHECK (("initialAmount" >= (0)::double precision)),
    CONSTRAINT "debt_next_due_date_valid" CHECK ((("nextDueDate" IS NULL) OR (("nextDueDate" >= '1900-01-01'::"date") AND ("nextDueDate" <= (CURRENT_DATE + '10 years'::interval))))),
    CONSTRAINT "debt_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."Debt" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Debt"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."Debt"."status" IS 'Estado da dívida (ativa ou encerrada)';



COMMENT ON COLUMN "public"."Debt"."nextDueDate" IS 'Data de vencimento da fatura/dívida';



COMMENT ON CONSTRAINT "debt_first_payment_date_valid" ON "public"."Debt" IS 'Valida que a data do primeiro pagamento está em um range válido';



COMMENT ON CONSTRAINT "debt_next_due_date_valid" ON "public"."Debt" IS 'Valida que a próxima data de vencimento está em um range válido';



CREATE TABLE IF NOT EXISTS "public"."Execution" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "questradeExecutionId" bigint NOT NULL,
    "symbolId" bigint NOT NULL,
    "symbol" "text" NOT NULL,
    "quantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "side" "text" NOT NULL,
    "price" numeric(15,4) NOT NULL,
    "orderId" bigint NOT NULL,
    "orderChainId" bigint NOT NULL,
    "exchangeExecId" "text",
    "timestamp" timestamp(3) without time zone NOT NULL,
    "notes" "text",
    "venue" "text",
    "totalCost" numeric(15,2) DEFAULT 0 NOT NULL,
    "orderPlacementCommission" numeric(15,2) DEFAULT 0,
    "commission" numeric(15,2) DEFAULT 0,
    "executionFee" numeric(15,2) DEFAULT 0,
    "secFee" numeric(15,2) DEFAULT 0,
    "canadianExecutionFee" numeric(15,2) DEFAULT 0,
    "parentId" bigint,
    "lastSyncedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Execution" OWNER TO "postgres";


COMMENT ON TABLE "public"."Execution" IS 'Stores order executions from Questrade';



CREATE TABLE IF NOT EXISTS "public"."Feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "feedback" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "Feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."Feedback" OWNER TO "postgres";


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
    "userId" "uuid" NOT NULL,
    "accountId" "text",
    "holdingId" "text",
    CONSTRAINT "Goal_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Goal_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "Goal_targetMonths_check" CHECK ((("targetMonths" IS NULL) OR ("targetMonths" > (0)::double precision))),
    CONSTRAINT "goal_targetamount_positive" CHECK (("targetAmount" > (0)::double precision))
);


ALTER TABLE "public"."Goal" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Goal"."userId" IS 'User ID - obrigatório para RLS policies';



CREATE TABLE IF NOT EXISTS "public"."Group" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid",
    "type" "text",
    CONSTRAINT "Group_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."Group" OWNER TO "postgres";


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
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    CONSTRAINT "HouseholdMember_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."HouseholdMember" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InvestmentAccount" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "accountId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" "uuid" NOT NULL,
    "questradeAccountNumber" "text",
    "questradeConnectionId" "text",
    "isQuestradeConnected" boolean DEFAULT false,
    "cash" numeric(15,2),
    "marketValue" numeric(15,2),
    "totalEquity" numeric(15,2),
    "buyingPower" numeric(15,2),
    "maintenanceExcess" numeric(15,2),
    "currency" "text" DEFAULT 'CAD'::"text",
    "balanceLastUpdatedAt" timestamp(3) without time zone
);


ALTER TABLE "public"."InvestmentAccount" OWNER TO "postgres";


COMMENT ON COLUMN "public"."InvestmentAccount"."updatedAt" IS 'Timestamp de última atualização - atualizado automaticamente';



COMMENT ON COLUMN "public"."InvestmentAccount"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."InvestmentAccount"."questradeAccountNumber" IS 'Questrade account number for this investment account';



COMMENT ON COLUMN "public"."InvestmentAccount"."questradeConnectionId" IS 'Reference to QuestradeConnection for this account';



COMMENT ON COLUMN "public"."InvestmentAccount"."isQuestradeConnected" IS 'Whether this account is connected to Questrade';



COMMENT ON COLUMN "public"."InvestmentAccount"."cash" IS 'Cash balance in the account';



COMMENT ON COLUMN "public"."InvestmentAccount"."marketValue" IS 'Current market value of all positions';



COMMENT ON COLUMN "public"."InvestmentAccount"."totalEquity" IS 'Total equity (cash + market value)';



COMMENT ON COLUMN "public"."InvestmentAccount"."buyingPower" IS 'Available buying power';



COMMENT ON COLUMN "public"."InvestmentAccount"."maintenanceExcess" IS 'Maintenance excess amount';



COMMENT ON COLUMN "public"."InvestmentAccount"."currency" IS 'Currency of the account (default: CAD)';



COMMENT ON COLUMN "public"."InvestmentAccount"."balanceLastUpdatedAt" IS 'Last time balance information was updated from Questrade';



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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "check_buy_sell_fields" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text"])) AND ("quantity" IS NOT NULL) AND ("quantity" > (0)::double precision) AND ("price" IS NOT NULL) AND ("price" >= (0)::double precision)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text"])))),
    CONSTRAINT "check_security_required" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"])) AND ("securityId" IS NOT NULL)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"]))))
);


ALTER TABLE "public"."InvestmentTransaction" OWNER TO "postgres";


COMMENT ON CONSTRAINT "check_buy_sell_fields" ON "public"."InvestmentTransaction" IS 'Garante que transações do tipo buy e sell tenham quantity e price válidos';



COMMENT ON CONSTRAINT "check_security_required" ON "public"."InvestmentTransaction" IS 'Garante que transações do tipo buy, sell, dividend e interest tenham securityId';



CREATE TABLE IF NOT EXISTS "public"."Order" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "questradeOrderId" bigint NOT NULL,
    "symbolId" bigint NOT NULL,
    "symbol" "text" NOT NULL,
    "totalQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "openQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "filledQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "canceledQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "side" "text" NOT NULL,
    "orderType" "text" NOT NULL,
    "limitPrice" numeric(15,4),
    "stopPrice" numeric(15,4),
    "isAllOrNone" boolean DEFAULT false,
    "isAnonymous" boolean DEFAULT false,
    "icebergQuantity" numeric(15,4),
    "minQuantity" numeric(15,4),
    "avgExecPrice" numeric(15,4),
    "lastExecPrice" numeric(15,4),
    "source" "text",
    "timeInForce" "text" NOT NULL,
    "gtdDate" timestamp(3) without time zone,
    "state" "text" NOT NULL,
    "clientReasonStr" "text",
    "chainId" bigint NOT NULL,
    "creationTime" timestamp(3) without time zone NOT NULL,
    "updateTime" timestamp(3) without time zone NOT NULL,
    "notes" "text",
    "primaryRoute" "text",
    "secondaryRoute" "text",
    "orderRoute" "text",
    "venueHoldingOrder" "text",
    "comissionCharged" numeric(15,2),
    "exchangeOrderId" "text",
    "isSignificantShareHolder" boolean DEFAULT false,
    "isInsider" boolean DEFAULT false,
    "isLimitOffsetInTicks" boolean DEFAULT false,
    "userId" bigint,
    "placementCommission" numeric(15,2),
    "strategyType" "text",
    "triggerStopPrice" numeric(15,4),
    "lastSyncedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Order" OWNER TO "postgres";


COMMENT ON TABLE "public"."Order" IS 'Stores orders from Questrade';



CREATE TABLE IF NOT EXISTS "public"."PlaidConnection" (
    "id" "text" NOT NULL,
    "userId" "uuid" NOT NULL,
    "itemId" "text" NOT NULL,
    "accessToken" "text" NOT NULL,
    "institutionId" "text",
    "institutionName" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "errorCode" "text",
    "errorMessage" "text",
    "institutionLogo" "text"
);


ALTER TABLE "public"."PlaidConnection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PlaidLiability" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "liabilityType" "text" NOT NULL,
    "apr" double precision,
    "interestRate" double precision,
    "minimumPayment" double precision,
    "lastPaymentAmount" double precision,
    "lastPaymentDate" timestamp(3) without time zone,
    "nextPaymentDueDate" timestamp(3) without time zone,
    "lastStatementBalance" double precision,
    "lastStatementDate" timestamp(3) without time zone,
    "creditLimit" double precision,
    "currentBalance" double precision,
    "availableCredit" double precision,
    "plaidAccountId" "text",
    "plaidItemId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "PlaidLiability_liabilityType_check" CHECK (("liabilityType" = ANY (ARRAY['credit_card'::"text", 'student_loan'::"text", 'mortgage'::"text", 'auto_loan'::"text", 'personal_loan'::"text", 'business_loan'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."PlaidLiability" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."PlannedPayment" (
    "id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "accountId" "text" NOT NULL,
    "categoryId" "text",
    "subcategoryId" "text",
    "description" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "linkedTransactionId" "text",
    "debtId" "text",
    "userId" "uuid" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "toAccountId" "text",
    "subscriptionId" "text",
    CONSTRAINT "PlannedPayment_paid_has_transaction" CHECK ((("status" <> 'paid'::"text") OR ("linkedTransactionId" IS NOT NULL))),
    CONSTRAINT "PlannedPayment_skipped_cancelled_no_transaction" CHECK ((("status" <> ALL (ARRAY['skipped'::"text", 'cancelled'::"text"])) OR ("linkedTransactionId" IS NULL))),
    CONSTRAINT "PlannedPayment_source_check" CHECK (("source" = ANY (ARRAY['recurring'::"text", 'debt'::"text", 'manual'::"text", 'subscription'::"text"]))),
    CONSTRAINT "PlannedPayment_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'paid'::"text", 'skipped'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "PlannedPayment_transaction_only_if_paid" CHECK ((("linkedTransactionId" IS NULL) OR ("status" = 'paid'::"text"))),
    CONSTRAINT "PlannedPayment_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text", 'transfer'::"text"]))),
    CONSTRAINT "planned_payment_date_valid" CHECK ((("date" >= '1900-01-01'::"date") AND ("date" <= (CURRENT_DATE + '5 years'::interval))))
);


ALTER TABLE "public"."PlannedPayment" OWNER TO "postgres";


COMMENT ON TABLE "public"."PlannedPayment" IS 'Future payments that will become Transactions when paid. Does not affect account balances.';



COMMENT ON COLUMN "public"."PlannedPayment"."source" IS 'Origin of the planned payment: recurring (from recurring transaction), debt (from debt), manual (user created)';



COMMENT ON COLUMN "public"."PlannedPayment"."status" IS 'Current status: scheduled (pending), paid (converted to Transaction), skipped (skipped without creating Transaction), cancelled (cancelled)';



COMMENT ON COLUMN "public"."PlannedPayment"."linkedTransactionId" IS 'Transaction ID when this PlannedPayment was converted to a Transaction (only when status = paid)';



COMMENT ON COLUMN "public"."PlannedPayment"."debtId" IS 'Debt ID if this PlannedPayment was created from a debt';



COMMENT ON COLUMN "public"."PlannedPayment"."toAccountId" IS 'Destination account ID for transfer type planned payments';



COMMENT ON COLUMN "public"."PlannedPayment"."subscriptionId" IS 'Subscription ID if this PlannedPayment was created from a UserServiceSubscription';



COMMENT ON CONSTRAINT "planned_payment_date_valid" ON "public"."PlannedPayment" IS 'Valida que a data do pagamento planejado está em um range válido (1900 até 5 anos no futuro)';



CREATE TABLE IF NOT EXISTS "public"."Position" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "securityId" "text" NOT NULL,
    "openQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "closedQuantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "currentMarketValue" numeric(15,2) DEFAULT 0 NOT NULL,
    "currentPrice" numeric(15,4) DEFAULT 0 NOT NULL,
    "averageEntryPrice" numeric(15,4) DEFAULT 0 NOT NULL,
    "closedPnl" numeric(15,2) DEFAULT 0 NOT NULL,
    "openPnl" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalCost" numeric(15,2) DEFAULT 0 NOT NULL,
    "isRealTime" boolean DEFAULT false,
    "isUnderReorg" boolean DEFAULT false,
    "lastUpdatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."Position" OWNER TO "postgres";


COMMENT ON TABLE "public"."Position" IS 'Stores current positions (holdings) from Questrade';



CREATE TABLE IF NOT EXISTS "public"."PromoCode" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "discountType" "text" NOT NULL,
    "discountValue" numeric(10,2) NOT NULL,
    "duration" "text" NOT NULL,
    "durationInMonths" integer,
    "maxRedemptions" integer,
    "expiresAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "stripeCouponId" "text",
    "planIds" "jsonb" DEFAULT '[]'::"jsonb",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "PromoCode_discountType_check" CHECK (("discountType" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "PromoCode_duration_check" CHECK (("duration" = ANY (ARRAY['once'::"text", 'forever'::"text", 'repeating'::"text"])))
);


ALTER TABLE "public"."PromoCode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."QuestradeConnection" (
    "id" "text" NOT NULL,
    "userId" "uuid" NOT NULL,
    "accessToken" "text" NOT NULL,
    "refreshToken" "text" NOT NULL,
    "apiServerUrl" "text" NOT NULL,
    "tokenExpiresAt" timestamp(3) without time zone NOT NULL,
    "lastSyncedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE "public"."QuestradeConnection" OWNER TO "postgres";


COMMENT ON TABLE "public"."QuestradeConnection" IS 'Stores Questrade API connections with encrypted tokens';



CREATE TABLE IF NOT EXISTS "public"."Security" (
    "id" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sector" "text"
);


ALTER TABLE "public"."Security" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Security"."sector" IS 'Industry sector for the security (e.g., Technology, Finance, Healthcare, Consumer, Energy, etc.)';



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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" "uuid",
    "logo" "text"
);


ALTER TABLE "public"."Subcategory" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Subcategory"."logo" IS 'URL or path to the logo/image for this subcategory';



CREATE TABLE IF NOT EXISTS "public"."Subscription" (
    "id" "text" NOT NULL,
    "userId" "uuid",
    "planId" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripeSubscriptionId" "text",
    "stripeCustomerId" "text",
    "currentPeriodStart" timestamp(3) without time zone,
    "currentPeriodEnd" timestamp(3) without time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "trialStartDate" timestamp(3) without time zone,
    "trialEndDate" timestamp(3) without time zone,
    "gracePeriodDays" integer DEFAULT 7,
    "lastUpgradePrompt" timestamp(3) without time zone,
    "expiredAt" timestamp(3) without time zone,
    "pendingEmail" "text"
);


ALTER TABLE "public"."Subscription" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Subscription"."userId" IS 'User ID. NULL if subscription is pending user signup.';



COMMENT ON COLUMN "public"."Subscription"."trialStartDate" IS 'Start date of the trial period';



COMMENT ON COLUMN "public"."Subscription"."trialEndDate" IS 'End date of the trial period. After this date, user must subscribe to continue.';



COMMENT ON COLUMN "public"."Subscription"."gracePeriodDays" IS 'Number of days of grace period after trial expires (default: 7)';



COMMENT ON COLUMN "public"."Subscription"."lastUpgradePrompt" IS 'Timestamp of last upgrade prompt shown to user';



COMMENT ON COLUMN "public"."Subscription"."expiredAt" IS 'Timestamp when subscription/trial expired';



COMMENT ON COLUMN "public"."Subscription"."pendingEmail" IS 'Email address for pending subscriptions waiting to be linked to a user account.';



CREATE TABLE IF NOT EXISTS "public"."SystemSettings" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "maintenanceMode" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SystemSettings" OWNER TO "postgres";


COMMENT ON TABLE "public"."SystemSettings" IS 'Stores system-wide configuration settings like maintenance mode. Only super_admin can read/write.';



COMMENT ON COLUMN "public"."SystemSettings"."maintenanceMode" IS 'When true, only super_admin users can access the platform. All other users see maintenance page.';



CREATE TABLE IF NOT EXISTS "public"."Transaction" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "amount" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "categoryId" "text",
    "subcategoryId" "text",
    "description" "text",
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "transferToId" "text",
    "transferFromId" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "recurring" boolean DEFAULT false NOT NULL,
    "userId" "uuid" NOT NULL,
    "suggestedCategoryId" "text",
    "suggestedSubcategoryId" "text",
    "plaidMetadata" "jsonb",
    "expenseType" "text",
    "amount_numeric" numeric(15,2),
    "description_search" "text",
    "date" "date" NOT NULL,
    CONSTRAINT "transaction_date_valid" CHECK ((("date" >= '1900-01-01'::"date") AND ("date" <= (CURRENT_DATE + '1 year'::interval))))
);


ALTER TABLE "public"."Transaction" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Transaction"."expenseType" IS 'Indicates if expense is fixed or variable. Only applies to expense transactions. Values: "fixed" or "variable"';



COMMENT ON COLUMN "public"."Transaction"."amount_numeric" IS 'Non-encrypted numeric amount for reports and aggregations. Populated from encrypted amount field.';



COMMENT ON COLUMN "public"."Transaction"."description_search" IS 'Normalized description for search and category learning. Lowercase, no special characters, normalized whitespace.';



COMMENT ON COLUMN "public"."Transaction"."date" IS 'Transaction date (date only, no time component). Changed from timestamp to date to avoid timezone issues.';



COMMENT ON CONSTRAINT "transaction_date_valid" ON "public"."Transaction" IS 'Valida que a data da transação está em um range válido (1900 até 1 ano no futuro)';



CREATE TABLE IF NOT EXISTS "public"."TransactionSync" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "plaidTransactionId" "text" NOT NULL,
    "transactionId" "text",
    "syncDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "status" "text" DEFAULT 'synced'::"text"
);


ALTER TABLE "public"."TransactionSync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatarUrl" "text",
    "createdAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "phoneNumber" "text",
    "dateOfBirth" "date"
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserServiceSubscription" (
    "id" "text" NOT NULL,
    "userId" "uuid" NOT NULL,
    "serviceName" "text" NOT NULL,
    "subcategoryId" "text",
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "billingFrequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "billingDay" integer,
    "accountId" "text" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "firstBillingDate" "date" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "UserServiceSubscription_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "UserServiceSubscription_billingDay_check" CHECK (((("billingFrequency" = 'monthly'::"text") AND ("billingDay" >= 1) AND ("billingDay" <= 31)) OR (("billingFrequency" = 'semimonthly'::"text") AND ("billingDay" >= 1) AND ("billingDay" <= 31)) OR (("billingFrequency" = 'weekly'::"text") AND ("billingDay" >= 0) AND ("billingDay" <= 6)) OR (("billingFrequency" = 'biweekly'::"text") AND ("billingDay" >= 0) AND ("billingDay" <= 6)) OR (("billingFrequency" = 'daily'::"text") AND ("billingDay" IS NULL)))),
    CONSTRAINT "UserServiceSubscription_billingFrequency_check" CHECK (("billingFrequency" = ANY (ARRAY['monthly'::"text", 'weekly'::"text", 'biweekly'::"text", 'semimonthly'::"text", 'daily'::"text"])))
);


ALTER TABLE "public"."UserServiceSubscription" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserServiceSubscription" IS 'Recurring service subscriptions that automatically create Planned Payments';



COMMENT ON COLUMN "public"."UserServiceSubscription"."serviceName" IS 'Name of the service (can be custom or from subcategory)';



COMMENT ON COLUMN "public"."UserServiceSubscription"."subcategoryId" IS 'Subcategory ID if service is based on existing subcategory';



COMMENT ON COLUMN "public"."UserServiceSubscription"."billingFrequency" IS 'How often the subscription is billed: monthly, weekly, biweekly, semimonthly, daily';



COMMENT ON COLUMN "public"."UserServiceSubscription"."billingDay" IS 'Day of month (1-31) for monthly/semimonthly, or day of week (0-6, Sunday=0) for weekly/biweekly';



COMMENT ON COLUMN "public"."UserServiceSubscription"."isActive" IS 'Whether the subscription is currently active (paused subscriptions do not generate planned payments)';



COMMENT ON COLUMN "public"."UserServiceSubscription"."firstBillingDate" IS 'Date of the first billing/payment';



CREATE MATERIALIZED VIEW "public"."holdings_view" AS
 WITH "transaction_agg" AS (
         SELECT "it"."securityId",
            "it"."accountId",
            "a_1"."userId",
            "sum"(
                CASE
                    WHEN ("it"."type" = 'buy'::"text") THEN COALESCE("it"."quantity", (0)::double precision)
                    ELSE (0)::double precision
                END) AS "total_buy_qty",
            "sum"(
                CASE
                    WHEN ("it"."type" = 'sell'::"text") THEN COALESCE("it"."quantity", (0)::double precision)
                    ELSE (0)::double precision
                END) AS "total_sell_qty",
            "sum"(
                CASE
                    WHEN ("it"."type" = 'buy'::"text") THEN ((COALESCE("it"."quantity", (0)::double precision) * COALESCE("it"."price", (0)::double precision)) + COALESCE("it"."fees", (0)::double precision))
                    WHEN ("it"."type" = 'sell'::"text") THEN (- ((COALESCE("it"."quantity", (0)::double precision) * COALESCE("it"."price", (0)::double precision)) - COALESCE("it"."fees", (0)::double precision)))
                    ELSE (0)::double precision
                END) AS "book_value"
           FROM ("public"."InvestmentTransaction" "it"
             JOIN "public"."Account" "a_1" ON ((("a_1"."id" = "it"."accountId") AND ("a_1"."type" = 'investment'::"text"))))
          WHERE (("it"."securityId" IS NOT NULL) AND ("a_1"."userId" IS NOT NULL))
          GROUP BY "it"."securityId", "it"."accountId", "a_1"."userId"
        ), "security_latest_price" AS (
         SELECT DISTINCT ON ("SecurityPrice"."securityId") "SecurityPrice"."securityId",
            "SecurityPrice"."price" AS "last_price",
            "SecurityPrice"."date" AS "last_price_date"
           FROM "public"."SecurityPrice"
          ORDER BY "SecurityPrice"."securityId", "SecurityPrice"."date" DESC
        )
 SELECT "ta"."securityId" AS "security_id",
    "ta"."accountId" AS "account_id",
    "ta"."userId" AS "user_id",
    "s"."symbol",
    "s"."name",
    "s"."class" AS "asset_type",
    COALESCE("s"."sector", 'Unknown'::"text") AS "sector",
    ("ta"."total_buy_qty" - "ta"."total_sell_qty") AS "quantity",
        CASE
            WHEN (("ta"."total_buy_qty" - "ta"."total_sell_qty") > (0)::double precision) THEN ("ta"."book_value" / ("ta"."total_buy_qty" - "ta"."total_sell_qty"))
            ELSE (0)::double precision
        END AS "avg_price",
    "ta"."book_value",
    COALESCE("sp"."last_price", (0)::double precision) AS "last_price",
    (("ta"."total_buy_qty" - "ta"."total_sell_qty") * COALESCE("sp"."last_price", (0)::double precision)) AS "market_value",
    ((("ta"."total_buy_qty" - "ta"."total_sell_qty") * COALESCE("sp"."last_price", (0)::double precision)) - "ta"."book_value") AS "unrealized_pnl",
        CASE
            WHEN ("ta"."book_value" > (0)::double precision) THEN ((((("ta"."total_buy_qty" - "ta"."total_sell_qty") * COALESCE("sp"."last_price", (0)::double precision)) - "ta"."book_value") / "ta"."book_value") * (100)::double precision)
            ELSE (0)::double precision
        END AS "unrealized_pnl_percent",
    "a"."name" AS "account_name",
    "sp"."last_price_date",
    "now"() AS "last_updated"
   FROM ((("transaction_agg" "ta"
     JOIN "public"."Security" "s" ON (("s"."id" = "ta"."securityId")))
     LEFT JOIN "security_latest_price" "sp" ON (("sp"."securityId" = "ta"."securityId")))
     LEFT JOIN "public"."Account" "a" ON (("a"."id" = "ta"."accountId")))
  WHERE (("ta"."total_buy_qty" - "ta"."total_sell_qty") > (0)::double precision)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."holdings_view" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."holdings_view" IS 'View materializada que calcula holdings atuais de forma otimizada. Refresh automático via trigger. Filtra apenas contas do tipo investment.';



CREATE MATERIALIZED VIEW "public"."asset_allocation_view" AS
 WITH "user_totals" AS (
         SELECT "holdings_view"."user_id",
            "sum"("holdings_view"."market_value") AS "total_portfolio_value"
           FROM "public"."holdings_view"
          GROUP BY "holdings_view"."user_id"
        )
 SELECT "h"."user_id",
    "h"."asset_type",
    "count"(*) AS "holdings_count",
    "sum"("h"."market_value") AS "total_value",
    "sum"("h"."unrealized_pnl") AS "total_pnl",
        CASE
            WHEN ("ut"."total_portfolio_value" > (0)::double precision) THEN (("sum"("h"."market_value") / "ut"."total_portfolio_value") * (100)::double precision)
            ELSE (0)::double precision
        END AS "allocation_percent",
    "now"() AS "last_updated"
   FROM ("public"."holdings_view" "h"
     JOIN "user_totals" "ut" ON (("ut"."user_id" = "h"."user_id")))
  GROUP BY "h"."user_id", "h"."asset_type", "ut"."total_portfolio_value"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."asset_allocation_view" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."asset_allocation_view" IS 'Distribuição de portfolio por tipo de ativo (Stock, ETF, etc)';



CREATE TABLE IF NOT EXISTS "public"."category_learning" (
    "user_id" "uuid" NOT NULL,
    "normalized_description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "subcategory_id" "text",
    "description_and_amount_count" integer DEFAULT 0 NOT NULL,
    "description_only_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "category_learning_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."category_learning" OWNER TO "postgres";


COMMENT ON TABLE "public"."category_learning" IS 'Aggregated category learning data for fast suggestions. Replaces scanning 12 months of transactions.';



COMMENT ON COLUMN "public"."category_learning"."normalized_description" IS 'Normalized description (lowercase, no special chars, normalized whitespace). Must match normalizeDescription() function.';



COMMENT ON COLUMN "public"."category_learning"."description_and_amount_count" IS 'Number of times this description+amount combination was used with this category.';



COMMENT ON COLUMN "public"."category_learning"."description_only_count" IS 'Number of times this description (any amount) was used with this category.';



COMMENT ON COLUMN "public"."category_learning"."last_used_at" IS 'Last time this category was used for this description. Used to prioritize recent suggestions.';



CREATE MATERIALIZED VIEW "public"."portfolio_summary_view" AS
 SELECT "user_id",
    "count"(*) AS "holdings_count",
    "sum"("market_value") AS "total_value",
    "sum"("book_value") AS "total_cost",
    "sum"("unrealized_pnl") AS "total_return",
        CASE
            WHEN ("sum"("book_value") > (0)::double precision) THEN (("sum"("unrealized_pnl") / "sum"("book_value")) * (100)::double precision)
            ELSE (0)::double precision
        END AS "total_return_percent",
    "now"() AS "last_updated"
   FROM "public"."holdings_view"
  GROUP BY "user_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."portfolio_summary_view" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."portfolio_summary_view" IS 'Resumo agregado do portfolio por usuário';



CREATE MATERIALIZED VIEW "public"."sector_allocation_view" AS
 WITH "user_totals" AS (
         SELECT "holdings_view"."user_id",
            "sum"("holdings_view"."market_value") AS "total_portfolio_value"
           FROM "public"."holdings_view"
          GROUP BY "holdings_view"."user_id"
        )
 SELECT "h"."user_id",
    "h"."sector",
    "count"(*) AS "holdings_count",
    "sum"("h"."market_value") AS "total_value",
    "sum"("h"."unrealized_pnl") AS "total_pnl",
        CASE
            WHEN ("ut"."total_portfolio_value" > (0)::double precision) THEN (("sum"("h"."market_value") / "ut"."total_portfolio_value") * (100)::double precision)
            ELSE (0)::double precision
        END AS "allocation_percent",
    "now"() AS "last_updated"
   FROM ("public"."holdings_view" "h"
     JOIN "user_totals" "ut" ON (("ut"."user_id" = "h"."user_id")))
  GROUP BY "h"."user_id", "h"."sector", "ut"."total_portfolio_value"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."sector_allocation_view" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."sector_allocation_view" IS 'Distribuição de portfolio por setor';



CREATE TABLE IF NOT EXISTS "public"."user_monthly_usage" (
    "user_id" "uuid" NOT NULL,
    "month_date" "date" NOT NULL,
    "transactions_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."user_monthly_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_monthly_usage" IS 'Aggregated monthly transaction counts per user. Used for fast limit checking without COUNT(*) queries.';



COMMENT ON COLUMN "public"."user_monthly_usage"."month_date" IS 'First day of the month (e.g., 2025-11-01). Used instead of text YYYY-MM for better ergonomics.';



COMMENT ON COLUMN "public"."user_monthly_usage"."transactions_count" IS 'Number of transactions for this user in this month. For transfers, counts as 1 (not 2) for new transactions.';



CREATE OR REPLACE VIEW "public"."vw_transactions_for_reports" AS
 SELECT "id",
    "type",
    "amount",
    "accountId",
    "categoryId",
    "subcategoryId",
    "description",
    "tags",
    "transferToId",
    "transferFromId",
    "createdAt",
    "updatedAt",
    "recurring",
    "userId",
    "suggestedCategoryId",
    "suggestedSubcategoryId",
    "plaidMetadata",
    "expenseType",
    "amount_numeric",
    "description_search",
    "date"
   FROM "public"."Transaction"
  WHERE (("transferFromId" IS NULL) AND ("transferToId" IS NULL) AND ("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])));


ALTER VIEW "public"."vw_transactions_for_reports" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_transactions_for_reports" IS 'Transactions for reports, excluding transfers. Use this view for income/expense calculations to avoid double-counting transfers.';



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_accountId_key" UNIQUE ("accountId");



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_accountId_ownerId_key" UNIQUE ("accountId", "ownerId");



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Candle"
    ADD CONSTRAINT "Candle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Candle"
    ADD CONSTRAINT "Candle_securityId_start_end_interval_unique" UNIQUE ("securityId", "start", "end", "interval");



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ContactForm"
    ADD CONSTRAINT "ContactForm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Execution"
    ADD CONSTRAINT "Execution_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Execution"
    ADD CONSTRAINT "Execution_questradeExecutionId_accountId_unique" UNIQUE ("questradeExecutionId", "accountId");



ALTER TABLE ONLY "public"."Feedback"
    ADD CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Group"
    ADD CONSTRAINT "Group_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_invitationToken_key" UNIQUE ("invitationToken");



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_questradeOrderId_accountId_unique" UNIQUE ("questradeOrderId", "accountId");



ALTER TABLE ONLY "public"."PlaidConnection"
    ADD CONSTRAINT "PlaidConnection_itemId_key" UNIQUE ("itemId");



ALTER TABLE ONLY "public"."PlaidConnection"
    ADD CONSTRAINT "PlaidConnection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PlaidLiability"
    ADD CONSTRAINT "PlaidLiability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Plan"
    ADD CONSTRAINT "Plan_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."Plan"
    ADD CONSTRAINT "Plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Position"
    ADD CONSTRAINT "Position_accountId_securityId_unique" UNIQUE ("accountId", "securityId");



ALTER TABLE ONLY "public"."Position"
    ADD CONSTRAINT "Position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PromoCode"
    ADD CONSTRAINT "PromoCode_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."PromoCode"
    ADD CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PromoCode"
    ADD CONSTRAINT "PromoCode_stripeCouponId_key" UNIQUE ("stripeCouponId");



ALTER TABLE ONLY "public"."QuestradeConnection"
    ADD CONSTRAINT "QuestradeConnection_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."SystemSettings"
    ADD CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_plaidTransactionId_key" UNIQUE ("plaidTransactionId");



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_learning"
    ADD CONSTRAINT "category_learning_pkey" PRIMARY KEY ("user_id", "normalized_description", "type");



ALTER TABLE ONLY "public"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_date");



CREATE INDEX "AccountInvestmentValue_accountId_idx" ON "public"."AccountInvestmentValue" USING "btree" ("accountId");



CREATE INDEX "AccountOwner_accountId_idx" ON "public"."AccountOwner" USING "btree" ("accountId");



CREATE INDEX "AccountOwner_ownerId_idx" ON "public"."AccountOwner" USING "btree" ("ownerId");



CREATE INDEX "Account_plaidItemId_idx" ON "public"."Account" USING "btree" ("plaidItemId");



CREATE INDEX "Account_type_idx" ON "public"."Account" USING "btree" ("type");



CREATE INDEX "Account_userId_idx" ON "public"."Account" USING "btree" ("userId");



CREATE UNIQUE INDEX "BudgetCategory_budgetId_categoryId_key" ON "public"."BudgetCategory" USING "btree" ("budgetId", "categoryId");



CREATE INDEX "BudgetCategory_budgetId_idx" ON "public"."BudgetCategory" USING "btree" ("budgetId");



CREATE INDEX "BudgetCategory_categoryId_idx" ON "public"."BudgetCategory" USING "btree" ("categoryId");



CREATE INDEX "Budget_categoryId_period_idx" ON "public"."Budget" USING "btree" ("categoryId", "period");



CREATE INDEX "Budget_groupId_idx" ON "public"."Budget" USING "btree" ("groupId") WHERE ("groupId" IS NOT NULL);



CREATE UNIQUE INDEX "Budget_period_categoryId_subcategoryId_key" ON "public"."Budget" USING "btree" ("period", "categoryId", COALESCE("subcategoryId", ''::"text")) WHERE ("categoryId" IS NOT NULL);



CREATE UNIQUE INDEX "Budget_period_groupId_key" ON "public"."Budget" USING "btree" ("period", "groupId") WHERE ("groupId" IS NOT NULL);



CREATE INDEX "Budget_period_idx" ON "public"."Budget" USING "btree" ("period");



CREATE INDEX "Budget_subcategoryId_idx" ON "public"."Budget" USING "btree" ("subcategoryId") WHERE ("subcategoryId" IS NOT NULL);



CREATE INDEX "Budget_userId_idx" ON "public"."Budget" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Candle_securityId_start_idx" ON "public"."Candle" USING "btree" ("securityId", "start");



CREATE INDEX "Category_groupId_idx" ON "public"."Category" USING "btree" ("groupId");



CREATE INDEX "Category_name_idx" ON "public"."Category" USING "btree" ("name");



CREATE INDEX "Category_userId_idx" ON "public"."Category" USING "btree" ("userId");



CREATE INDEX "ContactForm_createdAt_idx" ON "public"."ContactForm" USING "btree" ("createdAt" DESC);



CREATE INDEX "ContactForm_userId_idx" ON "public"."ContactForm" USING "btree" ("userId");



CREATE INDEX "Debt_accountId_idx" ON "public"."Debt" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "Debt_userId_idx" ON "public"."Debt" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Execution_accountId_idx" ON "public"."Execution" USING "btree" ("accountId");



CREATE INDEX "Feedback_createdAt_idx" ON "public"."Feedback" USING "btree" ("createdAt" DESC);



CREATE INDEX "Feedback_userId_idx" ON "public"."Feedback" USING "btree" ("userId");



CREATE INDEX "Goal_accountId_idx" ON "public"."Goal" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "Goal_userId_idx" ON "public"."Goal" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Group_name_idx" ON "public"."Group" USING "btree" ("name");



CREATE UNIQUE INDEX "Group_name_key_system" ON "public"."Group" USING "btree" ("name") WHERE ("userId" IS NULL);



CREATE UNIQUE INDEX "Group_name_userId_key" ON "public"."Group" USING "btree" ("name", "userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Group_userId_idx" ON "public"."Group" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "HouseholdMember_email_idx" ON "public"."HouseholdMember" USING "btree" ("email");



CREATE INDEX "HouseholdMember_memberId_idx" ON "public"."HouseholdMember" USING "btree" ("memberId");



CREATE INDEX "HouseholdMember_ownerId_idx" ON "public"."HouseholdMember" USING "btree" ("ownerId");



CREATE INDEX "HouseholdMember_status_idx" ON "public"."HouseholdMember" USING "btree" ("status");



CREATE INDEX "InvestmentAccount_accountId_idx" ON "public"."InvestmentAccount" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "InvestmentAccount_questradeConnectionId_idx" ON "public"."InvestmentAccount" USING "btree" ("questradeConnectionId") WHERE ("questradeConnectionId" IS NOT NULL);



CREATE INDEX "InvestmentAccount_userId_idx" ON "public"."InvestmentAccount" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "InvestmentTransaction_accountId_idx" ON "public"."InvestmentTransaction" USING "btree" ("accountId");



CREATE INDEX "InvestmentTransaction_date_idx" ON "public"."InvestmentTransaction" USING "btree" ("date");



CREATE INDEX "InvestmentTransaction_securityId_idx" ON "public"."InvestmentTransaction" USING "btree" ("securityId");



CREATE INDEX "Order_accountId_idx" ON "public"."Order" USING "btree" ("accountId");



CREATE INDEX "PlaidConnection_itemId_idx" ON "public"."PlaidConnection" USING "btree" ("itemId");



CREATE INDEX "PlaidConnection_userId_idx" ON "public"."PlaidConnection" USING "btree" ("userId");



CREATE INDEX "PlaidLiability_accountId_idx" ON "public"."PlaidLiability" USING "btree" ("accountId");



CREATE INDEX "Position_accountId_securityId_idx" ON "public"."Position" USING "btree" ("accountId", "securityId");



CREATE INDEX "Position_securityId_idx" ON "public"."Position" USING "btree" ("securityId");



CREATE INDEX "QuestradeConnection_userId_idx" ON "public"."QuestradeConnection" USING "btree" ("userId");



CREATE INDEX "SecurityPrice_securityId_date_idx" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE UNIQUE INDEX "SecurityPrice_securityId_date_key" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE INDEX "Security_symbol_idx" ON "public"."Security" USING "btree" ("symbol");



CREATE UNIQUE INDEX "Security_symbol_key" ON "public"."Security" USING "btree" ("symbol");



CREATE INDEX "SimpleInvestmentEntry_accountId_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("accountId");



CREATE INDEX "SimpleInvestmentEntry_date_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("date");



CREATE INDEX "Subcategory_categoryId_idx" ON "public"."Subcategory" USING "btree" ("categoryId");



CREATE INDEX "Subcategory_name_idx" ON "public"."Subcategory" USING "btree" ("name");



CREATE INDEX "Subcategory_userId_idx" ON "public"."Subcategory" USING "btree" ("userId");



CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription" USING "btree" ("planId") WHERE ("planId" IS NOT NULL);



CREATE INDEX "Subscription_status_idx" ON "public"."Subscription" USING "btree" ("status");



CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription" USING "btree" ("userId");



CREATE UNIQUE INDEX "SystemSettings_id_key" ON "public"."SystemSettings" USING "btree" ("id");



CREATE INDEX "TransactionSync_accountId_idx" ON "public"."TransactionSync" USING "btree" ("accountId");



CREATE INDEX "TransactionSync_transactionId_idx" ON "public"."TransactionSync" USING "btree" ("transactionId") WHERE ("transactionId" IS NOT NULL);



CREATE INDEX "Transaction_accountId_idx" ON "public"."Transaction" USING "btree" ("accountId");



CREATE INDEX "Transaction_amount_numeric_idx" ON "public"."Transaction" USING "btree" ("amount_numeric") WHERE ("amount_numeric" IS NOT NULL);



CREATE INDEX "Transaction_recurring_idx" ON "public"."Transaction" USING "btree" ("recurring");



CREATE INDEX "Transaction_subcategoryId_idx" ON "public"."Transaction" USING "btree" ("subcategoryId") WHERE ("subcategoryId" IS NOT NULL);



CREATE INDEX "Transaction_suggestedCategoryId_idx" ON "public"."Transaction" USING "btree" ("suggestedCategoryId") WHERE ("suggestedCategoryId" IS NOT NULL);



CREATE INDEX "Transaction_suggestedSubcategoryId_idx" ON "public"."Transaction" USING "btree" ("suggestedSubcategoryId") WHERE ("suggestedSubcategoryId" IS NOT NULL);



CREATE INDEX "Transaction_type_idx" ON "public"."Transaction" USING "btree" ("type");



CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction" USING "btree" ("userId");



CREATE INDEX "User_role_idx" ON "public"."User" USING "btree" ("role");



CREATE INDEX "category_learning_last_used_idx" ON "public"."category_learning" USING "btree" ("last_used_at" DESC);



CREATE INDEX "category_learning_user_type_desc_idx" ON "public"."category_learning" USING "btree" ("user_id", "type", "normalized_description");



CREATE INDEX "idx_account_isconnected" ON "public"."Account" USING "btree" ("isConnected") WHERE ("isConnected" = true);



CREATE INDEX "idx_account_user_type" ON "public"."Account" USING "btree" ("userId", "type") WHERE ("type" IS NOT NULL);



CREATE INDEX "idx_account_user_updated" ON "public"."Account" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_account_userid_type" ON "public"."Account" USING "btree" ("userId", "type") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_accountowner_accountid" ON "public"."AccountOwner" USING "btree" ("accountId");



CREATE INDEX "idx_accountowner_ownerid" ON "public"."AccountOwner" USING "btree" ("ownerId");



CREATE INDEX "idx_asset_allocation_user" ON "public"."asset_allocation_view" USING "btree" ("user_id");



CREATE INDEX "idx_budget_category" ON "public"."Budget" USING "btree" ("categoryId") WHERE ("categoryId" IS NOT NULL);



CREATE INDEX "idx_budget_period_categoryid" ON "public"."Budget" USING "btree" ("period", "categoryId");



CREATE INDEX "idx_budget_recurring" ON "public"."Budget" USING "btree" ("isRecurring", "userId") WHERE ("isRecurring" = true);



CREATE INDEX "idx_budget_user_period" ON "public"."Budget" USING "btree" ("userId", "period" DESC) WHERE ("period" IS NOT NULL);



CREATE INDEX "idx_budget_user_updated" ON "public"."Budget" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_budget_userid_period" ON "public"."Budget" USING "btree" ("userId", "period");



CREATE INDEX "idx_category_group" ON "public"."Category" USING "btree" ("groupId") WHERE ("groupId" IS NOT NULL);



CREATE INDEX "idx_category_user" ON "public"."Category" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_category_userid_groupid" ON "public"."Category" USING "btree" ("userId", "groupId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_debt_user_loan_type" ON "public"."Debt" USING "btree" ("userId", "loanType") WHERE ("loanType" IS NOT NULL);



CREATE INDEX "idx_debt_user_updated" ON "public"."Debt" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_debt_userid_firstpaymentdate" ON "public"."Debt" USING "btree" ("userId", "firstPaymentDate") WHERE ("isPaidOff" = false);



CREATE INDEX "idx_debt_userid_ispaidoff" ON "public"."Debt" USING "btree" ("userId", "isPaidOff");



CREATE INDEX "idx_goal_user_completed" ON "public"."Goal" USING "btree" ("userId", "completedAt" DESC) WHERE ("completedAt" IS NOT NULL);



CREATE INDEX "idx_goal_user_status" ON "public"."Goal" USING "btree" ("userId", "isCompleted", "isPaused") WHERE ("isCompleted" IS NOT NULL);



CREATE INDEX "idx_goal_user_updated" ON "public"."Goal" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_goal_userid_iscompleted" ON "public"."Goal" USING "btree" ("userId", "isCompleted");



CREATE INDEX "idx_goal_userid_targetmonths" ON "public"."Goal" USING "btree" ("userId", "targetMonths") WHERE (("isCompleted" = false) AND ("targetMonths" IS NOT NULL));



CREATE INDEX "idx_holdings_view_account" ON "public"."holdings_view" USING "btree" ("account_id");



CREATE INDEX "idx_holdings_view_security" ON "public"."holdings_view" USING "btree" ("security_id");



CREATE UNIQUE INDEX "idx_holdings_view_unique" ON "public"."holdings_view" USING "btree" ("user_id", "security_id", "account_id");



CREATE INDEX "idx_holdings_view_user" ON "public"."holdings_view" USING "btree" ("user_id");



CREATE INDEX "idx_householdmember_memberid_status" ON "public"."HouseholdMember" USING "btree" ("memberId", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_householdmember_ownerid" ON "public"."HouseholdMember" USING "btree" ("ownerId");



CREATE INDEX "idx_investment_account_questrade" ON "public"."InvestmentAccount" USING "btree" ("userId", "isQuestradeConnected") WHERE ("isQuestradeConnected" = true);



CREATE INDEX "idx_investment_account_type" ON "public"."InvestmentAccount" USING "btree" ("userId", "type") WHERE ("type" IS NOT NULL);



CREATE INDEX "idx_investment_transaction_account_date" ON "public"."InvestmentTransaction" USING "btree" ("accountId", "date" DESC) WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_investment_transaction_holdings_calc" ON "public"."InvestmentTransaction" USING "btree" ("accountId", "securityId", "date") WHERE (("securityId" IS NOT NULL) AND ("date" IS NOT NULL));



CREATE INDEX "idx_investment_transaction_security" ON "public"."InvestmentTransaction" USING "btree" ("securityId", "accountId", "type") WHERE ("securityId" IS NOT NULL);



CREATE INDEX "idx_investment_transaction_updated" ON "public"."InvestmentTransaction" USING "btree" ("accountId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_investmentaccount_userid" ON "public"."InvestmentAccount" USING "btree" ("userId");



CREATE INDEX "idx_investmenttransaction_accountid_date" ON "public"."InvestmentTransaction" USING "btree" ("accountId", "date" DESC);



CREATE INDEX "idx_plaidconnection_itemid" ON "public"."PlaidConnection" USING "btree" ("itemId");



CREATE INDEX "idx_plaidconnection_userid" ON "public"."PlaidConnection" USING "btree" ("userId");



CREATE INDEX "idx_planned_payment_date" ON "public"."PlannedPayment" USING "btree" ("date");



CREATE INDEX "idx_planned_payment_date_status_user" ON "public"."PlannedPayment" USING "btree" ("date", "status", "userId");



CREATE INDEX "idx_planned_payment_debt_id" ON "public"."PlannedPayment" USING "btree" ("debtId") WHERE ("debtId" IS NOT NULL);



CREATE INDEX "idx_planned_payment_linked_transaction" ON "public"."PlannedPayment" USING "btree" ("linkedTransactionId") WHERE ("linkedTransactionId" IS NOT NULL);



CREATE INDEX "idx_planned_payment_source" ON "public"."PlannedPayment" USING "btree" ("source");



CREATE INDEX "idx_planned_payment_status" ON "public"."PlannedPayment" USING "btree" ("status");



CREATE INDEX "idx_planned_payment_subscription_id" ON "public"."PlannedPayment" USING "btree" ("subscriptionId") WHERE ("subscriptionId" IS NOT NULL);



CREATE INDEX "idx_planned_payment_to_account_id" ON "public"."PlannedPayment" USING "btree" ("toAccountId") WHERE ("toAccountId" IS NOT NULL);



CREATE INDEX "idx_planned_payment_user_date_status" ON "public"."PlannedPayment" USING "btree" ("userId", "date", "status") WHERE ("date" IS NOT NULL);



COMMENT ON INDEX "public"."idx_planned_payment_user_date_status" IS 'Índice para queries de pagamentos planejados por data e status';



CREATE INDEX "idx_planned_payment_user_id" ON "public"."PlannedPayment" USING "btree" ("userId");



CREATE UNIQUE INDEX "idx_portfolio_summary_user" ON "public"."portfolio_summary_view" USING "btree" ("user_id");



CREATE INDEX "idx_position_account_open" ON "public"."Position" USING "btree" ("accountId", "openQuantity", "lastUpdatedAt" DESC) WHERE ("openQuantity" > (0)::numeric);



CREATE INDEX "idx_position_accountid" ON "public"."Position" USING "btree" ("accountId");



CREATE INDEX "idx_position_security" ON "public"."Position" USING "btree" ("securityId", "accountId") WHERE ("securityId" IS NOT NULL);



CREATE INDEX "idx_sector_allocation_user" ON "public"."sector_allocation_view" USING "btree" ("user_id");



CREATE INDEX "idx_security_price_date_range" ON "public"."SecurityPrice" USING "btree" ("securityId", "date") WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_security_price_security_date" ON "public"."SecurityPrice" USING "btree" ("securityId", "date" DESC) WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_simple_investment_account_date" ON "public"."SimpleInvestmentEntry" USING "btree" ("accountId", "date" DESC) WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_simple_investment_account_updated" ON "public"."SimpleInvestmentEntry" USING "btree" ("accountId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_subcategory_categoryid" ON "public"."Subcategory" USING "btree" ("categoryId");



CREATE INDEX "idx_subcategory_userid" ON "public"."Subcategory" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_subscription_status_enddate" ON "public"."Subscription" USING "btree" ("status", "currentPeriodEnd") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_subscription_userid_status" ON "public"."Subscription" USING "btree" ("userId", "status");



CREATE INDEX "idx_transaction_description_gin" ON "public"."Transaction" USING "gin" ("to_tsvector"('"english"'::"regconfig", "description")) WHERE ("description" IS NOT NULL);



CREATE INDEX "idx_transaction_user_category" ON "public"."Transaction" USING "btree" ("userId", "categoryId") WHERE ("categoryId" IS NOT NULL);



CREATE INDEX "idx_transaction_user_date" ON "public"."Transaction" USING "btree" ("userId", "date" DESC) WHERE ("date" IS NOT NULL);



COMMENT ON INDEX "public"."idx_transaction_user_date" IS 'Índice otimizado para queries de transações por usuário e período (query mais comum do sistema)';



CREATE INDEX "idx_transaction_user_date_type" ON "public"."Transaction" USING "btree" ("userId", "date" DESC, "type") WHERE (("date" IS NOT NULL) AND ("type" IS NOT NULL));



COMMENT ON INDEX "public"."idx_transaction_user_date_type" IS 'Índice composto para queries com filtro de tipo adicional';



CREATE INDEX "idx_transaction_user_updated" ON "public"."Transaction" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_user_service_subscription_account_id" ON "public"."UserServiceSubscription" USING "btree" ("accountId");



CREATE INDEX "idx_user_service_subscription_is_active" ON "public"."UserServiceSubscription" USING "btree" ("isActive") WHERE ("isActive" = true);



CREATE INDEX "idx_user_service_subscription_subcategory_id" ON "public"."UserServiceSubscription" USING "btree" ("subcategoryId") WHERE ("subcategoryId" IS NOT NULL);



CREATE INDEX "idx_user_service_subscription_user_active" ON "public"."UserServiceSubscription" USING "btree" ("userId", "isActive");



CREATE INDEX "idx_user_service_subscription_user_id" ON "public"."UserServiceSubscription" USING "btree" ("userId");



CREATE INDEX "transaction_description_search_trgm_idx" ON "public"."Transaction" USING "gin" ("description_search" "public"."gin_trgm_ops") WHERE ("description_search" IS NOT NULL);



CREATE INDEX "user_monthly_usage_user_month_idx" ON "public"."user_monthly_usage" USING "btree" ("user_id", "month_date");



CREATE OR REPLACE TRIGGER "trigger_notify_holdings_refresh" AFTER INSERT OR DELETE OR UPDATE ON "public"."InvestmentTransaction" FOR EACH ROW EXECUTE FUNCTION "public"."notify_refresh_holdings"();



CREATE OR REPLACE TRIGGER "trigger_notify_price_refresh" AFTER INSERT OR UPDATE ON "public"."SecurityPrice" FOR EACH STATEMENT EXECUTE FUNCTION "public"."notify_refresh_holdings"();



CREATE OR REPLACE TRIGGER "update_plan_updated_at" BEFORE UPDATE ON "public"."Plan" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_promo_code_updated_at" BEFORE UPDATE ON "public"."PromoCode" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_updated_at" BEFORE UPDATE ON "public"."Subscription" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_updated_at" BEFORE UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "public"."Budget"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."BudgetCategory"
    ADD CONSTRAINT "BudgetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Budget"
    ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Candle"
    ADD CONSTRAINT "Candle_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Category"
    ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ContactForm"
    ADD CONSTRAINT "ContactForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Execution"
    ADD CONSTRAINT "Execution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Feedback"
    ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Group"
    ADD CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_questradeConnectionId_fkey" FOREIGN KEY ("questradeConnectionId") REFERENCES "public"."QuestradeConnection"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlaidConnection"
    ADD CONSTRAINT "PlaidConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlaidLiability"
    ADD CONSTRAINT "PlaidLiability_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "public"."Debt"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."UserServiceSubscription"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Position"
    ADD CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Position"
    ADD CONSTRAINT "Position_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."QuestradeConnection"
    ADD CONSTRAINT "QuestradeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SecurityPrice"
    ADD CONSTRAINT "SecurityPrice_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_suggestedSubcategoryId_fkey" FOREIGN KEY ("suggestedSubcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_learning"
    ADD CONSTRAINT "category_learning_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."Category"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_learning"
    ADD CONSTRAINT "category_learning_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."Subcategory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."category_learning"
    ADD CONSTRAINT "category_learning_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AccountInvestmentValue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."AccountOwner" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."Candle" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ContactForm" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Debt" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Execution" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Goal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Group" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HouseholdMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentAccount" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentTransaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlaidConnection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlaidLiability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Plan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlannedPayment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Plans are publicly readable" ON "public"."Plan" FOR SELECT USING (true);



ALTER TABLE "public"."Position" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PromoCode" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Public can read active promo codes" ON "public"."PromoCode" FOR SELECT USING ((("isActive" = true) AND (("expiresAt" IS NULL) OR ("expiresAt" > "now"()))));



ALTER TABLE "public"."QuestradeConnection" ENABLE ROW LEVEL SECURITY;


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


CREATE POLICY "Super admin can delete promo codes" ON "public"."PromoCode" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can delete system categories" ON "public"."Category" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can delete system groups" ON "public"."Group" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can delete system subcategories" ON "public"."Subcategory" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can insert promo codes" ON "public"."PromoCode" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can insert system categories" ON "public"."Category" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can insert system groups" ON "public"."Group" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can insert system subcategories" ON "public"."Subcategory" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can read promo codes" ON "public"."PromoCode" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can update promo codes" ON "public"."PromoCode" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can update system categories" ON "public"."Category" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can update system groups" ON "public"."Group" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admin can update system subcategories" ON "public"."Subcategory" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))) AND ("userId" IS NULL)));



CREATE POLICY "Super admins can update contact submissions" ON "public"."ContactForm" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all contact submissions" ON "public"."ContactForm" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all feedback submissions" ON "public"."Feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."SystemSettings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "SystemSettings_insert_super_admin" ON "public"."SystemSettings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "SystemSettings_select_super_admin" ON "public"."SystemSettings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "SystemSettings_update_super_admin" ON "public"."SystemSettings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."Transaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."TransactionSync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserServiceSubscription" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can delete TransactionSync for their accounts" ON "public"."TransactionSync" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "TransactionSync"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete account owners" ON "public"."AccountOwner" FOR DELETE USING ((("ownerId" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountOwner"."accountId") AND ("Account"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can delete candles for own securities" ON "public"."Candle" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Security"
  WHERE (("Security"."id" = "Candle"."securityId") AND (EXISTS ( SELECT 1
           FROM "public"."Position"
          WHERE (("Position"."securityId" = "Security"."id") AND (EXISTS ( SELECT 1
                   FROM "public"."InvestmentAccount"
                  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))))))))));



CREATE POLICY "Users can delete executions for own accounts" ON "public"."Execution" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Execution"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete household members" ON "public"."HouseholdMember" FOR DELETE USING (("ownerId" = "auth"."uid"()));



CREATE POLICY "Users can delete orders for own accounts" ON "public"."Order" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Order"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own account investment values" ON "public"."AccountInvestmentValue" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own accounts" ON "public"."Account" FOR DELETE USING ((("auth"."uid"() = "userId") OR (EXISTS ( SELECT 1
   FROM "public"."AccountOwner"
  WHERE (("AccountOwner"."accountId" = "Account"."id") AND ("AccountOwner"."ownerId" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Users can delete own budget categories" ON "public"."BudgetCategory" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own budgets" ON "public"."Budget" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own categories" ON "public"."Category" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own debts" ON "public"."Debt" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own goals" ON "public"."Goal" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own groups" ON "public"."Group" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own investment accounts" ON "public"."InvestmentAccount" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own investment transactions" ON "public"."InvestmentTransaction" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "InvestmentTransaction"."accountId") AND ("Account"."userId" = "auth"."uid"()) AND ("Account"."type" = 'investment'::"text")))));



CREATE POLICY "Users can delete own planned payments" ON "public"."PlannedPayment" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own subcategories" ON "public"."Subcategory" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND ("Category"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete own subscriptions" ON "public"."UserServiceSubscription" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete own transactions" ON "public"."Transaction" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can delete positions for own accounts" ON "public"."Position" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own Plaid connections" ON "public"."PlaidConnection" FOR DELETE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete their own Plaid liabilities" ON "public"."PlaidLiability" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own Questrade connections" ON "public"."QuestradeConnection" FOR DELETE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert TransactionSync for their accounts" ON "public"."TransactionSync" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "TransactionSync"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert account owners" ON "public"."AccountOwner" FOR INSERT WITH CHECK ((("public"."is_account_owner_by_userid"("accountId") OR "public"."is_account_owner_via_accountowner"("accountId") OR "public"."is_current_user_admin"()) AND (("auth"."uid"() = "ownerId") OR ("public"."is_account_owner_by_userid"("accountId") AND (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE ("User"."id" = "AccountOwner"."ownerId")))) OR (("public"."is_account_owner_via_accountowner"("accountId") AND ((EXISTS ( SELECT 1
   FROM "public"."HouseholdMember"
  WHERE (("HouseholdMember"."ownerId" = "auth"."uid"()) AND ("HouseholdMember"."memberId" = "AccountOwner"."ownerId") AND ("HouseholdMember"."status" = 'active'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."HouseholdMember"
  WHERE (("HouseholdMember"."ownerId" = "AccountOwner"."ownerId") AND ("HouseholdMember"."memberId" = "auth"."uid"()) AND ("HouseholdMember"."status" = 'active'::"text")))))) OR ("public"."is_current_user_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE ("User"."id" = "AccountOwner"."ownerId"))))))));



CREATE POLICY "Users can insert candles for own securities" ON "public"."Candle" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Security"
  WHERE (("Security"."id" = "Candle"."securityId") AND (EXISTS ( SELECT 1
           FROM "public"."Position"
          WHERE (("Position"."securityId" = "Security"."id") AND (EXISTS ( SELECT 1
                   FROM "public"."InvestmentAccount"
                  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))))))))));



CREATE POLICY "Users can insert executions for own accounts" ON "public"."Execution" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Execution"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert household members" ON "public"."HouseholdMember" FOR INSERT WITH CHECK (("ownerId" = "auth"."uid"()));



CREATE POLICY "Users can insert orders for own accounts" ON "public"."Order" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Order"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own account investment values" ON "public"."AccountInvestmentValue" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own accounts" ON "public"."Account" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own budget categories" ON "public"."BudgetCategory" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own budgets" ON "public"."Budget" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own categories" ON "public"."Category" FOR INSERT WITH CHECK ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert own category learning" ON "public"."category_learning" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own contact submissions" ON "public"."ContactForm" FOR INSERT WITH CHECK ((("auth"."uid"() = "userId") OR ("userId" IS NULL)));



CREATE POLICY "Users can insert own debts" ON "public"."Debt" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own feedback submissions" ON "public"."Feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own goals" ON "public"."Goal" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own groups" ON "public"."Group" FOR INSERT WITH CHECK ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert own investment accounts" ON "public"."InvestmentAccount" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own investment transactions" ON "public"."InvestmentTransaction" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "InvestmentTransaction"."accountId") AND ("Account"."userId" = "auth"."uid"()) AND ("Account"."type" = 'investment'::"text")))));



CREATE POLICY "Users can insert own planned payments" ON "public"."PlannedPayment" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."User" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can insert own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert own subcategories" ON "public"."Subcategory" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can insert own subscriptions" ON "public"."Subscription" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert own subscriptions" ON "public"."UserServiceSubscription" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert own transactions" ON "public"."Transaction" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can insert positions for own accounts" ON "public"."Position" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own Plaid connections" ON "public"."PlaidConnection" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can insert their own Plaid liabilities" ON "public"."PlaidLiability" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own Questrade connections" ON "public"."QuestradeConnection" FOR INSERT WITH CHECK (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update TransactionSync for their accounts" ON "public"."TransactionSync" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "TransactionSync"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update account owners" ON "public"."AccountOwner" FOR UPDATE USING ((("ownerId" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountOwner"."accountId") AND ("Account"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can update candles for own securities" ON "public"."Candle" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Security"
  WHERE (("Security"."id" = "Candle"."securityId") AND (EXISTS ( SELECT 1
           FROM "public"."Position"
          WHERE (("Position"."securityId" = "Security"."id") AND (EXISTS ( SELECT 1
                   FROM "public"."InvestmentAccount"
                  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))))))))));



CREATE POLICY "Users can update executions for own accounts" ON "public"."Execution" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Execution"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update household members" ON "public"."HouseholdMember" FOR UPDATE USING ((("ownerId" = "auth"."uid"()) OR ("memberId" = "auth"."uid"())));



CREATE POLICY "Users can update orders for own accounts" ON "public"."Order" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Order"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own account investment values" ON "public"."AccountInvestmentValue" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own accounts" ON "public"."Account" FOR UPDATE USING ((("auth"."uid"() = "userId") OR (EXISTS ( SELECT 1
   FROM "public"."AccountOwner"
  WHERE (("AccountOwner"."accountId" = "Account"."id") AND ("AccountOwner"."ownerId" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Users can update own budget categories" ON "public"."BudgetCategory" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own budgets" ON "public"."Budget" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own categories" ON "public"."Category" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own category learning" ON "public"."category_learning" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own debts" ON "public"."Debt" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own goals" ON "public"."Goal" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own groups" ON "public"."Group" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own investment accounts" ON "public"."InvestmentAccount" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own investment transactions" ON "public"."InvestmentTransaction" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "InvestmentTransaction"."accountId") AND ("Account"."userId" = "auth"."uid"()) AND ("Account"."type" = 'investment'::"text")))));



CREATE POLICY "Users can update own planned payments" ON "public"."PlannedPayment" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."User" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own subcategories" ON "public"."Subcategory" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND ("Category"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update own subscriptions" ON "public"."UserServiceSubscription" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update own transactions" ON "public"."Transaction" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can update positions for own accounts" ON "public"."Position" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update their own Plaid connections" ON "public"."PlaidConnection" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can update their own Plaid liabilities" ON "public"."PlaidLiability" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can update their own Questrade connections" ON "public"."QuestradeConnection" FOR UPDATE USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view TransactionSync for their accounts" ON "public"."TransactionSync" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "TransactionSync"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view account owners" ON "public"."AccountOwner" FOR SELECT USING ((("ownerId" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountOwner"."accountId") AND ("Account"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can view candles for own securities" ON "public"."Candle" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Security"
  WHERE (("Security"."id" = "Candle"."securityId") AND (EXISTS ( SELECT 1
           FROM "public"."Position"
          WHERE (("Position"."securityId" = "Security"."id") AND (EXISTS ( SELECT 1
                   FROM "public"."InvestmentAccount"
                  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))))))))));



CREATE POLICY "Users can view executions for own accounts" ON "public"."Execution" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Execution"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view household members" ON "public"."HouseholdMember" FOR SELECT USING ((("ownerId" = "auth"."uid"()) OR ("memberId" = "auth"."uid"())));



CREATE POLICY "Users can view orders for own accounts" ON "public"."Order" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Order"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own account investment values" ON "public"."AccountInvestmentValue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "AccountInvestmentValue"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own accounts" ON "public"."Account" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own budget categories" ON "public"."BudgetCategory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("Budget"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own budgets" ON "public"."Budget" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own category learning" ON "public"."category_learning" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own contact submissions" ON "public"."ContactForm" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own debts" ON "public"."Debt" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own feedback submissions" ON "public"."Feedback" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view own goals" ON "public"."Goal" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own investment accounts" ON "public"."InvestmentAccount" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own investment transactions" ON "public"."InvestmentTransaction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "InvestmentTransaction"."accountId") AND ("Account"."userId" = "auth"."uid"()) AND ("Account"."type" = 'investment'::"text")))));



CREATE POLICY "Users can view own monthly usage" ON "public"."user_monthly_usage" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own planned payments" ON "public"."PlannedPayment" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."User" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own simple investment entries" ON "public"."SimpleInvestmentEntry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "SimpleInvestmentEntry"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view own subscriptions" ON "public"."Subscription" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own subscriptions" ON "public"."UserServiceSubscription" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view own transactions" ON "public"."Transaction" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users can view positions for own accounts" ON "public"."Position" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount"
  WHERE (("InvestmentAccount"."id" = "Position"."accountId") AND ("InvestmentAccount"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view system and own categories" ON "public"."Category" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can view system and own groups" ON "public"."Group" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can view system and own subcategories" ON "public"."Subcategory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own Plaid connections" ON "public"."PlaidConnection" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view their own Plaid liabilities" ON "public"."PlaidLiability" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND ("Account"."userId" = "auth"."uid"())))));



CREATE POLICY "Users can view their own Questrade connections" ON "public"."QuestradeConnection" FOR SELECT USING (("userId" = "auth"."uid"()));



CREATE POLICY "Users cannot delete own profile" ON "public"."User" FOR DELETE USING (false);



ALTER TABLE "public"."category_learning" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_monthly_usage" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp without time zone, "p_updated_at" timestamp without time zone, "p_max_transactions" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp without time zone, "p_updated_at" timestamp without time zone, "p_max_transactions" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_max_transactions" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" "text", "p_amount_numeric" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_recurring" boolean, "p_max_transactions" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."notify_refresh_holdings"() TO "service_role";
GRANT ALL ON FUNCTION "public"."notify_refresh_holdings"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_portfolio_views"() TO "service_role";
GRANT ALL ON FUNCTION "public"."refresh_portfolio_views"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";



GRANT ALL ON TABLE "public"."Account" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Account" TO "authenticated";



GRANT ALL ON TABLE "public"."AccountInvestmentValue" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."AccountInvestmentValue" TO "authenticated";



GRANT ALL ON TABLE "public"."AccountOwner" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."AccountOwner" TO "authenticated";



GRANT ALL ON TABLE "public"."Budget" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Budget" TO "authenticated";



GRANT ALL ON TABLE "public"."BudgetCategory" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."BudgetCategory" TO "authenticated";



GRANT ALL ON TABLE "public"."Candle" TO "anon";
GRANT ALL ON TABLE "public"."Candle" TO "authenticated";
GRANT ALL ON TABLE "public"."Candle" TO "service_role";



GRANT ALL ON TABLE "public"."Category" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Category" TO "authenticated";



GRANT ALL ON TABLE "public"."ContactForm" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ContactForm" TO "authenticated";



GRANT ALL ON TABLE "public"."Debt" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Debt" TO "authenticated";



GRANT ALL ON TABLE "public"."Execution" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Execution" TO "authenticated";



GRANT ALL ON TABLE "public"."Feedback" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Feedback" TO "authenticated";



GRANT ALL ON TABLE "public"."Goal" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Goal" TO "authenticated";



GRANT ALL ON TABLE "public"."Group" TO "anon";
GRANT ALL ON TABLE "public"."Group" TO "authenticated";
GRANT ALL ON TABLE "public"."Group" TO "service_role";



GRANT ALL ON TABLE "public"."HouseholdMember" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."HouseholdMember" TO "authenticated";



GRANT ALL ON TABLE "public"."InvestmentAccount" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."InvestmentAccount" TO "authenticated";



GRANT ALL ON TABLE "public"."InvestmentTransaction" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."InvestmentTransaction" TO "authenticated";



GRANT ALL ON TABLE "public"."Order" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Order" TO "authenticated";



GRANT ALL ON TABLE "public"."PlaidConnection" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."PlaidConnection" TO "authenticated";



GRANT ALL ON TABLE "public"."PlaidLiability" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."PlaidLiability" TO "authenticated";



GRANT ALL ON TABLE "public"."Plan" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Plan" TO "authenticated";
GRANT SELECT ON TABLE "public"."Plan" TO "anon";



GRANT ALL ON TABLE "public"."PlannedPayment" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."PlannedPayment" TO "authenticated";



GRANT ALL ON TABLE "public"."Position" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Position" TO "authenticated";



GRANT ALL ON TABLE "public"."PromoCode" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."PromoCode" TO "authenticated";
GRANT SELECT ON TABLE "public"."PromoCode" TO "anon";



GRANT ALL ON TABLE "public"."QuestradeConnection" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."QuestradeConnection" TO "authenticated";



GRANT ALL ON TABLE "public"."Security" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Security" TO "authenticated";
GRANT SELECT ON TABLE "public"."Security" TO "anon";



GRANT ALL ON TABLE "public"."SecurityPrice" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."SecurityPrice" TO "authenticated";
GRANT SELECT ON TABLE "public"."SecurityPrice" TO "anon";



GRANT ALL ON TABLE "public"."SimpleInvestmentEntry" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."SimpleInvestmentEntry" TO "authenticated";



GRANT ALL ON TABLE "public"."Subcategory" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Subcategory" TO "authenticated";



GRANT ALL ON TABLE "public"."Subscription" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Subscription" TO "authenticated";



GRANT ALL ON TABLE "public"."SystemSettings" TO "anon";
GRANT ALL ON TABLE "public"."SystemSettings" TO "authenticated";
GRANT ALL ON TABLE "public"."SystemSettings" TO "service_role";



GRANT ALL ON TABLE "public"."Transaction" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Transaction" TO "authenticated";



GRANT ALL ON TABLE "public"."TransactionSync" TO "anon";
GRANT ALL ON TABLE "public"."TransactionSync" TO "authenticated";
GRANT ALL ON TABLE "public"."TransactionSync" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."User" TO "authenticated";



GRANT ALL ON TABLE "public"."UserServiceSubscription" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."UserServiceSubscription" TO "authenticated";



GRANT ALL ON TABLE "public"."holdings_view" TO "service_role";
GRANT SELECT ON TABLE "public"."holdings_view" TO "authenticated";



GRANT ALL ON TABLE "public"."asset_allocation_view" TO "service_role";
GRANT SELECT ON TABLE "public"."asset_allocation_view" TO "authenticated";



GRANT ALL ON TABLE "public"."category_learning" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."category_learning" TO "authenticated";



GRANT ALL ON TABLE "public"."portfolio_summary_view" TO "service_role";
GRANT SELECT ON TABLE "public"."portfolio_summary_view" TO "authenticated";



GRANT ALL ON TABLE "public"."sector_allocation_view" TO "service_role";
GRANT SELECT ON TABLE "public"."sector_allocation_view" TO "authenticated";



GRANT ALL ON TABLE "public"."user_monthly_usage" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_monthly_usage" TO "authenticated";



GRANT ALL ON TABLE "public"."vw_transactions_for_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."vw_transactions_for_reports" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







