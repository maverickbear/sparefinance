# Leaked Password Protection Setup

This document describes the server-side HaveIBeenPwned (HIBP) password validation implementation.

## Overview

This application implements server-side password validation against the HaveIBeenPwned (HIBP) compromised-passwords database. This prevents users from registering or updating to known-compromised passwords, significantly reducing account takeover risk.

**Note:** Supabase Auth's leaked password protection is only available on Pro plan and above. This implementation provides the same protection for all plans by checking passwords server-side before creating accounts.

## How It Works

The application automatically checks passwords against HIBP in these scenarios:

- **User Sign Up**: When a new user registers
- **Invitation Acceptance**: When a household member accepts an invitation with a password
- **Password Reset**: When implemented, will also check against HIBP
- **Password Update**: When implemented, will also check against HIBP

All password checks happen **server-side** before calling Supabase Auth, ensuring protection regardless of your Supabase plan.

## Implementation Details

### Server-Side HIBP Validation

The application uses the HIBP k-anonymity API approach:
- Only the first 5 characters of the SHA-1 hash are sent to HIBP
- The full password never leaves your server
- Privacy-preserving while still checking against the breach database

### Features

- ✅ **Automatic validation**: All signup and invitation flows check passwords
- ✅ **Caching**: Responses are cached to reduce API calls and improve performance
- ✅ **Fail-open**: If HIBP API is unavailable, the check gracefully fails (doesn't block users)
- ✅ **User-friendly errors**: Clear messages when passwords are rejected
- ✅ **Rate limiting**: Built-in caching prevents excessive API calls

### No Configuration Required

The feature is **already implemented and active**. No dashboard configuration is needed.

## Error Handling

The application includes user-friendly error handling for HIBP-rejected passwords:

- **User-friendly messages**: Instead of technical errors, users see clear messages like "This password has appeared in a data breach. Please choose a different password."
- **Automatic validation**: Passwords are checked before account creation
- **Consistent UX**: Error messages are consistent across all password flows

## Server-Side Validation

The codebase includes a production-ready server-side HIBP validation utility (`lib/utils/hibp.ts`) that:

- Validates passwords before sending to Supabase
- Uses k-anonymity approach for privacy
- Includes caching to reduce API calls
- Handles errors gracefully (fail-open)
- Provides clear error messages

## Testing

Use the test utility (`scripts/test-hibp.ts`) to verify that leaked password protection is working:

```bash
npm run test:hibp
```

This will attempt to create a user with a known breached password and verify it's rejected by the server-side HIBP check.

You can also manually test by:
1. Trying to sign up with a known breached password (e.g., `password123` or `12345678`)
2. You should receive an error message: "This password has appeared in a data breach. Please choose a different password."

## Monitoring

Consider monitoring:

- Number of rejected passwords due to HIBP checks
- Common error patterns
- User feedback on password requirements

## Best Practices

1. **Enable the feature**: This is the most important step
2. **Test regularly**: Verify the feature remains enabled
3. **Monitor errors**: Track HIBP rejections to understand user behavior
4. **User education**: Consider adding password strength indicators and guidance
5. **Password managers**: Recommend users use password managers

## Troubleshooting

### Feature Not Working

1. **Check server logs**: Look for HIBP-related errors in your server logs
2. **Test with known breached password**: Use `password123` or similar
3. **Verify API connectivity**: Ensure your server can reach `api.pwnedpasswords.com`
4. **Check error messages**: Verify errors are being caught and displayed correctly

### HIBP API Unavailable

If the HIBP API is unavailable, the check gracefully fails (fail-open). This means:
- Users can still sign up (service availability is maintained)
- The check is skipped (logged as a warning)
- This prevents service disruption if HIBP API is down

### False Positives

- HIBP checks are based on known breaches, not password strength
- A password might be in HIBP but still be relatively strong
- Users should choose a different password regardless

### Rate Limiting and Caching

- The implementation includes in-memory caching (1 hour TTL) to reduce API calls
- Cache is limited to 1000 entries to prevent memory issues
- For production at scale, consider using Redis or similar for distributed caching
- The HIBP API is free and doesn't require authentication, but be respectful of rate limits

## Related Files

- `lib/api/auth.ts` - Authentication functions (includes HIBP check)
- `lib/utils/hibp.ts` - Server-side HIBP validation utility
- `lib/utils/auth-errors.ts` - Error handling utilities
- `scripts/test-hibp.ts` - Test utility
- `app/api/auth/signup/route.ts` - Sign up endpoint (includes HIBP check)
- `lib/api/members.ts` - Invitation acceptance with password (includes HIBP check)

## Implementation Status

✅ **Fully Implemented and Active**: All code changes have been implemented:
- ✅ Server-side HIBP validation integrated into all password flows
- ✅ User-friendly error messages for breached passwords
- ✅ Production-ready HIBP utility with caching and error handling
- ✅ Test utility to verify leaked password protection is working
- ✅ Updated validation schemas with better password guidance
- ✅ Centralized error handling utility (`lib/utils/auth-errors.ts`)

✅ **No Action Required**: The feature is already active and working. No dashboard configuration needed.

## Quick Verification Steps

1. **Test**: Run `npm run test:hibp` to verify it's working
2. **Manual Test**: Try signing up with a known breached password (e.g., `password123`) and confirm it's rejected
3. **Check Logs**: Verify HIBP checks are happening in your server logs

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [HaveIBeenPwned](https://haveibeenpwned.com/)
- [HIBP API Documentation](https://haveibeenpwned.com/API/v3#PwnedPasswords)

