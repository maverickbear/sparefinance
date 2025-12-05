


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



CREATE OR REPLACE FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."HouseholdMember" hm1
        JOIN "public"."HouseholdMember" hm2 ON hm1."householdId" = hm2."householdId"
        WHERE hm1."userId" = p_user1_id
          AND hm2."userId" = p_user2_id
          AND hm1."status" = 'active'
          AND hm2."status" = 'active'
    );
END;
$$;


ALTER FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") IS 'Checks if two users are active members of the same household. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."audit_table_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_table_name text;
    v_record_id text;
    v_user_id uuid;
BEGIN
    -- Get table name from TG_TABLE_NAME
    v_table_name := TG_TABLE_NAME;
    
    -- Get current user ID
    v_user_id := auth.uid();
    
    -- Handle different operations
    IF TG_OP = 'INSERT' THEN
        -- Get record ID from NEW
        -- FIX: Use to_jsonb() instead of direct cast
        v_record_id := COALESCE(
            NEW."id"::text, 
            to_jsonb(NEW)->>'id'
        );
        
        -- Log INSERT
        INSERT INTO "public"."audit_log" (
            "table_name", "record_id", "action", "user_id", "new_data"
        ) VALUES (
            v_table_name, v_record_id, 'INSERT', v_user_id, to_jsonb(NEW)
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'UPDATE' THEN
        -- Get record ID from NEW (or OLD if NEW doesn't have id)
        -- FIX: Use to_jsonb() instead of direct cast
        v_record_id := COALESCE(
            NEW."id"::text, 
            OLD."id"::text, 
            to_jsonb(NEW)->>'id', 
            to_jsonb(OLD)->>'id'
        );
        
        -- Only log if data actually changed
        IF OLD IS DISTINCT FROM NEW THEN
            INSERT INTO "public"."audit_log" (
                "table_name", "record_id", "action", "user_id", "old_data", "new_data"
            ) VALUES (
                v_table_name, v_record_id, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW)
            );
        END IF;
        
        RETURN NEW;
    
    ELSIF TG_OP = 'DELETE' THEN
        -- Get record ID from OLD
        -- FIX: Use to_jsonb() instead of direct cast
        v_record_id := COALESCE(
            OLD."id"::text, 
            to_jsonb(OLD)->>'id'
        );
        
        -- Log DELETE
        INSERT INTO "public"."audit_log" (
            "table_name", "record_id", "action", "user_id", "old_data"
        ) VALUES (
            v_table_name, v_record_id, 'DELETE', v_user_id, to_jsonb(OLD)
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_table_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."audit_table_changes"() IS 'Trigger function to automatically log changes to tables. Logs INSERT, UPDATE, and DELETE operations with old and new data. Uses SET search_path for security. Fixed jsonb casting issue.';



CREATE OR REPLACE FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM "public"."AccountOwner" ao
        WHERE ao."accountId" = p_account_id
          AND ao."ownerId" = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") IS 'Checks if the current user can access an account via AccountOwner relationship. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    user_role text;
    user_status text;
BEGIN
    -- SECURITY FIX: Remove NULL bypass - all records must have householdId
    -- If householdId is NULL, deny access (no longer allowing backward compatibility)
    IF p_household_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get user's role and status in this household
    SELECT hm."role", hm."status"
    INTO user_role, user_status
    FROM "public"."HouseholdMember" hm
    WHERE hm."householdId" = p_household_id
      AND hm."userId" = auth.uid();
    
    -- User is not a member of this household
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- User must be active
    IF user_status != 'active' THEN
        RETURN false;
    END IF;
    
    -- Check operation permissions
    CASE p_operation
        WHEN 'read' THEN
            -- All active members can read
            RETURN true;
        
        WHEN 'write' THEN
            -- Only owner/admin can write
            RETURN user_role IN ('owner', 'admin');
        
        WHEN 'delete' THEN
            -- Only owner/admin can delete
            RETURN user_role IN ('owner', 'admin');
        
        ELSE
            -- Unknown operation, deny access
            RETURN false;
    END CASE;
END;
$$;


ALTER FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") IS 'Checks if the current user can perform an operation (read/write/delete) on a household''s data based on their role. SECURITY FIX: No longer allows NULL householdId (backward compatibility removed). Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_household_id uuid;
    v_user_id uuid;
BEGIN
    -- Get householdId and userId from the record
    CASE p_table_name
        WHEN 'Account' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."Account"
            WHERE "id" = p_record_id;
        
        WHEN 'Transaction' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."Transaction"
            WHERE "id" = p_record_id;
        
        WHEN 'Budget' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."Budget"
            WHERE "id" = p_record_id;
        
        WHEN 'Goal' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."Goal"
            WHERE "id" = p_record_id;
        
        WHEN 'Debt' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."Debt"
            WHERE "id" = p_record_id;
        
        WHEN 'PlannedPayment' THEN
            SELECT "householdId", "userId" INTO v_household_id, v_user_id
            FROM "public"."PlannedPayment"
            WHERE "id" = p_record_id;
        
        ELSE
            -- Unknown table, deny access
            RETURN false;
    END CASE;
    
    -- If record not found, deny access
    IF v_household_id IS NULL AND v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check household access OR direct ownership
    RETURN (
        (v_household_id IS NOT NULL AND "public"."can_access_household_data"(v_household_id, 'read'::text))
        OR (v_user_id = auth.uid())
    );
END;
$$;


ALTER FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") IS 'Unified helper function to check if current user can access a record. Uses household access OR direct ownership. Maximum 2 access paths. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."check_email_has_account"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM "User" 
    WHERE email = LOWER(p_email)
  ) INTO user_exists;
  
  RETURN user_exists;
END;
$$;


ALTER FUNCTION "public"."check_email_has_account"("p_email" "text") OWNER TO "postgres";


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
    SET "search_path" TO ''
    AS $$
DECLARE
    v_planned_payment "public"."PlannedPayment"%ROWTYPE;
    v_transaction_id "text";
    v_user_id "uuid";
    v_household_id "uuid";
BEGIN
    -- Get the planned payment
    SELECT * INTO v_planned_payment
    FROM "public"."PlannedPayment"
    WHERE "id" = p_planned_payment_id
    AND "userId" = "auth"."uid"()
    AND "status" = 'scheduled'::"text";
    
    IF NOT FOUND THEN
        PERFORM public.raise_error_with_code('PLANNED_PAYMENT_NOT_FOUND', 'ID: ' || p_planned_payment_id);
    END IF;
    
    -- Check if already has a linked transaction (idempotency)
    IF v_planned_payment."linkedTransactionId" IS NOT NULL THEN
        RETURN v_planned_payment."linkedTransactionId";
    END IF;
    
    v_user_id := v_planned_payment."userId";
    v_household_id := v_planned_payment."householdId";
    
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
        "householdId",
        "isRecurring",
        "createdAt",
        "updatedAt"
    ) VALUES (
        v_transaction_id,
        v_planned_payment."date",
        v_planned_payment."type",
        v_planned_payment."amount",
        v_planned_payment."accountId",
        v_planned_payment."categoryId",
        v_planned_payment."subcategoryId",
        v_planned_payment."description",
        v_user_id,
        v_household_id,
        false, -- Planned payments are not recurring
        NOW(),
        NOW()
    );
    
    -- Update planned payment to mark as processed
    UPDATE "public"."PlannedPayment"
    SET 
        "status" = 'paid'::"text",
        "linkedTransactionId" = v_transaction_id,
        "updatedAt" = NOW()
    WHERE "id" = p_planned_payment_id;
    
    RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") IS 'Converts a planned payment to a transaction. Uses improved error handling with error codes. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text" DEFAULT NULL::"text", "p_subcategory_id" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_description_search" "text" DEFAULT NULL::"text", "p_is_recurring" boolean DEFAULT false, "p_expense_type" "text" DEFAULT NULL::"text", "p_created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "p_updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "p_max_transactions" integer DEFAULT '-1'::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_month_date date;
  v_current_count integer;
  v_new_count integer;
  v_transaction_id text;
  v_household_id uuid;
BEGIN
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "public"."user_monthly_usage"
    WHERE "user_id" = p_user_id AND "month_date" = v_month_date;
    
    IF v_current_count >= p_max_transactions THEN
      PERFORM public.raise_error_with_code('TRANSACTION_LIMIT_REACHED', 
        'Current: ' || v_current_count || ', Limit: ' || p_max_transactions);
    END IF;
  END IF;
  
  -- Increment counter
  v_new_count := "public"."increment_transaction_count"(p_user_id, v_month_date);
  
  -- Get user's default household if needed
  -- Note: householdId should be provided by the application layer, but we'll get default if not provided
  SELECT "public"."get_or_create_default_personal_household"(p_user_id) INTO v_household_id;
  
  -- Insert transaction
  INSERT INTO "public"."Transaction" (
    "id", 
    "date", 
    "type", 
    "amount", 
    "accountId", 
    "userId",
    "householdId",
    "categoryId", 
    "subcategoryId", 
    "description", 
    "description_search",
    "isRecurring", 
    "expenseType", 
    "createdAt", 
    "updatedAt"
  ) VALUES (
    p_id, 
    p_date, 
    p_type, 
    p_amount, 
    p_account_id, 
    p_user_id,
    v_household_id,
    p_category_id, 
    p_subcategory_id, 
    p_description, 
    p_description_search,
    p_is_recurring, 
    p_expense_type, 
    p_created_at, 
    p_updated_at
  );
  
  -- Return JSON with transaction ID and new count
  RETURN jsonb_build_object(
    'transaction_id', p_id,
    'new_count', v_new_count
  );
END;
$$;


ALTER FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_max_transactions" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_max_transactions" integer) IS 'Creates a transaction atomically with limit checking. Uses improved error handling with error codes. Updated to use isRecurring instead of recurring and timestamptz instead of timestamp. Amount is numeric (no longer encrypted).';



CREATE OR REPLACE FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text" DEFAULT NULL::"text", "p_description_search" "text" DEFAULT NULL::"text", "p_is_recurring" boolean DEFAULT false, "p_max_transactions" integer DEFAULT '-1'::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_outgoing_id text;
  v_incoming_id text;
  v_month_date date;
  v_current_count integer;
  v_new_count integer;
  v_now timestamptz;
  v_outgoing_description text;
  v_incoming_description text;
  v_household_id uuid;
BEGIN
  -- Generate IDs
  v_outgoing_id := gen_random_uuid()::text;
  v_incoming_id := gen_random_uuid()::text;
  v_now := CURRENT_TIMESTAMP;
  
  -- Get user's default household
  SELECT "public"."get_or_create_default_personal_household"(p_user_id) INTO v_household_id;
  
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited (counts as 2 transactions)
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "public"."user_monthly_usage"
    WHERE "user_id" = p_user_id AND "month_date" = v_month_date;
    
    IF v_current_count + 2 > p_max_transactions THEN
      PERFORM public.raise_error_with_code('TRANSACTION_LIMIT_REACHED', 
        'Current: ' || v_current_count || ', Limit: ' || p_max_transactions || ' (transfer requires 2 transactions)');
    END IF;
  END IF;
  
  -- Increment counter twice (for both transactions)
  v_new_count := "public"."increment_transaction_count"(p_user_id, v_month_date);
  v_new_count := "public"."increment_transaction_count"(p_user_id, v_month_date);
  
  -- Build descriptions
  v_outgoing_description := COALESCE(p_description, 'Transfer out');
  v_incoming_description := COALESCE(p_description, 'Transfer in');
  
  -- Create outgoing transaction
  INSERT INTO "public"."Transaction" (
    "id", "date", "type", "amount", "accountId", "userId", "householdId",
    "transferToId", "description", "description_search", "isRecurring",
    "createdAt", "updatedAt"
  ) VALUES (
    v_outgoing_id, p_date, 'transfer', p_amount, p_from_account_id, p_user_id, v_household_id,
    p_to_account_id, v_outgoing_description, p_description_search, p_is_recurring,
    v_now, v_now
  );
  
  -- Create incoming transaction
  INSERT INTO "public"."Transaction" (
    "id", "date", "type", "amount", "accountId", "userId", "householdId",
    "transferFromId", "description", "description_search", "isRecurring",
    "createdAt", "updatedAt"
  ) VALUES (
    v_incoming_id, p_date, 'transfer', p_amount, p_to_account_id, p_user_id, v_household_id,
    p_from_account_id, v_incoming_description, p_description_search, p_is_recurring,
    v_now, v_now
  );
  
  -- Return JSON with transaction IDs and new count
  RETURN jsonb_build_object(
    'outgoing_transaction_id', v_outgoing_id,
    'incoming_transaction_id', v_incoming_id,
    'new_count', v_new_count
  );
END;
$$;


ALTER FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_max_transactions" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_max_transactions" integer) IS 'Creates a transfer (two transactions) atomically with limit checking. Uses improved error handling with error codes. Updated to use isRecurring instead of recurring and timestamptz instead of timestamp.';



CREATE OR REPLACE FUNCTION "public"."delete_user_data"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Temporarily disable the trigger to allow deletion of system goals
  -- This is safe because we're deleting the user, so their goals should be deleted too
  -- Check if trigger exists before disabling (to avoid errors if trigger doesn't exist)
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'prevent_emergency_fund_deletion_trigger' 
    AND tgrelid = 'public.Goal'::regclass
  ) THEN
    ALTER TABLE "public"."Goal" DISABLE TRIGGER "prevent_emergency_fund_deletion_trigger";
  END IF;
  
  -- Delete all goals (system and non-system)
  DELETE FROM "public"."Goal"
  WHERE "userId" = p_user_id;
  
  -- Re-enable the trigger if it was disabled
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'prevent_emergency_fund_deletion_trigger' 
    AND tgrelid = 'public.Goal'::regclass
  ) THEN
    ALTER TABLE "public"."Goal" ENABLE TRIGGER "prevent_emergency_fund_deletion_trigger";
  END IF;
  
  -- Delete subscriptions (to avoid RESTRICT constraint on planId)
  DELETE FROM "public"."Subscription"
  WHERE "userId" = p_user_id;
  
  -- Delete subscriptions by household if user owns households
  DELETE FROM "public"."Subscription"
  WHERE "householdId" IN (
    SELECT "id" FROM "public"."Household" WHERE "createdBy" = p_user_id
  );
  
  -- Note: We cannot delete from User table here because FK constraint to auth.users
  -- The User table will be deleted via CASCADE when auth.users is deleted
  -- All other data (accounts, transactions, etc.) will cascade delete when User is deleted
  
  -- This function cleans up data that might have RESTRICT constraints or triggers
