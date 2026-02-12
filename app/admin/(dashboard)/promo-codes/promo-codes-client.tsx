"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PromoCodesTable } from "@/components/admin/promo-codes-table";
import { PromoCodeDialog } from "@/components/admin/promo-code-dialog";
import { Plus } from "lucide-react";
import type { PromoCode } from "@/src/domain/admin/admin.types";

interface PromoCodesPageClientProps {
  initialPromoCodes: PromoCode[];
  availablePlans: { id: string; name: string }[];
}

export function PromoCodesPageClient({ initialPromoCodes, availablePlans }: PromoCodesPageClientProps) {
  const router = useRouter();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);

  function handleCreatePromoCode() {
    setEditingPromoCode(null);
    setIsDialogOpen(true);
  }

  function handleEditPromoCode(promoCode: PromoCode) {
    setEditingPromoCode(promoCode);
    setIsDialogOpen(true);
  }

  async function handleDeletePromoCode(id: string) {
    const response = await fetch(`/api/v2/admin/promo-codes?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete promo code");
    }

    router.refresh();
  }

  async function handleTogglePromoCodeActive(id: string, isActive: boolean) {
    const response = await fetch("/api/v2/admin/promo-codes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        isActive: !isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to toggle promo code");
    }

    router.refresh();
  }

  function handleSuccess(createdOrUpdatedPromoCode?: PromoCode) {
    if (createdOrUpdatedPromoCode) {
      if (editingPromoCode) {
        setPromoCodes((prev) =>
          prev.map((pc) => (pc.id === createdOrUpdatedPromoCode.id ? createdOrUpdatedPromoCode : pc))
        );
      } else {
        setPromoCodes((prev) => [createdOrUpdatedPromoCode, ...prev]);
      }
    } else {
      router.refresh();
    }
  }

  return (
    <div className="w-full p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Promo Codes</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage promotional codes for discounts on subscriptions.
          </p>
        </div>
        <Button onClick={handleCreatePromoCode}>
          <Plus className="h-4 w-4 mr-2" />
          Create Promo Code
        </Button>
      </div>
      <PromoCodesTable
        promoCodes={promoCodes}
        loading={false}
        onEdit={handleEditPromoCode}
        onDelete={handleDeletePromoCode}
        onToggleActive={handleTogglePromoCodeActive}
      />

      <PromoCodeDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingPromoCode(null);
          }
        }}
        promoCode={editingPromoCode}
        onSuccess={handleSuccess}
        availablePlans={availablePlans}
      />
    </div>
  );
}
