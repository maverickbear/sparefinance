"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function TermsOfUsePage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Terms of Use
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agreement to Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These Terms of Use ("Terms") constitute a legally binding agreement between you 
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            <h3 className="font-semibold mb-2">Prohibited Activities</h3>
            <p className="text-sm text-muted-foreground mb-2">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription and Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Some features of the Service require a paid subscription. By subscribing, you agree to:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
            <li>Pay all fees associated with your subscription</li>
            <li>Provide accurate payment information</li>
            <li>Authorize us to charge your payment method for recurring subscriptions</li>
            <li>Understand that subscription fees are non-refundable except as required by law</li>
            <li>Accept that subscription prices may change with notice</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Subscriptions automatically renew unless cancelled. You may cancel your subscription 
            at any time through your account settings. Cancellation will take effect at the end 
            of your current billing period.
          </p>
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
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
            These Terms shall be governed by and construed in accordance with the laws of the 
            jurisdiction in which Spare Finance operates, without regard to its conflict of law 
            provisions. Any disputes arising from these Terms or the Service shall be resolved 
            through binding arbitration or in the appropriate courts of that jurisdiction.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you have any questions about these Terms of Use, please contact us:
          </p>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> legal@sparefinance.com</p>
            <p><strong>Support:</strong> support@sparefinance.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

