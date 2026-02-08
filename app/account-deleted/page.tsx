"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BaseUser } from "@/src/domain/auth/auth.types";

export default function AccountDeletedPage() {
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated, they shouldn't be here (account was deleted)
    // Redirect to home page
    async function checkAuth() {
      try {
        const response = await fetch("/api/v2/user");
        const { user }: { user: BaseUser | null } = response.ok ? await response.json() : { user: null };
        if (user) {
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        } else {
          // User is not authenticated (expected after deletion), stay on page
        }
      } catch (error) {
        // Error checking auth, stay on page
        console.error("Error checking auth:", error);
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader isAuthenticated={false} />
      <div className="flex-1 flex items-center justify-center p-4 pt-24 md:pt-28">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Deleted Icon */}
          <div className="flex justify-center">
            <div className="p-6 bg-destructive/10 rounded-full">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Account Deleted</h1>
            <p className="text-muted-foreground">
              Your account has been permanently deleted.
            </p>
          </div>

          {/* Status Card */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Deletion Complete</CardTitle>
              <CardDescription>
                Your account and all associated data have been permanently removed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  Your account has been permanently deleted and cannot be recovered. All your data including transactions, accounts, budgets, and goals have been removed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>What was deleted?</CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li>All your financial data (transactions, accounts, budgets, goals)</li>
                <li>Your subscription has been cancelled</li>
                <li>Your account credentials and profile information</li>
                <li>All associated data and settings</li>
              </ul>
            </CardContent>
          </Card>

          {/* Action */}
          <div className="pt-4">
            <a
              href="/"
              className="text-sm text-foreground hover:underline"
            >
              Return to home page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

