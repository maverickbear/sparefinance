"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/signup-form";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Zap, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/common/logo";

export function SignUpFormWrapperContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId") || undefined;
  const interval = (searchParams.get("interval") as "month" | "year") || undefined;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-[#f8f4f1] relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center">
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <Logo variant="wordmark" color="auto" width={200} height={53} priority />
              </Link>
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Manage your personal finances intelligently and make more informed decisions about your money.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <TrendingUp className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Track Your Finances</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor income, expenses, and investments in one place.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Data</h3>
                <p className="text-sm text-muted-foreground">
                  Your financial information protected with cutting-edge encryption.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Smart Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic insights about your financial habits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Sign Up Form */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <Button variant="ghost" size="small" className="-ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Button>
          </Link>
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <Logo variant="wordmark" color="auto" width={200} priority />
              </Link>
            </div>
            <p className="text-muted-foreground text-sm">
              Create your account to get started
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">Create an account</h2>
            <p className="text-muted-foreground">
              Sign up to start managing your finances
            </p>
          </div>

          <SignUpForm planId={planId} interval={interval} />
        </div>
      </div>
    </div>
  );
}
