/**
 * Test utility to verify leaked password protection is working
 * 
 * This script attempts to create a user with a known breached password
 * and verifies that it's rejected by the server-side HIBP check.
 * 
 * Usage:
 *   npm run test:hibp
 * 
 * Note: This tests the server-side HIBP validation, which is always active.
 * No Supabase Dashboard configuration is needed.
 * 
 * IMPORTANT: This script tests through the API route to ensure the server-side
 * HIBP check is executed. Make sure your server is running or set NEXT_PUBLIC_APP_URL.
 */

// Known breached passwords from HaveIBeenPwned
const TEST_PASSWORDS = [
  "password123", // Very common breached password
  "12345678", // Very common breached password
  "Password1", // Common breached password
];

const TEST_EMAIL = `test-hibp-${Date.now()}@example.com`;

async function testHIBPProtection() {
  console.log("🔒 Testing Server-Side HIBP Password Protection\n");

  // Get app URL for API testing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  console.log("📋 Test Configuration:");
  console.log(`   App URL: ${appUrl}`);
  console.log(`   Test Passwords: ${TEST_PASSWORDS.join(", ")}\n`);
  console.log("⚠️  Note: This test requires the server to be running.\n");
  console.log("   If testing locally, run 'npm run dev' in another terminal.\n");

  let passedTests = 0;
  let failedTests = 0;

  for (const password of TEST_PASSWORDS) {
    console.log(`🧪 Testing password: "${password}"`);
    
    try {
      // Test through the API route to ensure server-side HIBP check is executed
      const testEmail = `test-hibp-${Date.now()}-${Math.random()}@example.com`;
      
      const response = await fetch(`${appUrl}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testEmail,
          password: password,
          name: "Test User",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if error is HIBP-related
        const errorMessage = result.error || "";
        const errorLower = errorMessage.toLowerCase();
        
        const isHIBPError =
          errorLower.includes("breach") ||
          errorLower.includes("pwned") ||
          errorLower.includes("compromised") ||
          errorLower.includes("leaked") ||
          errorLower.includes("hibp") ||
          errorLower.includes("haveibeenpwned") ||
          errorLower.includes("data breach");

        if (isHIBPError) {
          console.log(`   ✅ PASS: Password rejected (server-side HIBP check working)`);
          console.log(`   Error message: ${errorMessage}\n`);
          passedTests++;
        } else {
          console.log(`   ⚠️  WARNING: Password rejected but not due to HIBP`);
          console.log(`   Error message: ${errorMessage}`);
          console.log(`   Status: ${response.status}`);
          console.log(`   This might indicate HIBP protection is not working correctly\n`);
          failedTests++;
        }
      } else if (result.user) {
        console.log(`   ❌ FAIL: Password accepted (should have been rejected)`);
        console.log(`   User ID: ${result.user.id}`);
        console.log(`   ⚠️  Server-side HIBP check may not be working!\n`);
        failedTests++;
      } else {
        console.log(`   ⚠️  UNKNOWN: Unexpected response`);
        console.log(`   Response: ${JSON.stringify(result)}\n`);
        failedTests++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: Unexpected error during test`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
      failedTests++;
    }
  }

  // Summary
  console.log("📊 Test Summary:");
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   Total: ${passedTests + failedTests}\n`);

  if (failedTests > 0) {
    console.log("⚠️  WARNING: Some tests failed!");
    console.log("   Please verify that server-side HIBP validation is working:");
    console.log("   1. Check server logs for HIBP-related errors");
    console.log("   2. Verify your server can reach api.pwnedpasswords.com");
    console.log("   3. Check that lib/utils/hibp.ts is properly imported");
    console.log("   4. Run this test again\n");
    process.exit(1);
  } else {
    console.log("✅ All tests passed! Server-side HIBP validation is working correctly.\n");
    process.exit(0);
  }
}

// Run the test
testHIBPProtection().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

