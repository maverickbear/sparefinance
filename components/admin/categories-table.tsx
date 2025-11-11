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
import { Loader2, Edit, Trash2, Folder } from "lucide-react";
import type { SystemCategory } from "@/lib/api/admin";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface CategoriesTableProps {
  categories: SystemCategory[];
  macros: { id: string; name: string }[];
  loading?: boolean;
  onEdit: (category: SystemCategory) => void;
  onDelete: (id: string) => void;
}

export function CategoriesTable({
  categories: initialCategories,
  macros,
  loading: initialLoading,
  onEdit,
  onDelete,
}: CategoriesTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [categories, setCategories] = useState<SystemCategory[]>(initialCategories);
  const [loading, setLoading] = useState(initialLoading);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMacroName = (macroId: string) => {
    return macros.find((m) => m.id === macroId)?.name || macroId;
  };

  const handleDelete = (id: string) => {
    openDialog(
      {
        title: "Delete Category",
        description: "Are you sure you want to delete this system category? This will also delete all associated subcategories. This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          await onDelete(id);
          setCategories((prev) => prev.filter((c) => c.id !== id));
        } catch (error) {
          console.error("Error deleting category:", error);
          alert(error instanceof Error ? error.message : "Failed to delete category");
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
            <TableHead>Name</TableHead>
            <TableHead>Macro</TableHead>
            <TableHead>Subcategories</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Folder className="h-8 w-8" />
                  <p>No system categories found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{getMacroName(category.macroId)}</Badge>
                </TableCell>
                <TableCell>
                  {category.subcategories?.length || 0}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(category.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(category.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(category)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id)}
                      disabled={deletingId === category.id}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      {deletingId === category.id ? (
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

