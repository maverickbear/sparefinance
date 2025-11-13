# 🧭 Post-Trial Experience – Spare Finance

This document defines the user experience and access rules after a user's **trial period** ends.  

There is **no free tier**, so the system must encourage conversion while preserving user trust and data visibility.

---

## 🔒 Access States

| State | Description | User Permissions | Technical Status |
|--------|--------------|------------------|------------------|
| **Trial** | User is within the 14-day free trial period. | ✅ Full access to all features. | `status: "trialing"` + `trialEndDate > now` |
| **Grace (Days 1–3)** | Trial expired, short grace period before full lock. | 🔍 Read-only mode. User can view all data but cannot edit or add anything. | `status: "expired"` + `accessMode: "read_only"` + `daysSinceExpiry <= 3` |
| **Expired (Days 4–7)** | Trial expired, user still allowed to see limited insights. | 🔍 View-only dashboards and reports (blurred details). | `status: "expired"` + `accessMode: "read_only"` + `daysSinceExpiry <= 7` |
| **Locked (After 7 days)** | Account is fully locked. | 🚫 No access to data, only upgrade screen and support. | `status: "expired"` + `accessMode: "locked"` + `daysSinceExpiry > 7` |
| **Active (Paid)** | User has an active subscription. | ✅ Full access restored. | `status: "active"` |

---

## 🧱 Feature Behavior After Trial

### Current Features in Spare Finance

| Feature | Current Location | Behavior After Expiration |
|----------|------------------|--------------------------|
| **Transactions** | `/transactions` | View only, cannot add/edit/delete. Disable form buttons, show upgrade prompt on action attempts. |
| **Budgets** | `/budgets` | View summary only, cannot modify. Disable create/edit buttons. |
| **Goals** | `/planning/goals` | View progress only, cannot create/edit/delete. Disable action buttons. |
| **Accounts** | `/accounts` | Visible, but no new connections allowed. Disable "Add Account" button. |
| **Investments** | `/investments` | View portfolio only, cannot add transactions or accounts. Disable all write operations. |
| **Debts** | `/debts` | View only, cannot add/edit/delete debts. |
| **Categories** | `/categories` | View only, cannot create/edit categories. |
| **Reports** | `/reports` | View with blur overlay and upgrade prompt. Show summary but blur detailed data. |
| **Dashboard** | `/dashboard` | View summary cards and charts (read-only). All interactive elements disabled. |
| **CSV Export** | Various pages | Disabled until upgrade. Hide export buttons or show upgrade prompt. |
| **Bank Integration (Plaid)** | `/accounts` | No new connections allowed. Existing connections remain visible. |
| **Questrade Integration** | `/investments` | No new connections. Existing data remains visible. |
| **Notifications** | System-wide | Disabled. |
| **Data Storage** | Database | Data preserved indefinitely (safe and recoverable). |

---

## 💬 Upgrade Messaging

### Global Banner (visible in all screens)

**Location**: Top of all protected pages, below navigation

**Design**:
```
⚠️ Your trial has expired.
Upgrade now to unlock your full financial dashboard and keep tracking your goals.
[Upgrade Now]
```

**Implementation**: 
- Component: `components/common/trial-expired-banner.tsx`
- Show when: `accessMode === "read_only" || accessMode === "locked"`
- Dismissible: No (always visible)
- Action: Opens pricing modal

---

### Modal on Restricted Actions

**Trigger**: User attempts any write operation (create, edit, delete)

**Design**:
```
Upgrade Required

Your trial has ended — add new transactions and budgets by upgrading your plan.

[Upgrade Now] [Remind Me Later]
```

**Implementation**:
- Component: `components/common/upgrade-required-modal.tsx`
- Show when: User clicks disabled action in read-only mode
- "Remind Me Later": Closes modal, sets `lastUpgradePrompt` timestamp
- "Upgrade Now": Opens pricing modal

---

### Locked State Screen (after 7 days)

**Location**: Replaces main content on all protected pages

