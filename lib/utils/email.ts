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

export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  console.log("[EMAIL] sendInvitationEmail called with:", {
    to: data.to,
    memberName: data.memberName,
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail,
    hasToken: !!data.invitationToken,
  });

  const resend = getResend();
  
  if (!resend) {
    console.warn("[EMAIL] ❌ RESEND_API_KEY not configured. Email will not be sent.");
    return;
  }

  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  const invitationLink = `${appUrl}/members/accept?token=${data.invitationToken}`;

  console.log("[EMAIL] Invitation link generated:", invitationLink);

  // Always use noreply@sparefinance.com as the default sender
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@sparefinance.com";
  
  // Ensure we're using noreply@sparefinance.com instead of onboarding@resend.dev
  const finalFromEmail = fromEmail === "onboarding@resend.dev" ? "noreply@sparefinance.com" : fromEmail;

  console.log("[EMAIL] Sending email from:", finalFromEmail, "to:", data.to);

  try {
    const result = await resend.emails.send({
      from: finalFromEmail,
      to: data.to,
      subject: `${data.ownerName} invited you to Spare Finance`,
      html: getInvitationEmailTemplate({
        memberName: data.memberName,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        invitationLink,
        memberEmail: data.to,
      }),
    });

    if (result.error) {
      const errorMessage = result.error.message || JSON.stringify(result.error);
      
      // Check if it's the Resend testing limitation error
      if (errorMessage.includes("validation_error") || 
          errorMessage.includes("You can only send testing emails to your own email address") ||
          errorMessage.includes("domain") ||
          errorMessage.includes("not verified")) {
        console.warn(`
⚠️  Resend Testing Limitation:
The invitation was created successfully, but the email could not be sent automatically.
This is because Resend's testing mode only allows sending emails to your verified email address.

📋 The invitation link is: ${invitationLink}

You can manually share this link with the invited member.

🔧 To enable email sending to any recipient:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: ${finalFromEmail}
        `);
      } else {
        console.error("[EMAIL] ❌ Resend API error:", result.error);
        console.error("[EMAIL] Error details:", JSON.stringify(result.error, null, 2));
      }
    } else {
      console.log("[EMAIL] ✅ Invitation email sent successfully to:", data.to);
      console.log("[EMAIL] Email ID:", result.data?.id);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's the Resend testing limitation error
    if (errorMessage.includes("validation_error") || 
        errorMessage.includes("You can only send testing emails to your own email address") ||
        errorMessage.includes("domain") ||
        errorMessage.includes("not verified")) {
      console.warn(`
⚠️  Resend Testing Limitation:
The invitation was created successfully, but the email could not be sent automatically.
This is because Resend's testing mode only allows sending emails to your verified email address.

📋 The invitation link is: ${invitationLink}

You can manually share this link with the invited member.

🔧 To enable email sending to any recipient:
1. Go to https://resend.com/domains
2. Add and verify the domain: sparefinance.com
3. Configure DNS records (SPF, DKIM, DMARC) as instructed by Resend
4. Wait for domain verification (may take a few hours)

Once verified, emails will be sent from: ${fromEmail}
      `);
    } else {
      console.error("[EMAIL] ❌ Error sending invitation email:", error);
      if (error instanceof Error) {
        console.error("[EMAIL] Error stack:", error.stack);
      }
    }
    // Don't throw - we don't want email failures to break the invitation flow
    // The invitation is still created in the database
  }
}

function getInvitationEmailTemplate(data: {
  memberName: string;
  ownerName: string;
  ownerEmail: string;
  invitationLink: string;
  memberEmail?: string;
}): string {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates/household-invitation.html');
    console.log("[EMAIL] Loading template from:", templatePath);
    
    let html = fs.readFileSync(templatePath, 'utf-8');
    console.log("[EMAIL] Template loaded successfully, length:", html.length);
    
    // Replace template variables
    html = html.replace(/\{\{ \.MemberName \}\}/g, data.memberName || "there");
    html = html.replace(/\{\{ \.OwnerName \}\}/g, data.ownerName || "Um usuário");
    html = html.replace(/\{\{ \.OwnerEmail \}\}/g, data.ownerEmail || "");
    html = html.replace(/\{\{ \.InvitationLink \}\}/g, data.invitationLink);
    html = html.replace(/\{\{ \.MemberEmail \}\}/g, data.memberEmail || "");
    html = html.replace(/\{\{ \.Year \}\}/g, new Date().getFullYear().toString());
    
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
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
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
                    <a href="${data.invitationLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #667eea; font-size: 14px; word-break: break-all;">
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
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@sparefinance.com";
  const finalFromEmail = fromEmail === "onboarding@resend.dev" ? "noreply@sparefinance.com" : fromEmail;

  console.log("[EMAIL] Email configuration:", {
    from: finalFromEmail,
    to: data.to,
    appUrl,
  });

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
    const result = await resend.emails.send({
      from: finalFromEmail,
      to: data.to,
      subject: `Complete your Spare Finance account setup`,
      html: getCheckoutPendingEmailTemplate({
        planName: data.planName,
        trialInfo,
        signupUrl: data.signupUrl,
      }),
    });

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
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
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
                    <a href="${data.signupUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Complete Account Setup</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #8a8a8a; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #667eea; font-size: 14px; word-break: break-all;">
                ${data.signupUrl}
              </p>
              
              <div style="margin: 30px 0 0; padding: 20px; background-color: #f9f9f9; border-radius: 6px; border-left: 4px solid #667eea;">
                <p style="margin: 0 0 10px; color: #1a1a1a; font-size: 14px; font-weight: 600;">What's next?</p>
                <ul style="margin: 0; padding-left: 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                  <li>Create your account password</li>
                  <li>Access all premium features</li>
                  <li>Start tracking your finances</li>
                  <li>No credit card required during trial</li>
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

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const resend = getResend();
  
  if (!resend) {
    console.warn("RESEND_API_KEY not configured. Email will not be sent.");
    return;
  }

  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  const founderName = data.founderName || "Naor Tartarotti";
  
  // Use personal email address for welcome emails (from the founder)
  const fromEmail = process.env.RESEND_WELCOME_FROM_EMAIL || "naor@sparefinance.com";
  const finalFromEmail = fromEmail === "onboarding@resend.dev" ? "naor@sparefinance.com" : fromEmail;

  try {
    const result = await resend.emails.send({
      from: finalFromEmail,
      to: data.to,
      subject: `Welcome to Spare Finance!`,
      html: getWelcomeEmailTemplate({
        founderName,
        email: data.to,
      }),
    });

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
    
    // Replace variables
    html = html.replace(/\{\{ \.FounderName \}\}/g, data.founderName);
    html = html.replace(/\{\{ \.Email \}\}/g, data.email);
    html = html.replace(/\{\{ \.Year \}\}/g, new Date().getFullYear().toString());
    
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
              <img src="https://dvshwrtzazoetkbzxolv.supabase.co/storage/v1/object/public/images/spare-logo-purple.png" alt="Spare Finance" style="height: 32px; width: auto;" />
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
              <p style="margin:0; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                Best regards,<br>
                ${data.founderName}<br>
                <span style="color: #8a8a8a; font-size: 14px;">Founder, Spare Finance</span>
              </p>
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
