"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { memberInviteSchema, MemberInviteFormData, memberUpdateSchema, MemberUpdateFormData } from "@/src/domain/members/members.validations";
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
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { HouseholdMember } from "@/src/domain/members/members.types";

interface MemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: HouseholdMember;
  onSuccess?: () => void;
}

export function MemberForm({ open, onOpenChange, member, onSuccess }: MemberFormProps) {
  const isEditing = !!member;
  const schema = isEditing ? memberUpdateSchema : memberInviteSchema;
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      setIsSubmitting(true);
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
        const res = await fetch("/api/v2/members", {
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Invite"} Member</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the member's information"
              : "Invite a new household member by email"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="member@example.com"
              {...form.register("email")}
              size="medium"
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
            <Input {...form.register("name")} placeholder="Member name" size="medium" />
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
              <SelectTrigger size="medium">
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

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="medium" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="medium" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Inviting..."}
                </>
              ) : (
                isEditing ? "Update" : "Invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



