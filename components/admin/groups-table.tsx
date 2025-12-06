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
import type { SystemGroup } from "@/src/domain/admin/admin.types";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { formatAdminDate } from "@/src/infrastructure/utils/timestamp";

interface GroupsTableProps {
  groups: SystemGroup[];
  loading?: boolean;
  onEdit: (group: SystemGroup) => void;
  onDelete: (id: string) => void;
}

export function GroupsTable({
  groups: initialGroups,
  loading: initialLoading,
  onEdit,
  onDelete,
}: GroupsTableProps) {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const [groups, setGroups] = useState<SystemGroup[]>(initialGroups);
  const [loading, setLoading] = useState(initialLoading);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    openDialog(
      {
        title: "Delete Group",
        description: "Are you sure you want to delete this system group? This will also delete all associated categories and subcategories. This action cannot be undone.",
        variant: "destructive",
        confirmLabel: "Delete",
      },
      async () => {
        setDeletingId(id);
        try {
          await onDelete(id);
          setGroups((prev) => prev.filter((g) => g.id !== id));
        } catch (error) {
          console.error("Error deleting group:", error);
          alert(error instanceof Error ? error.message : "Failed to delete group");
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
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FolderTree className="h-8 w-8" />
                  <p>No system groups found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    group.type === "income" 
                      ? "bg-sentiment-positive/10 text-sentiment-positive"
                      : "bg-sentiment-negative/10 text-sentiment-negative"
                  }`}>
                    {group.type === "income" ? "Income" : group.type === "expense" ? "Expense" : "N/A"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatAdminDate(group.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatAdminDate(group.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(group)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(group.id)}
                      disabled={deletingId === group.id}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      {deletingId === group.id ? (
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

