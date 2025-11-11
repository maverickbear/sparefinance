# Billing Feature Setup Guide

This guide will help you set up the billing feature with Stripe integration.

## Prerequisites

1. **Stripe Account**: Create an account at [stripe.com](https://stripe.com)
2. **Supabase Auth**: Ensure Supabase Auth is enabled in your Supabase project

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=https://sparefinance.com/

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DATABASE_URL=...
```

## Stripe Setup

### 1. Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** > **API keys**
3. Copy your **Publishable key** and **Secret key** (test mode)
4. Add them to your `.env.local` file

### 2. Create Products and Prices with Trial

For each plan (Basic and Premium), create a product and price in Stripe with a 30-day trial:

1. Go to **Products** in Stripe Dashboard
2. Create a product for "Basic Plan"
   - Name: "Basic Plan"
   - Description: "Basic subscription for Spare Finance"
3. Create prices with 30-day trial:
   - Monthly: $7.99/month with 30-day trial
   - Yearly: $79.90/year with 30-day trial
   - **Important**: When creating prices, enable "Add a trial period" and set it to 30 days
4. Repeat for "Premium Plan" ($14.99/month, $149.90/year) with 30-day trial
5. Copy the **Price IDs** and **Product IDs**

**Note**: The trial period is configured at the price level in Stripe. When a customer subscribes, they will automatically get 30 days free before being charged.

### 3. Update Plan Prices in Database

Run this SQL in your Supabase SQL editor:

```sql
-- Update Basic plan
UPDATE "Plan"
SET 
  "stripePriceIdMonthly" = 'price_xxxxx', -- Replace with your monthly price ID
  "stripePriceIdYearly" = 'price_xxxxx', -- Replace with your yearly price ID
  "stripeProductId" = 'prod_xxxxx' -- Replace with your product ID
WHERE "id" = 'basic';

-- Update Premium plan
UPDATE "Plan"
SET 
  "stripePriceIdMonthly" = 'price_xxxxx', -- Replace with your monthly price ID
  "stripePriceIdYearly" = 'price_xxxxx', -- Replace with your yearly price ID
  "stripeProductId" = 'prod_xxxxx' -- Replace with your product ID
WHERE "id" = 'premium';
```

### 4. Set Up Webhook

1. Go to **Developers** > **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set endpoint URL to: `https://your-domain.com/api/stripe/webhook`
   - For local testing: Use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** and add to `STRIPE_WEBHOOK_SECRET`

### 5. Local Webhook Testing (Optional)

If testing locally, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will output a webhook secret - use this for `STRIPE_WEBHOOK_SECRET` in local development.

## Database Migrations

Run the migrations to create the billing tables:

```bash
# Apply migrations
# These files are in supabase/migrations/
# - 20251108000000_create_billing_tables.sql
# - 20251108000001_seed_plans.sql
# - 20251108000002_rls_policies.sql
```

Apply them in your Supabase SQL editor or via Supabase CLI.

## Install Dependencies

The billing feature requires the `stripe` package:

```bash
npm install stripe
```

## Features

### Plans

- **Basic**: 500 transactions/month, 10 accounts, investments, advanced reports, CSV export, household members ($7.99/month or $79.90/year) - **30-day trial**
- **Premium**: Unlimited transactions, unlimited accounts, all features, household members ($14.99/month or $149.90/year) - **30-day trial**

**Note**: There is no free plan. All users must select Basic or Premium with a 30-day trial period.

### Authentication

- Users must sign up/login to access the app
- New users must select a plan (Basic or Premium) to continue
- All plans include a 30-day trial period
- Authentication is handled via Supabase Auth

### Limit Enforcement

- Transaction limits are checked before creating transactions
- Account limits are checked before creating accounts
- Feature access (investments, reports) is checked per feature

## Testing

### Test Mode

Stripe provides test cards for testing:

- **Success**: `4242 4242 4242 4242`
- **Requires 3D Secure**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`

Use any future expiry date and any 3-digit CVC.

### Test Flow

1. Sign up a new user
2. Go to `/select-plan` (user will be redirected here if no subscription)
3. Select a plan (Basic or Premium)
4. Use test card `4242 4242 4242 4242`
5. Complete checkout (trial starts immediately)
6. Verify subscription status is "trialing" in `/billing`
7. After 30 days (or use Stripe test clock to advance), subscription becomes "active"
8. Test webhook by updating subscription in Stripe Dashboard
9. Test subscription management via Stripe Customer Portal

## Troubleshooting

### Webhook not working

- Verify webhook secret is correct
- Check Stripe Dashboard > Webhooks for error logs
- Ensure endpoint URL is accessible
- For local testing, use Stripe CLI

### Subscription not updating

- Check webhook logs in Stripe Dashboard
- Verify webhook secret matches
- Check database logs for errors
- Ensure RLS policies allow updates

### Limits not enforcing

- Verify user is authenticated
- Check plan limits in database
- Verify subscription status is "active"
- Check API route logs for errors

## Subscription Management

All subscription management (cancel, reactivate, upgrade, downgrade) is handled through the **Stripe Customer Portal**. Users are redirected to the Portal for:

- Cancelling subscriptions
- Reactivating cancelled subscriptions
- Upgrading or downgrading plans
- Updating payment methods

The Portal is accessed via the "Manage Subscription" button in the billing settings page.

## Trial Period

- All plans (Basic and Premium) include a 30-day trial period
- Trial is configured at the Stripe price level
- During trial, subscription status is "trialing"
- After 30 days, Stripe automatically charges the customer and status becomes "active"
- Users can cancel during trial without being charged

## Production Checklist

- [ ] Switch to Stripe production keys
- [ ] Update webhook endpoint URL
- [ ] Configure trial periods on all prices (30 days)
- [ ] Test all payment flows including trial
- [ ] Verify webhook signature verification
- [ ] Test subscription cancellation via Portal
- [ ] Test subscription reactivation via Portal
- [ ] Test upgrade/downgrade via Portal
- [ ] Test payment failure handling
- [ ] Review RLS policies
- [ ] Set up monitoring/alerts
- [ ] Configure Stripe billing portal branding
- [ ] Test trial expiration and automatic charging

