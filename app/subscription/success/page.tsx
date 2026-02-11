"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { SubscriptionSuccessDialog } from "@/src/presentation/components/features/billing/subscription-success-dialog";
import { Loader2 } from "lucide-react";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showDialog, setShowDialog] = useState(false);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Show dialog when component mounts
    if (sessionId) {
      setShowDialog(true);
    } else {
      // If no session_id, redirect to dashboard
      router.push("/dashboard");
    }
  }, [sessionId, router]);

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      // Dialog closed, redirect to dashboard
      router.push("/dashboard");
    }
  };

  const handleSuccess = () => {
    // Dialog will handle navigation
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SubscriptionProvider initialData={{ subscription: null, plan: null }}>
      <div className="min-h-screen flex items-center justify-center">
        <SubscriptionSuccessDialog
          open={showDialog}
          onOpenChange={handleDialogClose}
          onSuccess={handleSuccess}
        />
      </div>
    </SubscriptionProvider>
  );
}

// Wrapper component that provides Suspense boundary for useSearchParams
export default function SuccessPage() {
  return (
    <Suspense fallback={(
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )}>
      <SuccessContent />
    </Suspense>
  );
}
