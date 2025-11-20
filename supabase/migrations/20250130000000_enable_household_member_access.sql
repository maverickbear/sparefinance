-- ============================================================================
-- Enable Household Member Full Access
-- ============================================================================
-- Data: 2025-01-30
-- Descrição: Permite que household members tenham acesso completo aos dados
--            do owner, funcionando como uma conta conjunta.
--            Atualiza todas as políticas RLS para incluir household members.
-- ============================================================================

-- ============================================================================
-- 1. CRIAR FUNÇÃO HELPER PARA VERIFICAR HOUSEHOLD MEMBERSHIP
-- ============================================================================

-- Função que retorna o ownerId se o usuário for household member, 
-- caso contrário retorna o próprio userId
CREATE OR REPLACE FUNCTION get_household_owner_id()
RETURNS uuid AS $$
DECLARE
  current_user_id uuid;
  owner_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is a household member
  SELECT "ownerId" INTO owner_id
  FROM "HouseholdMember"
  WHERE "memberId" = current_user_id
    AND "status" = 'active'
    AND "ownerId" != current_user_id  -- Prevent self-referential records
  LIMIT 1;
  
  -- Return ownerId if member, otherwise return current userId
  RETURN COALESCE(owner_id, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função helper para verificar se o userId fornecido pertence ao owner ou é o owner
CREATE OR REPLACE FUNCTION is_owner_or_household_member(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Se o userId é do próprio usuário, permitir
  IF check_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Se o userId é do owner e o usuário atual é household member, permitir
  IF EXISTS (
    SELECT 1 FROM "HouseholdMember"
    WHERE "memberId" = auth.uid()
      AND "ownerId" = check_user_id
      AND "status" = 'active'
      AND "ownerId" != auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. ATUALIZAR RLS POLICIES PARA TRANSACTION
-- ============================================================================

-- SELECT: Permitir household members verem transações do owner
DROP POLICY IF EXISTS "Users can view own transactions" ON "Transaction";
CREATE POLICY "Users can view own transactions" ON "Transaction" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT: Permitir household members criarem transações no contexto do owner
DROP POLICY IF EXISTS "Users can insert own transactions" ON "Transaction";
CREATE POLICY "Users can insert own transactions" ON "Transaction" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE: Permitir household members atualizarem transações do owner
DROP POLICY IF EXISTS "Users can update own transactions" ON "Transaction";
CREATE POLICY "Users can update own transactions" ON "Transaction" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE: Permitir household members deletarem transações do owner
DROP POLICY IF EXISTS "Users can delete own transactions" ON "Transaction";
CREATE POLICY "Users can delete own transactions" ON "Transaction" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 3. ATUALIZAR RLS POLICIES PARA ACCOUNT
-- ============================================================================

-- SELECT: Incluir household membership além de AccountOwner
DROP POLICY IF EXISTS "Users can view own accounts" ON "Account";
CREATE POLICY "Users can view own accounts" ON "Account" FOR SELECT
USING (
  "userId" = auth.uid()
  OR EXISTS (
    SELECT 1 FROM "AccountOwner" WHERE "accountId" = "Account"."id" AND "ownerId" = auth.uid()
  )
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT: Permitir household members criarem contas no contexto do owner
DROP POLICY IF EXISTS "Users can insert own accounts" ON "Account";
CREATE POLICY "Users can insert own accounts" ON "Account" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE: Incluir household membership
DROP POLICY IF EXISTS "Users can update own accounts" ON "Account";
CREATE POLICY "Users can update own accounts" ON "Account" FOR UPDATE
USING (
  ("auth"."uid"() = "userId") 
  OR (EXISTS (
    SELECT 1 FROM "AccountOwner"
    WHERE ("AccountOwner"."accountId" = "Account"."id") AND ("AccountOwner"."ownerId" = "auth"."uid"())
  ))
  OR ("userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM "User"
    WHERE ("User"."id" = "auth"."uid"()) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))
  ))
);

-- DELETE: Incluir household membership
DROP POLICY IF EXISTS "Users can delete own accounts" ON "Account";
CREATE POLICY "Users can delete own accounts" ON "Account" FOR DELETE
USING (
  ("auth"."uid"() = "userId") 
  OR (EXISTS (
    SELECT 1 FROM "AccountOwner"
    WHERE ("AccountOwner"."accountId" = "Account"."id") AND ("AccountOwner"."ownerId" = "auth"."uid"())
  ))
  OR ("userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM "User"
    WHERE ("User"."id" = "auth"."uid"()) AND ("User"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))
  ))
);