END;
$$;


ALTER FUNCTION "public"."delete_user_data"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") IS 'Deletes user-related data (goals, subscriptions) before user deletion. Handles system goals and RESTRICT constraints. Actual user deletion from auth.users must be done via Admin API.';



CREATE OR REPLACE FUNCTION "public"."get_account_user_id"("p_account_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT "userId" INTO v_user_id
    FROM "public"."Account"
    WHERE "id" = p_account_id;
    
    RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."get_account_user_id"("p_account_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_user_id"("p_account_id" "text") IS 'Returns the userId of an account. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") RETURNS TABLE("table_name" "text", "last_update" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    -- Transaction
    SELECT 
      'Transaction' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000)::bigint as last_update
    FROM "public"."Transaction"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Account
    SELECT 
      'Account' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000)::bigint
    FROM "public"."Account"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Budget
    SELECT 
      'Budget' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000)::bigint
    FROM "public"."Budget"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Goal
    SELECT 
      'Goal' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000)::bigint
    FROM "public"."Goal"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- Debt
    SELECT 
      'Debt' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updatedAt", "createdAt"))) * 1000)::bigint
    FROM "public"."Debt"
    WHERE "userId" = p_user_id
      AND ("updatedAt" IS NOT NULL OR "createdAt" IS NOT NULL)
    
    UNION ALL
    
    -- SimpleInvestmentEntry (via Account)
    SELECT 
      'SimpleInvestmentEntry' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST(sie."updatedAt", sie."createdAt"))) * 1000)::bigint
    FROM "public"."SimpleInvestmentEntry" sie
    JOIN "public"."Account" a ON a.id = sie."accountId"
    WHERE a."userId" = p_user_id
      AND (sie."updatedAt" IS NOT NULL OR sie."createdAt" IS NOT NULL)
  )
  SELECT * FROM updates WHERE updates.last_update IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") IS 'Retorna timestamp da última atualização de cada tabela para um usuário. Usado pelo endpoint check-updates. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_household_id uuid;
    v_user_name text;
