"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Privacy Policy
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
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
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
            <li>
              <strong>Service Providers:</strong> With trusted third-party service providers who 
              assist us in operating our platform (e.g., payment processors, cloud hosting)
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
          <CardTitle>Data Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We implement industry-standard security measures to protect your information:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            <p><strong>Email:</strong> privacy@sparefinance.com</p>
            <p><strong>Support:</strong> support@sparefinance.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

