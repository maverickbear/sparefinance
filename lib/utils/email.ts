import { Resend } from "resend";
import fs from "fs";
import path from "path";

// Initialize Resend only if API key is available
const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

export interface InvitationEmailData {
  to: string;
  memberName: string;
  ownerName: string;
  ownerEmail: string;
  invitationToken: string;
  appUrl?: string;
}

export interface CheckoutPendingEmailData {
  to: string;
  planName: string;
  trialEndDate: Date | null;
  signupUrl: string;
  appUrl?: string;
}

export interface WelcomeEmailData {
  to: string;
  userName: string;
  founderName?: string;
  appUrl?: string;
}

export interface PasswordResetEmailData {
  to: string;
  userName?: string;
  resetLink: string;
  appUrl?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  console.log("[EMAIL] sendInvitationEmail called with:", {
    to: data.to,
    memberName: data.memberName,
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail,
    hasToken: !!data.invitationToken,
    appUrl: data.appUrl,
  });

  const resend = getResend();
  
  if (!resend) {
    const apiKeyStatus = process.env.RESEND_API_KEY ? "SET (but Resend not initialized)" : "NOT SET";
    console.error("[EMAIL] ❌ RESEND_API_KEY not configured. Email will not be sent.");
    console.error("[EMAIL] RESEND_API_KEY status:", apiKeyStatus);
    throw new Error("RESEND_API_KEY not configured. Cannot send invitation email.");
  }
  
  console.log("[EMAIL] ✅ Resend initialized successfully");

  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  const invitationLink = `${appUrl}/members/accept?token=${data.invitationToken}`;

  console.log("[EMAIL] Invitation link generated:", invitationLink);

  // Always use noreply@sparefinance.com as the sender with "Spare Finance" as display name
  const finalFromEmail = "Spare Finance <noreply@sparefinance.com>";

  console.log("[EMAIL] Sending email from:", finalFromEmail, "to:", data.to);
  console.log("[EMAIL] Final from email value:", JSON.stringify(finalFromEmail));

  try {
    console.log("[EMAIL] Preparing to send email via Resend API...");
    const emailPayload = {
      from: finalFromEmail,
      to: data.to,
      subject: `${data.ownerName} invited you to Spare Finance`,
      html: getInvitationEmailTemplate({
        memberName: data.memberName,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        invitationLink,
        memberEmail: data.to,
        appUrl,
      }),
    };
    console.log("[EMAIL] Email payload (from field):", JSON.stringify(emailPayload.from));
    const result = await resend.emails.send(emailPayload);

    console.log("[EMAIL] Resend API response received:", {
      hasError: !!result.error,
      hasData: !!result.data,
      error: result.error ? {
        message: result.error.message,
        name: result.error.name,
      } : null,
      emailId: result.data?.id,
    });

    if (result.error) {
      const errorMessage = result.error.message || JSON.stringify(result.error);
      
      // Check if it's a domain verification or testing limitation error
      const isDomainError = errorMessage.includes("validation_error") || 
          errorMessage.includes("domain") ||
          errorMessage.includes("not verified");
      const isTestingLimitation = errorMessage.includes("You can only send testing emails to your own email address");
      
      if (isDomainError || isTestingLimitation) {
        const warningMessage = `
⚠️  Resend Domain Verification Required:
The invitation was created successfully, but the email could not be sent automatically.
This is because the domain sparefinance.com is not verified in Resend.

📋 The invitation link is: ${invitationLink}

You can manually share this link with the invited member.

🔧 To enable email sending:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: noreply@sparefinance.com
        `;
        console.warn("[EMAIL]", warningMessage);
        throw new Error(`Email not sent - domain verification required. Invitation link: ${invitationLink}`);
      } else {
        console.error("[EMAIL] ❌ Resend API error:", result.error);
        console.error("[EMAIL] Error details:", JSON.stringify(result.error, null, 2));
        throw new Error(`Resend API error: ${errorMessage}`);
      }
    } else {
      console.log("[EMAIL] ✅ Invitation email sent successfully to:", data.to);
      console.log("[EMAIL] Email ID:", result.data?.id);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error("[EMAIL] ❌ Exception caught while sending invitation email:", error);
    if (error instanceof Error) {
      console.error("[EMAIL] Error message:", error.message);
      console.error("[EMAIL] Error stack:", error.stack);
    }
    
    // Check if it's the Resend testing limitation error
    if (errorMessage.includes("validation_error") || 
        errorMessage.includes("You can only send testing emails to your own email address") ||
        errorMessage.includes("domain") ||
        errorMessage.includes("not verified") ||
        errorMessage.includes("Resend testing limitations")) {
      console.warn(`
⚠️  Resend Testing Limitation:
The invitation was created successfully, but the email could not be sent automatically.
This is because Resend's testing mode only allows sending emails to your verified email address.

📋 The invitation link is: ${invitationLink}

You can manually share this link with the invited member.

🔧 To enable email sending:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: noreply@sparefinance.com
      `);
    }
    
    // Re-throw the error so the caller knows the email wasn't sent
    // The caller can decide whether to fail the invitation or continue
    throw error;
  }
}

function getLogoUrl(appUrl?: string): string {
  // Get Supabase URL from environment variable
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    // Fallback to hardcoded URL if env var is not set
    return "https://app.sparefinance.com/storage/v1/object/public/images/logo-primary-lightbg-email.png";
  }
  
