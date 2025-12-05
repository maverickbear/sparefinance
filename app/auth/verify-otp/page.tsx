import { Suspense } from "react";
import { VerifyOtpFormWrapperContent } from "./verify-otp-form-wrapper";

function VerifyOtpFormWrapper() {
  return <VerifyOtpFormWrapperContent />;
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md space-y-4">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded-lg" />
            </div>
            <div className="space-y-4">
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    }>
      <VerifyOtpFormWrapper />
    </Suspense>
  );
}

