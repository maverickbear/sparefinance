import { Shield } from "lucide-react";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { ContentPageLayout } from "@/components/common/content-page-layout";
import { LegalSection } from "@/components/common/legal-section";

export const metadata = {
  title: "Privacy Policy - Spare Finance",
  description: "Privacy Policy for Spare Finance",
};

const LAST_UPDATED = "February 1, 2025";

const externalLinkClass =
  "text-foreground underline underline-offset-4 hover:text-primary";

export default async function PrivacyPolicyPage() {
  let proPlanName = "PRO";
  try {
    const subscriptionsService = makeSubscriptionsService();
    const plans = await subscriptionsService.getPlans();
    const proPlan = plans.find((p) => p.name === "pro");
    proPlanName = proPlan?.name ?? "PRO";
  } catch (error: unknown) {
    const err = error as { message?: string };
    const msg = err?.message ?? "";
    if (
      !msg.includes("prerender") &&
      !msg.includes("HANGING_PROMISE") &&
      !msg.includes("fetch() rejects")
    ) {
      console.error("Error fetching plans:", error);
    }
  }

  return (
    <ContentPageLayout
      hero={{
        icon: <Shield className="h-10 w-10 shrink-0 text-primary" />,
        title: "Privacy Policy",
        subtitle: `Last updated: ${LAST_UPDATED}`,
      }}
    >
      <article className="space-y-6">
        <LegalSection title="Introduction">
          <p>
            Spare Finance is a product created by Maverick Bear Design, a
            Canadian company. At Spare Finance (&quot;we,&quot; &quot;our,&quot; or
            &quot;us&quot;), we are committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our financial management application
            and services.
          </p>
          <p>
            Please read this Privacy Policy carefully. By using our services, you
            agree to the collection and use of information in accordance with
            this policy.
          </p>
        </LegalSection>

        <LegalSection title="Information We Collect">
          <div>
            <h3>Personal Information</h3>
            <p>
              We collect information that you provide directly to us, including:
            </p>
            <ul>
              <li>Name and email address</li>
              <li>Phone number (optional)</li>
              <li>Profile picture or avatar URL (optional)</li>
              <li>Payment and billing information</li>
            </ul>
          </div>
          <div>
            <h3>Financial Information</h3>
            <p>To provide our services, we collect and store:</p>
            <ul>
              <li>
                Transaction data (amounts, dates, descriptions, categories,
                subcategories, tags, recurring patterns)
              </li>
              <li>
                Account information (account names, types, balances, limits,
                credit limits, account numbers when applicable)
              </li>
              <li>
                Budget and goal information (monthly budgets, savings goals,
                progress tracking, target amounts, priorities)
              </li>
              <li>
                Investment data: securities (stocks, ETFs, bonds), holdings,
                positions, portfolio values, investment transactions (buys, sells,
                dividends, transfers), market prices, asset allocation
              </li>
              <li>
                Debt tracking data: loan types, balances, interest rates,
                payment schedules, minimum payments, due dates, payment history,
                principal and interest paid
              </li>
              <li>
                Bank account data: account names, types, balances, transaction
                history (manually entered or imported via CSV)
              </li>
              <li>
                Category learning data: historical transaction patterns used for
                AI-powered categorization suggestions
              </li>
              <li>
                AI interaction data: queries, responses, and insights generated
                through AI features
              </li>
            </ul>
          </div>
          <div>
            <h3>Automatically Collected Information</h3>
            <p>When you use our services, we automatically collect:</p>
            <ul>
              <li>Device information and identifiers</li>
              <li>Usage data and analytics</li>
              <li>IP address and location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and manage your account</li>
            <li>Import and manage bank account data via CSV import</li>
            <li>
              Provide AI-powered category suggestions and financial insights
              using OpenAI
            </li>
            <li>
              Manage household member accounts and permissions ({proPlanName}{" "}
              plan)
            </li>
            <li>Calculate budgets, goals, investments, and debt tracking</li>
            <li>Generate reports, analytics, and financial health scores</li>
            <li>
              Send you important updates, notifications, and transactional emails
              via Resend
            </li>
            <li>Respond to your inquiries and provide customer support</li>
            <li>Monitor service performance and errors using Sentry</li>
            <li>Detect, prevent, and address technical issues and security threats</li>
            <li>Comply with legal obligations and enforce our terms</li>
            <li>Personalize your experience and provide relevant content</li>
            <li>Track account usage and enforce subscription plan limits</li>
            <li>Maintain security logs and audit trails for account actions</li>
          </ul>
        </LegalSection>

        <LegalSection title="How We Share Your Information">
          <p>
            We do not sell your personal or financial information. We may share
            your information only in the following circumstances:
          </p>
          <ul>
            <li>
              <strong>Service Providers:</strong> With trusted third-party service
              providers who assist us in operating our platform, including:
              <ul>
                <li>
                  <strong>Stripe:</strong> For payment processing and
                  subscription management. We do not store payment card
                  information — all payment data is handled by Stripe.
                </li>
                <li>
                  <strong>CSV Import:</strong> For importing bank account
                  transactions. We only receive account information,
                  transactions, and balances — we never access your bank
                  credentials.
                </li>
                <li>
                  <strong>OpenAI:</strong> For AI-powered categorization and
                  financial insights. Transaction data and patterns may be
                  processed by OpenAI to generate category suggestions and
                  insights. We do not share personally identifiable information
                  with OpenAI beyond what is necessary for the service.
                </li>
                <li>
                  <strong>Sentry:</strong> For error tracking and performance
                  monitoring. Error logs may include technical information about
                  your use of the service, but we filter sensitive data before
                  sending to Sentry.
                </li>
                <li>
                  <strong>Resend:</strong> For sending transactional emails
                  (verification codes, password resets, notifications). Email
                  addresses and basic account information are shared with Resend
                  for email delivery.
                </li>
                <li>
                  <strong>Supabase:</strong> For database hosting, authentication,
                  and cloud infrastructure. All your data is stored securely in
                  Supabase&apos;s infrastructure.
                </li>
                <li>
                  <strong>Vercel:</strong> For application hosting and content
                  delivery. Usage data and performance metrics may be collected by
                  Vercel.
                </li>
              </ul>
            </li>
            <li>
              <strong>Household Members:</strong> If you are part of a household
              account ({proPlanName} plan), your financial data may be shared
              with other household members as configured. Each household member
              maintains separate financial data (transactions, accounts,
              budgets), but the account owner can view and manage all household
              members. You control which members have access to your household
              account.
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law, court
              order, or government regulation
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger,
              acquisition, or sale of assets (with notice to users)
            </li>
            <li>
              <strong>With Your Consent:</strong> When you explicitly authorize
              us to share your information
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="Third-Party Services">
          <p>
            We use trusted third-party services to provide certain features of
            our platform. These services have their own privacy policies and
            terms of service:
          </p>
          <div className="space-y-4">
            <div>
              <h3>Stripe — Payment Processing</h3>
              <p>
                We use Stripe to process subscription payments. When you
                subscribe to our service:
              </p>
              <ul>
                <li>We do not store or have access to your full payment card information</li>
                <li>All payment data is securely processed and stored by Stripe</li>
                <li>We only receive confirmation of successful payments and subscription status</li>
                <li>Stripe handles all PCI-compliant payment processing</li>
              </ul>
              <p>
                For more information about how Stripe handles your payment data,
                please review{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
            <div>
              <h3>OpenAI — AI-Powered Features</h3>
              <p>
                We use OpenAI&apos;s API to provide AI-powered categorization and
                financial insights. When you use AI features:
              </p>
              <ul>
                <li>
                  Transaction descriptions and patterns may be sent to OpenAI to
                  generate category suggestions
                </li>
                <li>
                  We do not send personally identifiable information (names,
                  account numbers, exact amounts) to OpenAI
                </li>
                <li>Transaction data is anonymized before processing by OpenAI</li>
                <li>AI-generated suggestions are stored in your account for future reference</li>
                <li>You can disable or ignore AI suggestions at any time</li>
                <li>
                  OpenAI may use data sent to their API to improve their
                  services, but they do not use it to train models that serve
                  other customers
                </li>
              </ul>
              <p>
                For more information about how OpenAI handles data, please
                review{" "}
                <a
                  href="https://openai.com/policies/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  OpenAI&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
            <div>
              <h3>Sentry — Error Tracking and Monitoring</h3>
              <p>
                We use Sentry to monitor application errors and performance.
                When errors occur:
              </p>
              <ul>
                <li>
                  Technical error information (error messages, stack traces,
                  performance data) may be sent to Sentry
                </li>
                <li>
                  We filter and remove sensitive data (passwords, payment
                  information, account numbers) before sending to Sentry
                </li>
                <li>Error logs help us identify and fix issues to improve the service</li>
                <li>
                  You can opt out of error tracking, though this may limit our
                  ability to provide support
                </li>
              </ul>
              <p>
                For more information about Sentry&apos;s data practices, please
                review{" "}
                <a
                  href="https://sentry.io/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  Sentry&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
            <div>
              <h3>Resend — Email Delivery</h3>
              <p>
                We use Resend to send transactional emails (verification codes,
                password resets, notifications):
              </p>
              <ul>
                <li>
                  Your email address and basic account information are shared with
                  Resend for email delivery
                </li>
                <li>
                  Resend processes emails on our behalf and does not use your
                  information for their own purposes
                </li>
                <li>
                  You can unsubscribe from marketing emails, but transactional
                  emails (verification, password resets) are required for account
                  security
                </li>
              </ul>
              <p>
                For more information about Resend&apos;s data practices, please
                review{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  Resend&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </LegalSection>

        <LegalSection title="Data Security">
          <p>
            We implement industry-standard security measures to protect your
            information:
          </p>
          <ul>
            <li>End-to-end encryption for data transmission (TLS 1.2+)</li>
            <li>Secure data storage with encryption at rest</li>
            <li>
              Row Level Security (RLS) at the database level to ensure data
              isolation between users and households
            </li>
            <li>
              Secure authentication via Supabase Auth with password hashing and
              email verification (OTP)
            </li>
            <li>Secure storage of sensitive tokens (Stripe payment tokens)</li>
            <li>Regular security audits and vulnerability assessments</li>
            <li>Access controls and authentication mechanisms</li>
            <li>
              Compliance with financial data protection regulations (PIPEDA, GDPR,
              CCPA)
            </li>
            <li>
              Bank credentials are never stored — all data is entered manually or
              imported via CSV
            </li>
            <li>
              Household member data is isolated and only accessible to
              authorized members
            </li>
            <li>
              Security logging and audit trails for account actions (blocks,
              suspensions, deletions)
            </li>
            <li>Rate limiting to prevent abuse and unauthorized access</li>
            <li>Content Security Policy (CSP) headers to prevent XSS attacks</li>
            <li>
              Secure headers (HSTS, X-Frame-Options, X-Content-Type-Options) for
              additional protection
            </li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic
            storage is 100% secure. While we strive to use commercially
            acceptable means to protect your data, we cannot guarantee absolute
            security.
          </p>
          <p>
            <strong>AI Categorization Data:</strong> Category learning data is
            stored locally within your account and is not shared with other
            users. The AI system analyzes only your own historical transaction
            patterns to provide personalized category suggestions. Transaction
            data sent to OpenAI is anonymized to protect your privacy.
          </p>
          <p>
            <strong>Account Security:</strong> We maintain security logs and
            audit trails for account actions including blocks, suspensions, and
            terminations. This information is used for security purposes and
            compliance with our Terms of Service.
          </p>
        </LegalSection>

        <LegalSection title="Your Rights and Choices">
          <p>You have the following rights regarding your personal information:</p>
          <ul>
            <li>
              <strong>Access:</strong> Request access to your personal data
            </li>
            <li>
              <strong>Correction:</strong> Update or correct inaccurate
              information
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your account and
              data
            </li>
            <li>
              <strong>Export:</strong> Export your data in a portable format
            </li>
            <li>
              <strong>Opt-out:</strong> Unsubscribe from marketing communications
            </li>
            <li>
              <strong>Account Settings:</strong> Manage your privacy preferences
              in Settings
            </li>
          </ul>
          <p>
            To exercise these rights, please contact us at legal@sparefinance.com
            or use the account settings in the application.
          </p>
        </LegalSection>

        <LegalSection title="Data Retention">
          <p>
            We retain your personal and financial information for as long as
            your account is active or as needed to provide our services.
            Specific retention periods:
          </p>
          <ul>
            <li>
              <strong>Active Accounts:</strong> Data is retained while your
              account is active and needed for service provision
            </li>
            <li>
              <strong>Account Deletion:</strong> Upon account deletion request,
              all data is permanently deleted immediately
            </li>
            <li>
              <strong>Imported Data:</strong> When you delete imported CSV data,
              we remove it from our systems
            </li>
            <li>
              <strong>Security Logs:</strong> Security and audit logs (including
              account blocks and suspensions) may be retained longer for
              security and compliance purposes
            </li>
            <li>
              <strong>Legal Requirements:</strong> Data may be retained longer if
              required by law, regulation, or legitimate business purposes (e.g.,
              tax records, dispute resolution)
            </li>
            <li>
              <strong>Backup Data:</strong> Our database provider (Supabase)
              maintains automatic backups for disaster recovery. Backup retention
              is managed by Supabase according to their service terms (typically
              7–30 days depending on the service plan). We do not maintain
              separate backup copies beyond the provider&apos;s automatic backup
              system.
            </li>
          </ul>
          <p>
            You can request immediate deletion of your data by contacting us at
            legal@sparefinance.com. We will process deletion requests in
            accordance with applicable data protection laws.
          </p>
        </LegalSection>

        <LegalSection title="Children's Privacy">
          <p>
            Our services are not intended for individuals under the age of 18.
            We do not knowingly collect personal information from children. If you
            believe we have collected information from a child, please contact us
            immediately and we will take steps to delete such information.
          </p>
        </LegalSection>

        <LegalSection title="Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new Privacy Policy on
            this page and updating the &quot;Last updated&quot; date. You are advised to
            review this Privacy Policy periodically for any changes.
          </p>
        </LegalSection>

        <LegalSection title="Your Rights Under Data Protection Laws">
          <p>
            Depending on your location, you may have additional rights under data
            protection laws:
          </p>
          <div className="space-y-4">
            <div>
              <h3>PIPEDA (Canada)</h3>
              <p>
                As a Canadian company, we comply with PIPEDA. You have the right
                to access, correct, and challenge the accuracy of your personal
                information. You may also file a complaint with the Privacy
                Commissioner of Canada if you believe we have violated your
                privacy rights.
              </p>
            </div>
            <div>
              <h3>GDPR (European Economic Area)</h3>
              <p>
                If you are located in the EEA, you have the right to: access
                your data, rectify inaccurate data, erase your data (&quot;right to
                be forgotten&quot;), restrict processing, data portability, object to
                processing, and withdraw consent. You may also lodge a complaint
                with your local data protection authority.
              </p>
            </div>
            <div>
              <h3>CCPA (California)</h3>
              <p>
                If you are a California resident, you have the right to: know
                what personal information is collected, access your personal
                information, delete your personal information, opt-out of the
                sale of personal information (we do not sell your data), and
                non-discrimination for exercising your rights.
              </p>
            </div>
          </div>
          <p>
            To exercise any of these rights, please contact us at
            legal@sparefinance.com. We will respond to your request within 30
            days (or as required by applicable law).
          </p>
        </LegalSection>

        <LegalSection title="Contact Us">
          <p>
            If you have any questions about this Privacy Policy or our data
            practices, please contact us:
          </p>
          <div className="space-y-2 text-sm [&_strong]:text-foreground">
            <p><strong>Company:</strong> Maverick Bear Design (Canadian company)</p>
            <p><strong>Product:</strong> Spare Finance</p>
            <p><strong>Privacy & Legal:</strong> legal@sparefinance.com</p>
            <p><strong>Security:</strong> security@sparefinance.com</p>
            <p><strong>Support:</strong> support@sparefinance.com</p>
          </div>
          <p>
            For data protection inquiries, data subject access requests, or to
            exercise your privacy rights, please email legal@sparefinance.com
            with &quot;Privacy Request&quot; in the subject line.
          </p>
        </LegalSection>
      </article>
    </ContentPageLayout>
  );
}
