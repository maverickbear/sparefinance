# Deprecated Client-side API Files

**Date Moved**: 2025-01-XX  
**Status**: ⚠️ **DO NOT DELETE YET** - Safety period (1-2 weeks)

## Overview

These client-side API files (`*-client.ts`) have been migrated to API routes following Clean Architecture principles. They are kept here temporarily as a safety measure before permanent deletion.

## Files Moved

All runtime calls from these files have been migrated to `/api/v2/*` routes:

1. ✅ `accounts-client.ts` - Migrated to `/api/v2/accounts`
2. ✅ `budgets-client.ts` - Migrated to `/api/v2/budgets`
3. ✅ `categories-client.ts` - Migrated to `/api/v2/categories`
4. ✅ `debts-client.ts` - Migrated to `/api/v2/debts`
5. ✅ `goals-client.ts` - Migrated to `/api/v2/goals`
6. ✅ `members-client.ts` - Migrated to `/api/v2/members`
7. ✅ `profile-client.ts` - Migrated to `/api/v2/profile`
8. ✅ `transactions-client.ts` - Migrated to `/api/v2/transactions`
9. ✅ `user-client.ts` - Migrated to `/api/v2/user`
10. ✅ `households-client.ts` - No usage found, safe to remove

## Migration Status

- ✅ **All runtime calls migrated** to API routes
- ✅ **All types migrated** to domain types (`src/domain/*/types.ts`)
- ✅ **Zero runtime usage** verified before moving

## Verification

Before moving these files, we verified:
- No runtime function calls remain
- All type imports have been updated to domain types
- All components use API routes instead

## Next Steps

1. **Wait 1-2 weeks** to ensure no issues arise
2. **Monitor for any import errors** or runtime issues
3. **After safety period**, these files can be permanently deleted

## If Issues Arise

If you find any broken imports or runtime errors:
1. Check if the file is still needed
2. If needed, restore from this folder
3. Create proper API route if missing
4. Migrate the usage properly

---

**Last Updated**: 2025-01-XX  
**Safe to Delete After**: 2025-02-XX (1-2 weeks from move date)

