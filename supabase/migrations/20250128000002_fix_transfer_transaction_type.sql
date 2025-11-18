-- Migration: Fix transfer transaction type
-- Description: Changes transfer transactions to use type 'transfer' instead of 'expense' and 'income'
-- This ensures transfers don't affect net worth calculations since money only moves between accounts

-- Update the create_transfer_with_limit function to create transactions as type 'transfer'
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

COMMENT ON FUNCTION "create_transfer_with_limit" IS 'Creates a transfer (2 transactions) atomically with limit checking. Both transactions are created as type "transfer" since transfers do not affect net worth. Counts as 1 transaction. All operations in one transaction.';

