import Link from "next/link";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { Logo } from "@/components/common/logo";

export const metadata = {
  title: "Admin sign in | Spare Finance",
  description: "Sign in to the Spare Finance admin area.",
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <Link href="/">
          <Button variant="ghost" size="small" className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Button>
        </Link>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">Admin</span>
          </div>
          <div className="flex justify-center">
            <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
              <Logo variant="wordmark" color="auto" width={180} priority />
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with your email and password
          </p>
        </div>

        <AdminLoginForm />

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/admin/register" className="underline hover:text-foreground">
            Create admin account
          </Link>
        </p>
      </div>
    </div>
  );
}
