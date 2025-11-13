import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SimpleFooter } from "@/components/common/simple-footer";
import { FileText, ArrowLeft, Wallet } from "lucide-react";

export const metadata = {
  title: "Terms of Service - Spare Finance",
  description: "Terms of Service for Spare Finance",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-[12px]">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xl font-bold">Spare Finance</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <FileText className="h-10 w-10 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Terms of Service
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Spare Finance is a product created by Maverick Bear Design, a Canadian company. 
                These Terms of Service ("Terms") constitute a legally binding agreement between you 
                and Spare Finance ("we," "our," or "us") regarding your use of our financial 
                management application and services (the "Service").
              </p>
              <p className="text-sm text-muted-foreground">
                By accessing or using our Service, you agree to be bound by these Terms. If you 
                do not agree to these Terms, you may not access or use the Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You must be at least 18 years old to use our Service. By using the Service, you 
                represent and warrant that:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>You are at least 18 years of age</li>
                <li>You have the legal capacity to enter into these Terms</li>
                <li>You will comply with all applicable laws and regulations</li>
                <li>All information you provide is accurate and current</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To use certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and update your account information to keep it accurate</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account password 
                and for all activities that occur under your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use of the Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Permitted Use</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  You may use the Service for personal, non-commercial purposes in accordance 
                  with these Terms. You agree to use the Service only for lawful purposes and in 
                  a way that does not infringe the rights of others.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Service Features</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  The Service includes various features, some of which may be subject to plan limitations:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li><strong>Bank Integration (Plaid):</strong> Available on BASIC and PREMIUM plans. By connecting your bank accounts, you authorize us to access your account information, transactions, and balances through Plaid. You understand that we do not store your bank credentials and that Plaid handles all authentication securely.</li>
                  <li><strong>Household Members:</strong> Available on BASIC and PREMIUM plans. You may invite family members to your account. Each member maintains separate financial data, and you are responsible for managing member access and permissions.</li>
                  <li><strong>AI-Powered Categorization:</strong> The Service uses intelligent categorization to suggest transaction categories based on your historical data. These are suggestions only, and you are responsible for verifying and approving all categorizations.</li>
                  <li><strong>CSV Import/Export:</strong> Available on BASIC and PREMIUM plans. You may import and export your financial data. You are responsible for the accuracy of imported data and for maintaining backups of exported data.</li>
                  <li><strong>Plan Limits:</strong> Your subscription plan includes specific limits (e.g., number of transactions per month, number of accounts). You agree not to exceed these limits and understand that exceeding limits may result in service restrictions.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Prohibited Activities</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  You agree not to:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
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
                  <li>Use the Service to store or process data for commercial purposes without authorization</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans and Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Available Plans</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Spare Finance offers the following subscription plans:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li><strong>BASIC Plan:</strong> $7.99/month or $79.90/year - Includes 500 transactions per month, 10 accounts, investments, advanced reports, CSV import/export, bank integration via Plaid, household members, and AI-powered categorization</li>
                  <li><strong>PREMIUM Plan:</strong> $14.99/month or $149.90/year - Includes unlimited transactions and accounts, plus all BASIC plan features</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Free Trial</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Both BASIC and PREMIUM plans include a 30-day free trial period. During the trial:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>You have full access to all features of your selected plan</li>
                  <li>No payment is required until the trial period ends</li>
                  <li>You may cancel at any time during the trial without being charged</li>
                  <li>If you do not cancel before the trial ends, your subscription will automatically begin and you will be charged</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Payment Terms</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  By subscribing, you agree to:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>Pay all fees associated with your subscription</li>
                  <li>Provide accurate payment information</li>
                  <li>Authorize us to charge your payment method for recurring subscriptions</li>
                  <li>Understand that subscription fees are non-refundable except as required by law</li>
                  <li>Accept that subscription prices may change with notice</li>
                  <li>Understand that plan limits (transactions, accounts) are enforced and cannot be exceeded</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Subscription Management</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Subscriptions automatically renew unless cancelled. You may:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>Cancel your subscription at any time through your account settings or the Stripe Customer Portal</li>
                  <li>Upgrade or downgrade your plan at any time</li>
                  <li>Change your billing cycle (monthly to annual or vice versa)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Cancellation will take effect at the end of your current billing period. Upgrades are applied immediately, while downgrades take effect at the end of your current billing period.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Service, including its original content, features, and functionality, is owned 
                by Spare Finance and is protected by international copyright, trademark, patent, 
                trade secret, and other intellectual property laws.
              </p>
              <p className="text-sm text-muted-foreground">
                You may not reproduce, distribute, modify, create derivative works of, publicly 
                display, publicly perform, republish, download, store, or transmit any of the 
                material on our Service without our prior written consent.
              </p>
              <p className="text-sm text-muted-foreground">
                You retain ownership of any data you upload to the Service. By using the Service, 
                you grant us a license to use, store, and process your data as necessary to provide 
                the Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are solely responsible for all content, data, and information you upload, 
                post, or transmit through the Service ("User Content"). You represent and warrant that:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>You own or have the right to use all User Content</li>
                <li>User Content does not violate any third-party rights</li>
                <li>User Content is accurate and not misleading</li>
                <li>User Content complies with all applicable laws</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                We reserve the right to remove any User Content that violates these Terms or is 
                otherwise objectionable, in our sole discretion.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disclaimers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, 
                FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p className="text-sm text-muted-foreground">
                We do not warrant that the Service will be uninterrupted, secure, or error-free. 
                We do not guarantee the accuracy, completeness, or usefulness of any information 
                on the Service.
              </p>
              <p className="text-sm text-muted-foreground">
                The Service is a financial management tool and does not provide financial, legal, 
                or tax advice. You should consult with qualified professionals for such advice.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Bank Integration Disclaimer:</strong> Bank account connections are provided through 
                Plaid, a third-party service. We are not responsible for the availability, accuracy, or 
                security of Plaid's services. Bank data is provided "as is" and we do not guarantee the 
                accuracy or completeness of imported bank transactions or account information.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>AI Categorization Disclaimer:</strong> Category suggestions provided by our 
                AI-powered system are based on patterns in your historical data and are suggestions only. 
                You are responsible for reviewing and approving all categorizations. We do not guarantee 
                the accuracy of category suggestions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPARE FINANCE SHALL NOT BE LIABLE FOR ANY 
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF 
                PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, 
                USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
              </p>
              <p className="text-sm text-muted-foreground">
                Our total liability for any claims arising from or related to the Service shall not 
                exceed the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You agree to indemnify, defend, and hold harmless Spare Finance and its officers, 
                directors, employees, and agents from any claims, damages, losses, liabilities, 
                and expenses (including legal fees) arising from:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Any User Content you provide</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We may terminate or suspend your account and access to the Service immediately, 
                without prior notice, for any reason, including if you breach these Terms.
              </p>
              <p className="text-sm text-muted-foreground">
                You may terminate your account at any time by deleting your account through the 
                account settings. Upon termination, your right to use the Service will immediately 
                cease, and we may delete your account and data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will notify you of any 
                material changes by posting the updated Terms on this page and updating the "Last 
                updated" date. Your continued use of the Service after such changes constitutes 
                your acceptance of the modified Terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Spare Finance is operated by Maverick Bear Design, a Canadian company. 
                These Terms shall be governed by and construed in accordance with the laws of Canada 
                and the province in which Maverick Bear Design operates, without regard to its conflict 
                of law provisions. Any disputes arising from these Terms or the Service shall be resolved 
                through binding arbitration or in the appropriate courts of Canada.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Company:</strong> Maverick Bear Design (Canadian company)</p>
                <p><strong>Product:</strong> Spare Finance</p>
                <p><strong>Email:</strong> legal@sparefinance.com</p>
                <p><strong>Support:</strong> support@sparefinance.com</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Simple Footer */}
      <SimpleFooter />
    </div>
  );
}
