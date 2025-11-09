"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HelpCircle, Mail, MessageCircle, Book, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HelpSupportPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Help & Support</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Get help with your account, billing, and using Spare Finance
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Search Help</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Search our knowledge base for answers to common questions
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Book className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Documentation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Browse our comprehensive guides and tutorials
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Live Chat</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Chat with our support team in real-time
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Email Support</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Send us an email and we'll get back to you
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Frequently Asked Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Find answers to the most common questions about Spare Finance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I add a transaction?</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to the Transactions page and click the "Add Transaction" button. 
              Fill in the details including amount, category, date, and description, then save.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I create a budget?</h3>
            <p className="text-sm text-muted-foreground">
              Go to the Budgets page and click "Create Budget". Select a category, 
              set your monthly limit, and choose the time period. You can track your 
              spending against the budget throughout the month.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Can I share my account with family members?</h3>
            <p className="text-sm text-muted-foreground">
              Yes! With Basic or Premium plans, you can invite household members to 
              share access to your financial data. Go to Settings &gt; Members to invite 
              family members.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I upgrade my plan?</h3>
            <p className="text-sm text-muted-foreground">
              Visit Settings &gt; Billing to view your current plan and upgrade options. 
              You can upgrade at any time, and the new plan will be effective immediately.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I cancel my subscription?</h3>
            <p className="text-sm text-muted-foreground">
              Go to Settings &gt; Billing and click "Manage Subscription". You can cancel 
              your subscription at any time. You'll continue to have access until the end 
              of your current billing period.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Is my financial data secure?</h3>
            <p className="text-sm text-muted-foreground">
              Absolutely. We use bank-level encryption to protect your data. All information 
              is stored securely and we never share your financial data with third parties. 
              See our Privacy Policy for more details.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">How do I import transactions from CSV?</h3>
            <p className="text-sm text-muted-foreground">
              On the Transactions page, click "Import" and select your CSV file. Make sure 
              your CSV includes columns for date, amount, description, and category. Our 
              system will guide you through mapping the columns.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Can I export my data?</h3>
            <p className="text-sm text-muted-foreground">
              Yes, you can export your transactions, budgets, and other data at any time. 
              Go to Reports and use the export feature to download your data in CSV format.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Support</CardTitle>
          <CardDescription>
            Still need help? Our support team is here for you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Send us an email and we'll respond within 24 hours
              </p>
              <Button variant="outline" asChild>
                <a href="mailto:support@sparefinance.com">support@sparefinance.com</a>
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Chat with our support team Monday-Friday, 9 AM - 5 PM EST
              </p>
              <Button variant="outline">
                Start Chat
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <HelpCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Help Center</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Browse our comprehensive knowledge base and tutorials
              </p>
              <Button variant="outline">
                Visit Help Center
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/settings">Account Settings</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
        </Button>
      </div>
    </div>
  );
}