  // Construct the public URL for the logo in the images bucket
  return `${supabaseUrl}/storage/v1/object/public/images/logo-primary-lightbg-email.png`;
}

function getInvitationEmailTemplate(data: {
  memberName: string;
  ownerName: string;
  ownerEmail: string;
  invitationLink: string;
  memberEmail?: string;
  appUrl?: string;
}): string {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates/household-invitation.html');
    console.log("[EMAIL] Loading template from:", templatePath);
    
    let html = fs.readFileSync(templatePath, 'utf-8');
    console.log("[EMAIL] Template loaded successfully, length:", html.length);
    
    const logoUrl = getLogoUrl(data.appUrl);
    
    // Replace template variables
    html = html.replace(/\{\{ \.MemberName \}\}/g, data.memberName || "there");
    html = html.replace(/\{\{ \.OwnerName \}\}/g, data.ownerName || "A user");
    html = html.replace(/\{\{ \.OwnerEmail \}\}/g, data.ownerEmail || "");
    html = html.replace(/\{\{ \.InvitationLink \}\}/g, data.invitationLink);
    html = html.replace(/\{\{ \.MemberEmail \}\}/g, data.memberEmail || "");
    html = html.replace(/\{\{ \.Year \}\}/g, new Date().getFullYear().toString());
    html = html.replace(/\{\{ \.LogoURL \}\}/g, logoUrl);
    
    console.log("[EMAIL] Template variables replaced successfully");
    return html;
  } catch (error) {
    console.error("[EMAIL] ❌ Error loading invitation email template:", error);
    // Fallback to inline template if file read fails
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Spare Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #7BC85A; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Spare Finance</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">You've been invited!</h2>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Hello ${data.memberName || "there"},
              </p>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                <strong>${data.ownerName}</strong> (${data.ownerEmail}) has invited you to join their household on Spare Finance.
              </p>
              
              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                As a household member, you'll be able to view and manage shared finances, including transactions, budgets, and goals.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${data.invitationLink}" style="display: inline-block; padding: 14px 32px; background-color: #7BC85A; color: #16161B; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #7BC85A; font-size: 14px; word-break: break-all;">
                ${data.invitationLink}
              </p>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 12px; line-height: 1.6;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
                © ${new Date().getFullYear()} Spare Finance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

export async function sendCheckoutPendingEmail(data: CheckoutPendingEmailData): Promise<void> {
  console.log("[EMAIL] sendCheckoutPendingEmail called with:", {
    to: data.to,
    planName: data.planName,
    trialEndDate: data.trialEndDate,
    signupUrl: data.signupUrl,
  });
  
  const resend = getResend();
  
  if (!resend) {
    console.warn("[EMAIL] ❌ RESEND_API_KEY not configured. Email will not be sent.");
    console.warn("[EMAIL] RESEND_API_KEY value:", process.env.RESEND_API_KEY ? "SET (but Resend not initialized)" : "NOT SET");
    return;
  }

  console.log("[EMAIL] ✅ Resend initialized successfully");

  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
  // Always use noreply@sparefinance.com as the sender with "Spare Finance" as display name
  const finalFromEmail = "Spare Finance <noreply@sparefinance.com>";

  console.log("[EMAIL] Email configuration:", {
    from: finalFromEmail,
    to: data.to,
    appUrl,
  });
  console.log("[EMAIL] Final from email value:", JSON.stringify(finalFromEmail));

  // Format trial end date
  let trialInfo = "";
  if (data.trialEndDate) {
    const trialEnd = new Date(data.trialEndDate);
    const formattedDate = trialEnd.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    trialInfo = `Your 30-day trial is active and will end on ${formattedDate}.`;
  } else {
    trialInfo = "Your subscription is now active.";
  }

  console.log("[EMAIL] Trial info:", trialInfo);

  try {
    console.log("[EMAIL] Sending email via Resend...");
    const emailPayload = {
      from: finalFromEmail,
      to: data.to,
      subject: `Complete your Spare Finance account setup`,
      html: getCheckoutPendingEmailTemplate({
        planName: data.planName,
        trialInfo,
        signupUrl: data.signupUrl,
      }),
    };
    console.log("[EMAIL] Checkout pending email payload (from field):", JSON.stringify(emailPayload.from));
    const result = await resend.emails.send(emailPayload);

    console.log("[EMAIL] Resend API response:", {
      hasError: !!result.error,
      hasData: !!result.data,
      error: result.error,
      data: result.data,
    });

    if (result.error) {
      const errorMessage = result.error.message || JSON.stringify(result.error);
      console.error("[EMAIL] ❌ Resend API error:", result.error);
      console.error("[EMAIL] Error details:", {
        message: result.error.message,
        name: result.error.name,
        statusCode: (result.error as any)?.statusCode,
      });
      throw new Error(`Resend API error: ${errorMessage}`);
    } else {
      console.log("[EMAIL] ✅ Checkout pending email sent successfully to:", data.to);
      console.log("[EMAIL] Email ID:", result.data?.id);
    }
  } catch (error) {
    console.error("[EMAIL] ❌ Exception sending checkout pending email:", error);
    if (error instanceof Error) {
      console.error("[EMAIL] Error message:", error.message);
      console.error("[EMAIL] Error stack:", error.stack);
    }
    // Don't throw - we don't want email failures to break the webhook flow
  }
}

function getCheckoutPendingEmailTemplate(data: {
  planName: string;
  trialInfo: string;
  signupUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete your Spare Finance account setup</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #7BC85A; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Spare Finance</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">Complete your account setup</h2>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Great news! Your subscription to the <strong>${data.planName}</strong> plan has been successfully created.
              </p>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                ${data.trialInfo}
              </p>
              
              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                To start using Spare Finance, please complete your account setup by creating your password. This will only take a minute!
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 20px 0;">
                    <a href="${data.signupUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7BC85A; color: #16161B; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Complete Account Setup</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #7BC85A; font-size: 14px; word-break: break-all;">
                ${data.signupUrl}
              </p>
              
              <div style="margin: 30px 0 0; padding: 20px; background-color: #f9f9f9; border-radius: 6px; border-left: 4px solid #7BC85A;">
                <p style="margin: 0 0 10px; color: #1a1a1a; font-size: 14px; font-weight: 600;">What's next?</p>
                <ul style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                  <li>Create your account password</li>
                  <li>Access all pro features</li>
                  <li>Start tracking your finances</li>
                  <li>You'll only be charged after your 30-day trial ends. Cancel anytime.</li>
                </ul>
              </div>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 12px; line-height: 1.6;">
                If you didn't initiate this subscription, please contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
                © ${new Date().getFullYear()} Spare Finance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  console.log("[EMAIL] sendPasswordResetEmail called with:", {
    to: data.to,
    userName: data.userName,
    hasResetLink: !!data.resetLink,
    appUrl: data.appUrl,
  });

  const resend = getResend();
  
  if (!resend) {
    const apiKeyStatus = process.env.RESEND_API_KEY ? "SET (but Resend not initialized)" : "NOT SET";
    console.error("[EMAIL] ❌ RESEND_API_KEY not configured. Email will not be sent.");
    console.error("[EMAIL] RESEND_API_KEY status:", apiKeyStatus);
    throw new Error("RESEND_API_KEY not configured. Cannot send password reset email.");
  }
  
  console.log("[EMAIL] ✅ Resend initialized successfully");

  // Always use noreply@sparefinance.com as the sender with "Spare Finance" as display name
  const finalFromEmail = "Spare Finance <noreply@sparefinance.com>";

  console.log("[EMAIL] Sending email from:", finalFromEmail, "to:", data.to);
  console.log("[EMAIL] Final from email value:", JSON.stringify(finalFromEmail));

  try {
    console.log("[EMAIL] Preparing to send password reset email via Resend API...");
    const emailPayload = {
      from: finalFromEmail,
      to: data.to,
      subject: "Reset your password - Spare Finance",
      html: getPasswordResetEmailTemplate({
        userName: data.userName,
        resetLink: data.resetLink,
        userEmail: data.to,
      }),
    };
    console.log("[EMAIL] Email payload (from field):", JSON.stringify(emailPayload.from));
    const result = await resend.emails.send(emailPayload);

    console.log("[EMAIL] Resend API response received:", {
      hasError: !!result.error,
      hasData: !!result.data,
      error: result.error ? {
        message: result.error.message,
        name: result.error.name,
      } : null,
      emailId: result.data?.id,
    });

    if (result.error) {
      const errorMessage = result.error.message || JSON.stringify(result.error);
      
      // Check if it's a domain verification or testing limitation error
      const isDomainError = errorMessage.includes("validation_error") || 
          errorMessage.includes("domain") ||
          errorMessage.includes("not verified");
      const isTestingLimitation = errorMessage.includes("You can only send testing emails to your own email address");
      
      if (isDomainError || isTestingLimitation) {
        const warningMessage = `
⚠️  Resend Domain Verification Required:
The password reset email could not be sent automatically.
This is because the domain sparefinance.com is not verified in Resend.

📋 The password reset link is: ${data.resetLink}

You can manually share this link with the user if needed.

🔧 To enable email sending:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: noreply@sparefinance.com
        `;
        console.warn("[EMAIL]", warningMessage);
        throw new Error(`Email not sent - domain verification required. Reset link: ${data.resetLink}`);
      } else {
        console.error("[EMAIL] ❌ Resend API error:", result.error);
        console.error("[EMAIL] Error details:", JSON.stringify(result.error, null, 2));
        throw new Error(`Resend API error: ${errorMessage}`);
      }
    } else {
      console.log("[EMAIL] ✅ Password reset email sent successfully to:", data.to);
      console.log("[EMAIL] Email ID:", result.data?.id);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error("[EMAIL] ❌ Exception caught while sending password reset email:", error);
    if (error instanceof Error) {
      console.error("[EMAIL] Error message:", error.message);
      console.error("[EMAIL] Error stack:", error.stack);
    }
    
    // Check if it's a domain verification or testing limitation error
    if (errorMessage.includes("validation_error") || 
        errorMessage.includes("domain") ||
        errorMessage.includes("not verified") ||
        errorMessage.includes("Resend testing limitations") ||
        errorMessage.includes("domain verification required")) {
      console.warn(`
⚠️  Resend Domain Verification Required:
The password reset email could not be sent automatically.
This is because the domain sparefinance.com is not verified in Resend.

📋 The password reset link is: ${data.resetLink}

You can manually share this link with the user if needed.

🔧 To enable email sending:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: noreply@sparefinance.com
      `);
    }
    
    // Re-throw the error so the caller knows the email wasn't sent
    throw error;
  }
}

function getPasswordResetEmailTemplate(data: {
  userName?: string;
  resetLink: string;
  userEmail?: string;
}): string {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates/password-reset.html');
    console.log("[EMAIL] Loading password reset template from:", templatePath);
    
    let html = fs.readFileSync(templatePath, 'utf-8');
    console.log("[EMAIL] Template loaded successfully, length:", html.length);
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
    const logoUrl = getLogoUrl(appUrl);
    
    // Replace template variables
    html = html.replace(/\{\{ if \.Name \}\} \{\{ \.Name \}\}\{\{ end \}\}/g, data.userName || "");
    html = html.replace(/\{\{ \.ConfirmationURL \}\}/g, data.resetLink);
    html = html.replace(/\{\{ \.Email \}\}/g, data.userEmail || "");
    html = html.replace(/\{\{ \.Year \}\}/g, new Date().getFullYear().toString());
    html = html.replace(/\{\{ \.LogoURL \}\}/g, logoUrl);
    
    console.log("[EMAIL] Template variables replaced successfully");
    return html;
  } catch (error) {
    console.error("[EMAIL] ❌ Error loading password reset email template:", error);
    // Fallback to inline template if file read fails
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Spare Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="padding: 30px 40px 20px; text-align: left;">
              <img src="${getLogoUrl()}" alt="Spare Finance" style="height: 32px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <h1 style="margin: 0 0 20px; color: #1a1a1a; font-size: 28px; font-weight: 700; line-height: 1.3;">
                Reset your password
              </h1>
              
              <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                Hi${data.userName ? ` ${data.userName}` : ""},
              </p>
              
              <p style="margin: 0 0 24px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <div style="text-align: left; margin: 0 0 24px;">
                <a href="${data.resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #7BC85A; color: #16161B; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Reset Password
                </a>
              </div>
              
              <p style="margin: 0 0 16px; color: #8a8a8a; font-size: 14px; line-height: 1.5;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 24px; color: #8a8a8a; font-size: 14px; line-height: 1.5; word-break: break-all;">
                ${data.resetLink}
              </p>
              
              <p style="margin: 0 0 16px; color: #8a8a8a; font-size: 14px; line-height: 1.5;">
                This link will expire in 1 hour for security reasons. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <p style="margin: 0 0 24px; color: #8a8a8a; font-size: 14px; line-height: 1.5;">
                For your security, we recommend choosing a strong, unique password that you haven't used elsewhere.
              </p>
              
              <p style="margin: 0; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                Best regards,<br>
                Spare Finance
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e5e5e5; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; color: #8a8a8a; font-size: 12px; line-height: 1.5;">
                This message was sent to ${data.userEmail || ""}. If you have questions or complaints, please contact us.
              </p>
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
                © ${new Date().getFullYear()} Spare Finance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const resend = getResend();
  
  if (!resend) {
    console.warn("RESEND_API_KEY not configured. Email will not be sent.");
    return;
  }

  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  const founderName = data.founderName || "Naor Tartarotti";
  
  // Use founder's email as the sender so replies go directly to the founder
  // Default to naor@sparefinance.com if FOUNDER_EMAIL is not configured
  const founderEmail = process.env.FOUNDER_EMAIL || "naor@sparefinance.com";
  const finalFromEmail = `${founderName} <${founderEmail}>`;

  console.log("[EMAIL] Welcome email - Final from email value:", JSON.stringify(finalFromEmail));

  try {
    const emailPayload = {
      from: finalFromEmail,
      to: data.to,
      subject: `Welcome to Spare Finance!`,
      html: getWelcomeEmailTemplate({
        founderName,
        email: data.to,
      }),
    };
    console.log("[EMAIL] Welcome email payload (from field):", JSON.stringify(emailPayload.from));
    const result = await resend.emails.send(emailPayload);

    if (result.error) {
      const errorMessage = result.error.message || JSON.stringify(result.error);
      console.error("Resend API error:", result.error);
      throw new Error(`Resend API error: ${errorMessage}`);
    } else {
      console.log("✅ Welcome email sent successfully to:", data.to);
    }
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw - we don't want email failures to break the user flow
  }
}

function getWelcomeEmailTemplate(data: {
  founderName: string;
  email: string;
}): string {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates/welcome.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com";
    const logoUrl = getLogoUrl(appUrl);
    
    // Replace variables
    html = html.replace(/\{\{ \.FounderName \}\}/g, data.founderName);
    html = html.replace(/\{\{ \.Email \}\}/g, data.email);
    html = html.replace(/\{\{ \.Year \}\}/g, new Date().getFullYear().toString());
    html = html.replace(/\{\{ \.LogoURL \}\}/g, logoUrl);
    
    return html;
  } catch (error) {
    console.error("Error reading welcome email template:", error);
    // Fallback to inline template
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Spare Finance</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="padding: 30px 40px 20px; text-align: left;">
              <img src="${getLogoUrl()}" alt="Spare Finance" style="height: 32px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <h1 style="margin: 0 0 20px; color: #1a1a1a; font-size: 28px; font-weight: 700; line-height: 1.3;">
                Welcome to Spare Finance!
              </h1>
              <p style="margin: 0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                Hi,
              </p>
              <p style="margin:0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                I'm ${data.founderName}, founder of Spare Finance.
              </p>
              <p style="margin:0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                I hope you take full advantage of these 30 days to explore the platform and that it helps you organize your financial life, whether individually or as a family.
              </p>
              <p style="margin:0 0 16px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                I created this platform with the goal of moving away from spreadsheets. I focused on building something that made sense to me, and I decided to make it a product available to everyone.
              </p>
              <p style="margin:0 0 24px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                Your feedback is very welcome! If you have any questions, suggestions, or just want to share your experience, feel free to reply to this email. I read and respond to every message personally.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0;">
                <tr>
                  <td style="padding-right: 16px; vertical-align: top;">
                    <img src="https://dvshwrtzazoetkbzxolv.supabase.co/storage/v1/object/public/images/founder-avatar.jpeg" alt="${data.founderName}" style="width: 64px; height: 64px; border-radius: 50%; display: block;" />
                  </td>
                  <td style="vertical-align: top;">
                    <p style="margin:0; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                      Best regards,<br>
                      ${data.founderName}<br>
                      <span style="color: #8a8a8a; font-size: 14px;">Founder, Spare Finance</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e5e5e5; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px; color: #8a8a8a; font-size: 12px; line-height: 1.5;">
                This message was sent to ${data.email}. If you have questions or complaints, please contact us.
              </p>
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
                © ${new Date().getFullYear()} Spare Finance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
