"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Trash2, Power, PowerOff, Tag } from "lucide-react";
import type { PromoCode } from "@/src/domain/admin/admin.types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface PromoCodesTableProps {
  promoCodes: PromoCode[];
  loading?: boolean;
  onEdit: (promoCode: PromoCode) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export function PromoCodesTable({
  promoCodes: initialPromoCodes,
  loading: initialLoading,
  onEdit,
  onDelete,
  onToggleActive,
}: PromoCodesTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [loading, setLoading] = useState(initialLoading);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Sync state when props change
  useEffect(() => {
    setPromoCodes(initialPromoCodes);
  }, [initialPromoCodes]);

  useEffect(() => {
    setLoading(initialLoading);
  }, [initialLoading]);

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDiscount = (promoCode: PromoCode) => {
    if (promoCode.discountType === "percent") {
      return `${promoCode.discountValue}% off`;
    } else {
      return `$${promoCode.discountValue} off`;
    }
  };

  const formatDuration = (promoCode: PromoCode) => {
    if (promoCode.duration === "once") {
      return "Once";
    } else if (promoCode.duration === "forever") {
      return "Forever";
    } else {
      return `${promoCode.durationInMonths} month${promoCode.durationInMonths !== 1 ? "s" : ""}`;
    }
  };

  const handleDelete = (id: string) => {
    openDialog(
      {
        title: "Delete Promo Code",
        description: "Are you sure you want to delete this promo code? This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          await onDelete(id);
          setPromoCodes((prev) => prev.filter((pc) => pc.id !== id));
        } catch (error) {
          console.error("Error deleting promo code:", error);
          alert(error instanceof Error ? error.message : "Failed to delete promo code");
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      await onToggleActive(id, !currentActive);
      setPromoCodes((prev) =>
        prev.map((pc) => (pc.id === id ? { ...pc, isActive: !currentActive } : pc))
      );
    } catch (error) {
      console.error("Error toggling promo code:", error);
      alert(error instanceof Error ? error.message : "Failed to toggle promo code");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Max Uses</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Plans</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promoCodes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0">
                <div className="flex items-center justify-center min-h-[400px] w-full">
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <Tag className="h-8 w-8" />
                    <p>No promo codes found</p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            promoCodes.map((promoCode) => (
              <TableRow key={promoCode.id}>
                <TableCell className="font-mono font-medium">{promoCode.code}</TableCell>
                <TableCell>{formatDiscount(promoCode)}</TableCell>
                <TableCell>{formatDuration(promoCode)}</TableCell>
                <TableCell>
                  {promoCode.maxRedemptions ? promoCode.maxRedemptions : "Unlimited"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(promoCode.expiresAt)}
                </TableCell>
                <TableCell>
                  {promoCode.planIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {promoCode.planIds.map((planId) => (
                        <Badge key={planId} variant="outline" className="text-xs">
                          {planId}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">All plans</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={promoCode.isActive ? "default" : "secondary"}>
                    {promoCode.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(promoCode)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(promoCode.id, promoCode.isActive)}
                      disabled={togglingId === promoCode.id}
                      className="h-8 w-8"
                    >
                      {togglingId === promoCode.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : promoCode.isActive ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(promoCode.id)}
                      disabled={deletingId === promoCode.id}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      {deletingId === promoCode.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {ConfirmDialog}
    </div>
  );
}

