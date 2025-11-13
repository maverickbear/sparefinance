# What should happen when the trial expires?

## Current Flow

### 1. **Expiration Verification**
- The system checks if the trial has expired by comparing `trialEndDate` with the current date
- This happens in:
  - `lib/api/plans.ts` - `isTrialValid()` function
  - `app/(protected)/layout.tsx` - verification in protected layout
  - `lib/api/plans.ts` - `getUserSubscription()` function

### 2. **When the Trial Expires**
When `trialEndDate <= now`:
- `getUserSubscription()` returns `null`
- `ProtectedLayout` redirects the user to `/select-plan`
- The user cannot access protected routes

### 3. **Stripe Behavior**
- If the user **does not have a payment method**:
  - Stripe changes the status to `incomplete_expired` after the trial
  - Webhook `customer.subscription.updated` is sent
  - The system maps `incomplete_expired` to `cancelled` in the database
  
- If the user **has a payment method**:
  - Stripe attempts to charge automatically
  - If payment is successful: status changes to `active`
  - If payment fails: status changes to `past_due` or `cancelled`

## What is implemented ✅

1. ✅ Trial expiration verification on the server
2. ✅ Redirect to `/select-plan` when trial expires
3. ✅ Webhook handler to update status when Stripe notifies
4. ✅ Mapping of `incomplete_expired` to `cancelled`
5. ✅ Valid trial validation at multiple points

## What might be missing ⚠️

### 1. **Automatic Status Update in Database**
**Problem**: If the Stripe webhook doesn't arrive or fails, the status in the database may remain as `trialing` even after expiring.

**Solution**: Add a periodic check or a check at access time that automatically updates the status when it detects that the trial has expired.

### 2. **Message to User**
**Problem**: When the user is redirected to `/select-plan`, there is no clear message explaining that the trial has expired.

**Solution**: Add a query parameter or state that shows a message explaining that the trial has expired and that it's necessary to subscribe to a plan.

### 3. **Stripe Synchronization**
**Problem**: If there is a discrepancy between the status in the database and in Stripe, the system may not work correctly.

**Solution**: Add a synchronization route that checks the status in Stripe and updates the database.

## Recommendations

### Immediate Implementation

1. **Update status automatically when expiration is detected**:
   - In the `isTrialValid()` function, if the trial has expired, update the status in the database to `cancelled`
   - This ensures the status is always correct, even without a webhook

2. **Add message on `/select-plan` page**:
   - Check if there is a `trial_expired=true` parameter in the URL
   - Show a message explaining that the trial has expired

3. **Improve logs**:
   - Add logs when the trial expires
   - Record when the status is automatically updated

### Future Implementation

1. **Periodic job to clean up expired trials**:
   - Run daily to update status of expired trials
   - Ensure synchronization even without user access

2. **Notification before trial expires**:
   - Send email 3 days before the trial expires
   - Remind the user to add a payment method

3. **Expired trials dashboard**:
   - For admin, show list of trials that have expired
   - Help understand conversion rate

## Complete Flow Example

```
1. User starts trial (30 days)
   → Status: "trialing"
   → trialEndDate: today + 30 days

2. During the trial
   → User can use all features
   → Widget shows remaining days

3. Trial expires (trialEndDate <= now)
   → System detects expiration
   → Updates status to "cancelled" (if necessary)
   → Redirects to /select-plan?trial_expired=true
   → Shows message: "Your trial has expired. Subscribe to a plan to continue."

4. User selects plan
   → If choosing trial again: error (already used trial)
   → If choosing paid plan: redirects to Stripe checkout
   → After payment: status changes to "active"
```

## Reference Code

### Expiration Verification
```typescript
// lib/api/plans.ts
function isTrialValid(subscription: any): boolean {
  if (subscription.status !== "trialing") {
    return true;
  }
  
  if (!subscription.trialEndDate) {
    return false;
  }
  
  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  
  return trialEndDate > now;
}
```

### Redirect
```typescript
// app/(protected)/layout.tsx
if (subscription.status === "trialing") {
  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  
  if (trialEndDate <= now) {
    redirect("/select-plan");
  }
}
```
