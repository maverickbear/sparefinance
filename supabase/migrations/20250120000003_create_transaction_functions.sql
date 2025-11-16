-- Migration: Create SQL functions for atomic transaction creation with limit checking
-- These functions ensure limit checking and transaction creation happen atomically

-- Step 1: Create function to increment transaction count
CREATE OR REPLACE FUNCTION "increment_transaction_count"(
  p_user_id uuid,
  p_month_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Step 2: Create function to create regular transaction with limit check
CREATE OR REPLACE FUNCTION "create_transaction_with_limit"(
  p_id text,
  p_date date,
  p_type text,
  p_amount text,
  p_amount_numeric numeric(15,2),
  p_account_id text,
  p_user_id uuid,
  p_category_id text DEFAULT NULL,
  p_subcategory_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_description_search text DEFAULT NULL,
  p_recurring boolean DEFAULT false,
  p_expense_type text DEFAULT NULL,
  p_created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
  p_updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
  p_max_transactions integer DEFAULT -1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Step 3: Create function to create transfer with limit check (atomic)
CREATE OR REPLACE FUNCTION "create_transfer_with_limit"(
  p_user_id uuid,
  p_from_account_id text,
  p_to_account_id text,
  p_amount text,
  p_amount_numeric numeric(15,2),
  p_date date,
  p_description text DEFAULT NULL,
  p_description_search text DEFAULT NULL,
  p_recurring boolean DEFAULT false,
  p_max_transactions integer DEFAULT -1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Create outgoing transaction (expense from source account)
  INSERT INTO "Transaction" (
    "id", "date", "type", "amount", "amount_numeric", "accountId", "userId",
    "categoryId", "subcategoryId", "description", "description_search",
    "recurring", "transferToId", "createdAt", "updatedAt"
  ) VALUES (
    v_outgoing_id, p_date, 'expense', p_amount, p_amount_numeric, p_from_account_id, p_user_id,
    NULL, NULL, v_outgoing_description, p_description_search,
    p_recurring, v_incoming_id, v_now, v_now
  );
  
  -- Create incoming transaction (income to destination account)
  INSERT INTO "Transaction" (
    "id", "date", "type", "amount", "amount_numeric", "accountId", "userId",
    "categoryId", "subcategoryId", "description", "description_search",
    "recurring", "transferFromId", "createdAt", "updatedAt"
  ) VALUES (
    v_incoming_id, p_date, 'income', p_amount, p_amount_numeric, p_to_account_id, p_user_id,
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

-- Step 4: Add comments
COMMENT ON FUNCTION "increment_transaction_count" IS 'Atomically increments transaction count for a user/month. Used within transaction functions.';
COMMENT ON FUNCTION "create_transaction_with_limit" IS 'Creates a regular transaction atomically with limit checking. All operations in one transaction.';
COMMENT ON FUNCTION "create_transfer_with_limit" IS 'Creates a transfer (2 transactions) atomically with limit checking. Counts as 1 transaction. All operations in one transaction.';

