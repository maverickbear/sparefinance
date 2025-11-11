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
import { Loader2, Edit, Trash2, FolderTree } from "lucide-react";
import type { SystemMacro } from "@/lib/api/admin";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface MacrosTableProps {
  macros: SystemMacro[];
  loading?: boolean;
  onEdit: (macro: SystemMacro) => void;
  onDelete: (id: string) => void;
}

export function MacrosTable({
  macros: initialMacros,
  loading: initialLoading,
  onEdit,
  onDelete,
}: MacrosTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [macros, setMacros] = useState<SystemMacro[]>(initialMacros);
  const [loading, setLoading] = useState(initialLoading);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = (id: string) => {
    openDialog(
      {
        title: "Delete Macro",
        description: "Are you sure you want to delete this system macro? This will also delete all associated categories and subcategories. This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          await onDelete(id);
          setMacros((prev) => prev.filter((m) => m.id !== id));
        } catch (error) {
          console.error("Error deleting macro:", error);
          alert(error instanceof Error ? error.message : "Failed to delete macro");
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
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {macros.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FolderTree className="h-8 w-8" />
                  <p>No system macros found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            macros.map((macro) => (
              <TableRow key={macro.id}>
                <TableCell className="font-medium">{macro.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(macro.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(macro.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(macro)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(macro.id)}
                      disabled={deletingId === macro.id}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      {deletingId === macro.id ? (
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

