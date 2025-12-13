"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Trash2, Star } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

interface PaymentMethodManagerProps {
  customerId?: string;
}

export function PaymentMethodManager({ customerId }: PaymentMethodManagerProps) {
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  async function loadPaymentMethods() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/payment-methods");
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPaymentMethod() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to open Stripe portal",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast({
        title: "Error",
        description: "Failed to open Stripe portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }


  async function handleDelete(paymentMethodId: string) {
    if (!confirm("Are you sure you want to remove this payment method?")) {
      return;
    }

    try {
      setDeletingId(paymentMethodId);
      const response = await fetch("/api/stripe/payment-methods", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Payment method removed successfully",
          variant: "success",
        });
        loadPaymentMethods();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to remove payment method",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast({
        title: "Error",
        description: "Failed to remove payment method. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetDefault(paymentMethodId: string) {
    try {
      const response = await fetch("/api/stripe/payment-methods", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Default payment method updated",
          variant: "success",
        });
        loadPaymentMethods();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to set default payment method",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error setting default payment method:", error);
      toast({
        title: "Error",
        description: "Failed to set default payment method. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (loading && paymentMethods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Your payment methods are safely managed by Stripe</CardDescription>
            </div>
            <Button onClick={handleAddPaymentMethod} size="medium" className="w-full md:w-auto">
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        {paymentMethods.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {pm.card ? (
                          <>
                            {pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1)} •••• {pm.card.last4}
                          </>
                        ) : (
                          "Payment Method"
                        )}
                      </div>
                      {pm.card && (
                        <div className="text-sm text-muted-foreground">
                          Expires {pm.card.expMonth}/{pm.card.expYear}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="medium"
                      onClick={() => handleSetDefault(pm.id)}
                      title="Set as default"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="medium"
                      onClick={() => handleDelete(pm.id)}
                      disabled={deletingId === pm.id}
                    >
                      {deletingId === pm.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}

