"use client";

import type { HouseholdMember } from "@/src/domain/members/members.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvitationStatus } from "./invitation-status";
import { Edit, Trash2, Crown, Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { MemberForm } from "./member-form";

interface MemberCardProps {
  member: HouseholdMember;
  onUpdate?: () => void;
  onDelete?: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "M";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

export function MemberCard({ member, onUpdate, onDelete }: MemberCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to remove ${member.name || member.email} from your household?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to remove member");
      }

      onDelete?.();
    } catch (error) {
      console.error("Error removing member:", error);
      alert(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      const res = await fetch(`/api/members/${member.id}/resend`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to resend invitation");
      }

      alert("Invitation email resent successfully!");
    } catch (error) {
      console.error("Error resending invitation:", error);
      alert(error instanceof Error ? error.message : "Failed to resend invitation");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative flex-shrink-0">
                {(member as any).avatarUrl ? (
                  <>
                    <img
                      src={(member as any).avatarUrl}
                      alt={member.name || member.email}
                      className="h-12 w-12 rounded-full object-cover border-2"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const initialsContainer = e.currentTarget.nextElementSibling;
                        if (initialsContainer) {
                          (initialsContainer as HTMLElement).style.display = "flex";
                        }
                      }}
                    />
                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-lg font-semibold border-2">
                      {getInitials(member.name)}
                    </div>
                  </>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold border-2">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{member.name || member.email}</CardTitle>
                  {member.isOwner && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>
            {!member.isOwner && <InvitationStatus status={member.status} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {!member.isOwner && member.status === "pending" && member.invitedAt && (
              <p className="text-sm text-muted-foreground">
                Invitation sent on {new Date(member.invitedAt).toLocaleDateString()}
              </p>
            )}
            {!member.isOwner && member.status === "active" && member.acceptedAt && (
              <p className="text-sm text-muted-foreground">
                Joined on {new Date(member.acceptedAt).toLocaleDateString()}
              </p>
            )}
            {member.isOwner && member.createdAt && (
              <p className="text-sm text-muted-foreground">
                Account owner since {new Date(member.createdAt).toLocaleDateString()}
              </p>
            )}
            <div className="flex justify-end space-x-2 pt-2">
              {!member.isOwner && (
                <>
                  {member.status === "pending" && (
                    <Button
                      variant="outline"
                      onClick={handleResend}
                      disabled={isResending}
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Resend
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setIsEditOpen(true)}
                    disabled={isDeleting}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!member.isOwner && (
        <MemberForm
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          member={member}
          onSuccess={() => {
            onUpdate?.();
            setIsEditOpen(false);
          }}
        />
      )}
    </>
  );
}