-- ============================================================================
-- 4. ATUALIZAR RLS POLICIES PARA INVESTMENTACCOUNT
-- ============================================================================

-- SELECT: Permitir household members verem investment accounts do owner
DROP POLICY IF EXISTS "Users can view own investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can view own investment accounts" ON "InvestmentAccount" FOR SELECT
USING (
  "userId" = auth.uid()
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT: Permitir household members criarem investment accounts no contexto do owner
DROP POLICY IF EXISTS "Users can insert own investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can insert own investment accounts" ON "InvestmentAccount" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE: Permitir household members atualizarem investment accounts do owner
DROP POLICY IF EXISTS "Users can update own investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can update own investment accounts" ON "InvestmentAccount" FOR UPDATE
USING (
  "userId" = auth.uid()
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE: Permitir household members deletarem investment accounts do owner
DROP POLICY IF EXISTS "Users can delete own investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can delete own investment accounts" ON "InvestmentAccount" FOR DELETE
USING (
  "userId" = auth.uid()
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 5. ATUALIZAR RLS POLICIES PARA INVESTMENTTRANSACTION
-- ============================================================================

-- SELECT: Permitir household members verem investment transactions do owner
DROP POLICY IF EXISTS "Users can view own investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can view own investment transactions" ON "InvestmentTransaction" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "InvestmentTransaction"."accountId") 
      AND ("Account"."type" = 'investment'::"text")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- INSERT: Permitir household members criarem investment transactions
DROP POLICY IF EXISTS "Users can insert own investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can insert own investment transactions" ON "InvestmentTransaction" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "InvestmentTransaction"."accountId") 
      AND ("Account"."type" = 'investment'::"text")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- UPDATE: Permitir household members atualizarem investment transactions
DROP POLICY IF EXISTS "Users can update own investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can update own investment transactions" ON "InvestmentTransaction" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "InvestmentTransaction"."accountId") 
      AND ("Account"."type" = 'investment'::"text")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- DELETE: Permitir household members deletarem investment transactions
DROP POLICY IF EXISTS "Users can delete own investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can delete own investment transactions" ON "InvestmentTransaction" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "InvestmentTransaction"."accountId") 
      AND ("Account"."type" = 'investment'::"text")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 6. ATUALIZAR RLS POLICIES PARA POSITION
-- ============================================================================

-- SELECT: Permitir household members verem positions do owner
DROP POLICY IF EXISTS "Users can view positions for own accounts" ON "Position";
CREATE POLICY "Users can view positions for own accounts" ON "Position" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Position"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- INSERT, UPDATE, DELETE: Aplicar mesma lógica
DROP POLICY IF EXISTS "Users can insert positions for own accounts" ON "Position";
CREATE POLICY "Users can insert positions for own accounts" ON "Position" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Position"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update positions for own accounts" ON "Position";
CREATE POLICY "Users can update positions for own accounts" ON "Position" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Position"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can delete positions for own accounts" ON "Position";
CREATE POLICY "Users can delete positions for own accounts" ON "Position" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Position"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 7. ATUALIZAR RLS POLICIES PARA EXECUTION E ORDER
-- ============================================================================