BEGIN
    -- First, try to find existing default personal household
    SELECT h."id" INTO v_household_id
    FROM "public"."Household" h
    JOIN "public"."HouseholdMember" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = p_user_id
      AND h."type" = 'personal'
      AND hm."isDefault" = true
      AND hm."status" = 'active'
    LIMIT 1;
    
    -- If found, return it
    IF v_household_id IS NOT NULL THEN
        RETURN v_household_id;
    END IF;
    
    -- If not found, create a new personal household
    -- Get user name for household name
    SELECT COALESCE("name", "email", 'Personal') INTO v_user_name
    FROM "public"."User"
    WHERE "id" = p_user_id;
    
    -- Create household
    INSERT INTO "public"."Household" ("id", "name", "type", "createdBy", "settings")
    VALUES (gen_random_uuid(), v_user_name || '''s Personal', 'personal', p_user_id, '{}'::jsonb)
    RETURNING "id" INTO v_household_id;
    
    -- Create household membership
    INSERT INTO "public"."HouseholdMember" (
        "householdId", "userId", "role", "status", "isDefault", "joinedAt"
    )
    VALUES (
        v_household_id, p_user_id, 'owner', 'active', true, NOW()
    );
    
    RETURN v_household_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") IS 'Gets or creates a default personal household for a user. Used for migrating NULL householdId records. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") RETURNS TABLE("name" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.name,
    u.email
  FROM "User" u
  WHERE u.id = p_owner_id;
END;
$$;


ALTER FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_households"() RETURNS TABLE("household_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT hm."householdId"
    FROM "public"."HouseholdMember" hm
    WHERE hm."userId" = auth.uid()
      AND hm."status" = 'active';
END;
$$;


ALTER FUNCTION "public"."get_user_accessible_households"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_accessible_households"() IS 'Returns all household IDs that the current user can access as an active member. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_user_active_household"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    active_household_id uuid;
BEGIN
    SELECT "householdId" INTO active_household_id
    FROM "public"."UserActiveHousehold"
    WHERE "userId" = auth.uid()
    LIMIT 1;
    
    -- If no active household set, return default (personal) household
    IF active_household_id IS NULL THEN
        SELECT hm."householdId" INTO active_household_id
        FROM "public"."HouseholdMember" hm
        JOIN "public"."Household" h ON h."id" = hm."householdId"
        WHERE hm."userId" = auth.uid()
          AND hm."isDefault" = true
          AND h."type" = 'personal'
          AND hm."status" = 'active'
        LIMIT 1;
    END IF;
    
    RETURN active_household_id;
END;
$$;


ALTER FUNCTION "public"."get_user_active_household"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_active_household"() IS 'Returns the currently active household ID for the current user, or their default personal household. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_user_admin_household_ids"() RETURNS TABLE("household_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT hm."householdId" as household_id
    FROM "public"."HouseholdMember" hm
    WHERE hm."userId" = auth.uid()
      AND hm."role" IN ('owner', 'admin')
      AND hm."status" = 'active';
END;
$$;


ALTER FUNCTION "public"."get_user_admin_household_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_admin_household_ids"() IS 'Returns all household IDs where the current user is an owner or admin. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_user_household_ids"() RETURNS TABLE("household_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT hm."householdId" as household_id
    FROM "public"."HouseholdMember" hm
    WHERE hm."userId" = auth.uid()
      AND hm."status" = 'active';
END;
$$;


ALTER FUNCTION "public"."get_user_household_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_household_ids"() IS 'Returns all household IDs where the current user is an active member. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    user_role text;
BEGIN
    SELECT hm."role"
    INTO user_role
    FROM "public"."HouseholdMember" hm
    WHERE hm."householdId" = p_household_id
      AND hm."userId" = auth.uid()
      AND hm."status" = 'active';
    
    RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") IS 'Returns the current user''s role in the specified household, or NULL if not a member. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO "public"."user_monthly_usage" ("user_id", "month_date", "transactions_count")
  VALUES (p_user_id, p_month_date, 1)
  ON CONFLICT ("user_id", "month_date")
  DO UPDATE SET
    "transactions_count" = "public"."user_monthly_usage"."transactions_count" + 1;
  
  SELECT "transactions_count" INTO v_count
  FROM "public"."user_monthly_usage"
  WHERE "user_id" = p_user_id AND "month_date" = p_month_date;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") IS 'Atomically increments transaction count for a user/month. Used within transaction functions. Uses SET search_path for security.';



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


CREATE OR REPLACE FUNCTION "public"."is_household_member"("p_household_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."HouseholdMember" hm
        WHERE hm."householdId" = p_household_id
          AND hm."userId" = auth.uid()
          AND hm."status" = 'active'
    );
END;
$$;


ALTER FUNCTION "public"."is_household_member"("p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") IS 'Returns true if the current user is an active member of the specified household. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_deleted_at timestamptz;
BEGIN
    -- Check if record exists and is not deleted
    CASE p_table_name
        WHEN 'Account' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."Account"
            WHERE "id" = p_record_id;
        
        WHEN 'Transaction' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."Transaction"
            WHERE "id" = p_record_id;
        
        WHEN 'Budget' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."Budget"
            WHERE "id" = p_record_id;
        
        WHEN 'Goal' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."Goal"
            WHERE "id" = p_record_id;
        
        WHEN 'Debt' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."Debt"
            WHERE "id" = p_record_id;
        
        WHEN 'PlannedPayment' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."PlannedPayment"
            WHERE "id" = p_record_id;
        
        WHEN 'AccountOwner' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."AccountOwner"
            WHERE "id"::text = p_record_id;
        
        WHEN 'UserServiceSubscription' THEN
            SELECT "deletedAt" INTO v_deleted_at
            FROM "public"."UserServiceSubscription"
            WHERE "id" = p_record_id;
        
        ELSE
            -- Unknown table, assume not deleted
            RETURN true;
    END CASE;
    
    -- Return true if not found (doesn't exist) or deletedAt is NULL (not deleted)
    RETURN v_deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") IS 'Checks if a record is not soft-deleted. Returns true if record exists and deletedAt is NULL. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."prevent_emergency_fund_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_exists boolean;
BEGIN
  IF OLD."isSystemGoal" = true THEN
    -- Check if user still exists in User table
    -- If user doesn't exist, we're in a CASCADE deletion context, allow it
    SELECT EXISTS(SELECT 1 FROM "public"."User" WHERE "id" = OLD."userId") INTO v_user_exists;
    
    IF NOT v_user_exists THEN
      -- User is being deleted via CASCADE, allow goal deletion
      RETURN OLD;
    END IF;
    
    -- User still exists, prevent deletion (normal deletion attempt)
    RAISE EXCEPTION 'System goals cannot be deleted. You can edit them instead.';
  END IF;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."prevent_emergency_fund_deletion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_emergency_fund_deletion"() IS 'Prevents deletion of system goals, except when the user is being deleted (CASCADE). Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    v_message text;
    v_user_message text;
BEGIN
    -- Get error message from error_codes table
    SELECT "message", "user_message"
    INTO v_message, v_user_message
    FROM "public"."error_codes"
    WHERE "code" = p_error_code;
    
    -- If error code not found, use the code as message
    IF NOT FOUND THEN
        v_message := p_error_code;
        v_user_message := 'An error occurred';
    END IF;
    
    -- Add additional info if provided
    IF p_additional_info IS NOT NULL THEN
        v_message := v_message || ': ' || p_additional_info;
    END IF;
    
    -- Raise exception with error code in hint
    RAISE EXCEPTION '%', v_message
        USING HINT = 'ERROR_CODE:' || p_error_code || '|USER_MESSAGE:' || v_user_message;
END;
$$;


ALTER FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") IS 'Raises an exception with a standardized error code. Error code and user message are included in the hint for application layer to extract. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."trigger_update_subscription_cache"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_household_id uuid;
BEGIN
  -- Only process if status is active or trialing
  IF NEW."status" IN ('active', 'trialing') THEN
    -- Update cache for the subscription owner (if userId-based subscription)
    IF NEW."userId" IS NOT NULL THEN
      PERFORM "public"."update_user_subscription_cache"(NEW."userId");
      
      -- Also update all household members if this is a userId-based subscription
      -- Get householdId from user's active household
      SELECT "householdId" INTO v_household_id
      FROM "public"."UserActiveHousehold"
      WHERE "userId" = NEW."userId"
      LIMIT 1;
      
      -- Fallback to default household
      IF v_household_id IS NULL THEN
        SELECT "householdId" INTO v_household_id
        FROM "public"."HouseholdMember"
        WHERE "userId" = NEW."userId"
          AND "isDefault" = true
          AND "status" = 'active'
        LIMIT 1;
      END IF;
      
      IF v_household_id IS NOT NULL THEN
        PERFORM "public"."update_household_members_subscription_cache"(v_household_id);
      END IF;
    END IF;
    
    -- Update cache for all household members if this is a householdId-based subscription
    IF NEW."householdId" IS NOT NULL THEN
      -- Update all members of this household
      PERFORM "public"."update_household_members_subscription_cache"(NEW."householdId");
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_subscription_cache"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_update_subscription_cache"() IS 'Updates subscription cache when subscription changes. Supports both userId-based (backward compatibility) and householdId-based subscriptions. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_member_record record;
BEGIN
  -- Update all active household members of this household
  FOR v_member_record IN
    SELECT "userId"
    FROM "public"."HouseholdMember"
    WHERE "householdId" = p_household_id
      AND "status" = 'active'
      AND "userId" IS NOT NULL
  LOOP
    PERFORM "public"."update_user_subscription_cache"(v_member_record."userId");
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") IS 'Updates subscription cache for all active members of a household when the household subscription changes. Uses HouseholdMember. Uses SET search_path for security.';



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


CREATE OR REPLACE FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_household_id uuid;
  v_subscription_record record;
BEGIN
  -- Get user's active household (or default personal household)
  SELECT "householdId" INTO v_household_id
  FROM "public"."UserActiveHousehold"
  WHERE "userId" = p_user_id
  LIMIT 1;

  -- Fallback to default (personal) household if no active household set
  IF v_household_id IS NULL THEN
    SELECT "householdId" INTO v_household_id
    FROM "public"."HouseholdMember"
    WHERE "userId" = p_user_id
      AND "isDefault" = true
      AND "status" = 'active'
    LIMIT 1;
  END IF;

  -- Get subscription for household (new architecture)
  IF v_household_id IS NOT NULL THEN
    SELECT 
      "id",
      "planId",
      "status"
    INTO v_subscription_record
    FROM "public"."Subscription"
    WHERE "householdId" = v_household_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "createdAt" DESC
    LIMIT 1;
  END IF;

  -- Fallback: Try to get subscription by userId (backward compatibility)
  IF v_subscription_record IS NULL THEN
    SELECT 
      "id",
      "planId",
      "status"
    INTO v_subscription_record
    FROM "public"."Subscription"
    WHERE "userId" = p_user_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "createdAt" DESC
    LIMIT 1;
  END IF;

  -- Update User table with subscription cache
  IF v_subscription_record IS NOT NULL THEN
    UPDATE "public"."User"
    SET
      "effectivePlanId" = v_subscription_record."planId",
      "effectiveSubscriptionStatus" = v_subscription_record."status",
      "effectiveSubscriptionId" = v_subscription_record."id",
      "subscriptionUpdatedAt" = NOW()
    WHERE "id" = p_user_id;
  ELSE
    -- If no subscription found, clear cache
    UPDATE "public"."User"
    SET
      "effectivePlanId" = NULL,
      "effectiveSubscriptionStatus" = NULL,
      "effectiveSubscriptionId" = NULL,
      "subscriptionUpdatedAt" = NOW()
    WHERE "id" = p_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") IS 'Updates the subscription cache in the User table. Uses HouseholdMember and householdId-based subscriptions. Falls back to userId-based subscriptions for backward compatibility.';



CREATE OR REPLACE FUNCTION "public"."validate_invitation_token"("p_token" "text") RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "status" "text", "owner_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hm.id,
    hm.email,
    hm.name,
    hm.role,
    hm.status,
    h."createdBy" as owner_id
  FROM "HouseholdMember" hm
  JOIN "Household" h ON h."id" = hm."householdId"
  WHERE hm."invitationToken" = p_token
    AND hm.status = 'pending';
END;
$$;


ALTER FUNCTION "public"."validate_invitation_token"("p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_invitation_token"("p_token" "text") IS 'Validates an invitation token and returns invitation details. Updated to use HouseholdMember table.';



CREATE OR REPLACE FUNCTION "public"."validate_plan_features"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  required_features text[] := ARRAY[
    'hasInvestments',
    'hasAdvancedReports',
    'hasCsvExport',
    'hasCsvImport',
    'hasDebts',
    'hasGoals',
    'hasBankIntegration',
    'hasHousehold',
    'hasBudgets',
    'maxTransactions',
    'maxAccounts'
  ];
  feature_key text;
  feature_type text;
BEGIN
  -- Check if features is not null
  IF NEW.features IS NULL THEN
    RAISE EXCEPTION 'Plan features cannot be null';
  END IF;

  -- Check if features is an object
  IF jsonb_typeof(NEW.features) != 'object' THEN
    RAISE EXCEPTION 'Plan features must be a JSON object';
  END IF;

  -- Validate required features exist
  FOREACH feature_key IN ARRAY required_features
  LOOP
    IF NOT (NEW.features ? feature_key) THEN
      RAISE EXCEPTION 'Missing required feature: %', feature_key;
    END IF;
  END LOOP;

  -- Validate boolean features
  IF jsonb_typeof(NEW.features->'hasInvestments') != 'boolean' THEN
    RAISE EXCEPTION 'hasInvestments must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasAdvancedReports') != 'boolean' THEN
    RAISE EXCEPTION 'hasAdvancedReports must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasCsvExport') != 'boolean' THEN
    RAISE EXCEPTION 'hasCsvExport must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasCsvImport') != 'boolean' THEN
    RAISE EXCEPTION 'hasCsvImport must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasDebts') != 'boolean' THEN
    RAISE EXCEPTION 'hasDebts must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasGoals') != 'boolean' THEN
    RAISE EXCEPTION 'hasGoals must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasBankIntegration') != 'boolean' THEN
    RAISE EXCEPTION 'hasBankIntegration must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasHousehold') != 'boolean' THEN
    RAISE EXCEPTION 'hasHousehold must be a boolean';
  END IF;
  IF jsonb_typeof(NEW.features->'hasBudgets') != 'boolean' THEN
    RAISE EXCEPTION 'hasBudgets must be a boolean';
  END IF;

  -- Validate numeric features
  IF jsonb_typeof(NEW.features->'maxTransactions') != 'number' THEN
    RAISE EXCEPTION 'maxTransactions must be a number';
  END IF;
  IF jsonb_typeof(NEW.features->'maxAccounts') != 'number' THEN
    RAISE EXCEPTION 'maxAccounts must be a number';
  END IF;

  -- Validate numeric ranges (optional - can be -1 for unlimited)
  IF (NEW.features->>'maxTransactions')::numeric < -1 THEN
    RAISE EXCEPTION 'maxTransactions must be >= -1 (-1 means unlimited)';
  END IF;
  IF (NEW.features->>'maxAccounts')::numeric < -1 THEN
    RAISE EXCEPTION 'maxAccounts must be >= -1 (-1 means unlimited)';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_plan_features"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_plan_features"() IS 'Secure function to validate plan features. Uses SET search_path = '' to prevent schema injection attacks.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "creditLimit" numeric(15,2),
    "userId" "uuid",
    "initialBalance" numeric(15,2),
    "plaidItemId" "text",
    "plaidAccountId" "text",
    "isConnected" boolean DEFAULT false,
    "lastSyncedAt" timestamp with time zone,
    "syncEnabled" boolean DEFAULT true,
    "plaidMask" "text",
    "plaidOfficialName" "text",
    "plaidVerificationStatus" "text",
    "dueDayOfMonth" integer,
    "extraCredit" numeric(15,2) DEFAULT 0 NOT NULL,
    "householdId" "uuid",
    "plaidSubtype" "text",
    "currencyCode" "text" DEFAULT 'USD'::"text",
    "plaidPersistentAccountId" "text",
    "plaidHolderCategory" "text",
    "plaidVerificationName" "text",
    "plaidAvailableBalance" numeric,
    "plaidUnofficialCurrencyCode" "text",
    "deletedAt" timestamp with time zone,
    CONSTRAINT "Account_currency_exclusive_check" CHECK ((NOT (("plaidUnofficialCurrencyCode" IS NOT NULL) AND ("plaidUnofficialCurrencyCode" <> ''::"text") AND (("currencyCode" IS NOT NULL) AND ("currencyCode" <> ''::"text"))))),
    CONSTRAINT "Account_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'checking'::"text", 'savings'::"text", 'credit'::"text", 'investment'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."Account" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Account"."creditLimit" IS 'Credit limit for credit card accounts. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."Account"."initialBalance" IS 'Initial balance for checking and savings accounts. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."Account"."dueDayOfMonth" IS 'Day of month when credit card bill is due (1-31). Only used for type=''credit'' accounts.';



COMMENT ON COLUMN "public"."Account"."extraCredit" IS 'Extra prepaid credit on this credit card. Used when user pays more than the current debt balance.';



COMMENT ON COLUMN "public"."Account"."plaidSubtype" IS 'Subtype from Plaid (e.g., checking, savings, credit card). Only set for accounts imported from Plaid.';



COMMENT ON COLUMN "public"."Account"."currencyCode" IS 'ISO currency code (e.g., USD, CAD). Defaults to USD. Used for multi-currency support.';



COMMENT ON COLUMN "public"."Account"."plaidPersistentAccountId" IS 'Persistent account ID for Tokenized Account Numbers (TAN). Used by Chase, PNC, and US Bank. Helps identify same account across multiple Items.';



COMMENT ON COLUMN "public"."Account"."plaidHolderCategory" IS 'Account category: personal, business, or unrecognized. Currently in beta.';



COMMENT ON COLUMN "public"."Account"."plaidVerificationName" IS 'Account holder name used for micro-deposit or database verification.';



COMMENT ON COLUMN "public"."Account"."plaidAvailableBalance" IS 'Available balance from Plaid (amount available to withdraw). Separate from current balance.';



COMMENT ON COLUMN "public"."Account"."plaidUnofficialCurrencyCode" IS 'Unofficial currency code for cryptocurrencies and non-ISO currencies. Only set when iso_currency_code is null.';



COMMENT ON COLUMN "public"."Account"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



COMMENT ON CONSTRAINT "Account_currency_exclusive_check" ON "public"."Account" IS 'Ensures currencyCode and plaidUnofficialCurrencyCode are mutually exclusive. ISO currency codes take precedence over unofficial codes (crypto).';



CREATE TABLE IF NOT EXISTS "public"."AccountInvestmentValue" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "totalValue" numeric(15,2) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid"
);


ALTER TABLE "public"."AccountInvestmentValue" OWNER TO "postgres";


COMMENT ON COLUMN "public"."AccountInvestmentValue"."totalValue" IS 'Total investment value. Stored as numeric(15,2) to prevent floating point rounding errors.';



CREATE TABLE IF NOT EXISTS "public"."AccountOwner" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "accountId" "text" NOT NULL,
    "ownerId" "uuid" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deletedAt" timestamp with time zone
);


ALTER TABLE "public"."AccountOwner" OWNER TO "postgres";


COMMENT ON COLUMN "public"."AccountOwner"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."Budget" (
    "id" "text" NOT NULL,
    "period" timestamp with time zone NOT NULL,
    "categoryId" "text",
    "amount" numeric(15,2) NOT NULL,
    "note" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "groupId" "text",
    "userId" "uuid" NOT NULL,
    "subcategoryId" "text",
    "isRecurring" boolean DEFAULT true NOT NULL,
    "householdId" "uuid",
    "deletedAt" timestamp with time zone,
    CONSTRAINT "budget_amount_positive" CHECK ((("amount")::double precision > (0)::double precision))
);


ALTER TABLE "public"."Budget" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Budget"."amount" IS 'Budget amount. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."Budget"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."Budget"."isRecurring" IS 'Indicates if the budget is recurring monthly. When true, the budget will be automatically created for future months.';



COMMENT ON COLUMN "public"."Budget"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."BudgetCategory" (
    "id" "text" NOT NULL,
    "budgetId" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."BudgetCategory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Candle" (
    "id" "text" NOT NULL,
    "securityId" "text" NOT NULL,
    "symbolId" bigint NOT NULL,
    "start" timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL,
    "low" numeric(15,4) NOT NULL,
    "high" numeric(15,4) NOT NULL,
    "open" numeric(15,4) NOT NULL,
    "close" numeric(15,4) NOT NULL,
    "volume" bigint DEFAULT 0 NOT NULL,
    "VWAP" numeric(15,4),
    "interval" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."Candle" OWNER TO "postgres";


COMMENT ON TABLE "public"."Candle" IS 'Stores historical price data (candles) for securities';



CREATE TABLE IF NOT EXISTS "public"."Category" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "groupId" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
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
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
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
    "firstPaymentDate" timestamp with time zone NOT NULL,
    "monthlyPayment" double precision NOT NULL,
    "principalPaid" double precision DEFAULT 0 NOT NULL,
    "interestPaid" double precision DEFAULT 0 NOT NULL,
    "additionalContributions" boolean DEFAULT false NOT NULL,
    "additionalContributionAmount" double precision DEFAULT 0,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "description" "text",
    "isPaidOff" boolean DEFAULT false NOT NULL,
    "isPaused" boolean DEFAULT false NOT NULL,
    "paidOffAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "paymentFrequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "paymentAmount" double precision,
    "accountId" "text",
    "userId" "uuid" NOT NULL,
    "startDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "nextDueDate" "date",
    "householdId" "uuid",
    "deletedAt" timestamp with time zone,
    CONSTRAINT "Debt_additionalContributionAmount_check" CHECK (("additionalContributionAmount" >= (0)::double precision)),
    CONSTRAINT "Debt_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Debt_downPayment_check" CHECK ((("downPayment" IS NULL) OR ("downPayment" >= (0)::double precision))),
    CONSTRAINT "Debt_initialAmount_check" CHECK (("initialAmount" > (0)::double precision)),
    CONSTRAINT "Debt_interestPaid_check" CHECK (("interestPaid" >= (0)::double precision)),
    CONSTRAINT "Debt_interestRate_check" CHECK (("interestRate" >= (0)::double precision)),
    CONSTRAINT "Debt_loanType_check" CHECK (("loanType" = ANY (ARRAY['mortgage'::"text", 'car_loan'::"text", 'personal_loan'::"text", 'credit_card'::"text", 'student_loan'::"text", 'business_loan'::"text", 'other'::"text"]))),
    CONSTRAINT "Debt_monthlyPayment_check" CHECK ((("monthlyPayment" > (0)::double precision) OR (("loanType" = 'credit_card'::"text") AND ("monthlyPayment" >= (0)::double precision)))),
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



COMMENT ON COLUMN "public"."Debt"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



COMMENT ON CONSTRAINT "debt_first_payment_date_valid" ON "public"."Debt" IS 'Valida que a data do primeiro pagamento está em um range válido';



COMMENT ON CONSTRAINT "debt_next_due_date_valid" ON "public"."Debt" IS 'Valida que a próxima data de vencimento está em um range válido';



CREATE TABLE IF NOT EXISTS "public"."Execution" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "symbolId" bigint NOT NULL,
    "symbol" "text" NOT NULL,
    "quantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "side" "text" NOT NULL,
    "price" numeric(15,4) NOT NULL,
    "orderId" bigint NOT NULL,
    "orderChainId" bigint NOT NULL,
    "exchangeExecId" "text",
    "timestamp" timestamp with time zone NOT NULL,
    "notes" "text",
    "venue" "text",
    "totalCost" numeric(15,2) DEFAULT 0 NOT NULL,
    "orderPlacementCommission" numeric(15,2) DEFAULT 0,
    "commission" numeric(15,2) DEFAULT 0,
    "executionFee" numeric(15,2) DEFAULT 0,
    "secFee" numeric(15,2) DEFAULT 0,
    "canadianExecutionFee" numeric(15,2) DEFAULT 0,
    "parentId" bigint,
    "lastSyncedAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid"
);


ALTER TABLE "public"."Execution" OWNER TO "postgres";


COMMENT ON TABLE "public"."Execution" IS 'Stores order executions for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."Feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "feedback" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "Feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."Feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Goal" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "targetAmount" double precision NOT NULL,
    "incomePercentage" double precision NOT NULL,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp with time zone,
    "description" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "currentBalance" double precision DEFAULT 0 NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "isPaused" boolean DEFAULT false NOT NULL,
    "expectedIncome" double precision,
    "targetMonths" double precision,
    "userId" "uuid" NOT NULL,
    "accountId" "text",
    "holdingId" "text",
    "householdId" "uuid",
    "isSystemGoal" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp with time zone,
    CONSTRAINT "Goal_currentBalance_check" CHECK (("currentBalance" >= (0)::double precision)),
    CONSTRAINT "Goal_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "Goal_targetMonths_check" CHECK ((("targetMonths" IS NULL) OR ("targetMonths" > (0)::double precision))),
    CONSTRAINT "goal_targetamount_positive" CHECK ((("targetAmount" > (0)::double precision) OR (("isSystemGoal" = true) AND ("targetAmount" >= (0)::double precision))))
);


ALTER TABLE "public"."Goal" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Goal"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."Goal"."isSystemGoal" IS 'Indicates if this is a system-created goal (e.g., Emergency Funds). System goals cannot be deleted.';



COMMENT ON COLUMN "public"."Goal"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."Group" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "userId" "uuid",
    "type" "text",
    CONSTRAINT "Group_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."Group" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Household" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "createdBy" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "Household_type_check" CHECK (("type" = ANY (ARRAY['personal'::"text", 'household'::"text"])))
);


ALTER TABLE "public"."Household" OWNER TO "postgres";


COMMENT ON TABLE "public"."Household" IS 'Households for organizing users and their data (personal or shared household accounts)';



COMMENT ON COLUMN "public"."Household"."type" IS 'Type of household: personal (individual account) or household (shared account)';



COMMENT ON COLUMN "public"."Household"."createdBy" IS 'User who created this household';



COMMENT ON COLUMN "public"."Household"."settings" IS 'Household settings stored as JSONB. Fields include: expectedIncome, expectedIncomeAmount, country (ISO 3166-1 alpha-2), stateOrProvince (state/province code). Location fields are used for tax calculations.';



CREATE TABLE IF NOT EXISTS "public"."HouseholdMember" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "householdId" "uuid" NOT NULL,
    "userId" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invitedBy" "uuid",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "email" "text",
    "name" "text",
    "invitationToken" "text",
    "invitedAt" timestamp with time zone,
    "acceptedAt" timestamp with time zone,
    CONSTRAINT "HouseholdMember_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))),
    CONSTRAINT "HouseholdMember_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'inactive'::"text"]))),
    CONSTRAINT "HouseholdMember_userId_or_email_check" CHECK ((("userId" IS NOT NULL) OR (("email" IS NOT NULL) AND ("status" = 'pending'::"text"))))
);


ALTER TABLE "public"."HouseholdMember" OWNER TO "postgres";


COMMENT ON TABLE "public"."HouseholdMember" IS 'Membership relationship between users and households';



COMMENT ON COLUMN "public"."HouseholdMember"."role" IS 'Role in the household: owner (full control), admin (can modify), member (read-only)';



COMMENT ON COLUMN "public"."HouseholdMember"."status" IS 'Membership status: active, pending (invitation), inactive';



COMMENT ON COLUMN "public"."HouseholdMember"."isDefault" IS 'Whether this is the default household for the user (typically their personal household)';



COMMENT ON COLUMN "public"."HouseholdMember"."email" IS 'Email for pending invitations (when userId is null)';



COMMENT ON COLUMN "public"."HouseholdMember"."name" IS 'Name for pending invitations';



COMMENT ON COLUMN "public"."HouseholdMember"."invitationToken" IS 'Token for invitation acceptance';



COMMENT ON COLUMN "public"."HouseholdMember"."invitedAt" IS 'When the invitation was sent';



COMMENT ON COLUMN "public"."HouseholdMember"."acceptedAt" IS 'When the invitation was accepted';



CREATE TABLE IF NOT EXISTS "public"."ImportJob" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "accountId" "text",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "progress" integer DEFAULT 0,
    "totalItems" integer DEFAULT 0,
    "processedItems" integer DEFAULT 0,
    "syncedItems" integer DEFAULT 0,
    "skippedItems" integer DEFAULT 0,
    "errorItems" integer DEFAULT 0,
    "errorMessage" "text",
    "metadata" "jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completedAt" timestamp with time zone,
    "retryCount" integer DEFAULT 0,
    "nextRetryAt" timestamp with time zone,
    CONSTRAINT "ImportJob_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "ImportJob_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "ImportJob_type_check" CHECK (("type" = ANY (ARRAY['plaid_sync'::"text", 'csv_import'::"text", 'investment_sync'::"text"])))
);


ALTER TABLE "public"."ImportJob" OWNER TO "postgres";


COMMENT ON TABLE "public"."ImportJob" IS 'Tracks background import jobs for bank accounts and transactions to prevent system overload';



CREATE TABLE IF NOT EXISTS "public"."InvestmentAccount" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "accountId" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" "uuid" NOT NULL,
    "cash" numeric(15,2),
    "marketValue" numeric(15,2),
    "totalEquity" numeric(15,2),
    "buyingPower" numeric(15,2),
    "maintenanceExcess" numeric(15,2),
    "currency" "text" DEFAULT 'CAD'::"text",
    "balanceLastUpdatedAt" timestamp with time zone,
    "householdId" "uuid"
);


ALTER TABLE "public"."InvestmentAccount" OWNER TO "postgres";


COMMENT ON COLUMN "public"."InvestmentAccount"."updatedAt" IS 'Timestamp de última atualização - atualizado automaticamente';



COMMENT ON COLUMN "public"."InvestmentAccount"."userId" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."InvestmentAccount"."cash" IS 'Cash balance in the account';



COMMENT ON COLUMN "public"."InvestmentAccount"."marketValue" IS 'Current market value of all positions';



COMMENT ON COLUMN "public"."InvestmentAccount"."totalEquity" IS 'Total equity (cash + market value)';



COMMENT ON COLUMN "public"."InvestmentAccount"."buyingPower" IS 'Available buying power';



COMMENT ON COLUMN "public"."InvestmentAccount"."maintenanceExcess" IS 'Maintenance excess amount';



COMMENT ON COLUMN "public"."InvestmentAccount"."currency" IS 'Currency of the account (default: CAD)';



COMMENT ON COLUMN "public"."InvestmentAccount"."balanceLastUpdatedAt" IS 'Last time balance information was updated';



CREATE TABLE IF NOT EXISTS "public"."InvestmentTransaction" (
    "id" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "accountId" "text" NOT NULL,
    "securityId" "text",
    "type" "text" NOT NULL,
    "quantity" double precision,
    "price" double precision,
    "fees" double precision DEFAULT 0 NOT NULL,
    "notes" "text",
    "transferToId" "text",
    "transferFromId" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid",
    "plaidInvestmentTransactionId" "text",
    "plaidSubtype" "text",
    "currencyCode" "text",
    CONSTRAINT "check_buy_sell_fields" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text"])) AND ("quantity" IS NOT NULL) AND ("quantity" > (0)::double precision) AND ("price" IS NOT NULL) AND ("price" >= (0)::double precision)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text"])))),
    CONSTRAINT "check_security_required" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"])) AND ("securityId" IS NOT NULL)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"]))))
);


ALTER TABLE "public"."InvestmentTransaction" OWNER TO "postgres";


COMMENT ON COLUMN "public"."InvestmentTransaction"."plaidInvestmentTransactionId" IS 'Unique ID from Plaid for this investment transaction. Used for deduplication and tracking.';



COMMENT ON COLUMN "public"."InvestmentTransaction"."plaidSubtype" IS 'Subtype from Plaid (e.g., "dividend qualified", "dividend non-qualified"). Only set for transactions imported from Plaid.';



COMMENT ON COLUMN "public"."InvestmentTransaction"."currencyCode" IS 'ISO currency code (e.g., USD, CAD). Used for multi-currency support.';



COMMENT ON CONSTRAINT "check_buy_sell_fields" ON "public"."InvestmentTransaction" IS 'Garante que transações do tipo buy e sell tenham quantity e price válidos';



COMMENT ON CONSTRAINT "check_security_required" ON "public"."InvestmentTransaction" IS 'Garante que transações do tipo buy, sell, dividend e interest tenham securityId';



CREATE TABLE IF NOT EXISTS "public"."Order" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
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
    "gtdDate" timestamp with time zone,
    "state" "text" NOT NULL,
    "clientReasonStr" "text",
    "chainId" bigint NOT NULL,
    "creationTime" timestamp with time zone NOT NULL,
    "updateTime" timestamp with time zone NOT NULL,
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
    "lastSyncedAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid"
);


ALTER TABLE "public"."Order" OWNER TO "postgres";


COMMENT ON TABLE "public"."Order" IS 'Stores orders for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."PlaidConnection" (
    "id" "text" NOT NULL,
    "userId" "uuid" NOT NULL,
    "itemId" "text" NOT NULL,
    "accessToken" "text" NOT NULL,
    "institutionId" "text",
    "institutionName" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "errorCode" "text",
    "errorMessage" "text",
    "institutionLogo" "text",
    "transactionsCursor" "text"
);


ALTER TABLE "public"."PlaidConnection" OWNER TO "postgres";


COMMENT ON COLUMN "public"."PlaidConnection"."transactionsCursor" IS 'Cursor for Plaid transactions/sync API pagination. Used to track position in transaction sync.';



CREATE TABLE IF NOT EXISTS "public"."PlaidLiability" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "liabilityType" "text" NOT NULL,
    "apr" double precision,
    "interestRate" double precision,
    "minimumPayment" double precision,
    "lastPaymentAmount" double precision,
    "lastPaymentDate" timestamp with time zone,
    "nextPaymentDueDate" timestamp with time zone,
    "lastStatementBalance" double precision,
    "lastStatementDate" timestamp with time zone,
    "creditLimit" double precision,
    "currentBalance" double precision,
    "availableCredit" double precision,
    "plaidAccountId" "text",
    "plaidItemId" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid",
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
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL
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
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "toAccountId" "text",
    "subscriptionId" "text",
    "householdId" "uuid",
    "deletedAt" timestamp with time zone,
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



COMMENT ON COLUMN "public"."PlannedPayment"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



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
    "lastUpdatedAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid"
);


ALTER TABLE "public"."Position" OWNER TO "postgres";


COMMENT ON TABLE "public"."Position" IS 'Stores current positions (holdings) for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."PromoCode" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "discountType" "text" NOT NULL,
    "discountValue" numeric(10,2) NOT NULL,
    "duration" "text" NOT NULL,
    "durationInMonths" integer,
    "maxRedemptions" integer,
    "expiresAt" timestamp with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "stripeCouponId" "text",
    "planIds" "jsonb" DEFAULT '[]'::"jsonb",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "PromoCode_discountType_check" CHECK (("discountType" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "PromoCode_duration_check" CHECK (("duration" = ANY (ARRAY['once'::"text", 'forever'::"text", 'repeating'::"text"])))
);


ALTER TABLE "public"."PromoCode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Security" (
    "id" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "sector" "text",
    "closePrice" numeric(15,4),
    "closePriceAsOf" timestamp with time zone,
    "currencyCode" "text"
);


ALTER TABLE "public"."Security" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Security"."sector" IS 'Industry sector for the security (e.g., Technology, Finance, Healthcare, Consumer, Energy, etc.)';



COMMENT ON COLUMN "public"."Security"."closePrice" IS 'Most recent closing price from Plaid.';



COMMENT ON COLUMN "public"."Security"."closePriceAsOf" IS 'Date when the closePrice was last updated from Plaid.';



COMMENT ON COLUMN "public"."Security"."currencyCode" IS 'ISO currency code for the security (e.g., USD, CAD).';



CREATE TABLE IF NOT EXISTS "public"."SecurityPrice" (
    "id" "text" NOT NULL,
    "securityId" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "price" double precision NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."SecurityPrice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."SimpleInvestmentEntry" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "type" "text" NOT NULL,
    "amount" double precision NOT NULL,
    "description" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid"
);


ALTER TABLE "public"."SimpleInvestmentEntry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Subcategory" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
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
    "currentPeriodStart" timestamp with time zone,
    "currentPeriodEnd" timestamp with time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trialStartDate" timestamp with time zone,
    "trialEndDate" timestamp with time zone,
    "gracePeriodDays" integer DEFAULT 7,
    "lastUpgradePrompt" timestamp with time zone,
    "expiredAt" timestamp with time zone,
    "pendingEmail" "text",
    "householdId" "uuid",
    CONSTRAINT "Subscription_userId_or_householdId_check" CHECK ((("userId" IS NOT NULL) OR ("householdId" IS NOT NULL)))
);


ALTER TABLE "public"."Subscription" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Subscription"."userId" IS 'User ID. NULL if subscription is pending user signup.';



COMMENT ON COLUMN "public"."Subscription"."trialStartDate" IS 'Start date of the trial period';



COMMENT ON COLUMN "public"."Subscription"."trialEndDate" IS 'End date of the trial period. After this date, user must subscribe to continue.';



COMMENT ON COLUMN "public"."Subscription"."gracePeriodDays" IS 'Number of days of grace period after trial expires (default: 7)';



COMMENT ON COLUMN "public"."Subscription"."lastUpgradePrompt" IS 'Timestamp of last upgrade prompt shown to user';



COMMENT ON COLUMN "public"."Subscription"."expiredAt" IS 'Timestamp when subscription/trial expired';



COMMENT ON COLUMN "public"."Subscription"."pendingEmail" IS 'Email address for pending subscriptions waiting to be linked to a user account.';



CREATE TABLE IF NOT EXISTS "public"."SubscriptionService" (
    "id" "text" NOT NULL,
    "categoryId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo" "text",
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."SubscriptionService" OWNER TO "postgres";


COMMENT ON TABLE "public"."SubscriptionService" IS 'Individual subscription services (e.g., ChatGPT Team, Netflix, Spotify)';



COMMENT ON COLUMN "public"."SubscriptionService"."categoryId" IS 'Category this service belongs to';



COMMENT ON COLUMN "public"."SubscriptionService"."name" IS 'Service name (e.g., "ChatGPT Team", "Netflix")';



COMMENT ON COLUMN "public"."SubscriptionService"."logo" IS 'URL or path to the logo/image for this service';



COMMENT ON COLUMN "public"."SubscriptionService"."displayOrder" IS 'Order for displaying services within category';



COMMENT ON COLUMN "public"."SubscriptionService"."isActive" IS 'Whether the service is active and visible to users';



CREATE TABLE IF NOT EXISTS "public"."SubscriptionServiceCategory" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."SubscriptionServiceCategory" OWNER TO "postgres";


COMMENT ON TABLE "public"."SubscriptionServiceCategory" IS 'Categories for subscription services (e.g., AI tools, Streaming Video, etc.)';



COMMENT ON COLUMN "public"."SubscriptionServiceCategory"."name" IS 'Category name (e.g., "AI tools", "Streaming Video")';



COMMENT ON COLUMN "public"."SubscriptionServiceCategory"."displayOrder" IS 'Order for displaying categories in UI';



COMMENT ON COLUMN "public"."SubscriptionServiceCategory"."isActive" IS 'Whether the category is active and visible to users';



CREATE TABLE IF NOT EXISTS "public"."SubscriptionServicePlan" (
    "id" "text" NOT NULL,
    "serviceId" "text" NOT NULL,
    "planName" "text" NOT NULL,
    "price" numeric(15,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "SubscriptionServicePlan_currency_check" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'CAD'::"text"]))),
    CONSTRAINT "SubscriptionServicePlan_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."SubscriptionServicePlan" OWNER TO "postgres";


COMMENT ON TABLE "public"."SubscriptionServicePlan" IS 'Pricing plans for subscription services (e.g., Basic, Pro, Enterprise)';



COMMENT ON COLUMN "public"."SubscriptionServicePlan"."serviceId" IS 'Service this plan belongs to';



COMMENT ON COLUMN "public"."SubscriptionServicePlan"."planName" IS 'Plan name (e.g., "Basic", "Pro", "Enterprise")';



COMMENT ON COLUMN "public"."SubscriptionServicePlan"."price" IS 'Price of the plan';



COMMENT ON COLUMN "public"."SubscriptionServicePlan"."currency" IS 'Currency code: USD or CAD';



COMMENT ON COLUMN "public"."SubscriptionServicePlan"."isActive" IS 'Whether the plan is active and visible';



CREATE TABLE IF NOT EXISTS "public"."SystemSettings" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "maintenanceMode" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "seoSettings" "jsonb"
);


ALTER TABLE "public"."SystemSettings" OWNER TO "postgres";


COMMENT ON TABLE "public"."SystemSettings" IS 'Stores system-wide configuration settings like maintenance mode. Only super_admin can read/write.';



COMMENT ON COLUMN "public"."SystemSettings"."maintenanceMode" IS 'When true, only super_admin users can access the platform. All other users see maintenance page.';



COMMENT ON COLUMN "public"."SystemSettings"."seoSettings" IS 'Stores SEO configuration settings including metadata, Open Graph, Twitter cards, and structured data.';



CREATE TABLE IF NOT EXISTS "public"."Transaction" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "categoryId" "text",
    "subcategoryId" "text",
    "description" "text",
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "transferToId" "text",
    "transferFromId" "text",
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "userId" "uuid" NOT NULL,
    "suggestedCategoryId" "text",
    "suggestedSubcategoryId" "text",
    "plaidMetadata" "jsonb",
    "expenseType" "text",
    "description_search" "text",
    "date" "date" NOT NULL,
    "householdId" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "receiptUrl" "text",
    "deletedAt" timestamp with time zone,
    CONSTRAINT "transaction_date_valid" CHECK ((("date" >= '1900-01-01'::"date") AND ("date" <= (CURRENT_DATE + '1 year'::interval))))
);


ALTER TABLE "public"."Transaction" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Transaction"."isRecurring" IS 'Whether this transaction is part of a recurring series. Renamed from "recurring" for consistency with other boolean columns.';



COMMENT ON COLUMN "public"."Transaction"."expenseType" IS 'Indicates if expense is fixed or variable. Only applies to expense transactions. Values: "fixed" or "variable"';



COMMENT ON COLUMN "public"."Transaction"."description_search" IS 'Normalized description for search and category learning. Lowercase, no special characters, normalized whitespace.';



COMMENT ON COLUMN "public"."Transaction"."date" IS 'Transaction date (date only, no time component). Changed from timestamp to date to avoid timezone issues.';



COMMENT ON COLUMN "public"."Transaction"."amount" IS 'Transaction amount as numeric value. No longer encrypted per regulatory compliance (amount is not PII).';



COMMENT ON COLUMN "public"."Transaction"."receiptUrl" IS 'URL to the receipt file stored in Supabase Storage receipts bucket';



COMMENT ON COLUMN "public"."Transaction"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



COMMENT ON CONSTRAINT "transaction_date_valid" ON "public"."Transaction" IS 'Valida que a data da transação está em um range válido (1900 até 1 ano no futuro)';



CREATE TABLE IF NOT EXISTS "public"."TransactionSync" (
    "id" "text" NOT NULL,
    "accountId" "text" NOT NULL,
    "plaidTransactionId" "text" NOT NULL,
    "transactionId" "text",
    "syncDate" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "status" "text" DEFAULT 'synced'::"text",
    "householdId" "uuid"
);


ALTER TABLE "public"."TransactionSync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatarUrl" "text",
    "createdAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "phoneNumber" "text",
    "dateOfBirth" "date",
    "effectivePlanId" "text",
    "effectiveSubscriptionStatus" "text",
    "effectiveSubscriptionId" "text",
    "subscriptionUpdatedAt" timestamp with time zone,
    "isBlocked" boolean DEFAULT false NOT NULL,
    "temporaryExpectedIncome" "text",
    "temporaryExpectedIncomeAmount" numeric(12,2)
);


ALTER TABLE "public"."User" OWNER TO "postgres";


COMMENT ON TABLE "public"."User" IS 'User accounts are deleted immediately upon request. No grace period or soft deletion.';



COMMENT ON COLUMN "public"."User"."effectivePlanId" IS 'Cached plan ID - for household members, this is the owner''s plan. For owners, this is their own plan.';



COMMENT ON COLUMN "public"."User"."effectiveSubscriptionStatus" IS 'Cached subscription status - active, trialing, cancelled, etc.';



COMMENT ON COLUMN "public"."User"."effectiveSubscriptionId" IS 'Cached subscription ID for reference';



COMMENT ON COLUMN "public"."User"."subscriptionUpdatedAt" IS 'Timestamp when subscription cache was last updated';



COMMENT ON COLUMN "public"."User"."isBlocked" IS 'When true, user is blocked from accessing the system and cannot log in. Subscription is paused until unblocked.';



COMMENT ON COLUMN "public"."User"."temporaryExpectedIncome" IS 'Temporary storage for expected income range during onboarding, before household is created. Values: "0-50k", "50k-100k", "100k-150k", "150k-250k", "250k+", or NULL.';



COMMENT ON COLUMN "public"."User"."temporaryExpectedIncomeAmount" IS 'Temporary storage for exact expected income amount (in dollars) during onboarding, before household is created. Used when user provides a custom value instead of selecting a range.';



CREATE TABLE IF NOT EXISTS "public"."UserActiveHousehold" (
    "userId" "uuid" NOT NULL,
    "householdId" "uuid" NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."UserActiveHousehold" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserActiveHousehold" IS 'Tracks which household is currently active for each user';



COMMENT ON COLUMN "public"."UserActiveHousehold"."householdId" IS 'The currently active household for this user';



CREATE TABLE IF NOT EXISTS "public"."UserBlockHistory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "reason" "text",
    "blockedBy" "uuid" NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "UserBlockHistory_action_check" CHECK (("action" = ANY (ARRAY['block'::"text", 'unblock'::"text"])))
);


ALTER TABLE "public"."UserBlockHistory" OWNER TO "postgres";


COMMENT ON TABLE "public"."UserBlockHistory" IS 'Tracks history of user blocks and unblocks with reasons. RLS enabled to enforce access control policies.';



COMMENT ON COLUMN "public"."UserBlockHistory"."action" IS 'Action taken: block or unblock';



COMMENT ON COLUMN "public"."UserBlockHistory"."reason" IS 'Reason/comment for the action';



COMMENT ON COLUMN "public"."UserBlockHistory"."blockedBy" IS 'User ID of the admin who performed the action';



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
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "householdId" "uuid",
    "planId" "text",
    "deletedAt" timestamp with time zone,
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



COMMENT ON COLUMN "public"."UserServiceSubscription"."planId" IS 'ID of the selected plan from SubscriptionServicePlan (optional)';



COMMENT ON COLUMN "public"."UserServiceSubscription"."deletedAt" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_log_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log" IS 'Audit log for tracking changes to critical tables. Only admins can read.';



COMMENT ON COLUMN "public"."audit_log"."table_name" IS 'Name of the table that was modified';



COMMENT ON COLUMN "public"."audit_log"."record_id" IS 'ID of the record that was modified';



COMMENT ON COLUMN "public"."audit_log"."action" IS 'Action performed: INSERT, UPDATE, or DELETE';



COMMENT ON COLUMN "public"."audit_log"."user_id" IS 'User who performed the action (from auth.uid())';



COMMENT ON COLUMN "public"."audit_log"."old_data" IS 'Previous data (for UPDATE and DELETE)';



COMMENT ON COLUMN "public"."audit_log"."new_data" IS 'New data (for INSERT and UPDATE)';



COMMENT ON COLUMN "public"."audit_log"."created_at" IS 'When the action was performed';



CREATE TABLE IF NOT EXISTS "public"."category_learning" (
    "user_id" "uuid" NOT NULL,
    "normalized_description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "subcategory_id" "text",
    "description_and_amount_count" integer DEFAULT 0 NOT NULL,
    "description_only_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "category_learning_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."category_learning" OWNER TO "postgres";


COMMENT ON TABLE "public"."category_learning" IS 'Aggregated category learning data for fast suggestions. Replaces scanning 12 months of transactions.';



COMMENT ON COLUMN "public"."category_learning"."normalized_description" IS 'Normalized description (lowercase, no special chars, normalized whitespace). Must match normalizeDescription() function.';



COMMENT ON COLUMN "public"."category_learning"."description_and_amount_count" IS 'Number of times this description+amount combination was used with this category.';



COMMENT ON COLUMN "public"."category_learning"."description_only_count" IS 'Number of times this description (any amount) was used with this category.';



COMMENT ON COLUMN "public"."category_learning"."last_used_at" IS 'Last time this category was used for this description. Used to prioritize recent suggestions.';



CREATE TABLE IF NOT EXISTS "public"."error_codes" (
    "code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "user_message" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."error_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."error_codes" IS 'Standard error codes for database functions. Maps internal error codes to user-friendly messages.';



CREATE TABLE IF NOT EXISTS "public"."user_monthly_usage" (
    "user_id" "uuid" NOT NULL,
    "month_date" "date" NOT NULL,
    "transactions_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."user_monthly_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_monthly_usage" IS 'Aggregated monthly transaction counts per user. Used for fast limit checking without COUNT(*) queries.';



COMMENT ON COLUMN "public"."user_monthly_usage"."month_date" IS 'First day of the month (e.g., 2025-11-01). Used instead of text YYYY-MM for better ergonomics.';



COMMENT ON COLUMN "public"."user_monthly_usage"."transactions_count" IS 'Number of transactions for this user in this month. For transfers, counts as 1 (not 2) for new transactions.';



CREATE OR REPLACE VIEW "public"."vw_transactions_for_reports" WITH ("security_invoker"='true') AS
 SELECT "id",
    "date",
    "type",
    "amount",
    "accountId",
    "userId",
    "categoryId",
    "subcategoryId",
    "description",
    "description_search",
    "isRecurring",
    "expenseType",
    "createdAt",
    "updatedAt",
    "transferToId",
    "transferFromId",
    "tags",
    "suggestedCategoryId",
    "suggestedSubcategoryId",
    "plaidMetadata",
    "householdId"
   FROM "public"."Transaction"
  WHERE (("type" <> 'transfer'::"text") AND (("transferToId" IS NULL) AND ("transferFromId" IS NULL)));


ALTER VIEW "public"."vw_transactions_for_reports" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_transactions_for_reports" IS 'Transactions for reports, excluding transfers. Use this view for income/expense calculations to avoid double-counting transfers. Uses SECURITY INVOKER to ensure RLS policies on Transaction table are properly enforced. Amount is now numeric (no longer encrypted). Updated to use isRecurring instead of recurring.';



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



ALTER TABLE ONLY "public"."Feedback"
    ADD CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Group"
    ADD CONSTRAINT "Group_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Household"
    ADD CONSTRAINT "Household_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ImportJob"
    ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."SecurityPrice"
    ADD CONSTRAINT "SecurityPrice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Security"
    ADD CONSTRAINT "Security_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SubscriptionServiceCategory"
    ADD CONSTRAINT "SubscriptionServiceCategory_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."SubscriptionServiceCategory"
    ADD CONSTRAINT "SubscriptionServiceCategory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SubscriptionServicePlan"
    ADD CONSTRAINT "SubscriptionServicePlan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."SubscriptionServicePlan"
    ADD CONSTRAINT "SubscriptionServicePlan_serviceId_planName_unique" UNIQUE ("serviceId", "planName");



ALTER TABLE ONLY "public"."SubscriptionService"
    ADD CONSTRAINT "SubscriptionService_categoryId_name_unique" UNIQUE ("categoryId", "name");



ALTER TABLE ONLY "public"."SubscriptionService"
    ADD CONSTRAINT "SubscriptionService_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."UserActiveHousehold"
    ADD CONSTRAINT "UserActiveHousehold_pkey" PRIMARY KEY ("userId");



ALTER TABLE ONLY "public"."UserBlockHistory"
    ADD CONSTRAINT "UserBlockHistory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_learning"
    ADD CONSTRAINT "category_learning_pkey" PRIMARY KEY ("user_id", "normalized_description", "type");



ALTER TABLE ONLY "public"."error_codes"
    ADD CONSTRAINT "error_codes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."user_monthly_usage"
    ADD CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_date");



CREATE INDEX "AccountInvestmentValue_accountId_idx" ON "public"."AccountInvestmentValue" USING "btree" ("accountId");



CREATE INDEX "AccountInvestmentValue_householdId_idx" ON "public"."AccountInvestmentValue" USING "btree" ("householdId");



CREATE INDEX "AccountOwner_accountId_idx" ON "public"."AccountOwner" USING "btree" ("accountId");



CREATE INDEX "AccountOwner_ownerId_idx" ON "public"."AccountOwner" USING "btree" ("ownerId");



CREATE INDEX "Account_householdId_idx" ON "public"."Account" USING "btree" ("householdId");



CREATE INDEX "Account_plaidAccountId_idx" ON "public"."Account" USING "btree" ("plaidAccountId") WHERE ("plaidAccountId" IS NOT NULL);



COMMENT ON INDEX "public"."Account_plaidAccountId_idx" IS 'Performance index on plaidAccountId for faster lookups during transaction sync operations. Partial index (only when not null).';



CREATE UNIQUE INDEX "Account_plaidAccountId_unique" ON "public"."Account" USING "btree" ("plaidAccountId") WHERE ("plaidAccountId" IS NOT NULL);



COMMENT ON INDEX "public"."Account_plaidAccountId_unique" IS 'Unique index on plaidAccountId to prevent duplicate account imports from Plaid. Partial index (only when not null) to allow manual accounts.';



CREATE INDEX "Account_plaidItemId_idx" ON "public"."Account" USING "btree" ("plaidItemId");



CREATE INDEX "Account_type_idx" ON "public"."Account" USING "btree" ("type");



CREATE INDEX "Account_userId_idx" ON "public"."Account" USING "btree" ("userId");



CREATE UNIQUE INDEX "BudgetCategory_budgetId_categoryId_key" ON "public"."BudgetCategory" USING "btree" ("budgetId", "categoryId");



CREATE INDEX "BudgetCategory_budgetId_idx" ON "public"."BudgetCategory" USING "btree" ("budgetId");



CREATE INDEX "BudgetCategory_categoryId_idx" ON "public"."BudgetCategory" USING "btree" ("categoryId");



CREATE INDEX "Budget_categoryId_period_idx" ON "public"."Budget" USING "btree" ("categoryId", "period");



CREATE INDEX "Budget_groupId_idx" ON "public"."Budget" USING "btree" ("groupId") WHERE ("groupId" IS NOT NULL);



CREATE INDEX "Budget_householdId_idx" ON "public"."Budget" USING "btree" ("householdId");



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



CREATE INDEX "Debt_householdId_idx" ON "public"."Debt" USING "btree" ("householdId");



CREATE INDEX "Debt_userId_idx" ON "public"."Debt" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Execution_accountId_idx" ON "public"."Execution" USING "btree" ("accountId");



CREATE INDEX "Execution_householdId_idx" ON "public"."Execution" USING "btree" ("householdId");



CREATE INDEX "Feedback_createdAt_idx" ON "public"."Feedback" USING "btree" ("createdAt" DESC);



CREATE INDEX "Feedback_userId_idx" ON "public"."Feedback" USING "btree" ("userId");



CREATE INDEX "Goal_accountId_idx" ON "public"."Goal" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "Goal_householdId_idx" ON "public"."Goal" USING "btree" ("householdId");



CREATE INDEX "Goal_userId_idx" ON "public"."Goal" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Group_name_idx" ON "public"."Group" USING "btree" ("name");



CREATE UNIQUE INDEX "Group_name_key_system" ON "public"."Group" USING "btree" ("name") WHERE ("userId" IS NULL);



CREATE UNIQUE INDEX "Group_name_userId_key" ON "public"."Group" USING "btree" ("name", "userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "Group_userId_idx" ON "public"."Group" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "HouseholdMember_email_idx" ON "public"."HouseholdMember" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "public"."HouseholdMember" USING "btree" ("householdId", "userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "HouseholdMember_householdId_userId_status_idx" ON "public"."HouseholdMember" USING "btree" ("householdId", "userId", "status");



CREATE UNIQUE INDEX "HouseholdMember_invitationToken_idx" ON "public"."HouseholdMember" USING "btree" ("invitationToken") WHERE ("invitationToken" IS NOT NULL);



CREATE INDEX "HouseholdMember_invitedBy_idx" ON "public"."HouseholdMember" USING "btree" ("invitedBy");



CREATE INDEX "HouseholdMember_userId_status_idx" ON "public"."HouseholdMember" USING "btree" ("userId", "status");



CREATE INDEX "Household_createdBy_idx" ON "public"."Household" USING "btree" ("createdBy");



CREATE INDEX "Household_type_createdBy_idx" ON "public"."Household" USING "btree" ("type", "createdBy");



CREATE INDEX "InvestmentAccount_accountId_idx" ON "public"."InvestmentAccount" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "InvestmentAccount_householdId_idx" ON "public"."InvestmentAccount" USING "btree" ("householdId");



CREATE INDEX "InvestmentAccount_userId_idx" ON "public"."InvestmentAccount" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "InvestmentTransaction_accountId_idx" ON "public"."InvestmentTransaction" USING "btree" ("accountId");



CREATE INDEX "InvestmentTransaction_date_idx" ON "public"."InvestmentTransaction" USING "btree" ("date");



CREATE INDEX "InvestmentTransaction_householdId_idx" ON "public"."InvestmentTransaction" USING "btree" ("householdId");



CREATE INDEX "InvestmentTransaction_plaidInvestmentTransactionId_idx" ON "public"."InvestmentTransaction" USING "btree" ("plaidInvestmentTransactionId");



CREATE UNIQUE INDEX "InvestmentTransaction_plaidInvestmentTransactionId_unique" ON "public"."InvestmentTransaction" USING "btree" ("plaidInvestmentTransactionId") WHERE ("plaidInvestmentTransactionId" IS NOT NULL);



CREATE INDEX "InvestmentTransaction_securityId_idx" ON "public"."InvestmentTransaction" USING "btree" ("securityId");



CREATE INDEX "Order_accountId_idx" ON "public"."Order" USING "btree" ("accountId");



CREATE INDEX "Order_householdId_idx" ON "public"."Order" USING "btree" ("householdId");



CREATE INDEX "PlaidConnection_itemId_idx" ON "public"."PlaidConnection" USING "btree" ("itemId");



CREATE INDEX "PlaidConnection_userId_idx" ON "public"."PlaidConnection" USING "btree" ("userId");



CREATE INDEX "PlaidLiability_accountId_idx" ON "public"."PlaidLiability" USING "btree" ("accountId");



CREATE INDEX "PlaidLiability_householdId_idx" ON "public"."PlaidLiability" USING "btree" ("householdId");



CREATE INDEX "PlannedPayment_accountId_idx" ON "public"."PlannedPayment" USING "btree" ("accountId");



CREATE INDEX "PlannedPayment_categoryId_idx" ON "public"."PlannedPayment" USING "btree" ("categoryId");



CREATE INDEX "PlannedPayment_debtId_idx" ON "public"."PlannedPayment" USING "btree" ("debtId") WHERE ("debtId" IS NOT NULL);



CREATE INDEX "PlannedPayment_householdId_idx" ON "public"."PlannedPayment" USING "btree" ("householdId");



CREATE INDEX "PlannedPayment_linkedTransactionId_idx" ON "public"."PlannedPayment" USING "btree" ("linkedTransactionId") WHERE ("linkedTransactionId" IS NOT NULL);



CREATE INDEX "PlannedPayment_subcategoryId_idx" ON "public"."PlannedPayment" USING "btree" ("subcategoryId");



CREATE INDEX "PlannedPayment_subscriptionId_idx" ON "public"."PlannedPayment" USING "btree" ("subscriptionId") WHERE ("subscriptionId" IS NOT NULL);



CREATE INDEX "PlannedPayment_toAccountId_idx" ON "public"."PlannedPayment" USING "btree" ("toAccountId") WHERE ("toAccountId" IS NOT NULL);



CREATE INDEX "Position_accountId_securityId_idx" ON "public"."Position" USING "btree" ("accountId", "securityId");



CREATE INDEX "Position_householdId_idx" ON "public"."Position" USING "btree" ("householdId");



CREATE INDEX "Position_securityId_idx" ON "public"."Position" USING "btree" ("securityId");



CREATE INDEX "SecurityPrice_securityId_date_idx" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE UNIQUE INDEX "SecurityPrice_securityId_date_key" ON "public"."SecurityPrice" USING "btree" ("securityId", "date");



CREATE INDEX "Security_symbol_idx" ON "public"."Security" USING "btree" ("symbol");



CREATE UNIQUE INDEX "Security_symbol_key" ON "public"."Security" USING "btree" ("symbol");



CREATE INDEX "SimpleInvestmentEntry_accountId_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("accountId");



CREATE INDEX "SimpleInvestmentEntry_date_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("date");



CREATE INDEX "SimpleInvestmentEntry_householdId_idx" ON "public"."SimpleInvestmentEntry" USING "btree" ("householdId");



CREATE INDEX "Subcategory_categoryId_idx" ON "public"."Subcategory" USING "btree" ("categoryId");



CREATE INDEX "Subcategory_name_idx" ON "public"."Subcategory" USING "btree" ("name");



CREATE INDEX "Subcategory_userId_idx" ON "public"."Subcategory" USING "btree" ("userId");



CREATE INDEX "Subscription_householdId_idx" ON "public"."Subscription" USING "btree" ("householdId");



CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription" USING "btree" ("planId") WHERE ("planId" IS NOT NULL);



CREATE INDEX "Subscription_status_idx" ON "public"."Subscription" USING "btree" ("status");



CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription" USING "btree" ("userId");



CREATE INDEX "TransactionSync_accountId_idx" ON "public"."TransactionSync" USING "btree" ("accountId");



CREATE INDEX "TransactionSync_accountId_plaidTransactionId_idx" ON "public"."TransactionSync" USING "btree" ("accountId", "plaidTransactionId");



COMMENT ON INDEX "public"."TransactionSync_accountId_plaidTransactionId_idx" IS 'Composite index for faster lookups of Plaid transactions by account. Improves performance of queries filtering by accountId and plaidTransactionId simultaneously, which is common during transaction sync operations when processing removed transactions.';



CREATE INDEX "TransactionSync_householdId_idx" ON "public"."TransactionSync" USING "btree" ("householdId");



CREATE INDEX "TransactionSync_transactionId_idx" ON "public"."TransactionSync" USING "btree" ("transactionId") WHERE ("transactionId" IS NOT NULL);



CREATE INDEX "Transaction_accountId_idx" ON "public"."Transaction" USING "btree" ("accountId");



CREATE INDEX "Transaction_amount_idx" ON "public"."Transaction" USING "btree" ("amount");



CREATE INDEX "Transaction_householdId_idx" ON "public"."Transaction" USING "btree" ("householdId");



CREATE INDEX "Transaction_recurring_idx" ON "public"."Transaction" USING "btree" ("isRecurring");



CREATE INDEX "Transaction_subcategoryId_idx" ON "public"."Transaction" USING "btree" ("subcategoryId") WHERE ("subcategoryId" IS NOT NULL);



CREATE INDEX "Transaction_suggestedCategoryId_idx" ON "public"."Transaction" USING "btree" ("suggestedCategoryId") WHERE ("suggestedCategoryId" IS NOT NULL);



CREATE INDEX "Transaction_suggestedSubcategoryId_idx" ON "public"."Transaction" USING "btree" ("suggestedSubcategoryId") WHERE ("suggestedSubcategoryId" IS NOT NULL);



CREATE INDEX "Transaction_type_idx" ON "public"."Transaction" USING "btree" ("type");



CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction" USING "btree" ("userId");



CREATE INDEX "UserActiveHousehold_householdId_idx" ON "public"."UserActiveHousehold" USING "btree" ("householdId");



CREATE INDEX "UserBlockHistory_blockedBy_idx" ON "public"."UserBlockHistory" USING "btree" ("blockedBy");



CREATE INDEX "UserBlockHistory_createdAt_idx" ON "public"."UserBlockHistory" USING "btree" ("createdAt" DESC);



CREATE INDEX "UserBlockHistory_userId_idx" ON "public"."UserBlockHistory" USING "btree" ("userId");



CREATE INDEX "UserServiceSubscription_householdId_idx" ON "public"."UserServiceSubscription" USING "btree" ("householdId");



CREATE INDEX "UserServiceSubscription_planId_idx" ON "public"."UserServiceSubscription" USING "btree" ("planId") WHERE ("planId" IS NOT NULL);



CREATE INDEX "User_role_idx" ON "public"."User" USING "btree" ("role");



CREATE INDEX "category_learning_category_id_fkey_idx" ON "public"."category_learning" USING "btree" ("category_id");



CREATE INDEX "category_learning_subcategory_id_fkey_idx" ON "public"."category_learning" USING "btree" ("subcategory_id");



CREATE INDEX "category_learning_user_type_desc_idx" ON "public"."category_learning" USING "btree" ("user_id", "type", "normalized_description");



CREATE INDEX "idx_account_deleted_at" ON "public"."Account" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_account_household" ON "public"."Account" USING "btree" ("householdId") WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_account_household" IS 'Index for querying accounts by household.';



CREATE INDEX "idx_account_isconnected" ON "public"."Account" USING "btree" ("isConnected") WHERE ("isConnected" = true);



CREATE INDEX "idx_account_owner_account" ON "public"."AccountOwner" USING "btree" ("accountId") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_account_owner_deleted_at" ON "public"."AccountOwner" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_account_owner_owner" ON "public"."AccountOwner" USING "btree" ("ownerId") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_account_user_type" ON "public"."Account" USING "btree" ("userId", "type") WHERE ("type" IS NOT NULL);



CREATE INDEX "idx_account_user_updated" ON "public"."Account" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_account_userid_type" ON "public"."Account" USING "btree" ("userId", "type") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_accountowner_accountid" ON "public"."AccountOwner" USING "btree" ("accountId");



CREATE INDEX "idx_accountowner_ownerid" ON "public"."AccountOwner" USING "btree" ("ownerId");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_table_record" ON "public"."audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_budget_category" ON "public"."Budget" USING "btree" ("categoryId") WHERE ("categoryId" IS NOT NULL);



CREATE INDEX "idx_budget_deleted_at" ON "public"."Budget" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_budget_household_period" ON "public"."Budget" USING "btree" ("householdId", "period" DESC) WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_budget_household_period" IS 'Composite index for querying budgets by household and period.';



CREATE INDEX "idx_budget_period_categoryid" ON "public"."Budget" USING "btree" ("period", "categoryId");



CREATE INDEX "idx_budget_user_period" ON "public"."Budget" USING "btree" ("userId", "period" DESC) WHERE ("period" IS NOT NULL);



CREATE INDEX "idx_budget_user_updated" ON "public"."Budget" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_category_group" ON "public"."Category" USING "btree" ("groupId") WHERE ("groupId" IS NOT NULL);



CREATE INDEX "idx_category_user" ON "public"."Category" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_category_userid_groupid" ON "public"."Category" USING "btree" ("userId", "groupId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_debt_deleted_at" ON "public"."Debt" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_debt_household" ON "public"."Debt" USING "btree" ("householdId") WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_debt_household" IS 'Index for querying debts by household.';



CREATE INDEX "idx_debt_user_updated" ON "public"."Debt" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_goal_deleted_at" ON "public"."Goal" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_goal_household" ON "public"."Goal" USING "btree" ("householdId") WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_goal_household" IS 'Index for querying goals by household.';



CREATE INDEX "idx_goal_user_updated" ON "public"."Goal" USING "btree" ("userId", "updatedAt" DESC, "createdAt" DESC) WHERE ("updatedAt" IS NOT NULL);



CREATE INDEX "idx_household_member_active" ON "public"."HouseholdMember" USING "btree" ("householdId", "userId") WHERE ("status" = 'active'::"text");



COMMENT ON INDEX "public"."idx_household_member_active" IS 'Partial index for active household members. Speeds up membership checks.';



CREATE INDEX "idx_import_job_account" ON "public"."ImportJob" USING "btree" ("accountId") WHERE ("accountId" IS NOT NULL);



CREATE INDEX "idx_import_job_next_retry" ON "public"."ImportJob" USING "btree" ("nextRetryAt") WHERE (("status" = 'failed'::"text") AND ("nextRetryAt" IS NOT NULL));



CREATE INDEX "idx_import_job_status" ON "public"."ImportJob" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_import_job_user_status" ON "public"."ImportJob" USING "btree" ("userId", "status");



CREATE INDEX "idx_investment_account_type" ON "public"."InvestmentAccount" USING "btree" ("userId", "type") WHERE ("type" IS NOT NULL);



CREATE INDEX "idx_investmenttransaction_accountid_date" ON "public"."InvestmentTransaction" USING "btree" ("accountId", "date" DESC);



CREATE INDEX "idx_planned_payment_date_status_user" ON "public"."PlannedPayment" USING "btree" ("date", "status", "userId");



CREATE INDEX "idx_planned_payment_deleted_at" ON "public"."PlannedPayment" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_planned_payment_household" ON "public"."PlannedPayment" USING "btree" ("householdId") WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_planned_payment_household" IS 'Index for querying planned payments by household.';



CREATE INDEX "idx_planned_payment_user_id" ON "public"."PlannedPayment" USING "btree" ("userId");



CREATE INDEX "idx_security_price_date_range" ON "public"."SecurityPrice" USING "btree" ("securityId", "date") WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_subcategory_categoryid" ON "public"."Subcategory" USING "btree" ("categoryId");



CREATE INDEX "idx_subcategory_userid" ON "public"."Subcategory" USING "btree" ("userId") WHERE ("userId" IS NOT NULL);



CREATE INDEX "idx_subscription_service_category_display_order" ON "public"."SubscriptionServiceCategory" USING "btree" ("displayOrder", "isActive");



CREATE INDEX "idx_subscription_service_plan_service_id" ON "public"."SubscriptionServicePlan" USING "btree" ("serviceId", "isActive");



CREATE INDEX "idx_transaction_account_date" ON "public"."Transaction" USING "btree" ("accountId", "date" DESC) WHERE ("deletedAt" IS NULL);



COMMENT ON INDEX "public"."idx_transaction_account_date" IS 'Index for querying transactions by account and date.';



CREATE INDEX "idx_transaction_category_date" ON "public"."Transaction" USING "btree" ("categoryId", "date" DESC) WHERE (("categoryId" IS NOT NULL) AND ("date" IS NOT NULL));



COMMENT ON INDEX "public"."idx_transaction_category_date" IS 'Index for querying transactions by category and date.';



CREATE INDEX "idx_transaction_deleted_at" ON "public"."Transaction" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_transaction_household_date" ON "public"."Transaction" USING "btree" ("householdId", "date" DESC) WHERE (("householdId" IS NOT NULL) AND ("deletedAt" IS NULL));



COMMENT ON INDEX "public"."idx_transaction_household_date" IS 'Composite index for querying transactions by household and date. Most common query pattern.';



CREATE INDEX "idx_transaction_recurring" ON "public"."Transaction" USING "btree" ("isRecurring", "date" DESC) WHERE ("isRecurring" = true);



CREATE INDEX "idx_transaction_user_date" ON "public"."Transaction" USING "btree" ("userId", "date" DESC) WHERE ("date" IS NOT NULL);



COMMENT ON INDEX "public"."idx_transaction_user_date" IS 'Index for backward compatibility with userId-based queries.';



CREATE INDEX "idx_user_active_household_user" ON "public"."UserActiveHousehold" USING "btree" ("userId");



CREATE INDEX "idx_user_service_subscription_account_id" ON "public"."UserServiceSubscription" USING "btree" ("accountId");



CREATE INDEX "idx_user_service_subscription_deleted_at" ON "public"."UserServiceSubscription" USING "btree" ("deletedAt") WHERE ("deletedAt" IS NULL);



CREATE INDEX "idx_user_service_subscription_subcategory_id" ON "public"."UserServiceSubscription" USING "btree" ("subcategoryId") WHERE ("subcategoryId" IS NOT NULL);



CREATE INDEX "idx_user_service_subscription_user_active" ON "public"."UserServiceSubscription" USING "btree" ("userId", "isActive");



CREATE INDEX "user_monthly_usage_user_month_idx" ON "public"."user_monthly_usage" USING "btree" ("user_id", "month_date");



CREATE OR REPLACE TRIGGER "audit_account_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."Account" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_household_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."Household" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_subscription_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."Subscription" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_transaction_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."Transaction" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_user_changes" AFTER DELETE OR UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "prevent_emergency_fund_deletion_trigger" BEFORE DELETE ON "public"."Goal" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_emergency_fund_deletion"();



CREATE OR REPLACE TRIGGER "subscription_cache_update_trigger" AFTER INSERT OR UPDATE OF "userId", "planId", "status" ON "public"."Subscription" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_subscription_cache"();



CREATE OR REPLACE TRIGGER "update_plan_updated_at" BEFORE UPDATE ON "public"."Plan" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_promo_code_updated_at" BEFORE UPDATE ON "public"."PromoCode" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_updated_at" BEFORE UPDATE ON "public"."Subscription" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_updated_at" BEFORE UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_plan_features_trigger" BEFORE INSERT OR UPDATE ON "public"."Plan" FOR EACH ROW EXECUTE FUNCTION "public"."validate_plan_features"();



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AccountInvestmentValue"
    ADD CONSTRAINT "AccountInvestmentValue_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."AccountOwner"
    ADD CONSTRAINT "AccountOwner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "Budget_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "Debt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Debt"
    ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Execution"
    ADD CONSTRAINT "Execution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Execution"
    ADD CONSTRAINT "Execution_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Feedback"
    ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Goal"
    ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Group"
    ADD CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."HouseholdMember"
    ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Household"
    ADD CONSTRAINT "Household_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ImportJob"
    ADD CONSTRAINT "ImportJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ImportJob"
    ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentAccount"
    ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."InvestmentAccount"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Order"
    ADD CONSTRAINT "Order_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlaidConnection"
    ADD CONSTRAINT "PlaidConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlaidLiability"
    ADD CONSTRAINT "PlaidLiability_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlaidLiability"
    ADD CONSTRAINT "PlaidLiability_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "public"."Debt"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PlannedPayment"
    ADD CONSTRAINT "PlannedPayment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "Position_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Position"
    ADD CONSTRAINT "Position_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SecurityPrice"
    ADD CONSTRAINT "SecurityPrice_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "public"."Security"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SimpleInvestmentEntry"
    ADD CONSTRAINT "SimpleInvestmentEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subcategory"
    ADD CONSTRAINT "Subcategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."SubscriptionServicePlan"
    ADD CONSTRAINT "SubscriptionServicePlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."SubscriptionService"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."SubscriptionService"
    ADD CONSTRAINT "SubscriptionService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."SubscriptionServiceCategory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."TransactionSync"
    ADD CONSTRAINT "TransactionSync_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "public"."Category"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_suggestedSubcategoryId_fkey" FOREIGN KEY ("suggestedSubcategoryId") REFERENCES "public"."Subcategory"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserActiveHousehold"
    ADD CONSTRAINT "UserActiveHousehold_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserActiveHousehold"
    ADD CONSTRAINT "UserActiveHousehold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserBlockHistory"
    ADD CONSTRAINT "UserBlockHistory_blockedBy_fkey" FOREIGN KEY ("blockedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."UserBlockHistory"
    ADD CONSTRAINT "UserBlockHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."UserServiceSubscription"
    ADD CONSTRAINT "UserServiceSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionServicePlan"("id") ON DELETE SET NULL;



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


CREATE POLICY "Admins can insert block history" ON "public"."UserBlockHistory" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Admins can insert securities" ON "public"."Security" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Anyone can view securities" ON "public"."Security" FOR SELECT USING (true);



CREATE POLICY "Anyone can view security prices" ON "public"."SecurityPrice" FOR SELECT USING (true);



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


ALTER TABLE "public"."Household" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."HouseholdMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ImportJob" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentAccount" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InvestmentTransaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Owners and admins can remove household members" ON "public"."HouseholdMember" FOR DELETE USING ((("householdId" IN ( SELECT "get_user_admin_household_ids"."household_id"
   FROM "public"."get_user_admin_household_ids"() "get_user_admin_household_ids"("household_id"))) OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Owners and admins can update household members" ON "public"."HouseholdMember" FOR UPDATE USING ((("householdId" IN ( SELECT "get_user_admin_household_ids"."household_id"
   FROM "public"."get_user_admin_household_ids"() "get_user_admin_household_ids"("household_id"))) OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Owners can delete their households" ON "public"."Household" FOR DELETE USING (("createdBy" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Owners can update their households" ON "public"."Household" FOR UPDATE USING (("createdBy" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."PlaidConnection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlaidLiability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Plan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PlannedPayment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Plans are publicly readable" ON "public"."Plan" FOR SELECT USING (true);



ALTER TABLE "public"."Position" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PromoCode" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Public and super admins can access subscription service categor" ON "public"."SubscriptionServiceCategory" USING ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Public and super admins can access subscription service plans" ON "public"."SubscriptionServicePlan" USING ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Public and super admins can access subscription services" ON "public"."SubscriptionService" USING ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK ((("isActive" = true) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Public and super admins can read promo codes" ON "public"."PromoCode" FOR SELECT USING (((("isActive" = true) AND (("expiresAt" IS NULL) OR ("expiresAt" > "now"()))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = "auth"."uid"()) AND ("User"."role" = 'super_admin'::"text"))))));



ALTER TABLE "public"."Security" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SecurityPrice" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Service role and users can delete subscriptions" ON "public"."Subscription" FOR DELETE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."can_access_household_data"("householdId", 'delete'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Service role and users can insert subscriptions" ON "public"."Subscription" FOR INSERT WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Service role and users can update subscriptions" ON "public"."Subscription" FOR UPDATE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Service role can delete plans" ON "public"."Plan" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Service role can insert audit logs" ON "public"."audit_log" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Service role can insert plans" ON "public"."Plan" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Service role can update plans" ON "public"."Plan" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text")) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



ALTER TABLE "public"."SimpleInvestmentEntry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Subcategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Subscription" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SubscriptionService" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SubscriptionServiceCategory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."SubscriptionServicePlan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Super admin can delete promo codes" ON "public"."PromoCode" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can insert promo codes" ON "public"."PromoCode" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admin can update promo codes" ON "public"."PromoCode" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can update contact submissions" ON "public"."ContactForm" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."SystemSettings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "SystemSettings_insert_super_admin" ON "public"."SystemSettings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "SystemSettings_select_super_admin" ON "public"."SystemSettings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



CREATE POLICY "SystemSettings_update_super_admin" ON "public"."SystemSettings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."Transaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."TransactionSync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserActiveHousehold" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserBlockHistory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."UserServiceSubscription" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users and admins can view block history" ON "public"."UserBlockHistory" FOR SELECT USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Users and super admins can delete categories" ON "public"."Category" FOR DELETE USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can delete groups" ON "public"."Group" FOR DELETE USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can delete subcategories" ON "public"."Subcategory" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = ( SELECT "auth"."uid"() AS "uid")))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can insert categories" ON "public"."Category" FOR INSERT WITH CHECK ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can insert groups" ON "public"."Group" FOR INSERT WITH CHECK ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can insert subcategories" ON "public"."Subcategory" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = ( SELECT "auth"."uid"() AS "uid")))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can update categories" ON "public"."Category" FOR UPDATE USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can update groups" ON "public"."Group" FOR UPDATE USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can update subcategories" ON "public"."Subcategory" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = ( SELECT "auth"."uid"() AS "uid")))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = ( SELECT "auth"."uid"() AS "uid")))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Users and super admins can view contact submissions" ON "public"."ContactForm" FOR SELECT USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Users and super admins can view feedback submissions" ON "public"."Feedback" FOR SELECT USING ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Users can be added to households" ON "public"."HouseholdMember" FOR INSERT WITH CHECK ((("userId" = ( SELECT "auth"."uid"() AS "uid")) OR ("householdId" IN ( SELECT "get_user_admin_household_ids"."household_id"
   FROM "public"."get_user_admin_household_ids"() "get_user_admin_household_ids"("household_id")))));



CREATE POLICY "Users can create households" ON "public"."Household" FOR INSERT WITH CHECK (("createdBy" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create their own import jobs" ON "public"."ImportJob" FOR INSERT WITH CHECK (("auth"."uid"() = "userId"));



CREATE POLICY "Users can delete account owners" ON "public"."AccountOwner" FOR DELETE USING ((("ownerId" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_account_user_id"("accountId") = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can delete candles for own securities" ON "public"."Candle" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Candle"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete household TransactionSync" ON "public"."TransactionSync" FOR DELETE USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "TransactionSync"."accountId") AND ("a"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can delete household account investment values" ON "public"."AccountInvestmentValue" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "AccountInvestmentValue"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'delete'::"text"))))));



CREATE POLICY "Users can delete household accounts" ON "public"."Account" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"()) OR "public"."can_access_account_via_accountowner"("id") OR "public"."is_current_user_admin"()) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete household budgets" ON "public"."Budget" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete household debts" ON "public"."Debt" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete household executions" ON "public"."Execution" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Execution"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'delete'::"text")))));



COMMENT ON POLICY "Users can delete household executions" ON "public"."Execution" IS 'Allows users to delete Execution records via household access. Replaces redundant "own accounts" policy.';



CREATE POLICY "Users can delete household goals" ON "public"."Goal" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete household investment accounts" ON "public"."InvestmentAccount" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can delete household investment transactions" ON "public"."InvestmentTransaction" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "InvestmentTransaction"."accountId") AND ("a"."type" = 'investment'::"text") AND "public"."can_access_household_data"("a"."householdId", 'delete'::"text"))))));



CREATE POLICY "Users can delete household orders" ON "public"."Order" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Order"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'delete'::"text")))));



COMMENT ON POLICY "Users can delete household orders" ON "public"."Order" IS 'Allows users to delete Order records via household access. Replaces redundant "own accounts" policy.';



CREATE POLICY "Users can delete household planned payments" ON "public"."PlannedPayment" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete household positions" ON "public"."Position" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Position"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'delete'::"text"))))));



CREATE POLICY "Users can delete household service subscriptions" ON "public"."UserServiceSubscription" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can delete household simple investment entries" ON "public"."SimpleInvestmentEntry" FOR DELETE USING (("public"."can_access_household_data"("householdId", 'delete'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "SimpleInvestmentEntry"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'delete'::"text"))))));



CREATE POLICY "Users can delete household transactions" ON "public"."Transaction" FOR DELETE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'delete'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can delete own budget categories" ON "public"."BudgetCategory" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("public"."can_access_household_data"("Budget"."householdId", 'delete'::"text") OR ("Budget"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can delete prices for securities they own" ON "public"."SecurityPrice" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "SecurityPrice"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can delete securities they own" ON "public"."Security" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Security"."id") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can delete their own Plaid connections" ON "public"."PlaidConnection" FOR DELETE USING (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own Plaid liabilities" ON "public"."PlaidLiability" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND (("Account"."userId" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_access_account_via_accountowner"("Account"."id") OR "public"."can_access_household_data"("Account"."householdId", 'delete'::"text"))))));



CREATE POLICY "Users can insert account owners" ON "public"."AccountOwner" FOR INSERT WITH CHECK ((("ownerId" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_account_user_id"("accountId") = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can insert candles for own securities" ON "public"."Candle" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Candle"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert household TransactionSync" ON "public"."TransactionSync" FOR INSERT WITH CHECK ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "TransactionSync"."accountId") AND ("a"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert household account investment values" ON "public"."AccountInvestmentValue" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "AccountInvestmentValue"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can insert household accounts" ON "public"."Account" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert household budgets" ON "public"."Budget" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert household debts" ON "public"."Debt" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert household executions" ON "public"."Execution" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Execution"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text")))));



COMMENT ON POLICY "Users can insert household executions" ON "public"."Execution" IS 'Allows users to insert Execution records via household access. Replaces redundant "own accounts" policy.';



CREATE POLICY "Users can insert household goals" ON "public"."Goal" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert household investment accounts" ON "public"."InvestmentAccount" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can insert household investment transactions" ON "public"."InvestmentTransaction" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "InvestmentTransaction"."accountId") AND ("a"."type" = 'investment'::"text") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can insert household orders" ON "public"."Order" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Order"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text")))));



COMMENT ON POLICY "Users can insert household orders" ON "public"."Order" IS 'Allows users to insert Order records via household access. Replaces redundant "own accounts" policy.';



CREATE POLICY "Users can insert household planned payments" ON "public"."PlannedPayment" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert household positions" ON "public"."Position" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Position"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can insert household service subscriptions" ON "public"."UserServiceSubscription" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can insert household simple investment entries" ON "public"."SimpleInvestmentEntry" FOR INSERT WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "SimpleInvestmentEntry"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can insert household transactions" ON "public"."Transaction" FOR INSERT WITH CHECK (((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can insert own budget categories" ON "public"."BudgetCategory" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("public"."can_access_household_data"("Budget"."householdId", 'write'::"text") OR ("Budget"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert own category learning" ON "public"."category_learning" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own contact submissions" ON "public"."ContactForm" FOR INSERT WITH CHECK (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own feedback submissions" ON "public"."Feedback" FOR INSERT WITH CHECK (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own profile" ON "public"."User" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert prices for securities they own" ON "public"."SecurityPrice" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "SecurityPrice"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can insert their own Plaid connections" ON "public"."PlaidConnection" FOR INSERT WITH CHECK (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own Plaid liabilities" ON "public"."PlaidLiability" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND (("Account"."userId" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_access_account_via_accountowner"("Account"."id") OR "public"."can_access_household_data"("Account"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can manage their active household" ON "public"."UserActiveHousehold" USING (("userId" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update account owners" ON "public"."AccountOwner" FOR UPDATE USING ((("ownerId" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_account_user_id"("accountId") = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can update candles for own securities" ON "public"."Candle" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Candle"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update household TransactionSync" ON "public"."TransactionSync" FOR UPDATE USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "TransactionSync"."accountId") AND ("a"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can update household account investment values" ON "public"."AccountInvestmentValue" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "AccountInvestmentValue"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text")))))) WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "AccountInvestmentValue"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can update household accounts" ON "public"."Account" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"()) OR "public"."can_access_account_via_accountowner"("id") OR "public"."is_current_user_admin"()) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update household budgets" ON "public"."Budget" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update household debts" ON "public"."Debt" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update household executions" ON "public"."Execution" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Execution"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Execution"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text")))));



CREATE POLICY "Users can update household goals" ON "public"."Goal" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update household investment accounts" ON "public"."InvestmentAccount" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can update household investment transactions" ON "public"."InvestmentTransaction" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "InvestmentTransaction"."accountId") AND ("a"."type" = 'investment'::"text") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text")))))) WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "InvestmentTransaction"."accountId") AND ("a"."type" = 'investment'::"text") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can update household orders" ON "public"."Order" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Order"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Order"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text")))));



CREATE POLICY "Users can update household planned payments" ON "public"."PlannedPayment" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update household positions" ON "public"."Position" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Position"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text")))))) WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Position"."accountId") AND "public"."can_access_household_data"("ia"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can update household service subscriptions" ON "public"."UserServiceSubscription" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can update household simple investment entries" ON "public"."SimpleInvestmentEntry" FOR UPDATE USING (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "SimpleInvestmentEntry"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text")))))) WITH CHECK (("public"."can_access_household_data"("householdId", 'write'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "SimpleInvestmentEntry"."accountId") AND "public"."can_access_household_data"("a"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can update household transactions" ON "public"."Transaction" FOR UPDATE USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'write'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can update own budget categories" ON "public"."BudgetCategory" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("public"."can_access_household_data"("Budget"."householdId", 'write'::"text") OR ("Budget"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can update own category learning" ON "public"."category_learning" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile" ON "public"."User" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update prices for securities they own" ON "public"."SecurityPrice" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "SecurityPrice"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can update securities they own" ON "public"."Security" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Security"."id") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."User"
  WHERE (("User"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("User"."role" = 'super_admin'::"text")))) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can update their own Plaid connections" ON "public"."PlaidConnection" FOR UPDATE USING (("userId" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own Plaid liabilities" ON "public"."PlaidLiability" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND (("Account"."userId" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_access_account_via_accountowner"("Account"."id") OR "public"."can_access_household_data"("Account"."householdId", 'write'::"text"))))));



CREATE POLICY "Users can update their own import jobs" ON "public"."ImportJob" FOR UPDATE USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users can view account owners" ON "public"."AccountOwner" FOR SELECT USING (((("ownerId" = "auth"."uid"()) OR ("public"."get_account_user_id"("accountId") = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view candles for own securities" ON "public"."Candle" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."Position" "p"
     JOIN "public"."InvestmentAccount" "ia" ON (("ia"."id" = "p"."accountId")))
  WHERE (("p"."securityId" = "Candle"."securityId") AND ("ia"."userId" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view household Plaid liabilities" ON "public"."PlaidLiability" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Account"
  WHERE (("Account"."id" = "PlaidLiability"."accountId") AND (("Account"."userId" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_access_account_via_accountowner"("Account"."id") OR "public"."can_access_household_data"("Account"."householdId", 'read'::"text"))))));



CREATE POLICY "Users can view household TransactionSync" ON "public"."TransactionSync" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "TransactionSync"."accountId") AND ("a"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view household account investment values" ON "public"."AccountInvestmentValue" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "AccountInvestmentValue"."accountId") AND ("a"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))))))));



CREATE POLICY "Users can view household accounts" ON "public"."Account" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"()) OR "public"."can_access_account_via_accountowner"("id") OR "public"."is_current_user_admin"()) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household budget categories" ON "public"."BudgetCategory" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."Budget"
  WHERE (("Budget"."id" = "BudgetCategory"."budgetId") AND ("public"."can_access_household_data"("Budget"."householdId", 'read'::"text") OR ("Budget"."userId" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view household budgets" ON "public"."Budget" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household debts" ON "public"."Debt" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household executions" ON "public"."Execution" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Execution"."accountId") AND ("ia"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id")))))));



CREATE POLICY "Users can view household goals" ON "public"."Goal" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household investment accounts" ON "public"."InvestmentAccount" FOR SELECT USING (("public"."can_access_household_data"("householdId", 'read'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view household investment transactions" ON "public"."InvestmentTransaction" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "InvestmentTransaction"."accountId") AND ("a"."type" = 'investment'::"text") AND ("a"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))))))));



CREATE POLICY "Users can view household members" ON "public"."HouseholdMember" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_household_ids"."household_id"
   FROM "public"."get_user_household_ids"() "get_user_household_ids"("household_id"))) OR ("userId" = "auth"."uid"())));



CREATE POLICY "Users can view household orders" ON "public"."Order" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Order"."accountId") AND ("ia"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id")))))));



CREATE POLICY "Users can view household planned payments" ON "public"."PlannedPayment" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household positions" ON "public"."Position" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."InvestmentAccount" "ia"
  WHERE (("ia"."id" = "Position"."accountId") AND ("ia"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))))))));



CREATE POLICY "Users can view household service subscriptions" ON "public"."UserServiceSubscription" FOR SELECT USING ((("public"."can_access_household_data"("householdId", 'read'::"text") OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view household simple investment entries" ON "public"."SimpleInvestmentEntry" FOR SELECT USING ((("householdId" IN ( SELECT "get_user_accessible_households"."household_id"
   FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))) OR (EXISTS ( SELECT 1
   FROM "public"."Account" "a"
  WHERE (("a"."id" = "SimpleInvestmentEntry"."accountId") AND ("a"."householdId" IN ( SELECT "get_user_accessible_households"."household_id"
           FROM "public"."get_user_accessible_households"() "get_user_accessible_households"("household_id"))))))));



CREATE POLICY "Users can view household subscriptions" ON "public"."Subscription" FOR SELECT USING (("public"."can_access_household_data"("householdId", 'read'::"text") OR ("userId" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



CREATE POLICY "Users can view household transactions" ON "public"."Transaction" FOR SELECT USING ((((("householdId" IS NOT NULL) AND "public"."can_access_household_data"("householdId", 'read'::"text")) OR ("userId" = "auth"."uid"())) AND ("deletedAt" IS NULL)));



CREATE POLICY "Users can view own and household member profiles" ON "public"."User" FOR SELECT USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ("id" IN ( SELECT "HouseholdMember"."userId"
   FROM "public"."HouseholdMember"
  WHERE (("HouseholdMember"."householdId" IN ( SELECT "get_user_household_ids"."household_id"
           FROM "public"."get_user_household_ids"() "get_user_household_ids"("household_id"))) AND ("HouseholdMember"."status" = 'active'::"text"))))));



CREATE POLICY "Users can view own category learning" ON "public"."category_learning" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own monthly usage" ON "public"."user_monthly_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view system and own categories" ON "public"."Category" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view system and own groups" ON "public"."Group" FOR SELECT USING ((("userId" IS NULL) OR ("userId" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view system and own subcategories" ON "public"."Subcategory" FOR SELECT USING ((("userId" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."Category"
  WHERE (("Category"."id" = "Subcategory"."categoryId") AND (("Category"."userId" IS NULL) OR ("Category"."userId" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Users can view their households" ON "public"."Household" FOR SELECT USING ((("id" IN ( SELECT "get_user_household_ids"."household_id"
   FROM "public"."get_user_household_ids"() "get_user_household_ids"("household_id"))) OR ("createdBy" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can view their own Plaid connections" ON "public"."PlaidConnection" FOR SELECT USING (("userId" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own import jobs" ON "public"."ImportJob" FOR SELECT USING (("auth"."uid"() = "userId"));



CREATE POLICY "Users cannot delete own profile" ON "public"."User" FOR DELETE USING (false);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_learning" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_monthly_usage" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."are_users_in_same_household"("p_user1_id" "uuid", "p_user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_table_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_has_account"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_has_account"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_has_account"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_invitation_email_match"("invitation_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_max_transactions" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_max_transactions" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text", "p_subcategory_id" "text", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_expense_type" "text", "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone, "p_max_transactions" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_max_transactions" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_max_transactions" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_transfer_with_limit"("p_user_id" "uuid", "p_from_account_id" "text", "p_to_account_id" "text", "p_amount" numeric, "p_date" "date", "p_description" "text", "p_description_search" "text", "p_is_recurring" boolean, "p_max_transactions" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_user_id"("p_account_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_user_id"("p_account_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_user_id"("p_account_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_households"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_households"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_households"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_active_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_admin_household_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_admin_household_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_admin_household_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_household_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_household_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_household_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_household_role"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invitation_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invitation_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invitation_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_plan_features"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_plan_features"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_plan_features"() TO "service_role";



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



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."Household" TO "authenticated";
GRANT ALL ON TABLE "public"."Household" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."HouseholdMember" TO "authenticated";
GRANT ALL ON TABLE "public"."HouseholdMember" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ImportJob" TO "authenticated";
GRANT ALL ON TABLE "public"."ImportJob" TO "service_role";



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



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."SubscriptionService" TO "authenticated";
GRANT ALL ON TABLE "public"."SubscriptionService" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."SubscriptionServiceCategory" TO "authenticated";
GRANT ALL ON TABLE "public"."SubscriptionServiceCategory" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."SubscriptionServicePlan" TO "authenticated";
GRANT ALL ON TABLE "public"."SubscriptionServicePlan" TO "service_role";



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



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."UserActiveHousehold" TO "authenticated";
GRANT ALL ON TABLE "public"."UserActiveHousehold" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."UserBlockHistory" TO "authenticated";
GRANT ALL ON TABLE "public"."UserBlockHistory" TO "service_role";



GRANT ALL ON TABLE "public"."UserServiceSubscription" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."UserServiceSubscription" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."category_learning" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."category_learning" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."error_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."error_codes" TO "service_role";



GRANT ALL ON TABLE "public"."user_monthly_usage" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_monthly_usage" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."vw_transactions_for_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_transactions_for_reports" TO "service_role";



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







