"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Trash2, Tag } from "lucide-react";
import type { SystemSubcategory } from "@/src/domain/admin/admin.types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface SubcategoriesTableProps {
  subcategories: SystemSubcategory[];
  categories: { id: string; name: string }[];
  loading?: boolean;
  onEdit: (subcategory: SystemSubcategory) => void;
  onDelete: (id: string) => void;
}

export function SubcategoriesTable({
  subcategories: initialSubcategories,
  categories,
  loading: initialLoading,
  onEdit,
  onDelete,
}: SubcategoriesTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [subcategories, setSubcategories] = useState<SystemSubcategory[]>(initialSubcategories);
  const [loading, setLoading] = useState(initialLoading);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const handleDelete = (id: string) => {
    openDialog(
      {
        title: "Delete Subcategory",
        description: "Are you sure you want to delete this system subcategory? This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          await onDelete(id);
          setSubcategories((prev) => prev.filter((s) => s.id !== id));
        } catch (error) {
          console.error("Error deleting subcategory:", error);
          alert(error instanceof Error ? error.message : "Failed to delete subcategory");
        } finally {
          setDeletingId(null);
        }
      }
    );
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
            <TableHead>Logo</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subcategories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Tag className="h-8 w-8" />
                  <p>No system subcategories found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            subcategories.map((subcategory) => (
              <TableRow key={subcategory.id}>
                <TableCell>
                  {subcategory.logo ? (
                    <img 
                      src={subcategory.logo} 
                      alt={subcategory.name}
                      className="h-6 w-6 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{subcategory.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{getCategoryName(subcategory.categoryId)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(subcategory.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(subcategory.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(subcategory)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subcategory.id)}
                      disabled={deletingId === subcategory.id}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      {deletingId === subcategory.id ? (
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