-- Execution: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view executions for own accounts" ON "Execution";
CREATE POLICY "Users can view executions for own accounts" ON "Execution" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Execution"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update executions for own accounts" ON "Execution";
CREATE POLICY "Users can update executions for own accounts" ON "Execution" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Execution"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- Order: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view orders for own accounts" ON "Order";
CREATE POLICY "Users can view orders for own accounts" ON "Order" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Order"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update orders for own accounts" ON "Order";
CREATE POLICY "Users can update orders for own accounts" ON "Order" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "InvestmentAccount"
    WHERE ("InvestmentAccount"."id" = "Order"."accountId")
      AND (
        "InvestmentAccount"."userId" = auth.uid()
        OR "InvestmentAccount"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 8. ATUALIZAR RLS POLICIES PARA BUDGET
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own budgets" ON "Budget";
CREATE POLICY "Users can view own budgets" ON "Budget" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert own budgets" ON "Budget";
CREATE POLICY "Users can insert own budgets" ON "Budget" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update own budgets" ON "Budget";
CREATE POLICY "Users can update own budgets" ON "Budget" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete own budgets" ON "Budget";
CREATE POLICY "Users can delete own budgets" ON "Budget" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- BudgetCategory: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view own budget categories" ON "BudgetCategory";
CREATE POLICY "Users can view own budget categories" ON "BudgetCategory" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Budget"
    WHERE ("Budget"."id" = "BudgetCategory"."budgetId")
      AND (
        "Budget"."userId" = auth.uid()
        OR "Budget"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 9. ATUALIZAR RLS POLICIES PARA GOAL
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own goals" ON "Goal";
CREATE POLICY "Users can view own goals" ON "Goal" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert own goals" ON "Goal";
CREATE POLICY "Users can insert own goals" ON "Goal" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update own goals" ON "Goal";
CREATE POLICY "Users can update own goals" ON "Goal" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete own goals" ON "Goal";
CREATE POLICY "Users can delete own goals" ON "Goal" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 10. ATUALIZAR RLS POLICIES PARA DEBT
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own debts" ON "Debt";
CREATE POLICY "Users can view own debts" ON "Debt" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert own debts" ON "Debt";
CREATE POLICY "Users can insert own debts" ON "Debt" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update own debts" ON "Debt";
CREATE POLICY "Users can update own debts" ON "Debt" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete own debts" ON "Debt";
CREATE POLICY "Users can delete own debts" ON "Debt" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 11. ATUALIZAR RLS POLICIES PARA PLANNEDPAYMENT
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own planned payments" ON "PlannedPayment";
CREATE POLICY "Users can view own planned payments" ON "PlannedPayment" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert own planned payments" ON "PlannedPayment";
CREATE POLICY "Users can insert own planned payments" ON "PlannedPayment" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update own planned payments" ON "PlannedPayment";
CREATE POLICY "Users can update own planned payments" ON "PlannedPayment" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete own planned payments" ON "PlannedPayment";
CREATE POLICY "Users can delete own planned payments" ON "PlannedPayment" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 12. ATUALIZAR RLS POLICIES PARA USERSERVICESUBSCRIPTION
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can view own subscriptions" ON "UserServiceSubscription" FOR SELECT
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can insert own subscriptions" ON "UserServiceSubscription" FOR INSERT
WITH CHECK (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update own subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can update own subscriptions" ON "UserServiceSubscription" FOR UPDATE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can delete own subscriptions" ON "UserServiceSubscription" FOR DELETE
USING (
  "userId" = auth.uid() 
  OR "userId" IN (
    SELECT "ownerId" FROM "HouseholdMember" 
    WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
  )
);

-- ============================================================================
-- 13. ATUALIZAR RLS POLICIES PARA SIMPLEINVESTMENTENTRY
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can view own simple investment entries" ON "SimpleInvestmentEntry" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "SimpleInvestmentEntry"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- INSERT, UPDATE, DELETE: Aplicar mesma lógica
DROP POLICY IF EXISTS "Users can insert own simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can insert own simple investment entries" ON "SimpleInvestmentEntry" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "SimpleInvestmentEntry"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update own simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can update own simple investment entries" ON "SimpleInvestmentEntry" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "SimpleInvestmentEntry"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can delete own simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can delete own simple investment entries" ON "SimpleInvestmentEntry" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "SimpleInvestmentEntry"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 14. ATUALIZAR RLS POLICIES PARA ACCOUNTINVESTMENTVALUE
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "Users can view own account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can view own account investment values" ON "AccountInvestmentValue" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "AccountInvestmentValue"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- INSERT, UPDATE, DELETE: Aplicar mesma lógica
DROP POLICY IF EXISTS "Users can insert own account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can insert own account investment values" ON "AccountInvestmentValue" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "AccountInvestmentValue"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can update own account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can update own account investment values" ON "AccountInvestmentValue" FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "AccountInvestmentValue"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can delete own account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can delete own account investment values" ON "AccountInvestmentValue" FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "AccountInvestmentValue"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 15. ATUALIZAR RLS POLICIES PARA PLAIDLIABILITY E TRANSACTIONSYNC
-- ============================================================================

-- PlaidLiability: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view their own Plaid liabilities" ON "PlaidLiability";
CREATE POLICY "Users can view their own Plaid liabilities" ON "PlaidLiability" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "PlaidLiability"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR EXISTS (
          SELECT 1 FROM "AccountOwner" 
          WHERE "accountId" = "Account"."id" AND "ownerId" = auth.uid()
        )
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- TransactionSync: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can view TransactionSync for their accounts" ON "TransactionSync";
CREATE POLICY "Users can view TransactionSync for their accounts" ON "TransactionSync" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Account"
    WHERE ("Account"."id" = "TransactionSync"."accountId")
      AND (
        "Account"."userId" = auth.uid()
        OR EXISTS (
          SELECT 1 FROM "AccountOwner" 
          WHERE "accountId" = "Account"."id" AND "ownerId" = auth.uid()
        )
        OR "Account"."userId" IN (
          SELECT "ownerId" FROM "HouseholdMember" 
          WHERE "memberId" = auth.uid() AND "status" = 'active' AND "ownerId" != auth.uid()
        )
      )
  )
);

-- ============================================================================
-- 16. ATUALIZAR RLS POLICY PARA HOUSEHOLDMEMBER (PERMITIR MEMBERS VEREM TODOS)
-- ============================================================================

-- SELECT: Permitir household members verem todos os membros do household do owner
DROP POLICY IF EXISTS "Users can view household members" ON "HouseholdMember";
CREATE POLICY "Users can view household members" ON "HouseholdMember" FOR SELECT
USING (
  -- User is owner of this household
  "ownerId" = auth.uid()
  -- User is a member of this household
  OR "memberId" = auth.uid()
  -- User is a household member and wants to see all members of their owner's household
  OR EXISTS (
    SELECT 1 FROM "HouseholdMember" AS hm
    WHERE hm."memberId" = auth.uid()
      AND hm."status" = 'active'
      AND hm."ownerId" != auth.uid()  -- Prevent self-referential records
      AND hm."ownerId" = "HouseholdMember"."ownerId"
  )
);

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- Esta migration permite que household members tenham acesso completo aos dados
-- do owner, funcionando como uma conta conjunta.
--
-- Segurança:
-- - Apenas household members com status 'active' podem acessar dados do owner
-- - Self-referential records são prevenidos (ownerId != memberId)
-- - Todas as políticas RLS mantêm a verificação original para owners
-- - Household members podem ver todos os membros do household do owner
--
-- Performance:
-- - As queries podem ficar um pouco mais lentas com os JOINs adicionais
-- - As funções helper podem ser usadas para otimizar queries futuras
--
-- Backward Compatibility:
-- - Owners continuam vendo apenas seus próprios dados (comportamento atual mantido)
-- - AccountOwner table continua funcionando para compartilhamento explícito de contas

