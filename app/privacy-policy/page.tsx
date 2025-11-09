import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SimpleFooter } from "@/components/common/simple-footer";
import { Shield, ArrowLeft, Wallet } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - Spare Finance",
  description: "Privacy Policy for Spare Finance",
};

export default function PrivacyPolicyPage() {
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
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Privacy Policy
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Spare Finance is a product created by Maverick Bear Design, a Canadian company. 
                At Spare Finance ("we," "our," or "us"), we are committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our financial management application and services.
              </p>
              <p className="text-sm text-muted-foreground">
                Please read this Privacy Policy carefully. By using our services, you agree to the 
                collection and use of information in accordance with this policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Personal Information</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>Name and email address</li>
                  <li>Phone number (optional)</li>
                  <li>Profile picture or avatar URL (optional)</li>
                  <li>Payment and billing information</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Financial Information</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  To provide our services, we collect and store:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>Transaction data (amounts, dates, descriptions, categories)</li>
                  <li>Account information</li>
                  <li>Budget and goal information</li>
                  <li>Investment and debt tracking data</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Automatically Collected Information</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  When you use our services, we automatically collect:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                  <li>Device information and identifiers</li>
                  <li>Usage data and analytics</li>
                  <li>IP address and location data</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage your account</li>
                <li>Send you important updates and notifications</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations and enforce our terms</li>
                <li>Personalize your experience and provide relevant content</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Share Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                We do not sell your personal or financial information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Service Providers:</strong> With trusted third-party service providers who 
                  assist us in operating our platform, including:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li><strong>Stripe:</strong> For payment processing and subscription management. 
                    We do not store payment card information - all payment data is handled by Stripe.</li>
                    <li><strong>Plaid:</strong> For secure bank account connections (BASIC and PREMIUM plans only). 
                    We only receive account information, transactions, and balances - we never access your bank credentials.</li>
                    <li>Cloud hosting and infrastructure providers</li>
                  </ul>
                </li>
                <li>
                  <strong>Household Members:</strong> If you are part of a household account, your 
                  financial data may be shared with other household members as configured
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law, court order, or 
                  government regulation
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with a merger, acquisition, or 
                  sale of assets (with notice to users)
                </li>
                <li>
                  <strong>With Your Consent:</strong> When you explicitly authorize us to share 
                  your information
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                We use trusted third-party services to provide certain features of our platform. 
                These services have their own privacy policies and terms of service:
              </p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Stripe - Payment Processing</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    We use Stripe to process subscription payments. When you subscribe to our service:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                    <li>We do not store or have access to your full payment card information</li>
                    <li>All payment data is securely processed and stored by Stripe</li>
                    <li>We only receive confirmation of successful payments and subscription status</li>
                    <li>Stripe handles all PCI-compliant payment processing</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    For more information about how Stripe handles your payment data, please review 
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                      Stripe's Privacy Policy
                    </a>.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Plaid - Bank Account Connection</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    We use Plaid to securely connect your bank accounts (available on BASIC and PREMIUM plans). 
                    When you connect your bank account through Plaid:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                    <li>Plaid securely authenticates your bank credentials</li>
                    <li>We only receive account information, transaction data, and balances in real-time</li>
                    <li>We do not have access to your bank login credentials</li>
                    <li>Plaid uses bank-level encryption and security standards</li>
                    <li>You can disconnect your bank account at any time through your account settings</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    For more information about how Plaid handles your financial data, please review 
                    <a href="https://plaid.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                      Plaid's Privacy Policy
                    </a>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>End-to-end encryption for data transmission</li>
                <li>Secure data storage with encryption at rest</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Compliance with financial data protection regulations</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                However, no method of transmission over the Internet or electronic storage is 100% 
                secure. While we strive to use commercially acceptable means to protect your data, 
                we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Rights and Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Access:</strong> Request access to your personal data
                </li>
                <li>
                  <strong>Correction:</strong> Update or correct inaccurate information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your account and data
                </li>
                <li>
                  <strong>Export:</strong> Export your data in a portable format
                </li>
                <li>
                  <strong>Opt-out:</strong> Unsubscribe from marketing communications
                </li>
                <li>
                  <strong>Account Settings:</strong> Manage your privacy preferences in Settings
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                To exercise these rights, please contact us at privacy@sparefinance.com or use 
                the account settings in the application.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We retain your personal and financial information for as long as your account is 
                active or as needed to provide our services. If you delete your account, we will 
                delete or anonymize your data within 30 days, except where we are required to 
                retain it for legal, regulatory, or legitimate business purposes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Our services are not intended for individuals under the age of 18. We do not 
                knowingly collect personal information from children. If you believe we have 
                collected information from a child, please contact us immediately and we will 
                take steps to delete such information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any 
                material changes by posting the new Privacy Policy on this page and updating the 
                "Last updated" date. You are advised to review this Privacy Policy periodically 
                for any changes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Company:</strong> Maverick Bear Design (Canadian company)</p>
                <p><strong>Product:</strong> Spare Finance</p>
                <p><strong>Email:</strong> privacy@sparefinance.com</p>
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