**Design**:
```
Your trial has ended

Your data is safely stored. Reactivate your account anytime to continue managing your finances.

[Upgrade Plan]

Need help? Contact support
```

**Implementation**:
- Component: `components/common/locked-state-screen.tsx`
- Show when: `accessMode === "locked"`
- Replaces: All page content except navigation
- Action: Opens pricing modal (required, cannot be closed)

---

## 🕓 Grace Period Flow

### Timeline

1. **Trial Active (Days 1–14)** → Full access.
   - Status: `trialing`
   - Access: Full

2. **Day 13:** Send in-app & email reminder:
   - Banner: "Your trial ends tomorrow — don't lose access to your dashboard."
   - Email: Trial ending reminder

3. **Day 15–17:** Grace period (read-only access).
   - Status: `expired`
   - Access Mode: `read_only`
   - Days since expiry: 1–3
   - Banner: "Your trial has expired. Upgrade to continue managing your finances."

4. **Day 18–21:** Partial blur overlay, final reminder.
   - Status: `expired`
   - Access Mode: `read_only`
   - Days since expiry: 4–7
   - Banner: "Last chance! Upgrade now to keep your data accessible."

5. **Day 22+:** Locked screen with "Upgrade Plan" CTA.
   - Status: `expired`
   - Access Mode: `locked`
   - Days since expiry: > 7
   - Full lock screen replaces content

6. **Upon Upgrade:** Immediate full access restored.
   - Status: `active`
   - Access Mode: `full`
   - Clear all banners and modals

---

## ⚙️ Technical Implementation

### Database Schema Changes

#### Add fields to Subscription table

```sql
-- Migration: add_access_mode_fields.sql
ALTER TABLE "Subscription" 
ADD COLUMN IF NOT EXISTS "accessMode" TEXT DEFAULT 'full', -- 'full' | 'read_only' | 'locked'
ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS "lastUpgradePrompt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

-- Update status enum to include 'expired'
-- Note: Current status values: 'active' | 'cancelled' | 'past_due' | 'trialing'
-- We'll use 'cancelled' for expired trials and track access mode separately
```

**Note**: Since we already have `trialEndDate`, we can calculate expiration status. The `accessMode` field will be computed based on `trialEndDate` and current date.

---

### Type Definitions

#### Update `lib/validations/plan.ts`

```typescript
export const subscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string(),
  status: z.enum(["active", "cancelled", "past_due", "trialing", "expired"]),
  stripeSubscriptionId: z.string().nullable().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  currentPeriodStart: z.date().nullable().optional(),
  currentPeriodEnd: z.date().nullable().optional(),
  trialStartDate: z.date().nullable().optional(),
  trialEndDate: z.date().nullable().optional(),
  cancelAtPeriodEnd: z.boolean(),
  accessMode: z.enum(["full", "read_only", "locked"]).default("full"),
  gracePeriodDays: z.number().default(7),
  lastUpgradePrompt: z.date().nullable().optional(),
  expiredAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

---

### Core Functions

#### `lib/api/plans.ts` - Add access mode calculation

```typescript
/**
 * Calculate access mode based on subscription status and trial expiration
 */
export function calculateAccessMode(subscription: Subscription | null): "full" | "read_only" | "locked" {
  if (!subscription) {
    return "locked"; // No subscription = locked
  }

  // Active subscription = full access
  if (subscription.status === "active") {
    return "full";
  }

  // Trialing = full access (if not expired)
  if (subscription.status === "trialing") {
    if (subscription.trialEndDate) {
      const trialEndDate = new Date(subscription.trialEndDate);
      const now = new Date();
      if (trialEndDate > now) {
        return "full"; // Trial still active
      }
    }
    // Trial expired, calculate days since expiry
    return calculateExpiredAccessMode(subscription);
  }

  // Expired or cancelled = check grace period
  if (subscription.status === "expired" || subscription.status === "cancelled") {
    return calculateExpiredAccessMode(subscription);
  }

  // Past due = read-only (grace period)
  if (subscription.status === "past_due") {
    return "read_only";
  }

  return "locked";
}

