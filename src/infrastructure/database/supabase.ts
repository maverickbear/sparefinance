import { createServerClient } from "./supabase-server";

// Database types for Supabase tables
// Updated to use public schema with snake_case naming convention
export interface Database {
  public: {
    Tables: {
      // Core tables (no prefix)
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          role: string;
          phone_number: string | null;
          date_of_birth: string | null;
          effective_plan_id: string | null;
          effective_subscription_status: string | null;
          effective_subscription_id: string | null;
          subscription_updated_at: string | null;
          is_blocked: boolean;
          temporary_expected_income: string | null;
          temporary_expected_income_amount: number | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      households: {
        Row: {
          id: string;
          name: string;
          type: 'personal' | 'household';
          created_at: string;
          updated_at: string;
          created_by: string;
          settings: Record<string, unknown> | null;
        };
        Insert: Omit<Database['public']['Tables']['households']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['households']['Insert']>;
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string | null;
          role: 'owner' | 'admin' | 'member';
          status: 'active' | 'pending' | 'inactive';
          is_default: boolean;
          joined_at: string;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
          email: string | null;
          name: string | null;
          invitation_token: string | null;
          invited_at: string | null;
          accepted_at: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['household_members']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['household_members']['Insert']>;
      };
      accounts: {
        Row: {
          id: string;
          name: string;
          type: 'cash' | 'checking' | 'savings' | 'credit' | 'investment' | 'other';
          created_at: string;
          updated_at: string;
          credit_limit: number | null;
          user_id: string | null;
          initial_balance: number | null;
          due_day_of_month: number | null;
          extra_credit: number;
          household_id: string | null;
          currency_code: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      account_owners: {
        Row: {
          id: string;
          account_id: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['account_owners']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['account_owners']['Insert']>;
      };
      account_investment_values: {
        Row: {
          id: string;
          account_id: string;
          date: string;
          market_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['account_investment_values']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['account_investment_values']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          type: string;
          account_id: string;
          category_id: string | null;
          subcategory_id: string | null;
          description: string | null;
          tags: string;
          transfer_to_id: string | null;
          transfer_from_id: string | null;
          created_at: string;
          updated_at: string;
          is_recurring: boolean;
          user_id: string;
          suggested_category_id: string | null;
          suggested_subcategory_id: string | null;
          expense_type: string | null;
          description_search: string | null;
          date: string;
          household_id: string | null;
          amount: number;
          receipt_url: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      transaction_syncs: {
        Row: {
          id: string;
          account_id: string;
          transaction_id: string | null;
          sync_date: string;
          status: string | null;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['transaction_syncs']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['transaction_syncs']['Insert']>;
      };
      budgets: {
        Row: {
          id: string;
          period: string;
          category_id: string | null;
          amount: number;
          note: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
          subcategory_id: string | null;
          is_recurring: boolean;
          household_id: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>;
      };
      budget_categories: {
        Row: {
          id: string;
          budget_id: string;
          category_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['budget_categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['budget_categories']['Insert']>;
      };
      planned_payments: {
        Row: {
          id: string;
          date: string;
          type: string;
          amount: number;
          account_id: string;
          category_id: string | null;
          subcategory_id: string | null;
          description: string | null;
          source: string;
          status: string;
          linked_transaction_id: string | null;
          debt_id: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
          to_account_id: string | null;
          subscription_id: string | null;
          household_id: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['planned_payments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['planned_payments']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          type: 'income' | 'expense';
          created_at: string;
          updated_at: string;
          user_id: string | null;
          is_system: boolean | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      subcategories: {
        Row: {
          id: string;
          name: string;
          category_id: string;
          created_at: string;
          updated_at: string;
          user_id: string | null;
          logo: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['subcategories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['subcategories']['Insert']>;
      };
      goals: {
        Row: {
          id: string;
          name: string;
          target_amount: number;
          income_percentage: number;
          is_completed: boolean;
          completed_at: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
          current_balance: number;
          priority: string;
          is_paused: boolean;
          expected_income: number | null;
          target_months: number | null;
          user_id: string;
          account_id: string | null;
          holding_id: string | null;
          household_id: string | null;
          is_system_goal: boolean;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['goals']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['goals']['Insert']>;
      };
      debts: {
        Row: {
          id: string;
          name: string;
          loan_type: string;
          initial_amount: number;
          down_payment: number | null;
          current_balance: number;
          interest_rate: number;
          total_months: number | null;
          first_payment_date: string;
          monthly_payment: number;
          principal_paid: number;
          interest_paid: number;
          additional_contributions: boolean;
          additional_contribution_amount: number | null;
          priority: string;
          description: string | null;
          is_paid_off: boolean;
          is_paused: boolean;
          paid_off_at: string | null;
          created_at: string;
          updated_at: string;
          payment_frequency: string;
          payment_amount: number | null;
          account_id: string | null;
          user_id: string;
          start_date: string | null;
          status: string;
          next_due_date: string | null;
          household_id: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['debts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['debts']['Insert']>;
      };
      investment_accounts: {
        Row: {
          id: string;
          name: string;
          type: string;
          account_id: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
          cash: number | null;
          market_value: number | null;
          total_equity: number | null;
          buying_power: number | null;
          maintenance_excess: number | null;
          currency: string | null;
          balance_last_updated_at: string | null;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['investment_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['investment_accounts']['Insert']>;
      };
      investment_transactions: {
        Row: {
          id: string;
          date: string;
          account_id: string;
          security_id: string | null;
          type: string;
          quantity: number | null;
          price: number | null;
          fees: number;
          notes: string | null;
          transfer_to_id: string | null;
          transfer_from_id: string | null;
          created_at: string;
          updated_at: string;
          household_id: string | null;
          currency_code: string | null;
        };
        Insert: Omit<Database['public']['Tables']['investment_transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['investment_transactions']['Insert']>;
      };
      securities: {
        Row: {
          id: string;
          symbol: string;
          name: string;
          class: string;
          created_at: string;
          updated_at: string;
          sector: string | null;
          close_price: number | null;
          close_price_as_of: string | null;
          currency_code: string | null;
        };
        Insert: Omit<Database['public']['Tables']['securities']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['securities']['Insert']>;
      };
      security_prices: {
        Row: {
          id: string;
          security_id: string;
          date: string;
          price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['security_prices']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['security_prices']['Insert']>;
      };
      positions: {
        Row: {
          id: string;
          account_id: string;
          security_id: string;
          open_quantity: number;
          closed_quantity: number;
          current_market_value: number;
          current_price: number;
          average_entry_price: number;
          closed_pnl: number;
          open_pnl: number;
          total_cost: number;
          is_real_time: boolean | null;
          is_under_reorg: boolean | null;
          last_updated_at: string;
          created_at: string;
          updated_at: string;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['positions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['positions']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          account_id: string;
          symbol_id: number;
          symbol: string;
          total_quantity: number;
          open_quantity: number;
          filled_quantity: number;
          canceled_quantity: number;
          side: string;
          order_type: string;
          limit_price: number | null;
          stop_price: number | null;
          is_all_or_none: boolean | null;
          is_anonymous: boolean | null;
          iceberg_quantity: number | null;
          min_quantity: number | null;
          avg_exec_price: number | null;
          last_exec_price: number | null;
          source: string | null;
          time_in_force: string;
          gtd_date: string | null;
          state: string;
          client_reason_str: string | null;
          chain_id: number;
          creation_time: string;
          update_time: string;
          notes: string | null;
          primary_route: string | null;
          secondary_route: string | null;
          order_route: string | null;
          venue_holding_order: string | null;
          comission_charged: number | null;
          exchange_order_id: string | null;
          is_significant_share_holder: boolean | null;
          is_insider: boolean | null;
          is_limit_offset_in_ticks: boolean | null;
          user_id: number | null;
          placement_commission: number | null;
          strategy_type: string | null;
          trigger_stop_price: number | null;
          last_synced_at: string;
          created_at: string;
          updated_at: string;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      executions: {
        Row: {
          id: string;
          account_id: string;
          symbol_id: number;
          symbol: string;
          quantity: number;
          side: string;
          price: number;
          order_id: number;
          order_chain_id: number;
          exchange_exec_id: string | null;
          timestamp: string;
          notes: string | null;
          venue: string | null;
          total_cost: number;
          order_placement_commission: number | null;
          commission: number | null;
          execution_fee: number | null;
          sec_fee: number | null;
          canadian_execution_fee: number | null;
          parent_id: number | null;
          last_synced_at: string;
          created_at: string;
          updated_at: string;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['executions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['executions']['Insert']>;
      };
      candles: {
        Row: {
          id: string;
          security_id: string;
          symbol_id: number;
          start: string;
          end: string;
          low: number;
          high: number;
          open: number;
          close: number;
          volume: number;
          vwap: number | null;
          interval: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['candles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['candles']['Insert']>;
      };
      simple_investment_entries: {
        Row: {
          id: string;
          account_id: string;
          date: string;
          type: string;
          amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['simple_investment_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['simple_investment_entries']['Insert']>;
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          service_name: string;
          subcategory_id: string | null;
          amount: number;
          description: string | null;
          billing_frequency: string;
          billing_day: number | null;
          account_id: string;
          is_active: boolean;
          first_billing_date: string;
          created_at: string;
          updated_at: string;
          household_id: string | null;
          plan_id: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['user_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_subscriptions']['Insert']>;
      };
      external_services: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          logo: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['external_services']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['external_services']['Insert']>;
      };
      external_service_categories: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['external_service_categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['external_service_categories']['Insert']>;
      };
      external_service_plans: {
        Row: {
          id: string;
          service_id: string;
          plan_name: string;
          price: number;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['external_service_plans']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['external_service_plans']['Insert']>;
      };
      // App billing tables (app_ prefix)
      app_plans: {
        Row: {
          id: string;
          name: string;
          price_monthly: number;
          price_yearly: number;
          features: Record<string, unknown>;
          stripe_price_id_monthly: string | null;
          stripe_price_id_yearly: string | null;
          stripe_product_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['app_plans']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['app_plans']['Insert']>;
      };
      app_subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          plan_id: string;
          status: string;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
          trial_start_date: string | null;
          trial_end_date: string | null;
          grace_period_days: number | null;
          last_upgrade_prompt: string | null;
          expired_at: string | null;
          pending_email: string | null;
          household_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['app_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['app_subscriptions']['Insert']>;
      };
      app_promo_codes: {
        Row: {
          id: string;
          code: string;
          discount_type: string;
          discount_value: number;
          duration: string;
          duration_in_months: number | null;
          max_redemptions: number | null;
          expires_at: string | null;
          is_active: boolean;
          stripe_coupon_id: string | null;
          plan_ids: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['app_promo_codes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['app_promo_codes']['Insert']>;
      };
      // System tables (system_ prefix with descriptive groupings)
      system_config_settings: {
        Row: {
          id: string;
          maintenance_mode: boolean;
          created_at: string;
          updated_at: string;
          seo_settings: Record<string, unknown> | null;
        };
        Insert: Omit<Database['public']['Tables']['system_config_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_config_settings']['Insert']>;
      };
      system_jobs_imports: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          type: string;
          status: string;
          progress: number | null;
          total_items: number | null;
          processed_items: number | null;
          synced_items: number | null;
          skipped_items: number | null;
          error_items: number | null;
          error_message: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          retry_count: number | null;
          next_retry_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['system_jobs_imports']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_jobs_imports']['Insert']>;
      };
      system_support_contact_forms: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          subject: string;
          message: string;
          status: string;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_support_contact_forms']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_support_contact_forms']['Insert']>;
      };
      system_support_feedback: {
        Row: {
          id: string;
          user_id: string;
          rating: number;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_support_feedback']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_support_feedback']['Insert']>;
      };
      system_user_active_households: {
        Row: {
          user_id: string;
          household_id: string;
          updated_at: string;
        };
        Insert: Database['public']['Tables']['system_user_active_households']['Row'];
        Update: Partial<Database['public']['Tables']['system_user_active_households']['Insert']>;
      };
      system_user_block_history: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          reason: string | null;
          blocked_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_user_block_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['system_user_block_history']['Insert']>;
      };
      system_error_codes: {
        Row: {
          code: string;
          message: string;
          user_message: string;
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_error_codes']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_error_codes']['Insert']>;
      };
      system_tax_rates: {
        Row: {
          id: string;
          country_code: string;
          state_or_province_code: string;
          tax_rate: number;
          display_name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_tax_rates']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_tax_rates']['Insert']>;
      };
      system_tax_federal_brackets: {
        Row: {
          id: string;
          country_code: string;
          tax_year: number;
          bracket_order: number;
          min_income: number;
          max_income: number | null;
          tax_rate: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_tax_federal_brackets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_tax_federal_brackets']['Insert']>;
      };
      system_user_monthly_usage: {
        Row: {
          user_id: string;
          month_date: string;
          transactions_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['system_user_monthly_usage']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['system_user_monthly_usage']['Insert']>;
      };
      // Audit tables (audit_ prefix)
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          user_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      audit_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          processed_at: string;
          result: string;
          error_message: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_webhook_events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_webhook_events']['Insert']>;
      };
      // Analytics tables (analytics_ prefix)
      analytics_category_learning: {
        Row: {
          user_id: string;
          normalized_description: string;
          type: 'expense' | 'income';
          category_id: string;
          subcategory_id: string | null;
          description_and_amount_count: number;
          description_only_count: number;
          last_used_at: string;
        };
        Insert: Omit<Database['public']['Tables']['analytics_category_learning']['Row'], 'last_used_at'>;
        Update: Partial<Database['public']['Tables']['analytics_category_learning']['Insert']>;
      };
    };
  };
}

// Helper to get the Supabase client
export function getSupabaseClient() {
  return createServerClient();
}
