"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { Shield, Mail, ArrowLeft } from "lucide-react";

export function VerifyOtpFormWrapperContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || undefined;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-[#f8f4f1] relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 space-y-8 w-full">
          <div className="space-y-4 w-full">
            <div className="flex justify-start items-start w-full">
              <Logo variant="full" color="purple" width={200} />
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Verify your email to complete your account setup.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Mail className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We sent a verification code to your email address.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code to verify your account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Verify OTP Form */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <Button variant="ghost" size="small" className="-ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Button>
          </Link>
          {/* Mobile header */}
          <div className="lg:hidden space-y-4">
            <div className="flex items-center justify-center">
              <Logo variant="full" color="purple" width={160} />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              Verify your email to continue
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">Verify your email</h2>
            <p className="text-muted-foreground">
              Enter the code we sent to your email
            </p>
          </div>

          <VerifyOtpForm email={email} />
        </div>
      </div>
    </div>
  );
}

