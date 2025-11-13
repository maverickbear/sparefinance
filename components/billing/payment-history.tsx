"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  period_start: number | null;
  period_end: number | null;
}

interface PaymentHistoryProps {
  className?: string;
}

export function PaymentHistory({ className }: PaymentHistoryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stripe/invoices?page=1&limit=10`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error("Error loading invoices:", err);
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "Paid", variant: "default" },
      open: { label: "Open", variant: "secondary" },
      void: { label: "Void", variant: "outline" },
      uncollectible: { label: "Uncollectible", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" as const };
    
    return (
      <Badge variant={statusInfo.variant} className="text-xs bg-green-500 text-white hover:bg-green-600">
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Billing History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && invoices.length === 0 ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px] w-full">
            <div className="text-center text-muted-foreground">
              <p>No billing history found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-4 flex-1">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(invoice.created * 1000), "MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </div>
                  {invoice.invoice_pdf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.open(invoice.invoice_pdf!, "_blank");
                      }}
                      className="h-8 w-8 p-0"
                      title="Download invoice PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

