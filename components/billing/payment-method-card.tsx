"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ChevronRight } from "lucide-react";
import { useState } from "react";

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

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod | null;
  onManage?: () => void;
}

export function PaymentMethodCard({ paymentMethod, onManage }: PaymentMethodCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleManage() {
    if (onManage) {
      onManage();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Failed to create portal session:", data.error);
      }
    } catch (error) {
      console.error("Error opening portal:", error);
    } finally {
      setLoading(false);
    }
  }

  const getCardBrandName = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "American Express",
      discover: "Discover",
      jcb: "JCB",
      diners: "Diners Club",
      unionpay: "UnionPay",
    };
    return brandMap[brand.toLowerCase()] || brand;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
      </CardHeader>
      <CardContent>
        {paymentMethod?.card ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {getCardBrandName(paymentMethod.card.brand)} ending in {paymentMethod.card.last4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {paymentMethod.card.expMonth.toString().padStart(2, "0")}/{paymentMethod.card.expYear}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManage}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No payment method on file</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManage}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

