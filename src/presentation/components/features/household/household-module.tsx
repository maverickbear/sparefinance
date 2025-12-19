"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FeatureGuard } from "@/components/common/feature-guard";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Plus, Edit as EditIcon, Trash2, Crown, Mail, Users, Loader2 } from "lucide-react";
import { MemberForm } from "@/components/members/member-form";
import type { HouseholdMember } from "@/src/domain/members/members.types";
import { useSubscription } from "@/hooks/use-subscription";
import { EmptyState } from "@/components/common/empty-state";
import { useAuthSafe } from "@/contexts/auth-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvitationStatus } from "@/components/members/invitation-status";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useWriteGuard } from "@/hooks/use-write-guard";

// Members helper
function getInitials(name: string | null | undefined): string {
  if (!name) return "M";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

export function HouseholdModule() {
  const { openDialog, ConfirmDialog } = useConfirmDialog();
  const { checkWriteAccess, canWrite } = useWriteGuard();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { limits, checking: limitsLoading } = useSubscription();
  
  // Use AuthContext for role instead of fetching
  const { role: currentUserRole } = useAuthSafe();

  useEffect(() => {
    if (!limitsLoading) {
      loadData();
    }
  }, [limitsLoading]);

  // OPTIMIZED: Fetch only members data, role comes from Context
  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch("/api/v2/members");
      if (!response.ok) {
        throw new Error("Failed to fetch members data");
      }
      const { members: data } = await response.json();
      setMembers(data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(member: HouseholdMember) {
    if (!checkWriteAccess()) return;
    openDialog(
      {
        title: "Remove Member",
        description: `Are you sure you want to remove ${member.name || member.email} from your household?`,
        variant: "destructive",
        confirmLabel: "Remove",
      },
      async () => {
        setDeletingId(member.id);
        try {
          const response = await fetch(`/api/v2/members/${member.id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to remove member");
          }
          loadData();
        } catch (error) {
          console.error("Error removing member:", error);
          alert(error instanceof Error ? error.message : "Failed to remove member");
        } finally {
          setDeletingId(null);
        }
      }
    );
  }

  async function handleResend(member: HouseholdMember) {
    if (!checkWriteAccess()) return;
    try {
      const res = await fetch(`/api/v2/members/${member.id}/resend`, {
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
    }
  }

  function handleEdit(member: HouseholdMember) {
    if (!checkWriteAccess()) return;
    setEditingMember(member);
    setIsFormOpen(true);
  }

  function handleFormClose() {
    setIsFormOpen(false);
    setEditingMember(undefined);
  }

  function handleFormSuccess() {
    loadData();
    handleFormClose();
  }

  return (
    <FeatureGuard 
      feature="hasHousehold"
      headerTitle="Household Members"
    >
      <div>
        <div className="flex items-center justify-end mb-4">
          {(currentUserRole === "admin" || currentUserRole === "super_admin" || currentUserRole === null) && members.length > 0 && canWrite && (
            <Button
              size="medium"
              onClick={() => {
                if (!checkWriteAccess()) return;
                setIsFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : members.length === 0 ? (
          <div className="w-full h-full min-h-[400px]">
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Invite household members to share access to your financial data."
            />
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Member</TableHead>
                  <TableHead className="text-xs md:text-sm">Email</TableHead>
                  <TableHead className="text-xs md:text-sm">Role</TableHead>
                  <TableHead className="text-xs md:text-sm">Status</TableHead>
                  <TableHead className="text-xs md:text-sm">Date</TableHead>
                  <TableHead className="text-xs md:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-xs md:text-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          {member.avatarUrl ? (
                            <>
                              <img
                                src={member.avatarUrl}
                                alt={member.name || member.email}
                                className="h-10 w-10 rounded-full object-cover border-2"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const initialsContainer = e.currentTarget.nextElementSibling;
                                  if (initialsContainer) {
                                    (initialsContainer as HTMLElement).style.display = "flex";
                                  }
                                }}
                              />
                              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground hidden items-center justify-center text-sm font-semibold border-2">
                                {getInitials(member.name)}
                              </div>
                            </>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold border-2">
                              {getInitials(member.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{member.name || member.email}</span>
                            {member.isOwner && (
                              <Badge variant="default" className="flex items-center gap-1">
                                <Crown className="h-3 w-3" />
                                Owner
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs md:text-sm text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell className="text-xs md:text-sm">
                      {member.isOwner ? (
                        <Badge variant="default" className="rounded-full border-border bg-white text-gray-900 hover:bg-gray-50">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant={member.role === "admin" ? "default" : "secondary"} className={member.role === "admin" ? "rounded-full border-border bg-white text-gray-900 hover:bg-gray-50" : ""}>
                          {member.role === "admin" ? "Admin" : "Member"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs md:text-sm">
                      {member.isOwner ? (
                        <Badge variant="secondary" className="rounded-full bg-primary text-primary-foreground border-transparent hover:bg-primary">Active</Badge>
                      ) : (
                        <InvitationStatus status={member.status} />
                      )}
                    </TableCell>
                    <TableCell className="text-xs md:text-sm text-muted-foreground">
                      {member.isOwner ? (
                        <span>Since {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "N/A"}</span>
                      ) : member.status === "pending" ? (
                        <span>Invited {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : "N/A"}</span>
                      ) : member.acceptedAt ? (
                        <span>Joined {new Date(member.acceptedAt).toLocaleDateString()}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!member.isOwner && (currentUserRole === "admin" || currentUserRole === "super_admin" || currentUserRole === null) && canWrite && (
                        <div className="flex space-x-1 md:space-x-2">
                          {member.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-10 md:w-10"
                              onClick={() => handleResend(member)}
                              title="Resend invitation email"
                            >
                              <Mail className="h-3 w-3 md:h-4 md:w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-10 md:w-10"
                            onClick={() => handleEdit(member)}
                          >
                            <EditIcon className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-10 md:w-10"
                            onClick={() => handleDelete(member)}
                            disabled={deletingId === member.id}
                          >
                            {deletingId === member.id ? (
                              <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <MemberForm
          open={isFormOpen}
          onOpenChange={handleFormClose}
          member={editingMember}
          onSuccess={handleFormSuccess}
        />
        {ConfirmDialog}

        {/* Mobile Floating Action Button */}
        {(currentUserRole === "admin" || currentUserRole === "super_admin" || currentUserRole === null) && canWrite && (
          <div className="fixed bottom-20 right-4 z-[60] lg:hidden">
            <Button
              size="medium"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => {
                if (!checkWriteAccess()) return;
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}

