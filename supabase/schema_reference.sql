


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
        FROM "public"."household_members" hm1
        JOIN "public"."household_members" hm2 ON hm1."household_id" = hm2."household_id"
        WHERE hm1."user_id" = p_user1_id
          AND hm2."user_id" = p_user2_id
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
    v_table_name TEXT;
    v_record_id TEXT;
    v_user_id UUID;
BEGIN
    -- Get table name from TG_TABLE_NAME
    v_table_name := TG_TABLE_NAME;
    
    -- Get current user ID
    v_user_id := auth.uid();
    
    -- Handle different operations
    IF TG_OP = 'INSERT' THEN
        -- Get record ID from NEW
        v_record_id := COALESCE(
            NEW.id::text, 
            to_jsonb(NEW)->>'id'
        );
        
        -- Log INSERT
        INSERT INTO "public"."audit_logs" (
            "table_name", "record_id", action, "user_id", "new_data"
        ) VALUES (
            v_table_name, v_record_id, 'INSERT', v_user_id, to_jsonb(NEW)
        );
        
        RETURN NEW;
    
    ELSIF TG_OP = 'UPDATE' THEN
        -- Get record ID from NEW (or OLD if NEW doesn't have id)
        v_record_id := COALESCE(
            NEW.id::text, 
            OLD.id::text, 
            to_jsonb(NEW)->>'id', 
            to_jsonb(OLD)->>'id'
        );
        
        -- Only log if data actually changed
        IF OLD IS DISTINCT FROM NEW THEN
            INSERT INTO "public"."audit_logs" (
                "table_name", "record_id", action, "user_id", "old_data", "new_data"
            ) VALUES (
                v_table_name, v_record_id, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW)
            );
        END IF;
        
        RETURN NEW;
    
    ELSIF TG_OP = 'DELETE' THEN
        -- Get record ID from OLD
        v_record_id := COALESCE(
            OLD.id::text, 
            to_jsonb(OLD)->>'id'
        );
        
        -- Log DELETE
        INSERT INTO "public"."audit_logs" (
            "table_name", "record_id", action, "user_id", "old_data"
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



CREATE OR REPLACE FUNCTION "public"."can_access_account"("p_account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_account_user_id uuid;
    v_household_id uuid;
BEGIN
    -- Get current user
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get account info (bypassing RLS)
    SELECT a.user_id, a.household_id
    INTO v_account_user_id, v_household_id
    FROM "public"."accounts" a
    WHERE a.id = p_account_id
    LIMIT 1;
    
    -- If account not found, deny access
    IF v_account_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check direct ownership
    IF v_account_user_id = auth.uid() THEN
        RETURN true;
    END IF;
    
    -- Check household membership (bypassing RLS)
    IF v_household_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1
            FROM "public"."household_members" hm
            WHERE hm."household_id" = v_household_id
              AND hm."user_id" = auth.uid()
              AND hm."status" = 'active'
        );
    END IF;
    
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."can_access_account"("p_account_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_account"("p_account_id" "text") IS 'Checks if current user can access an account. Bypasses RLS to prevent infinite recursion.';



CREATE OR REPLACE FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM "public"."account_owners" ao
        WHERE ao."account_id" = p_account_id
          AND ao."owner_id" = auth.uid()
          AND ao."deleted_at" IS NULL
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
    user_role TEXT;
    user_status TEXT;
BEGIN
    -- SECURITY FIX: Remove NULL bypass - all records must have householdId
    IF p_household_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get user's role and status in this household
    SELECT hm."role", hm."status"
    INTO user_role, user_status
    FROM "public"."household_members" hm
    WHERE hm."household_id" = p_household_id
      AND hm."user_id" = auth.uid();
    
    -- User is not a member of this household
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- User must be active
    IF user_status != 'active' THEN
        RETURN false;
    END IF;
    
    -- Check operation permissions
    IF p_operation = 'read' THEN
        -- All active members can read
        RETURN true;
    ELSIF p_operation = 'write' THEN
        -- Only owners and admins can write
        RETURN user_role IN ('owner', 'admin');
    ELSE
        -- Unknown operation
        RETURN false;
    END IF;
END;
$$;


ALTER FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") IS 'Checks if the current user can access household data with the specified operation (read/write). Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Check if user_id matches (direct ownership)
    IF p_user_id = auth.uid() THEN
        RETURN true;
    END IF;
    
    -- Check if user is a member of the household (bypassing RLS)
    RETURN EXISTS (
        SELECT 1
        FROM "public"."household_members" hm
        WHERE hm."household_id" = p_household_id
          AND hm."user_id" = auth.uid()
          AND hm."status" = 'active'
    );
END;
$$;


ALTER FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") IS 'Checks if current user can access a household_member record. Bypasses RLS to prevent infinite recursion.';



CREATE OR REPLACE FUNCTION "public"."can_access_record"("p_table_name" "text", "p_record_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_household_id UUID;
    v_user_id UUID;
BEGIN
    -- Get householdId and userId from the record
    CASE p_table_name
        WHEN 'accounts' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."accounts"
            WHERE "id" = p_record_id;
        
        WHEN 'transactions' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."transactions"
            WHERE "id" = p_record_id;
        
        WHEN 'budgets' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."budgets"
            WHERE "id" = p_record_id;
        
        WHEN 'goals' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."goals"
            WHERE "id" = p_record_id;
        
        WHEN 'debts' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."debts"
            WHERE "id" = p_record_id;
        
        WHEN 'planned_payments' THEN
            SELECT "household_id", "user_id" INTO v_household_id, v_user_id
            FROM "public"."planned_payments"
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
    SET "search_path" TO ''
    AS $$
DECLARE
  user_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM "public"."users" 
    WHERE "email" = LOWER(p_email)
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
    v_planned_payment RECORD;
    v_transaction_id "text";
    v_user_id "uuid";
    v_household_id "uuid";
BEGIN
    -- Get the planned payment
    SELECT * INTO v_planned_payment
    FROM "public"."planned_payments"
    WHERE "id" = p_planned_payment_id
    AND "user_id" = "auth"."uid"()
    AND "status" = 'scheduled'::"text";
    
    IF NOT FOUND THEN
        PERFORM public.raise_error_with_code('PLANNED_PAYMENT_NOT_FOUND', 'ID: ' || p_planned_payment_id);
    END IF;
    
    -- Check if already has a linked transaction (idempotency)
    IF v_planned_payment."linked_transaction_id" IS NOT NULL THEN
        RETURN v_planned_payment."linked_transaction_id";
    END IF;
    
    v_user_id := v_planned_payment."user_id";
    v_household_id := v_planned_payment."household_id";
    
    -- Generate transaction ID
    v_transaction_id := "gen_random_uuid"()::"text";
    
    -- Create the transaction
    INSERT INTO "public"."transactions" (
        "id",
        "date",
        "type",
        "amount",
        "account_id",
        "category_id",
        "subcategory_id",
        "description",
        "user_id",
        "household_id",
        "is_recurring",
        "created_at",
        "updated_at"
    ) VALUES (
        v_transaction_id,
        v_planned_payment."date",
        v_planned_payment."type",
        v_planned_payment."amount",
        v_planned_payment."account_id",
        v_planned_payment."category_id",
        v_planned_payment."subcategory_id",
        v_planned_payment."description",
        v_user_id,
        v_household_id,
        false, -- Planned payments are not recurring
        NOW(),
        NOW()
    );
    
    -- Update planned payment to mark as processed
    UPDATE "public"."planned_payments"
    SET 
        "status" = 'paid'::"text",
        "linked_transaction_id" = v_transaction_id,
        "updated_at" = NOW()
    WHERE "id" = p_planned_payment_id;
    
    RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."convert_planned_payment_to_transaction"("p_planned_payment_id" "text") IS 'Converts a planned payment to a transaction. Uses improved error handling with error codes. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text" DEFAULT 'Minha Conta'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_household_id UUID;
  v_member_id UUID;
  v_goal_id UUID;
  v_now TIMESTAMPTZ;
BEGIN
  -- Check if personal household already exists
  SELECT id INTO v_household_id
  FROM "public"."households"
  WHERE "created_by" = p_user_id
    AND type = 'personal'
  LIMIT 1;

  IF v_household_id IS NOT NULL THEN
    -- Household already exists, return it
    RETURN v_household_id;
  END IF;

  -- Set timestamp once for consistency
  v_now := NOW();

  -- Generate IDs
  v_household_id := gen_random_uuid();
  v_member_id := gen_random_uuid();
  v_goal_id := gen_random_uuid();

  -- Create Household
  INSERT INTO "public"."households" (
    id,
    name,
    type,
    "created_by",
    "created_at",
    "updated_at",
    settings
  ) VALUES (
    v_household_id,
    p_household_name,
    'personal',
    p_user_id,
    v_now,
    v_now,
    '{}'::jsonb
  );

  -- Create HouseholdMember
  INSERT INTO "public"."household_members" (
    id,
    "household_id",
    "user_id",
    role,
    status,
    "is_default",
    "joined_at",
    "invited_at",
    "accepted_at",
    "invited_by",
    "created_at",
    "updated_at"
  ) VALUES (
    v_member_id,
    v_household_id,
    p_user_id,
    'owner',
    'active',
    true,
    v_now,
    v_now,
    v_now,
    p_user_id,
    v_now,
    v_now
  );

  -- Set as active household
  INSERT INTO "public"."system_user_active_households" (
    "user_id",
    "household_id",
    "updated_at"
  ) VALUES (
    p_user_id,
    v_household_id,
    v_now
  )
  ON CONFLICT ("user_id") DO UPDATE SET
    "household_id" = v_household_id,
    "updated_at" = v_now;

  -- Create Emergency Fund Goal (only if it doesn't exist)
  INSERT INTO "public"."goals" (
    id,
    name,
    "target_amount",
    "current_balance",
    "income_percentage",
    priority,
    description,
    "is_paused",
    "is_completed",
    "completed_at",
    "expected_income",
    "target_months",
    "account_id",
    "holding_id",
    "is_system_goal",
    "user_id",
    "household_id",
    "created_at",
    "updated_at"
  )
  SELECT
    v_goal_id,
    'Emergency Funds',
    1000.00,
    0.00,
    0.00,
    'High',
    'Emergency fund for unexpected expenses. Target will be calculated automatically when you have transaction data.',
    false,
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    p_user_id,
    v_household_id,
    v_now,
    v_now
  WHERE NOT EXISTS (
    SELECT 1
    FROM "public"."goals"
    WHERE "household_id" = v_household_id
      AND name = 'Emergency Funds'
      AND "is_system_goal" = true
  );

  -- Return household ID
  RETURN v_household_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in PostgreSQL functions
    -- Re-raise the error
    RAISE;
END;
$$;


ALTER FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text") IS 'Atomically creates a personal household, household member, active household, and emergency fund goal for a new user. Returns the household ID. If household already exists, returns existing ID. All operations are in a single transaction - if any step fails, all changes are rolled back.';



CREATE OR REPLACE FUNCTION "public"."create_transaction_with_limit"("p_id" "text", "p_date" "date", "p_type" "text", "p_amount" numeric, "p_account_id" "text", "p_user_id" "uuid", "p_category_id" "text" DEFAULT NULL::"text", "p_subcategory_id" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_description_search" "text" DEFAULT NULL::"text", "p_is_recurring" boolean DEFAULT false, "p_expense_type" "text" DEFAULT NULL::"text", "p_created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "p_updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP, "p_max_transactions" integer DEFAULT '-1'::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_month_date DATE;
  v_current_count INTEGER;
  v_new_count INTEGER;
  v_transaction_id TEXT;
  v_household_id UUID;
BEGIN
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "public"."system_user_monthly_usage"
    WHERE "user_id" = p_user_id AND "monthDate" = v_month_date;
    
    IF v_current_count >= p_max_transactions THEN
      PERFORM public.raise_error_with_code('TRANSACTION_LIMIT_REACHED', 
        'Current: ' || v_current_count || ', Limit: ' || p_max_transactions);
    END IF;
  END IF;
  
  -- Increment counter
  v_new_count := public.increment_transaction_count(p_user_id, v_month_date);
  
  -- Get user's default household if needed
  SELECT public.get_or_create_default_personal_household(p_user_id) INTO v_household_id;
  
  -- Insert transaction
  INSERT INTO "public"."transactions" (
    id, 
    date, 
    type, 
    amount, 
    "account_id", 
    "user_id",
    "household_id",
    "category_id", 
    "subcategory_id", 
    description, 
    "description_search",
    "is_recurring", 
    "expense_type", 
    "created_at", 
    "updated_at"
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
  v_outgoing_id TEXT;
  v_incoming_id TEXT;
  v_month_date DATE;
  v_current_count INTEGER;
  v_new_count INTEGER;
  v_now TIMESTAMPTZ;
  v_outgoing_description TEXT;
  v_incoming_description TEXT;
  v_household_id UUID;
BEGIN
  -- Generate IDs
  v_outgoing_id := gen_random_uuid()::text;
  v_incoming_id := gen_random_uuid()::text;
  v_now := CURRENT_TIMESTAMP;
  
  -- Get user's default household
  SELECT public.get_or_create_default_personal_household(p_user_id) INTO v_household_id;
  
  -- Calculate month_date (first day of month)
  v_month_date := DATE_TRUNC('month', p_date)::date;
  
  -- Check limit if not unlimited (counts as 2 transactions)
  IF p_max_transactions != -1 THEN
    SELECT COALESCE("transactions_count", 0) INTO v_current_count
    FROM "public"."system_user_monthly_usage"
    WHERE "user_id" = p_user_id AND "monthDate" = v_month_date;
    
    IF v_current_count + 2 > p_max_transactions THEN
      PERFORM public.raise_error_with_code('TRANSACTION_LIMIT_REACHED', 
        'Current: ' || v_current_count || ', Limit: ' || p_max_transactions || ' (transfer requires 2 transactions)');
    END IF;
  END IF;
  
  -- Increment counter twice (for both transactions)
  v_new_count := public.increment_transaction_count(p_user_id, v_month_date);
  v_new_count := public.increment_transaction_count(p_user_id, v_month_date);
  
  -- Build descriptions
  v_outgoing_description := COALESCE(p_description, 'Transfer out');
  v_incoming_description := COALESCE(p_description, 'Transfer in');
  
  -- Create outgoing transaction
  INSERT INTO "public"."transactions" (
    id, date, type, amount, "account_id", "user_id", "household_id",
    "transfer_to_id", description, "description_search", "is_recurring",
    "created_at", "updated_at"
  ) VALUES (
    v_outgoing_id, p_date, 'transfer', p_amount, p_from_account_id, p_user_id, v_household_id,
    p_to_account_id, v_outgoing_description, p_description_search, p_is_recurring,
    v_now, v_now
  );
  
  -- Create incoming transaction
  INSERT INTO "public"."transactions" (
    id, date, type, amount, "account_id", "user_id", "household_id",
    "transfer_from_id", description, "description_search", "is_recurring",
    "created_at", "updated_at"
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
    AND tgrelid = 'public.goals'::regclass
  ) THEN
    ALTER TABLE "public"."goals" DISABLE TRIGGER "prevent_emergency_fund_deletion_trigger";
  END IF;
  
  -- Delete all goals (system and non-system)
  DELETE FROM "public"."goals"
  WHERE "user_id" = p_user_id;
  
  -- Re-enable the trigger if it was disabled
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'prevent_emergency_fund_deletion_trigger' 
    AND tgrelid = 'public.goals'::regclass
  ) THEN
    ALTER TABLE "public"."goals" ENABLE TRIGGER "prevent_emergency_fund_deletion_trigger";
  END IF;
  
  -- Delete subscriptions (to avoid RESTRICT constraint on planId)
  DELETE FROM "public"."system_subscriptions"
  WHERE "user_id" = p_user_id;
  
  -- Delete subscriptions by household if user owns households
  DELETE FROM "public"."system_subscriptions"
  WHERE "household_id" IN (
    SELECT "id" FROM "public"."households" WHERE "created_by" = p_user_id
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
  v_user_id UUID;
BEGIN
  SELECT "user_id" INTO v_user_id
  FROM "public"."accounts"
  WHERE id = p_account_id;
  
  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."get_account_user_id"("p_account_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_account_user_id"("p_account_id" "text") IS 'Gets the userId for an account. Used for RLS policies and access control.';



CREATE OR REPLACE FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") RETURNS TABLE("table_name" "text", "last_update" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    -- Transaction
    SELECT 
      'transactions' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updated_at", "created_at"))) * 1000)::bigint as last_update
    FROM "public"."transactions"
    WHERE "user_id" = p_user_id
      AND ("updated_at" IS NOT NULL OR "created_at" IS NOT NULL)
    
    UNION ALL
    
    -- Account
    SELECT 
      'accounts' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updated_at", "created_at"))) * 1000)::bigint
    FROM "public"."accounts"
    WHERE "user_id" = p_user_id
      AND ("updated_at" IS NOT NULL OR "created_at" IS NOT NULL)
    
    UNION ALL
    
    -- Budget
    SELECT 
      'budgets' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updated_at", "created_at"))) * 1000)::bigint
    FROM "public"."budgets"
    WHERE "user_id" = p_user_id
      AND ("updated_at" IS NOT NULL OR "created_at" IS NOT NULL)
    
    UNION ALL
    
    -- Goal
    SELECT 
      'goals' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updated_at", "created_at"))) * 1000)::bigint
    FROM "public"."goals"
    WHERE "user_id" = p_user_id
      AND ("updated_at" IS NOT NULL OR "created_at" IS NOT NULL)
    
    UNION ALL
    
    -- Debt
    SELECT 
      'debts' as table_name,
      (EXTRACT(EPOCH FROM MAX(GREATEST("updated_at", "created_at"))) * 1000)::bigint
    FROM "public"."debts"
    WHERE "user_id" = p_user_id
      AND ("updated_at" IS NOT NULL OR "created_at" IS NOT NULL)
  )
  SELECT * FROM updates
  WHERE last_update IS NOT NULL
  ORDER BY last_update DESC;
END;
$$;


ALTER FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_latest_updates"("p_user_id" "uuid") IS 'Returns the latest update timestamp for each table for a given user. Used for dashboard update checking.';



CREATE OR REPLACE FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_household_id uuid;
    v_user_name text;
    v_household_name text;
BEGIN
    -- First, try to find existing default personal household
    SELECT h."id" INTO v_household_id
    FROM "public"."households" h
    JOIN "public"."household_members" hm ON hm."household_id" = h."id"
    WHERE hm."user_id" = p_user_id
      AND h."type" = 'personal'
      AND hm."is_default" = true
      AND hm."status" = 'active'
    LIMIT 1;
    
    -- If found, return it
    IF v_household_id IS NOT NULL THEN
        RETURN v_household_id;
    END IF;
    
    -- If not found, create a new personal household
    -- Get user name for household name (with fallback to ensure it's never null)
    SELECT COALESCE("name", "email", 'Personal') INTO v_user_name
    FROM "public"."users"
    WHERE "id" = p_user_id;
    
    -- If user doesn't exist in User table, try to get from auth.users
    IF v_user_name IS NULL THEN
        SELECT COALESCE(raw_user_meta_data->>'name', email, 'Personal') INTO v_user_name
        FROM "auth"."users"
        WHERE id = p_user_id;
    END IF;
    
    -- Final fallback to ensure name is never null
    v_household_name := COALESCE(v_user_name, 'Personal') || '''s Personal';
    
    -- Create household with guaranteed non-null name
    INSERT INTO "public"."households" ("id", "name", "type", "created_by", "settings", "created_at", "updated_at")
    VALUES (gen_random_uuid(), v_household_name, 'personal', p_user_id, '{}'::jsonb, NOW(), NOW())
    RETURNING "id" INTO v_household_id;
    
    -- Create household membership
    INSERT INTO "public"."household_members" (
        "id", "household_id", "user_id", "role", "status", "is_default", "joined_at", "invited_at", "accepted_at", "invited_by", "created_at", "updated_at"
    )
    VALUES (
        gen_random_uuid(), v_household_id, p_user_id, 'owner', 'active', true, NOW(), NOW(), NOW(), p_user_id, NOW(), NOW()
    );
    
    RETURN v_household_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_or_create_default_personal_household"("p_user_id" "uuid") IS 'Gets or creates a default personal household for a user. Used for migrating NULL householdId records. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."get_owner_info_for_invitation"("p_owner_id" "uuid") RETURNS TABLE("name" "text", "email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.name,
    u.email
  FROM "public"."users" u
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
    SELECT hm."household_id"
    FROM "public"."household_members" hm
    WHERE hm."user_id" = auth.uid()
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
    SELECT "household_id" INTO active_household_id
    FROM "public"."system_user_active_households"
    WHERE "user_id" = auth.uid()
    LIMIT 1;
    
    -- If no active household set, return default (personal) household
    IF active_household_id IS NULL THEN
        SELECT hm."household_id" INTO active_household_id
        FROM "public"."household_members" hm
        JOIN "public"."households" h ON h."id" = hm."household_id"
        WHERE hm."user_id" = auth.uid()
          AND hm."is_default" = true
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
    SELECT hm."household_id" as household_id
    FROM "public"."household_members" hm
    WHERE hm."user_id" = auth.uid()
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
    SELECT hm."household_id" as household_id
    FROM "public"."household_members" hm
    WHERE hm."user_id" = auth.uid()
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
    FROM "public"."household_members" hm
    WHERE hm."household_id" = p_household_id
      AND hm."user_id" = auth.uid()
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
  v_user_exists boolean;
BEGIN
  -- Check if user exists in User table
  SELECT EXISTS(SELECT 1 FROM "public"."users" WHERE "id" = p_user_id) INTO v_user_exists;
  
  -- If user doesn't exist, try to create it from auth.users
  IF NOT v_user_exists THEN
    INSERT INTO "public"."users" ("id", "email", "role", "created_at", "updated_at")
    SELECT 
      au.id,
      au.email,
      'admin',
      NOW(),
      NOW()
    FROM "auth"."users" au
    WHERE au.id = p_user_id
    ON CONFLICT ("id") DO NOTHING;
  END IF;
  
  -- Now insert or update the usage count
  INSERT INTO "public"."system_user_monthly_usage" ("user_id", "monthDate", "transactions_count")
  VALUES (p_user_id, p_month_date, 1)
  ON CONFLICT ("user_id", "monthDate")
  DO UPDATE SET
    "transactions_count" = "public"."system_user_monthly_usage"."transactions_count" + 1;
  
  SELECT "transactions_count" INTO v_count
  FROM "public"."system_user_monthly_usage"
  WHERE "user_id" = p_user_id AND "monthDate" = p_month_date;
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_transaction_count"("p_user_id" "uuid", "p_month_date" "date") IS 'Increments the transaction count for a user in a given month. Creates the record if it doesn''t exist. Returns the new count.';



CREATE OR REPLACE FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "public"."accounts"
    WHERE "id" = account_id
    AND "user_id" = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_account_owner_by_userid"("account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "public"."account_owners"
    WHERE "account_id" = account_id
    AND "owner_id" = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_account_owner_via_accountowner"("account_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "public"."users"
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT deleted_at IS NOT NULL;
$$;


ALTER FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) IS 'Helper function to check if a record is soft-deleted';



CREATE OR REPLACE FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."household_members" hm
        WHERE hm."household_id" = p_household_id
          AND hm."user_id" = auth.uid()
          AND hm."status" = 'active'
          AND hm."role" IN ('owner', 'admin')
    );
END;
$$;


ALTER FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") IS 'Checks if current user is admin or owner of a household. Bypasses RLS to prevent infinite recursion.';



CREATE OR REPLACE FUNCTION "public"."is_household_member"("p_household_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."household_members" hm
        WHERE hm."household_id" = p_household_id
          AND hm."user_id" = auth.uid()
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
        WHEN 'accounts' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."accounts"
            WHERE "id" = p_record_id;
        
        WHEN 'transactions' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."transactions"
            WHERE "id" = p_record_id;
        
        WHEN 'budgets' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."budgets"
            WHERE "id" = p_record_id;
        
        WHEN 'goals' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."goals"
            WHERE "id" = p_record_id;
        
        WHEN 'debts' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."debts"
            WHERE "id" = p_record_id;
        
        WHEN 'planned_payments' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."planned_payments"
            WHERE "id" = p_record_id;
        
        WHEN 'account_owners' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."account_owners"
            WHERE "id"::text = p_record_id;
        
        WHEN 'user_subscriptions' THEN
            SELECT "deleted_at" INTO v_deleted_at
            FROM "public"."user_subscriptions"
            WHERE "id" = p_record_id;
        
        ELSE
            -- Unknown table, assume not deleted
            RETURN true;
    END CASE;
    
    -- Return true if not found (doesn't exist) or deleted_at is NULL (not deleted)
    RETURN v_deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") IS 'Checks if a record is not soft-deleted. Returns true if record exists and deletedAt is NULL. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_household_onboarding_complete"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  current_settings JSONB;
  updated_settings JSONB;
BEGIN
  -- Get current settings
  SELECT COALESCE(settings, '{}'::jsonb) INTO current_settings
  FROM public.households
  WHERE id = p_household_id;
  
  -- Only update if onboardingCompletedAt is not already set
  IF current_settings->>'onboardingCompletedAt' IS NULL THEN
    -- Set onboardingCompletedAt to current timestamp
    updated_settings := current_settings || jsonb_build_object(
      'onboardingCompletedAt', NOW()::text
    );
    
    -- Update household settings
    UPDATE public.households
    SET settings = updated_settings,
        updated_at = NOW()
    WHERE id = p_household_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."mark_household_onboarding_complete"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_emergency_fund_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_exists boolean;
BEGIN
  IF OLD."is_system_goal" = true THEN
    -- Check if user still exists in User table
    -- If user doesn't exist, we're in a CASCADE deletion context, allow it
    SELECT EXISTS(SELECT 1 FROM "public"."users" WHERE "id" = OLD."user_id") INTO v_user_exists;
    
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



CREATE OR REPLACE FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_household_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Note: Materialized views don't support DELETE/INSERT operations directly
  -- We need to refresh the entire materialized view
  -- For partial refreshes, we would need to use a regular table instead
  -- This function now refreshes the entire view, which is less efficient but necessary
  PERFORM refresh_budget_spending_view();
END;
$$;


ALTER FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid", "p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid", "p_household_id" "uuid") IS 'Refreshes budget spending data for a specific period and optionally user/household. Since analytics_budget_spending_by_period is a materialized view, this refreshes the entire view. For more efficient partial refreshes, consider using a regular table instead.';



CREATE OR REPLACE FUNCTION "public"."refresh_budget_spending_on_transaction_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_period date;
  v_user_id uuid;
  v_household_id uuid;
BEGIN
  -- Determine which period to refresh
  IF TG_OP = 'DELETE' THEN
    v_period := DATE_TRUNC('month', OLD."date"::date)::date;
    v_user_id := OLD."user_id";
    v_household_id := OLD."household_id";
  ELSE
    v_period := DATE_TRUNC('month', NEW."date"::date)::date;
    v_user_id := NEW."user_id";
    v_household_id := NEW."household_id";
  END IF;
  
  -- Only refresh if it's an expense transaction with a category
  IF (TG_OP = 'DELETE' AND OLD."type" = 'expense' AND OLD."category_id" IS NOT NULL)
     OR (TG_OP IN ('INSERT', 'UPDATE') AND NEW."type" = 'expense' AND NEW."category_id" IS NOT NULL) THEN
    
    -- Refresh the period
    PERFORM refresh_budget_spending_for_period(v_period, v_user_id, v_household_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."refresh_budget_spending_on_transaction_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_budget_spending_on_transaction_change"() IS 'Trigger function that automatically refreshes budget spending when transactions change. Called on INSERT, UPDATE, and DELETE of expense transactions.';



CREATE OR REPLACE FUNCTION "public"."refresh_budget_spending_view"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "public"."analytics_budget_spending_by_period";
END;
$$;


ALTER FUNCTION "public"."refresh_budget_spending_view"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_budget_spending_view"() IS 'Refreshes the entire analytics_budget_spending_by_period materialized view. Use refresh_budget_spending_for_period() for more efficient partial refreshes.';



CREATE OR REPLACE FUNCTION "public"."trigger_update_subscription_cache"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_household_id uuid;
BEGIN
  -- Only process if status is active or trialing
  IF NEW."status" IN ('active', 'trialing') THEN
    -- Update cache for the subscription owner (if user_id-based subscription)
    IF NEW."user_id" IS NOT NULL THEN
      PERFORM "public"."update_user_subscription_cache"(NEW."user_id");
      
      -- Also update all household members if this is a user_id-based subscription
      -- Get household_id from user's active household
      SELECT "household_id" INTO v_household_id
      FROM "public"."system_user_active_households"
      WHERE "user_id" = NEW."user_id"
      LIMIT 1;
      
      -- Fallback to default household
      IF v_household_id IS NULL THEN
        SELECT "household_id" INTO v_household_id
        FROM "public"."household_members"
        WHERE "user_id" = NEW."user_id"
          AND "is_default" = true
          AND "status" = 'active'
        LIMIT 1;
      END IF;
      
      IF v_household_id IS NOT NULL THEN
        PERFORM "public"."update_household_members_subscription_cache"(v_household_id);
      END IF;
    END IF;
    
    -- Update cache for all household members if this is a household_id-based subscription
    IF NEW."household_id" IS NOT NULL THEN
      -- Update all members of this household
      PERFORM "public"."update_household_members_subscription_cache"(NEW."household_id");
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_subscription_cache"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_update_subscription_cache"() IS 'Updates subscription cache when subscription changes. Supports both user_id-based (backward compatibility) and household_id-based subscriptions. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."update_federal_brackets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_federal_brackets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_member_record record;
BEGIN
  -- Update all active household members of this household
  FOR v_member_record IN
    SELECT "user_id"
    FROM "public"."household_members"
    WHERE "household_id" = p_household_id
      AND "status" = 'active'
      AND "user_id" IS NOT NULL
  LOOP
    PERFORM "public"."update_user_subscription_cache"(v_member_record."user_id");
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") IS 'Updates subscription cache for all active members of a household when the household subscription changes. Uses household_members. Uses SET search_path for security.';



CREATE OR REPLACE FUNCTION "public"."update_tax_rates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tax_rates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW."updated_at" = NOW();
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
  SELECT "household_id" INTO v_household_id
  FROM "public"."system_user_active_households"
  WHERE "user_id" = p_user_id
  LIMIT 1;

  -- Fallback to default (personal) household if no active household set
  IF v_household_id IS NULL THEN
    SELECT "household_id" INTO v_household_id
    FROM "public"."household_members"
    WHERE "user_id" = p_user_id
      AND "is_default" = true
      AND "status" = 'active'
    LIMIT 1;
  END IF;

  -- Get subscription for household (new architecture)
  IF v_household_id IS NOT NULL THEN
    SELECT 
      "id",
      "plan_id",
      "status"
    INTO v_subscription_record
    FROM "public"."system_subscriptions"
    WHERE "household_id" = v_household_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "created_at" DESC
    LIMIT 1;
  END IF;

  -- Fallback: Try to get subscription by userId (backward compatibility)
  IF v_subscription_record IS NULL THEN
    SELECT 
      "id",
      "plan_id",
      "status"
    INTO v_subscription_record
    FROM "public"."system_subscriptions"
    WHERE "user_id" = p_user_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "created_at" DESC
    LIMIT 1;
  END IF;

  -- Update User table with subscription cache
  IF v_subscription_record IS NOT NULL THEN
    UPDATE "public"."users"
    SET
      "effective_plan_id" = v_subscription_record."plan_id",
      "effective_subscription_status" = v_subscription_record."status",
      "effective_subscription_id" = v_subscription_record."id",
      "subscription_updated_at" = NOW()
    WHERE "id" = p_user_id;
  ELSE
    -- If no subscription found, clear cache
    UPDATE "public"."users"
    SET
      "effective_plan_id" = NULL,
      "effective_subscription_status" = NULL,
      "effective_subscription_id" = NULL,
      "subscription_updated_at" = NOW()
    WHERE "id" = p_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") IS 'Updates the subscription cache in the User table. Uses HouseholdMember and householdId-based subscriptions. Falls back to userId-based subscriptions for backward compatibility.';



CREATE OR REPLACE FUNCTION "public"."validate_invitation_token"("p_token" "text") RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "status" "text", "owner_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hm.id,
    hm.email,
    hm.name,
    hm.role,
    hm.status,
    h."created_by" as owner_id
  FROM "public"."household_members" hm
  JOIN "public"."households" h ON h."id" = hm."household_id"
  WHERE hm."invitation_token" = p_token
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


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "credit_limit" numeric(15,2),
    "user_id" "uuid",
    "initial_balance" numeric(15,2),
    "due_day_of_month" integer,
    "extra_credit" numeric(15,2) DEFAULT 0 NOT NULL,
    "household_id" "uuid",
    "currency_code" "text" DEFAULT 'USD'::"text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "accounts_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'checking'::"text", 'savings'::"text", 'credit'::"text", 'investment'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accounts"."credit_limit" IS 'Credit limit for credit card accounts. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."accounts"."initial_balance" IS 'Initial balance for checking and savings accounts. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."accounts"."due_day_of_month" IS 'Day of month when credit card bill is due (1-31). Only used for type=''credit'' accounts.';



COMMENT ON COLUMN "public"."accounts"."extra_credit" IS 'Extra prepaid credit on this credit card. Used when user pays more than the current debt balance.';



COMMENT ON COLUMN "public"."accounts"."currency_code" IS 'ISO currency code (e.g., USD, CAD). Defaults to USD. Used for multi-currency support.';



COMMENT ON COLUMN "public"."accounts"."deleted_at" IS 'Timestamp when the account was soft-deleted. NULL means not deleted.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "group_id" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."categories"."group_id" IS 'Optional group for visual organization only. Not required structurally. Categories can exist without groups.';



COMMENT ON COLUMN "public"."categories"."deleted_at" IS 'Timestamp when the category was soft-deleted. NULL means not deleted. System categories should never be deleted.';



CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" "uuid",
    "logo" "text",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subcategories"."logo" IS 'URL or path to the logo/image for this subcategory';



COMMENT ON COLUMN "public"."subcategories"."deleted_at" IS 'Timestamp when the subcategory was soft-deleted. NULL means not deleted. System subcategories should never be deleted.';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "category_id" "text",
    "subcategory_id" "text",
    "description" "text",
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "transfer_to_id" "text",
    "transfer_from_id" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "user_id" "uuid" NOT NULL,
    "suggested_category_id" "text",
    "suggested_subcategory_id" "text",
    "expense_type" "text",
    "description_search" "text",
    "date" "date" NOT NULL,
    "household_id" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "receipt_url" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "transactions_date_valid" CHECK ((("date" >= '1900-01-01'::"date") AND ("date" <= (CURRENT_DATE + '1 year'::interval))))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."is_recurring" IS 'Whether this transaction is part of a recurring series. Renamed from "recurring" for consistency with other boolean columns.';



COMMENT ON COLUMN "public"."transactions"."expense_type" IS 'Indicates if expense is fixed or variable. Only applies to expense transactions. Values: "fixed" or "variable"';



COMMENT ON COLUMN "public"."transactions"."description_search" IS 'Normalized description for search and category learning. Lowercase, no special characters, normalized whitespace.';



COMMENT ON COLUMN "public"."transactions"."date" IS 'Transaction date (date only, no time component). Changed from timestamp to date to avoid timezone issues.';



COMMENT ON COLUMN "public"."transactions"."amount" IS 'Transaction amount as numeric value. No longer encrypted per regulatory compliance (amount is not PII).';



COMMENT ON COLUMN "public"."transactions"."receipt_url" IS 'URL to the receipt file stored in Supabase Storage receipts bucket';



COMMENT ON COLUMN "public"."transactions"."deleted_at" IS 'Timestamp when the transaction was soft-deleted. NULL means not deleted.';



CREATE TABLE IF NOT EXISTS "public"."account_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "text" NOT NULL,
    "plaid_item_id" "text",
    "plaid_account_id" "text",
    "plaid_mask" "text",
    "plaid_official_name" "text",
    "plaid_subtype" "text",
    "plaid_verification_status" "text",
    "plaid_verification_name" "text",
    "plaid_available_balance" numeric(15,2),
    "plaid_persistent_account_id" "text",
    "plaid_holder_category" "text",
    "plaid_unofficial_currency_code" "text",
    "is_connected" boolean DEFAULT false,
    "sync_enabled" boolean DEFAULT true,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."account_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_integrations" IS 'Plaid integration data separated from core account information';



COMMENT ON COLUMN "public"."account_integrations"."plaid_subtype" IS 'Subtype from Plaid (e.g., checking, savings, credit card). Only set for accounts imported from Plaid.';



COMMENT ON COLUMN "public"."account_integrations"."plaid_verification_name" IS 'Account holder name used for micro-deposit or database verification.';



COMMENT ON COLUMN "public"."account_integrations"."plaid_available_balance" IS 'Available balance from Plaid (amount available to withdraw). Separate from current balance.';



COMMENT ON COLUMN "public"."account_integrations"."plaid_persistent_account_id" IS 'Persistent account ID for Tokenized Account Numbers (TAN). Used by Chase, PNC, and US Bank. Helps identify same account across multiple Items.';



COMMENT ON COLUMN "public"."account_integrations"."plaid_holder_category" IS 'Account category: personal, business, or unrecognized. Currently in beta.';



COMMENT ON COLUMN "public"."account_integrations"."plaid_unofficial_currency_code" IS 'Unofficial currency code for cryptocurrencies and non-ISO currencies. Only set when iso_currency_code is null.';



CREATE TABLE IF NOT EXISTS "public"."account_investment_values" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "total_value" numeric(15,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid"
);


ALTER TABLE "public"."account_investment_values" OWNER TO "postgres";


COMMENT ON COLUMN "public"."account_investment_values"."total_value" IS 'Total investment value. Stored as numeric(15,2) to prevent floating point rounding errors.';



CREATE TABLE IF NOT EXISTS "public"."account_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."account_owners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."account_owners"."deleted_at" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE MATERIALIZED VIEW "public"."analytics_budget_spending_by_period" AS
 SELECT ("date_trunc"('month'::"text", ("t"."date")::timestamp with time zone))::"date" AS "period",
    "t"."user_id",
    "t"."household_id",
    "t"."category_id",
    "t"."subcategory_id",
    "c"."group_id",
    COALESCE("sum"("abs"("t"."amount")), (0)::numeric) AS "actual_spend",
    "count"(*) AS "transaction_count"
   FROM ("public"."transactions" "t"
     LEFT JOIN "public"."categories" "c" ON (("t"."category_id" = "c"."id")))
  WHERE (("t"."type" = 'expense'::"text") AND ("t"."category_id" IS NOT NULL) AND ("t"."transfer_to_id" IS NULL) AND ("t"."transfer_from_id" IS NULL) AND ("t"."deleted_at" IS NULL))
  GROUP BY (("date_trunc"('month'::"text", ("t"."date")::timestamp with time zone))::"date"), "t"."user_id", "t"."household_id", "t"."category_id", "t"."subcategory_id", "c"."group_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."analytics_budget_spending_by_period" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."analytics_budget_spending_by_period" IS 'Pre-calculated spending aggregates by period, category, subcategory, and group. Used to optimize budget actual_spend calculations. Refreshed automatically via triggers.';



CREATE TABLE IF NOT EXISTS "public"."analytics_category_learning" (
    "user_id" "uuid" NOT NULL,
    "normalized_description" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "subcategory_id" "text",
    "description_and_amount_count" integer DEFAULT 0 NOT NULL,
    "description_only_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "categorylearning_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."analytics_category_learning" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_category_learning" IS 'Aggregated category learning data for fast suggestions. Replaces scanning 12 months of transactions.';



COMMENT ON COLUMN "public"."analytics_category_learning"."normalized_description" IS 'Normalized description (lowercase, no special chars, normalized whitespace). Must match normalizeDescription() function.';



COMMENT ON COLUMN "public"."analytics_category_learning"."description_and_amount_count" IS 'Number of times this description+amount combination was used with this category.';



COMMENT ON COLUMN "public"."analytics_category_learning"."description_only_count" IS 'Number of times this description (any amount) was used with this category.';



COMMENT ON COLUMN "public"."analytics_category_learning"."last_used_at" IS 'Last time this category was used for this description. Used to prioritize recent suggestions.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditlogs_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_logs" IS 'Audit log for tracking changes to critical tables. Only admins can read.';



COMMENT ON COLUMN "public"."audit_logs"."table_name" IS 'Name of the table that was modified';



COMMENT ON COLUMN "public"."audit_logs"."record_id" IS 'ID of the record that was modified';



COMMENT ON COLUMN "public"."audit_logs"."action" IS 'Action performed: INSERT, UPDATE, or DELETE';



COMMENT ON COLUMN "public"."audit_logs"."user_id" IS 'User who performed the action (from auth.uid())';



COMMENT ON COLUMN "public"."audit_logs"."old_data" IS 'Previous data (for UPDATE and DELETE)';



COMMENT ON COLUMN "public"."audit_logs"."new_data" IS 'New data (for INSERT and UPDATE)';



COMMENT ON COLUMN "public"."audit_logs"."created_at" IS 'When the action was performed';



CREATE TABLE IF NOT EXISTS "public"."audit_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "result" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_webhook_events" IS 'Tracks processed webhook events for idempotency. Prevents duplicate processing of Stripe webhooks.';



COMMENT ON COLUMN "public"."audit_webhook_events"."event_id" IS 'Stripe event ID (unique identifier from Stripe)';



COMMENT ON COLUMN "public"."audit_webhook_events"."event_type" IS 'Type of webhook event (e.g., checkout.session.completed, subscription.updated)';



COMMENT ON COLUMN "public"."audit_webhook_events"."processed_at" IS 'Timestamp when the event was processed';



COMMENT ON COLUMN "public"."audit_webhook_events"."result" IS 'Processing result: success, error, skipped';



COMMENT ON COLUMN "public"."audit_webhook_events"."error_message" IS 'Error message if processing failed';



COMMENT ON COLUMN "public"."audit_webhook_events"."metadata" IS 'Additional event metadata (JSON)';



CREATE TABLE IF NOT EXISTS "public"."budget_categories" (
    "id" "text" NOT NULL,
    "budget_id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "text" NOT NULL,
    "period" timestamp with time zone NOT NULL,
    "category_id" "text",
    "amount" numeric(15,2) NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "group_id" "text",
    "user_id" "uuid" NOT NULL,
    "subcategory_id" "text",
    "is_recurring" boolean DEFAULT true NOT NULL,
    "household_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "budgets_amount_positive" CHECK ((("amount")::double precision > (0)::double precision))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."budgets"."amount" IS 'Budget amount. Stored as numeric(15,2) to prevent floating point rounding errors.';



COMMENT ON COLUMN "public"."budgets"."user_id" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."budgets"."is_recurring" IS 'Indicates if the budget is recurring monthly. When true, the budget will be automatically created for future months.';



COMMENT ON COLUMN "public"."budgets"."deleted_at" IS 'Timestamp when the budget was soft-deleted. NULL means not deleted.';



CREATE TABLE IF NOT EXISTS "public"."candles" (
    "id" "text" NOT NULL,
    "security_id" "text" NOT NULL,
    "symbolId" bigint NOT NULL,
    "start" timestamp with time zone NOT NULL,
    "end" timestamp with time zone NOT NULL,
    "low" numeric(15,4) NOT NULL,
    "high" numeric(15,4) NOT NULL,
    "open" numeric(15,4) NOT NULL,
    "close" numeric(15,4) NOT NULL,
    "volume" bigint DEFAULT 0 NOT NULL,
    "vwap" numeric(15,4),
    "interval" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."candles" OWNER TO "postgres";


COMMENT ON TABLE "public"."candles" IS 'Stores historical price data (candles) for securities';



CREATE TABLE IF NOT EXISTS "public"."category_groups" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "user_id" "uuid",
    "type" "text",
    CONSTRAINT "categoryGroups_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."category_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "loan_type" "text" NOT NULL,
    "initial_amount" numeric(15,2) NOT NULL,
    "down_payment" numeric(15,2) DEFAULT 0,
    "current_balance" numeric(15,2) NOT NULL,
    "interest_rate" numeric(15,4) NOT NULL,
    "total_months" integer,
    "first_payment_date" timestamp with time zone NOT NULL,
    "monthly_payment" numeric(15,2) NOT NULL,
    "principal_paid" numeric(15,2) DEFAULT 0 NOT NULL,
    "interest_paid" numeric(15,2) DEFAULT 0 NOT NULL,
    "additional_contributions" boolean DEFAULT false NOT NULL,
    "additional_contribution_amount" numeric(15,2) DEFAULT 0,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "description" "text",
    "is_paid_off" boolean DEFAULT false NOT NULL,
    "is_paused" boolean DEFAULT false NOT NULL,
    "paid_off_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "payment_frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "payment_amount" numeric(15,2),
    "account_id" "text",
    "user_id" "uuid" NOT NULL,
    "start_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "next_due_date" "date",
    "household_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "debts_additionalcontributionamount_check" CHECK (("additional_contribution_amount" >= (0)::numeric)),
    CONSTRAINT "debts_currentbalance_check" CHECK (("current_balance" >= (0)::numeric)),
    CONSTRAINT "debts_downpayment_check" CHECK ((("down_payment" IS NULL) OR ("down_payment" >= (0)::numeric))),
    CONSTRAINT "debts_first_payment_date_valid" CHECK ((("first_payment_date" IS NULL) OR (("first_payment_date" >= '1900-01-01'::"date") AND ("first_payment_date" <= (CURRENT_DATE + '50 years'::interval))))),
    CONSTRAINT "debts_initialamount_check" CHECK (("initial_amount" > (0)::numeric)),
    CONSTRAINT "debts_initialamount_positive" CHECK (("initial_amount" >= (0)::numeric)),
    CONSTRAINT "debts_interestpaid_check" CHECK (("interest_paid" >= (0)::numeric)),
    CONSTRAINT "debts_interestrate_check" CHECK (("interest_rate" >= (0)::numeric)),
    CONSTRAINT "debts_loantype_check" CHECK (("loan_type" = ANY (ARRAY['mortgage'::"text", 'car_loan'::"text", 'personal_loan'::"text", 'credit_card'::"text", 'student_loan'::"text", 'business_loan'::"text", 'other'::"text"]))),
    CONSTRAINT "debts_monthlypayment_check" CHECK ((("monthly_payment" > (0)::numeric) OR (("loan_type" = 'credit_card'::"text") AND ("monthly_payment" >= (0)::numeric)))),
    CONSTRAINT "debts_next_due_date_valid" CHECK ((("next_due_date" IS NULL) OR (("next_due_date" >= '1900-01-01'::"date") AND ("next_due_date" <= (CURRENT_DATE + '10 years'::interval))))),
    CONSTRAINT "debts_paymentamount_check" CHECK ((("payment_amount" > (0)::numeric) OR ("payment_amount" IS NULL))),
    CONSTRAINT "debts_paymentfrequency_check" CHECK (("payment_frequency" = ANY (ARRAY['monthly'::"text", 'biweekly'::"text", 'weekly'::"text", 'semimonthly'::"text", 'daily'::"text"]))),
    CONSTRAINT "debts_principalpaid_check" CHECK (("principal_paid" >= (0)::numeric)),
    CONSTRAINT "debts_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "debts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"]))),
    CONSTRAINT "debts_totalmonths_check" CHECK ((("total_months" IS NULL) OR ("total_months" > 0)))
);


ALTER TABLE "public"."debts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."debts"."user_id" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."debts"."status" IS 'Estado da dívida (ativa ou encerrada)';



COMMENT ON COLUMN "public"."debts"."next_due_date" IS 'Data de vencimento da fatura/dívida';



COMMENT ON COLUMN "public"."debts"."deleted_at" IS 'Timestamp when the debt was soft-deleted. NULL means not deleted.';



CREATE TABLE IF NOT EXISTS "public"."executions" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
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
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid"
);


ALTER TABLE "public"."executions" OWNER TO "postgres";


COMMENT ON TABLE "public"."executions" IS 'Stores order executions for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric(15,2) NOT NULL,
    "income_percentage" numeric(15,2) NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "current_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "is_paused" boolean DEFAULT false NOT NULL,
    "expected_income" numeric(15,2),
    "target_months" numeric(15,2),
    "user_id" "uuid" NOT NULL,
    "account_id" "text",
    "holding_id" "text",
    "household_id" "uuid",
    "is_system_goal" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "goals_currentbalance_check" CHECK (("current_balance" >= (0)::numeric)),
    CONSTRAINT "goals_priority_check" CHECK (("priority" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "goals_targetamount_positive" CHECK ((("target_amount" > (0)::numeric) OR (("is_system_goal" = true) AND ("target_amount" >= (0)::numeric)))),
    CONSTRAINT "goals_targetmonths_check" CHECK ((("target_months" IS NULL) OR ("target_months" > (0)::numeric)))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."goals"."user_id" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."goals"."is_system_goal" IS 'Indicates if this is a system-created goal (e.g., Emergency Funds). System goals cannot be deleted.';



COMMENT ON COLUMN "public"."goals"."deleted_at" IS 'Timestamp when the goal was soft-deleted. NULL means not deleted.';



CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "email" "text",
    "name" "text",
    "invitation_token" "text",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "householdMembers_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))),
    CONSTRAINT "householdMembers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'inactive'::"text"]))),
    CONSTRAINT "householdMembers_userId_or_email_check" CHECK ((("user_id" IS NOT NULL) OR (("email" IS NOT NULL) AND ("status" = 'pending'::"text"))))
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."household_members" IS 'Membership relationship between users and households';



COMMENT ON COLUMN "public"."household_members"."role" IS 'Role in the household: owner (full control), admin (can modify), member (read-only)';



COMMENT ON COLUMN "public"."household_members"."status" IS 'Membership status: active, pending (invitation), inactive';



COMMENT ON COLUMN "public"."household_members"."is_default" IS 'Whether this is the default household for the user (typically their personal household)';



COMMENT ON COLUMN "public"."household_members"."email" IS 'Email for pending invitations (when userId is null)';



COMMENT ON COLUMN "public"."household_members"."name" IS 'Name for pending invitations';



COMMENT ON COLUMN "public"."household_members"."invitation_token" IS 'Token for invitation acceptance';



COMMENT ON COLUMN "public"."household_members"."invited_at" IS 'When the invitation was sent';



COMMENT ON COLUMN "public"."household_members"."accepted_at" IS 'When the invitation was accepted';



CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "households_type_check" CHECK (("type" = ANY (ARRAY['personal'::"text", 'household'::"text"])))
);


ALTER TABLE "public"."households" OWNER TO "postgres";


COMMENT ON TABLE "public"."households" IS 'Households for organizing users and their data (personal or shared household accounts)';



COMMENT ON COLUMN "public"."households"."type" IS 'Type of household: personal (individual account) or household (shared account)';



COMMENT ON COLUMN "public"."households"."created_by" IS 'User who created this household';



COMMENT ON COLUMN "public"."households"."settings" IS 'Household settings stored as JSONB. Fields include: expectedIncome, expectedIncomeAmount, country (ISO 3166-1 alpha-2), stateOrProvince (state/province code). Location fields are used for tax calculations.';



CREATE TABLE IF NOT EXISTS "public"."investment_accounts" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "account_id" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cash" numeric(15,2),
    "market_value" numeric(15,2),
    "total_equity" numeric(15,2),
    "buying_power" numeric(15,2),
    "maintenance_excess" numeric(15,2),
    "currency" "text" DEFAULT 'CAD'::"text",
    "balance_last_updated_at" timestamp with time zone,
    "household_id" "uuid"
);


ALTER TABLE "public"."investment_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."investment_accounts"."updated_at" IS 'Timestamp de última atualização - atualizado automaticamente';



COMMENT ON COLUMN "public"."investment_accounts"."user_id" IS 'User ID - obrigatório para RLS policies';



COMMENT ON COLUMN "public"."investment_accounts"."cash" IS 'Cash balance in the account';



COMMENT ON COLUMN "public"."investment_accounts"."market_value" IS 'Current market value of all positions';



COMMENT ON COLUMN "public"."investment_accounts"."total_equity" IS 'Total equity (cash + market value)';



COMMENT ON COLUMN "public"."investment_accounts"."buying_power" IS 'Available buying power';



COMMENT ON COLUMN "public"."investment_accounts"."maintenance_excess" IS 'Maintenance excess amount';



COMMENT ON COLUMN "public"."investment_accounts"."currency" IS 'Currency of the account (default: CAD)';



COMMENT ON COLUMN "public"."investment_accounts"."balance_last_updated_at" IS 'Last time balance information was updated';



CREATE TABLE IF NOT EXISTS "public"."investment_transactions" (
    "id" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "account_id" "text" NOT NULL,
    "security_id" "text",
    "type" "text" NOT NULL,
    "quantity" numeric(15,4),
    "price" numeric(15,4),
    "fees" numeric(15,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "transfer_to_id" "text",
    "transfer_from_id" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid",
    "plaid_investment_transaction_id" "text",
    "plaid_subtype" "text",
    "currency_code" "text",
    CONSTRAINT "investmenttransactions_check_buy_sell_fields" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text"])) AND ("quantity" IS NOT NULL) AND ("quantity" > (0)::numeric) AND ("price" IS NOT NULL) AND ("price" >= (0)::numeric)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text"])))),
    CONSTRAINT "investmenttransactions_check_security_required" CHECK (((("type" = ANY (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"])) AND ("security_id" IS NOT NULL)) OR ("type" <> ALL (ARRAY['buy'::"text", 'sell'::"text", 'dividend'::"text", 'interest'::"text"]))))
);


ALTER TABLE "public"."investment_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."investment_transactions"."plaid_investment_transaction_id" IS 'Unique ID from Plaid for this investment transaction. Used for deduplication and tracking.';



COMMENT ON COLUMN "public"."investment_transactions"."plaid_subtype" IS 'Subtype from Plaid (e.g., "dividend qualified", "dividend non-qualified"). Only set for transactions imported from Plaid.';



COMMENT ON COLUMN "public"."investment_transactions"."currency_code" IS 'ISO currency code (e.g., USD, CAD). Used for multi-currency support.';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
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
    "user_id" bigint,
    "placementCommission" numeric(15,2),
    "strategyType" "text",
    "triggerStopPrice" numeric(15,4),
    "lastSyncedAt" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Stores orders for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."planned_payments" (
    "id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "account_id" "text" NOT NULL,
    "category_id" "text",
    "subcategory_id" "text",
    "description" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "linked_transaction_id" "text",
    "debt_id" "text",
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "to_account_id" "text",
    "subscription_id" "text",
    "household_id" "uuid",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "plannedpayments_date_valid" CHECK ((("date" >= '1900-01-01'::"date") AND ("date" <= (CURRENT_DATE + '5 years'::interval)))),
    CONSTRAINT "plannedpayments_paid_has_transaction" CHECK ((("status" <> 'paid'::"text") OR ("linked_transaction_id" IS NOT NULL))),
    CONSTRAINT "plannedpayments_skipped_cancelled_no_transaction" CHECK ((("status" <> ALL (ARRAY['skipped'::"text", 'cancelled'::"text"])) OR ("linked_transaction_id" IS NULL))),
    CONSTRAINT "plannedpayments_source_check" CHECK (("source" = ANY (ARRAY['recurring'::"text", 'debt'::"text", 'manual'::"text", 'subscription'::"text"]))),
    CONSTRAINT "plannedpayments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'paid'::"text", 'skipped'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "plannedpayments_transaction_only_if_paid" CHECK ((("linked_transaction_id" IS NULL) OR ("status" = 'paid'::"text"))),
    CONSTRAINT "plannedpayments_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."planned_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."planned_payments" IS 'Future payments that will become Transactions when paid. Does not affect account balances.';



COMMENT ON COLUMN "public"."planned_payments"."source" IS 'Origin of the planned payment: recurring (from recurring transaction), debt (from debt), manual (user created)';



COMMENT ON COLUMN "public"."planned_payments"."status" IS 'Current status: scheduled (pending), paid (converted to Transaction), skipped (skipped without creating Transaction), cancelled (cancelled)';



COMMENT ON COLUMN "public"."planned_payments"."linked_transaction_id" IS 'Transaction ID when this PlannedPayment was converted to a Transaction (only when status = paid)';



COMMENT ON COLUMN "public"."planned_payments"."debt_id" IS 'Debt ID if this PlannedPayment was created from a debt';



COMMENT ON COLUMN "public"."planned_payments"."to_account_id" IS 'Destination account ID for transfer type planned payments';



COMMENT ON COLUMN "public"."planned_payments"."subscription_id" IS 'Subscription ID if this PlannedPayment was created from a UserServiceSubscription';



COMMENT ON COLUMN "public"."planned_payments"."deleted_at" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "security_id" "text" NOT NULL,
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
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid"
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


COMMENT ON TABLE "public"."positions" IS 'Stores current positions (holdings) for investment accounts';



CREATE TABLE IF NOT EXISTS "public"."securities" (
    "id" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "sector" "text",
    "closePrice" numeric(15,4),
    "closePriceAsOf" timestamp with time zone,
    "currencyCode" "text"
);


ALTER TABLE "public"."securities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."securities"."sector" IS 'Industry sector for the security (e.g., Technology, Finance, Healthcare, Consumer, Energy, etc.)';



COMMENT ON COLUMN "public"."securities"."closePrice" IS 'Most recent closing price from Plaid.';



COMMENT ON COLUMN "public"."securities"."closePriceAsOf" IS 'Date when the closePrice was last updated from Plaid.';



COMMENT ON COLUMN "public"."securities"."currencyCode" IS 'ISO currency code for the security (e.g., USD, CAD).';



CREATE TABLE IF NOT EXISTS "public"."security_prices" (
    "id" "text" NOT NULL,
    "security_id" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "price" numeric(15,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."security_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_investment_entries" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid"
);


ALTER TABLE "public"."simple_investment_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_service_categories" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."subscription_service_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_service_categories" IS 'Categories for subscription services (e.g., AI tools, Streaming Video, etc.)';



COMMENT ON COLUMN "public"."subscription_service_categories"."name" IS 'Category name (e.g., "AI tools", "Streaming Video")';



COMMENT ON COLUMN "public"."subscription_service_categories"."display_order" IS 'Order for displaying categories in UI';



COMMENT ON COLUMN "public"."subscription_service_categories"."is_active" IS 'Whether the category is active and visible to users';



CREATE TABLE IF NOT EXISTS "public"."subscription_service_plans" (
    "id" "text" NOT NULL,
    "service_id" "text" NOT NULL,
    "plan_name" "text" NOT NULL,
    "price" numeric(15,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    CONSTRAINT "subscriptionserviceplans_currency_check" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'CAD'::"text"]))),
    CONSTRAINT "subscriptionserviceplans_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."subscription_service_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_service_plans" IS 'Pricing plans for subscription services (e.g., Basic, Pro, Enterprise)';



COMMENT ON COLUMN "public"."subscription_service_plans"."service_id" IS 'Service this plan belongs to';



COMMENT ON COLUMN "public"."subscription_service_plans"."plan_name" IS 'Plan name (e.g., "Basic", "Pro", "Enterprise")';



COMMENT ON COLUMN "public"."subscription_service_plans"."price" IS 'Price of the plan';



COMMENT ON COLUMN "public"."subscription_service_plans"."currency" IS 'Currency code: USD or CAD';



COMMENT ON COLUMN "public"."subscription_service_plans"."is_active" IS 'Whether the plan is active and visible';



CREATE TABLE IF NOT EXISTS "public"."subscription_services" (
    "id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "logo" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."subscription_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_services" IS 'Individual subscription services (e.g., ChatGPT Team, Netflix, Spotify)';



COMMENT ON COLUMN "public"."subscription_services"."category_id" IS 'Category this service belongs to';



COMMENT ON COLUMN "public"."subscription_services"."name" IS 'Service name (e.g., "ChatGPT Team", "Netflix")';



COMMENT ON COLUMN "public"."subscription_services"."logo" IS 'URL or path to the logo/image for this service';



COMMENT ON COLUMN "public"."subscription_services"."display_order" IS 'Order for displaying services within category';



COMMENT ON COLUMN "public"."subscription_services"."is_active" IS 'Whether the service is active and visible to users';



CREATE TABLE IF NOT EXISTS "public"."system_contact_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contactforms_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'read'::"text", 'replied'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."system_contact_forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_error_codes" (
    "code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "userMessage" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_error_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_error_codes" IS 'Standard error codes for database functions. Maps internal error codes to user-friendly messages.';



CREATE TABLE IF NOT EXISTS "public"."system_federal_tax_brackets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "countryCode" "text" NOT NULL,
    "taxYear" integer NOT NULL,
    "bracketOrder" integer NOT NULL,
    "minIncome" numeric(12,2) NOT NULL,
    "maxIncome" numeric(12,2),
    "taxRate" numeric(6,4) NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "federaltaxbrackets_countrycode_check" CHECK (("countryCode" = ANY (ARRAY['US'::"text", 'CA'::"text"]))),
    CONSTRAINT "federaltaxbrackets_taxrate_check" CHECK ((("taxRate" >= (0)::numeric) AND ("taxRate" <= (1)::numeric)))
);


ALTER TABLE "public"."system_federal_tax_brackets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."system_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "text",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "progress" integer DEFAULT 0,
    "total_items" integer DEFAULT 0,
    "processed_items" integer DEFAULT 0,
    "synced_items" integer DEFAULT 0,
    "skipped_items" integer DEFAULT 0,
    "error_items" integer DEFAULT 0,
    "error_message" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    CONSTRAINT "importjobs_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "importjobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "importjobs_type_check" CHECK (("type" = ANY (ARRAY['plaid_sync'::"text", 'csv_import'::"text", 'investment_sync'::"text"])))
);


ALTER TABLE "public"."system_import_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_import_jobs" IS 'Tracks background import jobs for bank accounts and transactions to prevent system overload';



CREATE TABLE IF NOT EXISTS "public"."system_plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price_monthly" numeric(10,2) DEFAULT 0 NOT NULL,
    "price_yearly" numeric(10,2) DEFAULT 0 NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_price_id_monthly" "text",
    "stripe_price_id_yearly" "text",
    "stripe_product_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_promo_codes" (
    "id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "duration" "text" NOT NULL,
    "duration_in_months" integer,
    "max_redemptions" integer,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "stripe_coupon_id" "text",
    "plan_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promocodes_discounttype_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'fixed'::"text"]))),
    CONSTRAINT "promocodes_duration_check" CHECK (("duration" = ANY (ARRAY['once'::"text", 'forever'::"text", 'repeating'::"text"])))
);


ALTER TABLE "public"."system_promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "maintenance_mode" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "seo_settings" "jsonb"
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_settings" IS 'Stores system-wide configuration settings like maintenance mode. Only super_admin can read/write.';



COMMENT ON COLUMN "public"."system_settings"."maintenance_mode" IS 'When true, only super_admin users can access the platform. All other users see maintenance page.';



COMMENT ON COLUMN "public"."system_settings"."seo_settings" IS 'Stores SEO configuration settings including metadata, Open Graph, Twitter cards, and structured data.';



CREATE TABLE IF NOT EXISTS "public"."system_subscriptions" (
    "id" "text" NOT NULL,
    "user_id" "uuid",
    "plan_id" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trial_start_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "grace_period_days" integer DEFAULT 7,
    "last_upgrade_prompt" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "pending_email" "text",
    "household_id" "uuid",
    CONSTRAINT "subscriptions_userid_or_householdid_check" CHECK ((("user_id" IS NOT NULL) OR ("household_id" IS NOT NULL)))
);


ALTER TABLE "public"."system_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."system_subscriptions"."user_id" IS 'User ID. NULL if subscription is pending user signup.';



COMMENT ON COLUMN "public"."system_subscriptions"."trial_start_date" IS 'Start date of the trial period';



COMMENT ON COLUMN "public"."system_subscriptions"."trial_end_date" IS 'End date of the trial period. After this date, user must subscribe to continue.';



COMMENT ON COLUMN "public"."system_subscriptions"."grace_period_days" IS 'Number of days of grace period after trial expires (default: 7)';



COMMENT ON COLUMN "public"."system_subscriptions"."last_upgrade_prompt" IS 'Timestamp of last upgrade prompt shown to user';



COMMENT ON COLUMN "public"."system_subscriptions"."expired_at" IS 'Timestamp when subscription/trial expired';



COMMENT ON COLUMN "public"."system_subscriptions"."pending_email" IS 'Email address for pending subscriptions waiting to be linked to a user account.';



CREATE TABLE IF NOT EXISTS "public"."system_tax_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "countryCode" "text" NOT NULL,
    "stateOrProvinceCode" "text" NOT NULL,
    "taxRate" numeric(6,4) NOT NULL,
    "displayName" "text" NOT NULL,
    "description" "text",
    "isActive" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "taxrates_countrycode_check" CHECK (("countryCode" = ANY (ARRAY['US'::"text", 'CA'::"text"]))),
    CONSTRAINT "taxrates_taxrate_check" CHECK ((("taxRate" >= (0)::numeric) AND ("taxRate" <= (1)::numeric)))
);


ALTER TABLE "public"."system_tax_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_user_active_households" (
    "user_id" "uuid" NOT NULL,
    "household_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."system_user_active_households" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_user_active_households" IS 'Tracks which household is currently active for each user';



COMMENT ON COLUMN "public"."system_user_active_households"."household_id" IS 'The currently active household for this user';



CREATE TABLE IF NOT EXISTS "public"."system_user_block_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "reason" "text",
    "blocked_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "userblockhistory_action_check" CHECK (("action" = ANY (ARRAY['block'::"text", 'unblock'::"text"])))
);


ALTER TABLE "public"."system_user_block_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_user_block_history" IS 'Tracks history of user blocks and unblocks with reasons. RLS enabled to enforce access control policies.';



COMMENT ON COLUMN "public"."system_user_block_history"."action" IS 'Action taken: block or unblock';



COMMENT ON COLUMN "public"."system_user_block_history"."reason" IS 'Reason/comment for the action';



COMMENT ON COLUMN "public"."system_user_block_history"."blocked_by" IS 'User ID of the admin who performed the action';



CREATE TABLE IF NOT EXISTS "public"."system_user_monthly_usage" (
    "user_id" "uuid" NOT NULL,
    "monthDate" "date" NOT NULL,
    "transactions_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."system_user_monthly_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_user_monthly_usage" IS 'Aggregated monthly transaction counts per user. Used for fast limit checking without COUNT(*) queries.';



COMMENT ON COLUMN "public"."system_user_monthly_usage"."monthDate" IS 'First day of the month (e.g., 2025-11-01). Used instead of text YYYY-MM for better ergonomics.';



COMMENT ON COLUMN "public"."system_user_monthly_usage"."transactions_count" IS 'Number of transactions for this user in this month. For transfers, counts as 1 (not 2) for new transactions.';



CREATE TABLE IF NOT EXISTS "public"."transaction_syncs" (
    "id" "text" NOT NULL,
    "account_id" "text" NOT NULL,
    "transaction_id" "text",
    "sync_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "status" "text" DEFAULT 'synced'::"text",
    "household_id" "uuid"
);


ALTER TABLE "public"."transaction_syncs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_name" "text" NOT NULL,
    "subcategory_id" "text",
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "billing_frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "billing_day" integer,
    "account_id" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "first_billing_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "household_id" "uuid",
    "plan_id" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "usersubscriptions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "usersubscriptions_billingday_check" CHECK (((("billing_frequency" = 'monthly'::"text") AND ("billing_day" >= 1) AND ("billing_day" <= 31)) OR (("billing_frequency" = 'semimonthly'::"text") AND ("billing_day" >= 1) AND ("billing_day" <= 31)) OR (("billing_frequency" = 'weekly'::"text") AND ("billing_day" >= 0) AND ("billing_day" <= 6)) OR (("billing_frequency" = 'biweekly'::"text") AND ("billing_day" >= 0) AND ("billing_day" <= 6)) OR (("billing_frequency" = 'daily'::"text") AND ("billing_day" IS NULL)))),
    CONSTRAINT "usersubscriptions_billingfrequency_check" CHECK (("billing_frequency" = ANY (ARRAY['monthly'::"text", 'weekly'::"text", 'biweekly'::"text", 'semimonthly'::"text", 'daily'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_subscriptions" IS 'Recurring service subscriptions that automatically create Planned Payments';



COMMENT ON COLUMN "public"."user_subscriptions"."service_name" IS 'Name of the service (can be custom or from subcategory)';



COMMENT ON COLUMN "public"."user_subscriptions"."subcategory_id" IS 'Subcategory ID if service is based on existing subcategory';



COMMENT ON COLUMN "public"."user_subscriptions"."billing_frequency" IS 'How often the subscription is billed: monthly, weekly, biweekly, semimonthly, daily';



COMMENT ON COLUMN "public"."user_subscriptions"."billing_day" IS 'Day of month (1-31) for monthly/semimonthly, or day of week (0-6, Sunday=0) for weekly/biweekly';



COMMENT ON COLUMN "public"."user_subscriptions"."is_active" IS 'Whether the subscription is currently active (paused subscriptions do not generate planned payments)';



COMMENT ON COLUMN "public"."user_subscriptions"."first_billing_date" IS 'Date of the first billing/payment';



COMMENT ON COLUMN "public"."user_subscriptions"."plan_id" IS 'ID of the selected plan from SubscriptionServicePlan (optional)';



COMMENT ON COLUMN "public"."user_subscriptions"."deleted_at" IS 'Soft delete timestamp. When set, the record is considered deleted but not removed from database.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "phone_number" "text",
    "date_of_birth" "date",
    "effective_plan_id" "text",
    "effective_subscription_status" "text",
    "effective_subscription_id" "text",
    "subscription_updated_at" timestamp with time zone,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "temporary_expected_income" "text",
    "temporary_expected_income_amount" numeric(12,2)
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'User accounts are deleted immediately upon request. No grace period or soft deletion.';



COMMENT ON COLUMN "public"."users"."effective_plan_id" IS 'Cached plan ID - for household members, this is the owner''s plan. For owners, this is their own plan.';



COMMENT ON COLUMN "public"."users"."effective_subscription_status" IS 'Cached subscription status - active, trialing, cancelled, etc.';



COMMENT ON COLUMN "public"."users"."effective_subscription_id" IS 'Cached subscription ID for reference';



COMMENT ON COLUMN "public"."users"."subscription_updated_at" IS 'Timestamp when subscription cache was last updated';



COMMENT ON COLUMN "public"."users"."is_blocked" IS 'When true, user is blocked from accessing the system and cannot log in. Subscription is paused until unblocked.';



COMMENT ON COLUMN "public"."users"."temporary_expected_income" IS 'Temporary storage for expected income range during onboarding, before household is created. Values: "0-50k", "50k-100k", "100k-150k", "150k-250k", "250k+", or NULL.';



COMMENT ON COLUMN "public"."users"."temporary_expected_income_amount" IS 'Temporary storage for exact expected income amount (in dollars) during onboarding, before household is created. Used when user provides a custom value instead of selecting a range.';



CREATE OR REPLACE VIEW "public"."vw_transactions_for_reports" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."type",
    "t"."amount",
    "t"."date",
    "t"."description",
    "t"."account_id",
    "t"."category_id",
    "t"."subcategory_id",
    "t"."user_id",
    "t"."household_id",
    "t"."created_at",
    "t"."updated_at",
    "a"."name" AS "account_name",
    "a"."type" AS "account_type",
    "c"."name" AS "category_name",
    "s"."name" AS "subcategory_name"
   FROM ((("public"."transactions" "t"
     LEFT JOIN "public"."accounts" "a" ON (("t"."account_id" = "a"."id")))
     LEFT JOIN "public"."categories" "c" ON (("t"."category_id" = "c"."id")))
     LEFT JOIN "public"."subcategories" "s" ON (("t"."subcategory_id" = "s"."id")))
  WHERE ("t"."deleted_at" IS NULL);


ALTER VIEW "public"."vw_transactions_for_reports" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_integrations"
    ADD CONSTRAINT "accountIntegrations_accountId_key" UNIQUE ("account_id");



ALTER TABLE ONLY "public"."account_integrations"
    ADD CONSTRAINT "accountIntegrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_investment_values"
    ADD CONSTRAINT "accountInvestmentValues_accountId_key" UNIQUE ("account_id");



ALTER TABLE ONLY "public"."account_investment_values"
    ADD CONSTRAINT "accountInvestmentValues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_owners"
    ADD CONSTRAINT "accountOwners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "auditLogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budgetCategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candles"
    ADD CONSTRAINT "candles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_groups"
    ADD CONSTRAINT "categoryGroups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_category_learning"
    ADD CONSTRAINT "categoryLearning_pkey" PRIMARY KEY ("user_id", "normalized_description", "type");



ALTER TABLE ONLY "public"."system_contact_forms"
    ADD CONSTRAINT "contactForms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_error_codes"
    ADD CONSTRAINT "errorCodes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_federal_tax_brackets"
    ADD CONSTRAINT "federalTaxBrackets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "householdMembers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_import_jobs"
    ADD CONSTRAINT "importJobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investment_accounts"
    ADD CONSTRAINT "investmentAccounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investment_transactions"
    ADD CONSTRAINT "investmentTransactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedPayments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_plans"
    ADD CONSTRAINT "plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."system_plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_promo_codes"
    ADD CONSTRAINT "promoCodes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."system_promo_codes"
    ADD CONSTRAINT "promoCodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_promo_codes"
    ADD CONSTRAINT "promoCodes_stripeCouponId_key" UNIQUE ("stripe_coupon_id");



ALTER TABLE ONLY "public"."securities"
    ADD CONSTRAINT "securities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_prices"
    ADD CONSTRAINT "securityPrices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_investment_entries"
    ADD CONSTRAINT "simpleInvestmentEntries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_service_categories"
    ADD CONSTRAINT "subscriptionServiceCategories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_service_categories"
    ADD CONSTRAINT "subscriptionServiceCategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_service_plans"
    ADD CONSTRAINT "subscriptionServicePlans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_services"
    ADD CONSTRAINT "subscriptionServices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_subscriptions"
    ADD CONSTRAINT "subscriptions_stripeSubscriptionId_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."system_tax_rates"
    ADD CONSTRAINT "taxRates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_syncs"
    ADD CONSTRAINT "transactionSyncs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_user_active_households"
    ADD CONSTRAINT "userActiveHouseholds_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."system_user_block_history"
    ADD CONSTRAINT "userBlockHistory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_user_monthly_usage"
    ADD CONSTRAINT "userMonthlyUsage_pkey" PRIMARY KEY ("user_id", "monthDate");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "userSubscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_webhook_events"
    ADD CONSTRAINT "webhookEvents_eventId_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."audit_webhook_events"
    ADD CONSTRAINT "webhookEvents_pkey" PRIMARY KEY ("id");



CREATE INDEX "account_investment_values_household_id_idx" ON "public"."account_investment_values" USING "btree" ("household_id");



CREATE INDEX "accountintegrations_accountid_idx" ON "public"."account_integrations" USING "btree" ("account_id");



CREATE INDEX "accountinvestmentvalues_accountid_idx" ON "public"."account_investment_values" USING "btree" ("account_id");



CREATE INDEX "accountowners_accountid_idx" ON "public"."account_owners" USING "btree" ("account_id");



CREATE UNIQUE INDEX "accountowners_accountid_ownerid_key" ON "public"."account_owners" USING "btree" ("account_id", "owner_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "accountowners_ownerid_idx" ON "public"."account_owners" USING "btree" ("owner_id");



CREATE INDEX "accounts_householdid_idx" ON "public"."accounts" USING "btree" ("household_id");



CREATE INDEX "accounts_type_idx" ON "public"."accounts" USING "btree" ("type");



CREATE INDEX "accounts_userid_idx" ON "public"."accounts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "auditlogs_createdat_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "auditlogs_tablename_recordid_idx" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "auditlogs_userid_idx" ON "public"."audit_logs" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "budgetcategories_budgetid_categoryid_key" ON "public"."budget_categories" USING "btree" ("budget_id", "category_id");



CREATE INDEX "budgetcategories_budgetid_idx" ON "public"."budget_categories" USING "btree" ("budget_id");



CREATE INDEX "budgetcategories_categoryid_idx" ON "public"."budget_categories" USING "btree" ("category_id");



CREATE INDEX "budgets_categoryid_period_idx" ON "public"."budgets" USING "btree" ("category_id", "period");



CREATE INDEX "budgets_groupid_idx" ON "public"."budgets" USING "btree" ("group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "budgets_householdid_idx" ON "public"."budgets" USING "btree" ("household_id");



CREATE UNIQUE INDEX "budgets_period_categoryid_subcategoryid_key" ON "public"."budgets" USING "btree" ("period", "category_id", COALESCE("subcategory_id", ''::"text")) WHERE ("category_id" IS NOT NULL);



CREATE UNIQUE INDEX "budgets_period_groupid_key" ON "public"."budgets" USING "btree" ("period", "group_id") WHERE ("group_id" IS NOT NULL);



CREATE INDEX "budgets_period_idx" ON "public"."budgets" USING "btree" ("period");



CREATE INDEX "budgets_subcategoryid_idx" ON "public"."budgets" USING "btree" ("subcategory_id") WHERE ("subcategory_id" IS NOT NULL);



CREATE INDEX "budgets_userid_idx" ON "public"."budgets" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "candles_security_id_start_idx" ON "public"."candles" USING "btree" ("security_id", "start");



CREATE INDEX "categories_groupid_idx" ON "public"."categories" USING "btree" ("group_id");



CREATE INDEX "categories_name_idx" ON "public"."categories" USING "btree" ("name");



CREATE INDEX "categories_userid_idx" ON "public"."categories" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "categorygroups_name_idx" ON "public"."category_groups" USING "btree" ("name");



CREATE UNIQUE INDEX "categorygroups_name_key_system" ON "public"."category_groups" USING "btree" ("name") WHERE ("user_id" IS NULL);



CREATE UNIQUE INDEX "categorygroups_name_userid_key" ON "public"."category_groups" USING "btree" ("name", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "categorygroups_userid_idx" ON "public"."category_groups" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "categorylearning_categoryid_idx" ON "public"."analytics_category_learning" USING "btree" ("category_id");



CREATE INDEX "categorylearning_lastusedat_idx" ON "public"."analytics_category_learning" USING "btree" ("last_used_at" DESC);



CREATE INDEX "categorylearning_userid_idx" ON "public"."analytics_category_learning" USING "btree" ("user_id");



CREATE INDEX "contactforms_createdat_idx" ON "public"."system_contact_forms" USING "btree" ("created_at" DESC);



CREATE INDEX "contactforms_userid_idx" ON "public"."system_contact_forms" USING "btree" ("user_id");



CREATE INDEX "debts_accountid_idx" ON "public"."debts" USING "btree" ("account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "debts_householdid_idx" ON "public"."debts" USING "btree" ("household_id");



CREATE INDEX "debts_userid_idx" ON "public"."debts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "executions_account_id_idx" ON "public"."executions" USING "btree" ("account_id");



CREATE INDEX "executions_household_id_idx" ON "public"."executions" USING "btree" ("household_id");



CREATE INDEX "federaltaxbrackets_countrycode_taxyear_idx" ON "public"."system_federal_tax_brackets" USING "btree" ("countryCode", "taxYear");



CREATE INDEX "federaltaxbrackets_isactive_idx" ON "public"."system_federal_tax_brackets" USING "btree" ("isActive");



CREATE INDEX "feedback_createdat_idx" ON "public"."system_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "feedback_userid_idx" ON "public"."system_feedback" USING "btree" ("user_id");



CREATE INDEX "goals_accountid_idx" ON "public"."goals" USING "btree" ("account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "goals_householdid_idx" ON "public"."goals" USING "btree" ("household_id");



CREATE INDEX "goals_userid_idx" ON "public"."goals" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "householdmembers_email_idx" ON "public"."household_members" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "householdmembers_householdid_idx" ON "public"."household_members" USING "btree" ("household_id");



CREATE UNIQUE INDEX "householdmembers_householdid_userid_key" ON "public"."household_members" USING "btree" ("household_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "householdmembers_householdid_userid_status_idx" ON "public"."household_members" USING "btree" ("household_id", "user_id", "status");



CREATE UNIQUE INDEX "householdmembers_invitationtoken_idx" ON "public"."household_members" USING "btree" ("invitation_token") WHERE ("invitation_token" IS NOT NULL);



CREATE INDEX "householdmembers_invitedby_idx" ON "public"."household_members" USING "btree" ("invited_by");



CREATE INDEX "householdmembers_userid_idx" ON "public"."household_members" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "householdmembers_userid_status_idx" ON "public"."household_members" USING "btree" ("user_id", "status");



CREATE INDEX "households_createdby_idx" ON "public"."households" USING "btree" ("created_by");



CREATE INDEX "households_type_createdby_idx" ON "public"."households" USING "btree" ("type", "created_by");



CREATE INDEX "importjobs_accountid_idx" ON "public"."system_import_jobs" USING "btree" ("account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "importjobs_status_idx" ON "public"."system_import_jobs" USING "btree" ("status");



CREATE INDEX "importjobs_userid_idx" ON "public"."system_import_jobs" USING "btree" ("user_id");



CREATE INDEX "investmentaccounts_accountid_idx" ON "public"."investment_accounts" USING "btree" ("account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "investmentaccounts_householdid_idx" ON "public"."investment_accounts" USING "btree" ("household_id");



CREATE INDEX "investmentaccounts_userid_idx" ON "public"."investment_accounts" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "investmenttransactions_accountid_idx" ON "public"."investment_transactions" USING "btree" ("account_id");



CREATE INDEX "investmenttransactions_date_idx" ON "public"."investment_transactions" USING "btree" ("date");



CREATE INDEX "investmenttransactions_householdid_idx" ON "public"."investment_transactions" USING "btree" ("household_id");



CREATE INDEX "investmenttransactions_securityid_idx" ON "public"."investment_transactions" USING "btree" ("security_id") WHERE ("security_id" IS NOT NULL);



CREATE INDEX "orders_account_id_idx" ON "public"."orders" USING "btree" ("account_id");



CREATE INDEX "orders_household_id_idx" ON "public"."orders" USING "btree" ("household_id");



CREATE INDEX "plannedpayments_accountid_idx" ON "public"."planned_payments" USING "btree" ("account_id");



CREATE INDEX "plannedpayments_date_idx" ON "public"."planned_payments" USING "btree" ("date");



CREATE INDEX "plannedpayments_householdid_idx" ON "public"."planned_payments" USING "btree" ("household_id");



CREATE INDEX "plannedpayments_status_idx" ON "public"."planned_payments" USING "btree" ("status");



CREATE INDEX "plannedpayments_userid_idx" ON "public"."planned_payments" USING "btree" ("user_id");



CREATE INDEX "positions_account_id_idx" ON "public"."positions" USING "btree" ("account_id");



CREATE UNIQUE INDEX "positions_account_id_security_id_unique" ON "public"."positions" USING "btree" ("account_id", "security_id");



CREATE INDEX "positions_household_id_idx" ON "public"."positions" USING "btree" ("household_id");



CREATE INDEX "positions_security_id_idx" ON "public"."positions" USING "btree" ("security_id");



CREATE INDEX "security_prices_security_id_idx" ON "public"."security_prices" USING "btree" ("security_id");



CREATE INDEX "securityprices_date_idx" ON "public"."security_prices" USING "btree" ("date");



CREATE INDEX "simple_investment_entries_account_id_idx" ON "public"."simple_investment_entries" USING "btree" ("account_id");



CREATE INDEX "simple_investment_entries_household_id_idx" ON "public"."simple_investment_entries" USING "btree" ("household_id");



CREATE INDEX "subcategories_categoryid_idx" ON "public"."subcategories" USING "btree" ("category_id");



CREATE INDEX "subcategories_userid_idx" ON "public"."subcategories" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "subscriptions_householdid_idx" ON "public"."system_subscriptions" USING "btree" ("household_id") WHERE ("household_id" IS NOT NULL);



CREATE INDEX "subscriptions_planid_idx" ON "public"."system_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "subscriptions_stripesubscriptionid_idx" ON "public"."system_subscriptions" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "subscriptions_userid_idx" ON "public"."system_subscriptions" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "subscriptionserviceplans_serviceid_idx" ON "public"."subscription_service_plans" USING "btree" ("service_id");



CREATE INDEX "subscriptionservices_categoryid_idx" ON "public"."subscription_services" USING "btree" ("category_id");



CREATE INDEX "taxrates_countrycode_idx" ON "public"."system_tax_rates" USING "btree" ("countryCode");



CREATE INDEX "taxrates_isactive_idx" ON "public"."system_tax_rates" USING "btree" ("isActive");



CREATE INDEX "transactions_accountid_idx" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "transactions_categoryid_idx" ON "public"."transactions" USING "btree" ("category_id") WHERE ("category_id" IS NOT NULL);



CREATE INDEX "transactions_date_idx" ON "public"."transactions" USING "btree" ("date" DESC);



CREATE INDEX "transactions_householdid_idx" ON "public"."transactions" USING "btree" ("household_id");



CREATE INDEX "transactions_suggested_category_id_idx" ON "public"."transactions" USING "btree" ("suggested_category_id") WHERE ("suggested_category_id" IS NOT NULL);



CREATE INDEX "transactions_suggested_subcategory_id_idx" ON "public"."transactions" USING "btree" ("suggested_subcategory_id") WHERE ("suggested_subcategory_id" IS NOT NULL);



CREATE INDEX "transactions_type_idx" ON "public"."transactions" USING "btree" ("type");



CREATE INDEX "transactions_userid_idx" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "transactionsyncs_accountid_idx" ON "public"."transaction_syncs" USING "btree" ("account_id");



CREATE INDEX "transactionsyncs_transactionid_idx" ON "public"."transaction_syncs" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "userblockhistory_blockedby_idx" ON "public"."system_user_block_history" USING "btree" ("blocked_by");



CREATE INDEX "userblockhistory_userid_idx" ON "public"."system_user_block_history" USING "btree" ("user_id");



CREATE INDEX "usersubscriptions_accountid_idx" ON "public"."user_subscriptions" USING "btree" ("account_id");



CREATE INDEX "usersubscriptions_householdid_idx" ON "public"."user_subscriptions" USING "btree" ("household_id");



CREATE INDEX "usersubscriptions_subcategoryid_idx" ON "public"."user_subscriptions" USING "btree" ("subcategory_id") WHERE ("subcategory_id" IS NOT NULL);



CREATE INDEX "usersubscriptions_userid_idx" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "webhookevents_eventid_idx" ON "public"."audit_webhook_events" USING "btree" ("event_id");



CREATE INDEX "webhookevents_eventtype_idx" ON "public"."audit_webhook_events" USING "btree" ("event_type");



CREATE INDEX "webhookevents_processedat_idx" ON "public"."audit_webhook_events" USING "btree" ("processed_at" DESC);



CREATE OR REPLACE TRIGGER "audit_account_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_household_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_subscription_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."system_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_transaction_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "audit_user_changes" AFTER DELETE OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();



CREATE OR REPLACE TRIGGER "federal_brackets_updated_at_trigger" BEFORE UPDATE ON "public"."system_federal_tax_brackets" FOR EACH ROW EXECUTE FUNCTION "public"."update_federal_brackets_updated_at"();



CREATE OR REPLACE TRIGGER "prevent_emergency_fund_deletion_trigger" BEFORE DELETE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_emergency_fund_deletion"();



CREATE OR REPLACE TRIGGER "subscription_cache_update_trigger" AFTER INSERT OR UPDATE OF "user_id", "plan_id", "status" ON "public"."system_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_subscription_cache"();



CREATE OR REPLACE TRIGGER "tax_rates_updated_at_trigger" BEFORE UPDATE ON "public"."system_tax_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_tax_rates_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_refresh_budget_spending_delete" AFTER DELETE ON "public"."transactions" FOR EACH ROW WHEN ((("old"."type" = 'expense'::"text") AND ("old"."category_id" IS NOT NULL))) EXECUTE FUNCTION "public"."refresh_budget_spending_on_transaction_change"();



CREATE OR REPLACE TRIGGER "trigger_refresh_budget_spending_insert" AFTER INSERT ON "public"."transactions" FOR EACH ROW WHEN ((("new"."type" = 'expense'::"text") AND ("new"."category_id" IS NOT NULL))) EXECUTE FUNCTION "public"."refresh_budget_spending_on_transaction_change"();



CREATE OR REPLACE TRIGGER "trigger_refresh_budget_spending_update" AFTER UPDATE ON "public"."transactions" FOR EACH ROW WHEN ((("old"."date" IS DISTINCT FROM "new"."date") OR ("old"."amount" IS DISTINCT FROM "new"."amount") OR ("old"."category_id" IS DISTINCT FROM "new"."category_id") OR ("old"."subcategory_id" IS DISTINCT FROM "new"."subcategory_id") OR ("old"."type" IS DISTINCT FROM "new"."type"))) EXECUTE FUNCTION "public"."refresh_budget_spending_on_transaction_change"();



CREATE OR REPLACE TRIGGER "update_plan_updated_at" BEFORE UPDATE ON "public"."system_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_promo_code_updated_at" BEFORE UPDATE ON "public"."system_promo_codes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_updated_at" BEFORE UPDATE ON "public"."system_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_plan_features_trigger" BEFORE INSERT OR UPDATE ON "public"."system_plans" FOR EACH ROW EXECUTE FUNCTION "public"."validate_plan_features"();



ALTER TABLE ONLY "public"."account_investment_values"
    ADD CONSTRAINT "account_investment_values_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_integrations"
    ADD CONSTRAINT "accountintegrations_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_investment_values"
    ADD CONSTRAINT "accountinvestmentvalues_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_owners"
    ADD CONSTRAINT "accountowners_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_owners"
    ADD CONSTRAINT "accountowners_ownerid_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budgetcategories_budgetid_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budgetcategories_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_groupid_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_subcategoryid_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candles"
    ADD CONSTRAINT "candles_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_groupid_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_groups"
    ADD CONSTRAINT "categorygroups_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_category_learning"
    ADD CONSTRAINT "categorylearning_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_category_learning"
    ADD CONSTRAINT "categorylearning_subcategoryid_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_category_learning"
    ADD CONSTRAINT "categorylearning_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_contact_forms"
    ADD CONSTRAINT "contactforms_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."executions"
    ADD CONSTRAINT "executions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_feedback"
    ADD CONSTRAINT "feedback_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "householdmembers_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "householdmembers_invitedby_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "householdmembers_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_createdby_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_import_jobs"
    ADD CONSTRAINT "importjobs_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_import_jobs"
    ADD CONSTRAINT "importjobs_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_accounts"
    ADD CONSTRAINT "investmentaccounts_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."investment_accounts"
    ADD CONSTRAINT "investmentaccounts_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_accounts"
    ADD CONSTRAINT "investmentaccounts_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_transactions"
    ADD CONSTRAINT "investmenttransactions_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_transactions"
    ADD CONSTRAINT "investmenttransactions_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_transactions"
    ADD CONSTRAINT "investmenttransactions_securityid_fkey" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_debtid_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_linkedtransactionid_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_subcategoryid_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_subscriptionid_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_toaccountid_fkey" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_payments"
    ADD CONSTRAINT "plannedpayments_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."investment_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_prices"
    ADD CONSTRAINT "security_prices_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_investment_entries"
    ADD CONSTRAINT "simple_investment_entries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simple_investment_entries"
    ADD CONSTRAINT "simpleinvestmententries_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_subscriptions"
    ADD CONSTRAINT "subscriptions_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_subscriptions"
    ADD CONSTRAINT "subscriptions_planid_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."system_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_subscriptions"
    ADD CONSTRAINT "subscriptions_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_service_plans"
    ADD CONSTRAINT "subscriptionserviceplans_serviceid_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."subscription_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_services"
    ADD CONSTRAINT "subscriptionservices_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."subscription_service_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_categoryid_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_subcategoryid_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_suggested_subcategory_id_fkey" FOREIGN KEY ("suggested_subcategory_id") REFERENCES "public"."subcategories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_syncs"
    ADD CONSTRAINT "transactionsyncs_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_syncs"
    ADD CONSTRAINT "transactionsyncs_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_syncs"
    ADD CONSTRAINT "transactionsyncs_transactionid_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_user_active_households"
    ADD CONSTRAINT "useractivehouseholds_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_user_active_households"
    ADD CONSTRAINT "useractivehouseholds_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_user_block_history"
    ADD CONSTRAINT "userblockhistory_blockedby_fkey" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_user_block_history"
    ADD CONSTRAINT "userblockhistory_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_user_monthly_usage"
    ADD CONSTRAINT "usermonthlyusage_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "usersubscriptions_accountid_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "usersubscriptions_householdid_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "usersubscriptions_planid_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_service_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "usersubscriptions_subcategoryid_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "usersubscriptions_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."account_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_integrations_delete" ON "public"."account_integrations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_integrations"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "account_integrations_insert" ON "public"."account_integrations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_integrations"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "account_integrations_select" ON "public"."account_integrations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_integrations"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."account_owners" "ao"
          WHERE (("ao"."account_id" = "a"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("a"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "a"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))));



CREATE POLICY "account_integrations_update" ON "public"."account_integrations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_integrations"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."account_investment_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_investment_values_delete" ON "public"."account_investment_values" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "account_investment_values"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "account_investment_values_insert" ON "public"."account_investment_values" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "account_investment_values"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))));



CREATE POLICY "account_investment_values_select" ON "public"."account_investment_values" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "account_investment_values"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))));



CREATE POLICY "account_investment_values_update" ON "public"."account_investment_values" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "account_investment_values"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))));



ALTER TABLE "public"."account_owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_owners_delete" ON "public"."account_owners" FOR DELETE USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_owners"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."household_id" IS NOT NULL) AND "public"."is_household_admin_or_owner"("a"."household_id"))))))));



CREATE POLICY "account_owners_insert" ON "public"."account_owners" FOR INSERT WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."can_access_account"("account_id")));



CREATE POLICY "account_owners_select" ON "public"."account_owners" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR "public"."can_access_account"("account_id")));



CREATE POLICY "account_owners_update" ON "public"."account_owners" FOR UPDATE USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "account_owners"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."household_id" IS NOT NULL) AND "public"."is_household_admin_or_owner"("a"."household_id"))))))));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_delete_own" ON "public"."accounts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "accounts_insert_own" ON "public"."accounts" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "accounts_select_own" ON "public"."accounts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."account_owners" "ao"
  WHERE (("ao"."account_id" = "accounts"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "accounts_update_own" ON "public"."accounts" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."account_owners" "ao"
  WHERE (("ao"."account_id" = "accounts"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."analytics_category_learning" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_category_learning_delete" ON "public"."analytics_category_learning" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "analytics_category_learning_insert" ON "public"."analytics_category_learning" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "analytics_category_learning_select" ON "public"."analytics_category_learning" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "analytics_category_learning_update" ON "public"."analytics_category_learning" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_insert" ON "public"."audit_logs" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "audit_logs_select" ON "public"."audit_logs" FOR SELECT USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."audit_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_webhook_events_insert" ON "public"."audit_webhook_events" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "audit_webhook_events_select" ON "public"."audit_webhook_events" FOR SELECT USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."budget_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_categories_delete" ON "public"."budget_categories" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."budgets" "b"
  WHERE (("b"."id" = "budget_categories"."budget_id") AND (("b"."user_id" = "auth"."uid"()) OR (("b"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "b"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))));



CREATE POLICY "budget_categories_insert" ON "public"."budget_categories" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."budgets" "b"
  WHERE (("b"."id" = "budget_categories"."budget_id") AND (("b"."user_id" = "auth"."uid"()) OR (("b"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "b"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))));



CREATE POLICY "budget_categories_select" ON "public"."budget_categories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."budgets" "b"
  WHERE (("b"."id" = "budget_categories"."budget_id") AND (("b"."user_id" = "auth"."uid"()) OR (("b"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "b"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))));



CREATE POLICY "budget_categories_update" ON "public"."budget_categories" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."budgets" "b"
  WHERE (("b"."id" = "budget_categories"."budget_id") AND (("b"."user_id" = "auth"."uid"()) OR (("b"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "b"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budgets_delete" ON "public"."budgets" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "budgets_insert" ON "public"."budgets" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "budgets"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "budgets_select" ON "public"."budgets" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "budgets"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "budgets_update" ON "public"."budgets" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "budgets"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."candles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candles_delete" ON "public"."candles" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "candles_insert" ON "public"."candles" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "candles_select" ON "public"."candles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "candles_update" ON "public"."candles" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete" ON "public"."categories" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_insert" ON "public"."categories" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."category_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_groups_delete" ON "public"."category_groups" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "category_groups_insert" ON "public"."category_groups" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "category_groups_select" ON "public"."category_groups" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "category_groups_update" ON "public"."category_groups" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "debts_delete" ON "public"."debts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "debts_insert" ON "public"."debts" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "debts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "debts_select" ON "public"."debts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "debts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "debts_update" ON "public"."debts" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "debts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "executions_delete" ON "public"."executions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "executions"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "executions_insert" ON "public"."executions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "executions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "executions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "executions_select" ON "public"."executions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "executions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "executions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "executions_update" ON "public"."executions" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "executions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "executions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_delete" ON "public"."goals" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND (("is_system_goal" IS NULL) OR ("is_system_goal" = false))));



CREATE POLICY "goals_insert" ON "public"."goals" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "goals"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "goals_select" ON "public"."goals" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "goals"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "goals_update" ON "public"."goals" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "goals"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "household_members_insert" ON "public"."household_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."households" "h"
  WHERE (("h"."id" = "household_members"."household_id") AND ("h"."created_by" = "auth"."uid"()))))));



CREATE POLICY "household_members_select_member" ON "public"."household_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_household_member"("household_id", "user_id")));



CREATE POLICY "household_members_update" ON "public"."household_members" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."households" "h"
  WHERE (("h"."id" = "household_members"."household_id") AND ("h"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "households_insert_own" ON "public"."households" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "households_select_member" ON "public"."households" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "households"."id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))));



CREATE POLICY "households_update_owner" ON "public"."households" FOR UPDATE USING (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."investment_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investment_accounts_delete" ON "public"."investment_accounts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "investment_accounts_insert" ON "public"."investment_accounts" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "investment_accounts_select" ON "public"."investment_accounts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "investment_accounts_update" ON "public"."investment_accounts" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_accounts"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."investment_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investment_transactions_delete" ON "public"."investment_transactions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "investment_transactions"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "investment_transactions_insert" ON "public"."investment_transactions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "investment_transactions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "investment_transactions_select" ON "public"."investment_transactions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "investment_transactions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "investment_transactions_update" ON "public"."investment_transactions" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "investment_transactions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "investment_transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_delete" ON "public"."orders" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "orders"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "orders_insert" ON "public"."orders" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "orders"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "orders"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "orders_select" ON "public"."orders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "orders"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "orders"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "orders_update" ON "public"."orders" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "orders"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "orders"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."planned_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planned_payments_delete" ON "public"."planned_payments" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "planned_payments_insert" ON "public"."planned_payments" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "planned_payments"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "planned_payments_select" ON "public"."planned_payments" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "planned_payments"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "planned_payments_update" ON "public"."planned_payments" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "planned_payments"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "positions_delete" ON "public"."positions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "positions"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "positions_insert" ON "public"."positions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "positions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "positions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "positions_select" ON "public"."positions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "positions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "positions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "positions_update" ON "public"."positions" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "positions"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "positions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."securities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "securities_delete" ON "public"."securities" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "securities_insert" ON "public"."securities" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "securities_select" ON "public"."securities" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "securities_update" ON "public"."securities" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."security_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "security_prices_delete" ON "public"."security_prices" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "security_prices_insert" ON "public"."security_prices" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "security_prices_select" ON "public"."security_prices" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "security_prices_update" ON "public"."security_prices" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."simple_investment_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "simple_investment_entries_delete" ON "public"."simple_investment_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "simple_investment_entries"."account_id") AND ("ia"."user_id" = "auth"."uid"())))));



CREATE POLICY "simple_investment_entries_insert" ON "public"."simple_investment_entries" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "simple_investment_entries"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "simple_investment_entries"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "simple_investment_entries_select" ON "public"."simple_investment_entries" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "simple_investment_entries"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "simple_investment_entries"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "simple_investment_entries_update" ON "public"."simple_investment_entries" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."investment_accounts" "ia"
  WHERE (("ia"."id" = "simple_investment_entries"."account_id") AND (("ia"."user_id" = "auth"."uid"()) OR (("ia"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "ia"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "simple_investment_entries"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subcategories_delete" ON "public"."subcategories" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "subcategories"."category_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "subcategories_insert" ON "public"."subcategories" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "subcategories"."category_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "subcategories_select" ON "public"."subcategories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "subcategories"."category_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "subcategories_update" ON "public"."subcategories" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "subcategories"."category_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."subscription_service_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_service_categories_delete" ON "public"."subscription_service_categories" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_service_categories_insert" ON "public"."subscription_service_categories" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_service_categories_select" ON "public"."subscription_service_categories" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "subscription_service_categories_update" ON "public"."subscription_service_categories" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."subscription_service_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_service_plans_delete" ON "public"."subscription_service_plans" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_service_plans_insert" ON "public"."subscription_service_plans" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_service_plans_select" ON "public"."subscription_service_plans" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "subscription_service_plans_update" ON "public"."subscription_service_plans" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."subscription_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_services_delete" ON "public"."subscription_services" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_services_insert" ON "public"."subscription_services" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "subscription_services_select" ON "public"."subscription_services" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "subscription_services_update" ON "public"."subscription_services" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_contact_forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_contact_forms_delete" ON "public"."system_contact_forms" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_contact_forms_insert" ON "public"."system_contact_forms" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_contact_forms_select" ON "public"."system_contact_forms" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_contact_forms_update" ON "public"."system_contact_forms" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_error_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_error_codes_delete" ON "public"."system_error_codes" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_error_codes_insert" ON "public"."system_error_codes" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_error_codes_select" ON "public"."system_error_codes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_error_codes_update" ON "public"."system_error_codes" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_federal_tax_brackets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_federal_tax_brackets_delete" ON "public"."system_federal_tax_brackets" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_federal_tax_brackets_insert" ON "public"."system_federal_tax_brackets" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_federal_tax_brackets_select" ON "public"."system_federal_tax_brackets" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_federal_tax_brackets_update" ON "public"."system_federal_tax_brackets" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_feedback_delete" ON "public"."system_feedback" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_feedback_insert" ON "public"."system_feedback" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_feedback_select" ON "public"."system_feedback" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_feedback_update" ON "public"."system_feedback" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_import_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_import_jobs_delete" ON "public"."system_import_jobs" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_import_jobs_insert" ON "public"."system_import_jobs" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_import_jobs_select" ON "public"."system_import_jobs" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_import_jobs_update" ON "public"."system_import_jobs" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_plans_delete" ON "public"."system_plans" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_plans_insert" ON "public"."system_plans" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_plans_select" ON "public"."system_plans" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_plans_update" ON "public"."system_plans" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_promo_codes_delete" ON "public"."system_promo_codes" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_promo_codes_insert" ON "public"."system_promo_codes" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_promo_codes_select" ON "public"."system_promo_codes" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_promo_codes_update" ON "public"."system_promo_codes" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_delete" ON "public"."system_settings" FOR DELETE USING ("public"."is_super_admin"());



CREATE POLICY "system_settings_insert" ON "public"."system_settings" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "system_settings_select" ON "public"."system_settings" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_settings_update" ON "public"."system_settings" FOR UPDATE USING ("public"."is_super_admin"());



ALTER TABLE "public"."system_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_subscriptions_delete" ON "public"."system_subscriptions" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_subscriptions_insert" ON "public"."system_subscriptions" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_subscriptions_select" ON "public"."system_subscriptions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_subscriptions_update" ON "public"."system_subscriptions" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_tax_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_tax_rates_delete" ON "public"."system_tax_rates" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_tax_rates_insert" ON "public"."system_tax_rates" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_tax_rates_select" ON "public"."system_tax_rates" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_tax_rates_update" ON "public"."system_tax_rates" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_user_active_households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_user_active_households_delete" ON "public"."system_user_active_households" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_active_households_insert" ON "public"."system_user_active_households" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_active_households_select" ON "public"."system_user_active_households" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_active_households_update" ON "public"."system_user_active_households" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_user_block_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_user_block_history_delete" ON "public"."system_user_block_history" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_block_history_insert" ON "public"."system_user_block_history" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_block_history_select" ON "public"."system_user_block_history" FOR SELECT USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_block_history_update" ON "public"."system_user_block_history" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."system_user_monthly_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_user_monthly_usage_delete" ON "public"."system_user_monthly_usage" FOR DELETE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_monthly_usage_insert" ON "public"."system_user_monthly_usage" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_monthly_usage_select" ON "public"."system_user_monthly_usage" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "system_user_monthly_usage_update" ON "public"."system_user_monthly_usage" FOR UPDATE USING (("public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."transaction_syncs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transaction_syncs_delete" ON "public"."transaction_syncs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transaction_syncs"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "transaction_syncs_insert" ON "public"."transaction_syncs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transaction_syncs"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "transaction_syncs_select" ON "public"."transaction_syncs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transaction_syncs"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."account_owners" "ao"
          WHERE (("ao"."account_id" = "a"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("a"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "a"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))));



CREATE POLICY "transaction_syncs_update" ON "public"."transaction_syncs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transaction_syncs"."account_id") AND ("a"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_delete" ON "public"."transactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transactions"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."account_owners" "ao"
          WHERE (("ao"."account_id" = "a"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("a"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "a"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."accounts" "a"
  WHERE (("a"."id" = "transactions"."account_id") AND (("a"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."account_owners" "ao"
          WHERE (("ao"."account_id" = "a"."id") AND ("ao"."owner_id" = "auth"."uid"()) AND ("ao"."deleted_at" IS NULL)))) OR (("a"."household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."household_members" "hm"
          WHERE (("hm"."household_id" = "a"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text"))))))))) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text")))))));



CREATE POLICY "transactions_update" ON "public"."transactions" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("household_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "transactions"."household_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("hm"."status" = 'active'::"text") AND ("hm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))));



ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_subscriptions_delete" ON "public"."user_subscriptions" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "user_subscriptions_insert" ON "public"."user_subscriptions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "user_subscriptions_select" ON "public"."user_subscriptions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "user_subscriptions_update" ON "public"."user_subscriptions" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_super_admin"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_admin" ON "public"."users" FOR SELECT USING (("public"."is_admin"() OR "public"."is_super_admin"()));



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));



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



GRANT ALL ON FUNCTION "public"."can_access_account"("p_account_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_account"("p_account_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_account"("p_account_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_account_via_accountowner"("p_account_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_household_data"("p_household_id" "uuid", "p_operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_household_member"("p_household_id" "uuid", "p_user_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_personal_household_atomic"("p_user_id" "uuid", "p_household_name" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_deleted"("deleted_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_admin_or_owner"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_not_deleted"("p_table_name" "text", "p_record_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_household_onboarding_complete"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_household_onboarding_complete"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_household_onboarding_complete"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_emergency_fund_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."raise_error_with_code"("p_error_code" "text", "p_additional_info" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid", "p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid", "p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_for_period"("p_period" "date", "p_user_id" "uuid", "p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_budget_spending_on_transaction_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_on_transaction_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_on_transaction_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_budget_spending_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_budget_spending_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_subscription_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_federal_brackets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_federal_brackets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_federal_brackets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tax_rates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tax_rates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tax_rates_updated_at"() TO "service_role";



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



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."account_integrations" TO "anon";
GRANT ALL ON TABLE "public"."account_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."account_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."account_investment_values" TO "anon";
GRANT ALL ON TABLE "public"."account_investment_values" TO "authenticated";
GRANT ALL ON TABLE "public"."account_investment_values" TO "service_role";



GRANT ALL ON TABLE "public"."account_owners" TO "anon";
GRANT ALL ON TABLE "public"."account_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."account_owners" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."analytics_budget_spending_by_period" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_budget_spending_by_period" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_category_learning" TO "anon";
GRANT ALL ON TABLE "public"."analytics_category_learning" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_category_learning" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_categories" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."candles" TO "anon";
GRANT ALL ON TABLE "public"."candles" TO "authenticated";
GRANT ALL ON TABLE "public"."candles" TO "service_role";



GRANT ALL ON TABLE "public"."category_groups" TO "anon";
GRANT ALL ON TABLE "public"."category_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."category_groups" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."executions" TO "anon";
GRANT ALL ON TABLE "public"."executions" TO "authenticated";
GRANT ALL ON TABLE "public"."executions" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT ALL ON TABLE "public"."household_members" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."investment_accounts" TO "anon";
GRANT ALL ON TABLE "public"."investment_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."investment_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."investment_transactions" TO "anon";
GRANT ALL ON TABLE "public"."investment_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."investment_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."planned_payments" TO "anon";
GRANT ALL ON TABLE "public"."planned_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_payments" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."securities" TO "anon";
GRANT ALL ON TABLE "public"."securities" TO "authenticated";
GRANT ALL ON TABLE "public"."securities" TO "service_role";



GRANT ALL ON TABLE "public"."security_prices" TO "anon";
GRANT ALL ON TABLE "public"."security_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."security_prices" TO "service_role";



GRANT ALL ON TABLE "public"."simple_investment_entries" TO "anon";
GRANT ALL ON TABLE "public"."simple_investment_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."simple_investment_entries" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_service_categories" TO "anon";
GRANT ALL ON TABLE "public"."subscription_service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_service_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_service_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_service_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_services" TO "anon";
GRANT ALL ON TABLE "public"."subscription_services" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_services" TO "service_role";



GRANT ALL ON TABLE "public"."system_contact_forms" TO "anon";
GRANT ALL ON TABLE "public"."system_contact_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."system_contact_forms" TO "service_role";



GRANT ALL ON TABLE "public"."system_error_codes" TO "anon";
GRANT ALL ON TABLE "public"."system_error_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."system_error_codes" TO "service_role";



GRANT ALL ON TABLE "public"."system_federal_tax_brackets" TO "anon";
GRANT ALL ON TABLE "public"."system_federal_tax_brackets" TO "authenticated";
GRANT ALL ON TABLE "public"."system_federal_tax_brackets" TO "service_role";



GRANT ALL ON TABLE "public"."system_feedback" TO "anon";
GRANT ALL ON TABLE "public"."system_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."system_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."system_import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."system_import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."system_plans" TO "anon";
GRANT ALL ON TABLE "public"."system_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."system_plans" TO "service_role";



GRANT ALL ON TABLE "public"."system_promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."system_promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."system_promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."system_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."system_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."system_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."system_tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."system_tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."system_tax_rates" TO "service_role";



GRANT ALL ON TABLE "public"."system_user_active_households" TO "anon";
GRANT ALL ON TABLE "public"."system_user_active_households" TO "authenticated";
GRANT ALL ON TABLE "public"."system_user_active_households" TO "service_role";



GRANT ALL ON TABLE "public"."system_user_block_history" TO "anon";
GRANT ALL ON TABLE "public"."system_user_block_history" TO "authenticated";
GRANT ALL ON TABLE "public"."system_user_block_history" TO "service_role";



GRANT ALL ON TABLE "public"."system_user_monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."system_user_monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."system_user_monthly_usage" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_syncs" TO "anon";
GRANT ALL ON TABLE "public"."transaction_syncs" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_syncs" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



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







