import { FileText } from "lucide-react";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import { ContentPageLayout } from "@/components/common/content-page-layout";
import { LegalSection } from "@/components/common/legal-section";

export const metadata = {
  title: "Terms of Service - Spare Finance",
  description: "Terms of Service for Spare Finance",
};

const LAST_UPDATED = "February 1, 2025";

export default async function TermsOfServicePage() {
  let proPlanName = "PRO";
  let proPlan:
    | { name: string; priceMonthly: number; priceYearly: number }
    | undefined;
  try {
    const subscriptionsService = makeSubscriptionsService();
    const plans = await subscriptionsService.getPlans();
    proPlan = plans.find((p) => p.name === "pro");
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
        icon: <FileText className="h-10 w-10 shrink-0 text-primary" />,
        title: "Terms of Service",
        subtitle: `Last updated: ${LAST_UPDATED}`,
      }}
    >
      <article className="space-y-6">
        <LegalSection title="Agreement to Terms">
          <p>
            Spare Finance is a product created by Maverick Bear Design, a
            Canadian company. These Terms of Service (&quot;Terms&quot;) constitute a
            legally binding agreement between you and Spare Finance (&quot;we,&quot;
            &quot;our,&quot; or &quot;us&quot;) regarding your use of our financial management
            application and services (the &quot;Service&quot;).
          </p>
          <p>
            By accessing or using our Service, you agree to be bound by these
            Terms. If you do not agree to these Terms, you may not access or use
            the Service.
          </p>
        </LegalSection>

        <LegalSection title="Eligibility">
          <p>
            You must be at least 18 years old to use our Service. By using the
            Service, you represent and warrant that:
          </p>
          <ul>
            <li>You are at least 18 years of age</li>
            <li>You have the legal capacity to enter into these Terms</li>
            <li>You will comply with all applicable laws and regulations</li>
            <li>All information you provide is accurate and current</li>
          </ul>
        </LegalSection>

        <LegalSection title="Account Registration">
          <p>
            To use certain features of the Service, you must register for an
            account. You agree to:
          </p>
          <ul>
            <li>
              Provide accurate, current, and complete information during
              registration
            </li>
            <li>Maintain and update your account information to keep it accurate</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities that occur under your account</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p>
            You are responsible for maintaining the confidentiality of your
            account password and for all activities that occur under your
            account.
          </p>
        </LegalSection>

        <LegalSection title="Use of the Service">
          <div>
            <h3>Permitted Use</h3>
            <p>
              You may use the Service for personal, non-commercial purposes in
              accordance with these Terms. You agree to use the Service only for
              lawful purposes and in a way that does not infringe the rights of
              others.
            </p>
          </div>
          <div>
            <h3>Service Features</h3>
            <p>
              The Service includes various features, some of which may be subject
              to plan limitations:
            </p>
            <ul>
              <li>
                <strong>Household Members:</strong> Available on the {proPlanName}{" "}
                plan. You may invite family members to your account. Each member
                maintains separate financial data, and you are responsible for
                managing member access and permissions. The account owner can
                view and manage all household members&apos; data.
              </li>
              <li>
                <strong>AI-Powered Features:</strong> The Service uses
                OpenAI-powered artificial intelligence to provide category
                suggestions, financial insights, and automated categorization
                based on your historical data. These are suggestions only, and
                you are responsible for verifying and approving all AI-generated
                content. We do not guarantee the accuracy of AI suggestions.
              </li>
              <li>
                <strong>CSV Import/Export:</strong> You may import and export
                your financial data in CSV format. You are responsible for the
                accuracy of imported data and for maintaining backups of
                exported data. Imported data may require manual verification and
                categorization.
              </li>
              <li>
                <strong>Investment Tracking:</strong> You may track investments,
                securities, positions, and portfolio performance. Investment
                data may be entered manually. We do not provide investment advice
                and are not responsible for investment decisions made based on
                data displayed in the Service.
              </li>
              <li>
                <strong>Debt Management:</strong> You may track loans, mortgages,
                credit cards, and other debts. Debt information may be entered
                manually or imported via CSV. We do not provide debt management
                advice.
              </li>
              <li>
                <strong>Plan Limits:</strong> Your subscription plan includes
                specific limits (e.g., number of transactions per month, number of
                accounts). You agree not to exceed these limits and understand
                that exceeding limits may result in service restrictions or
                require plan upgrades.
              </li>
            </ul>
          </div>
          <div>
            <h3>Prohibited Activities</h3>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the intellectual property rights of others</li>
              <li>Transmit any viruses, malware, or harmful code</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Impersonate any person or entity</li>
              <li>Collect or harvest information about other users</li>
              <li>Use the Service to transmit spam or unsolicited communications</li>
              <li>Share your account credentials with unauthorized persons</li>
              <li>Attempt to circumvent plan limits or restrictions</li>
              <li>
                Use the Service to store or process data for commercial purposes
                without authorization
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection title="Subscription Plans and Payment">
          <div>
            <h3>Available Plans</h3>
            <p>Spare Finance offers the following subscription plans:</p>
            <ul>
              <li>
                <strong>{proPlanName} Plan:</strong> $
                {proPlan?.priceMonthly.toFixed(2) ?? "14.99"}/month or $
                {proPlan?.priceYearly.toFixed(2) ?? "149.90"}/year — Includes
                unlimited transactions, unlimited accounts, investments,
                advanced reports, CSV import/export, AI-powered categorization,
                budgets, goals, receipt scanner, household members, and all
                features.
              </li>
            </ul>
          </div>
          <div>
            <h3>Free Trial</h3>
            <p>
              The {proPlanName} plan includes a 30-day free trial period. During
              the trial:
            </p>
            <ul>
              <li>You have full access to all features of your selected plan</li>
              <li>
                A valid payment method is required to start the trial; you will
                only be charged after the trial period ends
              </li>
              <li>
                You may cancel at any time; if you cancel, your plan stays active
                until the end of your current billing cycle (monthly or annual)
              </li>
              <li>
                If you do not cancel before the trial ends, your subscription
                will automatically begin and you will be charged
              </li>
            </ul>
          </div>
          <div>
            <h3>Payment Terms</h3>
            <p>By subscribing, you agree to:</p>
            <ul>
              <li>Pay all fees associated with your subscription</li>
              <li>Provide accurate payment information</li>
              <li>
                Authorize us to charge your payment method for recurring
                subscriptions
              </li>
              <li>
                Understand that subscription fees are non-refundable except as
                required by law
              </li>
              <li>Accept that subscription prices may change with notice</li>
              <li>
                Understand that plan limits (transactions, accounts) are enforced
                and cannot be exceeded
              </li>
            </ul>
          </div>
          <div>
            <h3>Subscription Management</h3>
            <p>
              Subscriptions automatically renew unless cancelled. You may:
            </p>
            <ul>
              <li>
                Cancel your subscription at any time through your account
                settings or the Stripe Customer Portal
              </li>
              <li>Upgrade or downgrade your plan at any time</li>
              <li>Change your billing cycle (monthly to annual or vice versa)</li>
            </ul>
            <p>
              Cancellation will take effect at the end of your current billing
              period. Upgrades are applied immediately, while downgrades take
              effect at the end of your current billing period.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="Intellectual Property">
          <p>
            The Service, including its original content, features, and
            functionality, is owned by Spare Finance and is protected by
            international copyright, trademark, patent, trade secret, and other
            intellectual property laws.
          </p>
          <p>
            You may not reproduce, distribute, modify, create derivative works
            of, publicly display, publicly perform, republish, download, store,
            or transmit any of the material on our Service without our prior
            written consent.
          </p>
          <p>
            You retain ownership of any data you upload to the Service. By using
            the Service, you grant us a license to use, store, and process your
            data as necessary to provide the Service.
          </p>
        </LegalSection>

        <LegalSection title="User Content">
          <p>
            You are solely responsible for all content, data, and information you
            upload, post, or transmit through the Service (&quot;User Content&quot;). You
            represent and warrant that:
          </p>
          <ul>
            <li>You own or have the right to use all User Content</li>
            <li>User Content does not violate any third-party rights</li>
            <li>User Content is accurate and not misleading</li>
            <li>User Content complies with all applicable laws</li>
          </ul>
          <p>
            We reserve the right to remove any User Content that violates these
            Terms or is otherwise objectionable, in our sole discretion.
          </p>
        </LegalSection>

        <LegalSection title="Disclaimers">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that the Service will be uninterrupted, secure, or
            error-free. We do not guarantee the accuracy, completeness, or
            usefulness of any information on the Service.
          </p>
          <p>
            The Service is a financial management tool and does not provide
            financial, legal, or tax advice. You should consult with qualified
            professionals for such advice.
          </p>
          <p>
            <strong>AI Categorization Disclaimer:</strong> Category suggestions
            provided by our AI-powered system (powered by OpenAI) are based on
            patterns in your historical data and are suggestions only. You are
            responsible for reviewing and approving all categorizations. We do
            not guarantee the accuracy of category suggestions or AI-generated
            insights.
          </p>
          <p>
            <strong>Investment Advice Disclaimer:</strong> The Service does not
            provide investment, financial, legal, or tax advice. All investment
            data, portfolio information, and financial insights are for
            informational purposes only. You should consult with qualified
            financial advisors before making investment decisions.
          </p>
        </LegalSection>

        <LegalSection title="Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPARE FINANCE SHALL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
            DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
            INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            Our total liability for any claims arising from or related to the
            Service shall not exceed the amount you paid us in the twelve (12)
            months preceding the claim.
          </p>
        </LegalSection>

        <LegalSection title="Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless Spare Finance and
            its officers, directors, employees, and agents from any claims,
            damages, losses, liabilities, and expenses (including legal fees)
            arising from:
          </p>
          <ul>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
            <li>Any User Content you provide</li>
          </ul>
        </LegalSection>

        <LegalSection title="Account Suspension and Termination">
          <div>
            <h3>Termination by You</h3>
            <p>
              You may terminate your account at any time by deleting your
              account through the account settings. Upon termination:
            </p>
            <ul>
              <li>Your right to use the Service will immediately cease</li>
              <li>Your account and all data will be permanently deleted immediately</li>
              <li>All connected services will be disconnected</li>
              <li>Your subscription will be cancelled and no further charges will occur</li>
              <li>You may export your data before termination</li>
            </ul>
          </div>
          <div>
            <h3>Termination or Suspension by Us</h3>
            <p>
              We may terminate or suspend your account and access to the Service
              immediately, without prior notice, for any reason, including if:
            </p>
            <ul>
              <li>You breach these Terms or our Privacy Policy</li>
              <li>You engage in fraudulent, illegal, or harmful activities</li>
              <li>You violate any applicable laws or regulations</li>
              <li>You abuse or misuse the Service</li>
              <li>
                We determine, in our sole discretion, that your use poses a
                security risk
              </li>
              <li>Your account is inactive for an extended period</li>
            </ul>
            <p>
              If your account is suspended or terminated, you may lose access to
              your data. We maintain a history of account actions (including
              blocks and suspensions) for security and compliance purposes. You
              may contact us to appeal a suspension or termination decision.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="Changes to Terms">
          <p>
            We reserve the right to modify these Terms at any time. We will
            notify you of any material changes by posting the updated Terms on
            this page and updating the &quot;Last updated&quot; date. Your continued use
            of the Service after such changes constitutes your acceptance of the
            modified Terms.
          </p>
        </LegalSection>

        <LegalSection title="Compliance and Data Protection">
          <p>
            We are committed to protecting your privacy and personal
            information. Our data practices are governed by our Privacy Policy
            and comply with applicable data protection laws, including:
          </p>
          <ul>
            <li>
              <strong>PIPEDA (Personal Information Protection and Electronic
              Documents Act):</strong> As a Canadian company, we comply with
              PIPEDA requirements for the collection, use, and disclosure of
              personal information.
            </li>
            <li>
              <strong>GDPR (General Data Protection Regulation):</strong> We
              comply with GDPR requirements for users in the European Economic
              Area, including rights to access, rectification, erasure, and data
              portability.
            </li>
            <li>
              <strong>CCPA (California Consumer Privacy Act):</strong> We comply
              with CCPA requirements for California residents, including
              disclosure of data collection practices and consumer rights.
            </li>
          </ul>
          <p>
            You have the right to access, correct, delete, or export your
            personal data. You may also object to certain processing activities
            or request restriction of processing. To exercise these rights,
            please contact us at legal@sparefinance.com.
          </p>
        </LegalSection>

        <LegalSection title="Governing Law">
          <p>
            Spare Finance is operated by Maverick Bear Design, a Canadian
            company. These Terms shall be governed by and construed in
            accordance with the laws of Canada and the province in which
            Maverick Bear Design operates, without regard to its conflict of law
            provisions. Any disputes arising from these Terms or the Service
            shall be resolved through binding arbitration or in the appropriate
            courts of Canada.
          </p>
          <p>
            If you are located outside of Canada, you agree that by using the
            Service, you consent to the transfer of your information to Canada
            and the processing of such information in accordance with Canadian
            law and these Terms.
          </p>
        </LegalSection>

        <LegalSection title="Contact Information">
          <p>
            If you have any questions about these Terms of Service, please
            contact us:
          </p>
          <div className="space-y-2 text-sm [&_strong]:text-foreground">
            <p><strong>Company:</strong> Maverick Bear Design (Canadian company)</p>
            <p><strong>Product:</strong> Spare Finance</p>
            <p><strong>Email:</strong> legal@sparefinance.com</p>
            <p><strong>Support:</strong> support@sparefinance.com</p>
          </div>
        </LegalSection>
      </article>
    </ContentPageLayout>
  );
}
