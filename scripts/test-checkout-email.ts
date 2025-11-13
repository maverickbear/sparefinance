/**
 * Test script to verify checkout pending email functionality
 * Run: tsx scripts/test-checkout-email.ts
 */

import { sendCheckoutPendingEmail } from "../lib/utils/email";

async function testCheckoutEmail() {
  console.log("🧪 Testing checkout pending email...\n");

  const testEmail = process.env.TEST_EMAIL || "test@example.com";
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);

  try {
    await sendCheckoutPendingEmail({
      to: testEmail,
      planName: "Premium",
      trialEndDate: trialEndDate,
      signupUrl: "https://sparefinance.com/subscription/success?session_id=test",
      appUrl: "https://sparefinance.com",
    });

    console.log("\n✅ Test completed! Check your email inbox.");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testCheckoutEmail();

