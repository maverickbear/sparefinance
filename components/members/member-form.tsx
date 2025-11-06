"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { memberInviteSchema, MemberInviteFormData, memberUpdateSchema, MemberUpdateFormData } from "@/lib/validations/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import { HouseholdMember } from "@/lib/api/members";

interface MemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: HouseholdMember;
  onSuccess?: () => void;
}

export function MemberForm({ open, onOpenChange, member, onSuccess }: MemberFormProps) {
  const isEditing = !!member;
  const schema = isEditing ? memberUpdateSchema : memberInviteSchema;
  
  const form = useForm<MemberInviteFormData | MemberUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      name: "",
      role: "member",
    },
  });

  useEffect(() => {
    if (open) {
      if (member) {
        form.reset({
          email: member.email || "",
          name: member.name || "",
          role: member.role || "member",
        });
      } else {
        form.reset({
          email: "",
          name: "",
          role: "member",
        });
      }
    }
  }, [open, member, form]);

  async function onSubmit(data: MemberInviteFormData | MemberUpdateFormData) {
    try {
      if (isEditing) {
        // Update member
        const res = await fetch(`/api/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to update member");
        }
      } else {
        // Invite new member
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to invite member");
        }
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving member:", error);
      alert(error instanceof Error ? error.message : "Failed to save member");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Invite"} Member</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the member's information"
              : "Invite a new household member by email"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="member@example.com"
              {...form.register("email")}
            />
            {isEditing && member?.status === "active" && (
              <p className="text-xs text-muted-foreground">
                Changing email will also update the user's account email.
              </p>
            )}
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input {...form.register("name")} placeholder="Member name" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name?.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={form.watch("role") || "member"}
              onValueChange={(value) => form.setValue("role", value as "admin" | "member")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admin has full access based on the plan. Member cannot remove household members or invite others.
            </p>
            {form.formState.errors.role && (
              <p className="text-sm text-destructive">
                {form.formState.errors.role?.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Update" : "Invite"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