function calculateExpiredAccessMode(subscription: Subscription): "read_only" | "locked" {
  if (!subscription.trialEndDate) {
    return "locked"; // No trial end date = locked
  }

  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  const daysSinceExpiry = Math.floor((now.getTime() - trialEndDate.getTime()) / (1000 * 60 * 60 * 24));
  const gracePeriodDays = subscription.gracePeriodDays || 7;

  if (daysSinceExpiry <= 3) {
    return "read_only"; // Days 1-3: Full read-only
  } else if (daysSinceExpiry <= gracePeriodDays) {
    return "read_only"; // Days 4-7: Read-only with blur
  } else {
    return "locked"; // After grace period: Fully locked
  }
}

/**
 * Check if user can perform write operations
 */
export function canWrite(accessMode: "full" | "read_only" | "locked"): boolean {
  return accessMode === "full";
}

/**
 * Check if user can view data (not locked)
 */
export function canView(accessMode: "full" | "read_only" | "locked"): boolean {
  return accessMode !== "locked";
}
```

---

### Context Updates

#### Update `contexts/subscription-context.tsx`

Add access mode to context:

```typescript
interface SubscriptionData {
  hasSubscription: boolean;
  currentPlanId?: string;
  subscription?: Subscription | null;
  limits?: PlanFeatures;
  accessMode?: "full" | "read_only" | "locked"; // NEW
  daysSinceExpiry?: number; // NEW
}
```

---

### Component Updates

#### 1. Create `components/common/trial-expired-banner.tsx`

Global banner component that shows on all protected pages when trial expired.

#### 2. Create `components/common/upgrade-required-modal.tsx`

Modal shown when user attempts restricted actions.

#### 3. Create `components/common/locked-state-screen.tsx`

Full-screen replacement when account is locked.

#### 4. Create `components/common/read-only-guard.tsx`

Wrapper component that disables write operations and shows upgrade prompts.

#### 5. Update `components/subscription-guard.tsx`

Handle read-only and locked states, not just missing subscriptions.

#### 6. Update `app/(protected)/layout.tsx`

- Allow access even when trial expired (read-only mode)
- Only block when `accessMode === "locked"`
- Show appropriate banners/modals

---

### Page-Level Updates

Each protected page needs:

1. **Read-only checks** on all write operations
2. **Disabled buttons** for create/edit/delete actions
3. **Upgrade prompts** on action attempts
4. **Blur overlays** for reports (days 4-7)

**Pages to update**:
- `/dashboard` - Disable interactions, show read-only charts
- `/transactions` - Disable form, show upgrade on action
- `/budgets` - Disable create/edit
- `/goals` - Disable create/edit
- `/accounts` - Disable add account
- `/investments` - Disable transactions
- `/debts` - Disable add/edit
- `/categories` - Disable create/edit
- `/reports` - Add blur overlay

---

### API Route Updates

#### Update `app/api/billing/subscription/route.ts`

Include `accessMode` and `daysSinceExpiry` in response:

```typescript
const accessMode = calculateAccessMode(subscription);
const daysSinceExpiry = subscription.trialEndDate 
  ? Math.floor((Date.now() - new Date(subscription.trialEndDate).getTime()) / (1000 * 60 * 60 * 24))
  : null;

return NextResponse.json({
  subscription,
  plan,
  limits,
  interval,
  accessMode, // NEW
  daysSinceExpiry, // NEW
});
```

---

### Write Operation Protection

#### Create `lib/utils/write-guard.ts`

```typescript
import { canWrite } from "@/lib/api/plans";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import { usePricingModal } from "@/contexts/pricing-modal-context";

/**
 * Hook to check if user can perform write operations
 * Shows upgrade modal if not allowed
 */
