import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { AdminRegisterForm } from "./admin-register-form";

export const metadata = {
  title: "Admin registration | Spare Finance",
  description: "Create an admin account for the Spare Finance admin portal.",
};

export default function AdminRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <Link href="/admin/login">
          <Button variant="ghost" size="small" className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to admin sign in
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
          <h1 className="text-2xl font-bold">Admin registration</h1>
          <p className="text-muted-foreground text-sm">
            Create an admin account (name, email, and password)
          </p>
        </div>

        <AdminRegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/admin/login" className="underline hover:text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
