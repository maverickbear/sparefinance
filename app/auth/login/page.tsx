import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { TrendingUp, Shield, Zap } from "lucide-react";
import { Logo } from "@/components/common/logo";

function LoginFormWrapper() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
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

      {/* Right side - Login Form */}
      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                <Logo variant="wordmark" color="auto" height={53} priority />
              </Link>
            </div>
            <p className="text-muted-foreground text-sm">
              Sign in to your account to continue
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold">Welcome</h2>
            <p className="text-muted-foreground">
              Sign in to your account to access the dashboard
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginFormWrapper />
    </Suspense>
  );
}