export function useWriteGuard() {
  const { accessMode } = useSubscriptionContext();
  const { openModal } = usePricingModal();
  
  const checkWriteAccess = (action: string): boolean => {
    if (!canWrite(accessMode || "locked")) {
      // Show upgrade modal
      openModal(true);
      return false;
    }
    return true;
  };

  return {
    canWrite: canWrite(accessMode || "locked"),
    checkWriteAccess,
  };
}
```

---

## 🎯 UX Goals

- Maintain **emotional connection** through visible data.
- Create **progressive friction** instead of sudden blocking.
- Encourage **conversion** via contextual upgrade prompts.
- Build **trust** by preserving all user data securely.

---

## 🧠 Example Upgrade Hooks

### Contextual Messages

- **Transactions**: "You tracked **$8,450** during your trial. Continue managing your finances stress-free."
- **Goals**: "You're **2 goals away** from reaching your savings target — upgrade to continue your progress."
- **Budgets**: "You've set up **5 budgets** — upgrade to keep tracking your spending."
- **Investments**: "Your portfolio is worth **$12,500** — upgrade to continue tracking your investments."

### Promotional Messages

- "Reactivate today and **save 20%** on your first month."
- "Upgrade now and get **unlimited transactions** and **advanced reports**."

---

## 📋 Implementation Checklist

### Phase 1: Database & Core Logic
- [ ] Create migration to add `accessMode`, `gracePeriodDays`, `lastUpgradePrompt`, `expiredAt` fields
- [ ] Update `subscriptionSchema` in `lib/validations/plan.ts`
- [ ] Implement `calculateAccessMode()` function
- [ ] Implement `canWrite()` and `canView()` helpers
- [ ] Update `getUserSubscription()` to calculate access mode
- [ ] Update `app/api/billing/subscription/route.ts` to return access mode

### Phase 2: Context & Hooks
- [ ] Update `SubscriptionContext` to include `accessMode` and `daysSinceExpiry`
- [ ] Create `useWriteGuard()` hook
- [ ] Update `SubscriptionGuard` to handle read-only and locked states

### Phase 3: UI Components
- [ ] Create `TrialExpiredBanner` component
- [ ] Create `UpgradeRequiredModal` component
- [ ] Create `LockedStateScreen` component
- [ ] Create `ReadOnlyGuard` wrapper component
- [ ] Update `PricingModal` to handle expired trial messaging

### Phase 4: Layout Updates
- [ ] Update `app/(protected)/layout.tsx` to allow read-only access
- [ ] Add `TrialExpiredBanner` to protected layout
- [ ] Show `LockedStateScreen` when `accessMode === "locked"`

### Phase 5: Page Updates
- [ ] Update `/dashboard` - disable interactions
- [ ] Update `/transactions` - disable form, add upgrade prompts
- [ ] Update `/budgets` - disable create/edit
- [ ] Update `/goals` - disable create/edit
- [ ] Update `/accounts` - disable add account
- [ ] Update `/investments` - disable transactions
- [ ] Update `/debts` - disable add/edit
- [ ] Update `/categories` - disable create/edit
- [ ] Update `/reports` - add blur overlay

### Phase 6: API Protection
- [ ] Add write operation checks to transaction APIs
- [ ] Add write operation checks to budget APIs
- [ ] Add write operation checks to goal APIs
- [ ] Add write operation checks to account APIs
- [ ] Add write operation checks to investment APIs
- [ ] Add write operation checks to debt APIs
- [ ] Add write operation checks to category APIs

### Phase 7: Testing
- [ ] Test trial expiration flow
- [ ] Test read-only mode (days 1-3)
- [ ] Test read-only with blur (days 4-7)
- [ ] Test locked state (after 7 days)
- [ ] Test upgrade flow from each state
- [ ] Test all write operations are blocked
- [ ] Test all read operations still work

---

## ✅ Summary

- ❌ No Free Tier  
- 🧾 Trial → Grace (Read-only) → Expired (Blurred) → Locked → Upgrade  
- 🔍 Data always visible in read-only mode (until locked)  
- 💬 Contextual upgrade prompts  
- 🔄 Instant reactivation after payment  
- 🛡️ Server-side and client-side protection for write operations

---

**Author:** Naor Tartarotti  
**Product:** Spare Finance  
**Last Updated:** January 2025  
**Status:** Planning Phase

