"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Loader2, Users as UsersIcon, Calendar, ChevronRight, XCircle, Ban, MoreVertical, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { AdminUser } from "@/lib/api/admin";

interface UsersTableProps {
  users: AdminUser[];
  loading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onManageSubscription?: (user: AdminUser) => void;
  onBlockUser?: (user: AdminUser) => void;
  onUnblockUser?: (user: AdminUser) => void;
}

export function UsersTable({ users: initialUsers, loading: initialLoading, searchQuery: externalSearchQuery, onSearchChange, onManageSubscription, onBlockUser, onUnblockUser }: UsersTableProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [loading, setLoading] = useState(initialLoading);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [expandedHouseholds, setExpandedHouseholds] = useState<Set<string>>(new Set());
  
  // Use external search query if provided, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;

  const toggleHousehold = (householdId: string) => {
    setExpandedHouseholds((prev) => {
      const next = new Set(prev);
      if (next.has(householdId)) {
        next.delete(householdId);
      } else {
        next.add(householdId);
      }
      return next;
    });
  };

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setLoading(initialLoading);
  }, [initialLoading]);

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.name && user.name.toLowerCase().includes(query)) ||
      (user.plan && user.plan.name.toLowerCase().includes(query))
    );
  });

  // Group users by household
  const groupedUsers = useMemo(() => {
    const groups = new Map<string, { owner: AdminUser | null; members: AdminUser[] }>();
    const standaloneUsers: AdminUser[] = [];

    filteredUsers.forEach((user) => {
      if (user.household.householdId && user.household.hasHousehold) {
        const householdId = user.household.householdId;
        
        if (!groups.has(householdId)) {
          groups.set(householdId, { owner: null, members: [] });
        }
        
        const group = groups.get(householdId)!;
        
        if (user.household.isOwner) {
          group.owner = user;
        } else {
          group.members.push(user);
        }
      } else {
        standaloneUsers.push(user);
      }
    });

    // Convert groups to array and sort: owners first, then members
    const householdGroups = Array.from(groups.entries())
      .map(([householdId, group]) => ({
        householdId,
        owner: group.owner,
        members: group.members.sort((a, b) => 
          (a.name || a.email).localeCompare(b.name || b.email)
        ),
        pendingMembers: group.owner?.pendingMembers || [],
      }))
      .filter(group => group.owner !== null) // Only include groups with owners
      .sort((a, b) => {
        // Sort by owner name/email
        const aName = a.owner?.name || a.owner?.email || '';
        const bName = b.owner?.name || b.owner?.email || '';
        return aName.localeCompare(bName);
      });

    return { householdGroups, standaloneUsers };
  }, [filteredUsers]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      cancelled: "destructive",
      past_due: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const calculateDaysRemaining = (trialEndDate: string | null | undefined): number | null => {
    if (!trialEndDate) return null;
    try {
      const endDate = new Date(trialEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return null;
    }
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm");
    } catch {
      return dateString;
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
    <div className="space-y-4">
      <div className="hidden lg:block rounded-[12px] border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trial End</TableHead>
              <TableHead>Days Left</TableHead>
              <TableHead>Household</TableHead>
              <TableHead>Created</TableHead>
              {(onManageSubscription || onBlockUser || onUnblockUser) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(onManageSubscription || onBlockUser || onUnblockUser) ? 8 : 7} className="p-0">
                  <div className="flex items-center justify-center min-h-[400px] w-full">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <UsersIcon className="h-8 w-8" />
                      <p>No users found</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Render household groups */}
                {groupedUsers.householdGroups.map((group) => {
                  const isExpanded = expandedHouseholds.has(group.householdId);
                  const totalMembers = group.members.length + group.pendingMembers.length;
                  
                  return (
                    <React.Fragment key={group.householdId}>
                      {/* Owner row */}
                      {group.owner && (
                        <TableRow 
                          key={group.owner.id} 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/40"
                          onClick={() => toggleHousehold(group.householdId)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ChevronRight 
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-90' : ''
                                }`}
                              />
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{group.owner.name || "-"}</span>
                                  <Badge variant="outline" className="text-xs">Owner</Badge>
                                </div>
                                <span className="text-sm text-muted-foreground">{group.owner.email}</span>
                              </div>
                            </div>
                          </TableCell>
                        <TableCell>
                          {group.owner.plan ? (
                            <Badge variant="outline">{group.owner.plan.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">No plan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.owner.subscription
                            ? getStatusBadge(group.owner.subscription.status)
                            : <span className="text-muted-foreground">No subscription</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {group.owner.subscription?.trialEndDate
                            ? formatDateTime(group.owner.subscription.trialEndDate)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {group.owner.subscription?.status === "trialing" && group.owner.subscription.trialEndDate ? (
                            (() => {
                              const daysLeft = calculateDaysRemaining(group.owner.subscription.trialEndDate);
                              return daysLeft !== null ? (
                                <Badge variant={daysLeft <= 1 ? "destructive" : "secondary"}>
                                  {daysLeft} days
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="w-fit">
                            Owner ({totalMembers} {totalMembers === 1 ? 'member' : 'members'})
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(group.owner.createdAt)}
                        </TableCell>
                        {(onManageSubscription || onBlockUser || onUnblockUser) && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(group.owner.subscription?.status === "trialing" || group.owner.subscription?.status === "active") && group.owner.subscription.stripeSubscriptionId && onManageSubscription && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onManageSubscription(group.owner!);
                                      }}
                                    >
                                      <Calendar className="h-4 w-4 mr-2" />
                                      Subscription
                                    </DropdownMenuItem>
                                  )}
                                  {!group.owner.isBlocked && onBlockUser && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onBlockUser(group.owner!);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Block User
                                    </DropdownMenuItem>
                                  )}
                                  {group.owner.isBlocked && onUnblockUser && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUnblockUser(group.owner!);
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Unblock
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )}
                    {/* Member rows - only show if expanded */}
                    {isExpanded && group.members.map((member) => (
                      <TableRow key={member.id} className="bg-muted/10">
                        <TableCell>
                          <div className="flex flex-col gap-1 pl-6">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.name || "-"}</span>
                              <Badge variant="outline" className="text-xs">Member</Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">{member.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.plan ? (
                            <Badge variant="outline">{member.plan.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">No plan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.subscription
                            ? getStatusBadge(member.subscription.status)
                            : <span className="text-muted-foreground">No subscription</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {member.subscription?.trialEndDate
                            ? formatDateTime(member.subscription.trialEndDate)
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {member.subscription?.status === "trialing" && member.subscription.trialEndDate ? (
                            (() => {
                              const daysLeft = calculateDaysRemaining(member.subscription.trialEndDate);
                              return daysLeft !== null ? (
                                <Badge variant={daysLeft <= 1 ? "destructive" : "secondary"}>
                                  {daysLeft} days
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              );
                            })()
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="w-fit">
                            Member
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(member.createdAt)}
                        </TableCell>
                        {(onManageSubscription || onBlockUser || onUnblockUser) && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(member.subscription?.status === "trialing" || member.subscription?.status === "active") && member.subscription.stripeSubscriptionId && onManageSubscription && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onManageSubscription(member);
                                      }}
                                    >
                                      <Calendar className="h-4 w-4 mr-2" />
                                      Subscription
                                    </DropdownMenuItem>
                                  )}
                                  {!member.isBlocked && onBlockUser && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onBlockUser(member);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Block User
                                    </DropdownMenuItem>
                                  )}
                                  {member.isBlocked && onUnblockUser && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUnblockUser(member);
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Unblock
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {/* Pending members - only show if expanded */}
                    {isExpanded && group.pendingMembers.map((pending, index) => (
                      <TableRow key={`pending-${group.householdId}-${index}`} className="bg-muted/5">
                        <TableCell>
                          <div className="flex flex-col gap-1 pl-6">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{pending.name || pending.email || "Pending"}</span>
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                Pending
                              </Badge>
                            </div>
                            {pending.email && (
                              <span className="text-sm text-muted-foreground">{pending.email}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="w-fit">
                            Pending Invite
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        {onManageSubscription && (
                          <TableCell>
                            <span className="text-muted-foreground">-</span>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
                })}
                {/* Render standalone users (no household) */}
                {groupedUsers.standaloneUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{user.name || "-"}</span>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.plan ? (
                        <Badge variant="outline">{user.plan.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.subscription
                        ? getStatusBadge(user.subscription.status)
                        : <span className="text-muted-foreground">No subscription</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.subscription?.trialEndDate
                        ? formatDateTime(user.subscription.trialEndDate)
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {user.subscription?.status === "trialing" && user.subscription.trialEndDate ? (
                        (() => {
                          const daysLeft = calculateDaysRemaining(user.subscription.trialEndDate);
                          return daysLeft !== null ? (
                            <Badge variant={daysLeft <= 1 ? "destructive" : "secondary"}>
                              {daysLeft} days
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">No</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    {(onManageSubscription || onBlockUser || onUnblockUser) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="small"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(user.subscription?.status === "trialing" || user.subscription?.status === "active") && user.subscription.stripeSubscriptionId && onManageSubscription && (
                                <DropdownMenuItem
                                  onClick={() => onManageSubscription(user)}
                                >
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Subscription
                                </DropdownMenuItem>
                              )}
                              {!user.isBlocked && onBlockUser && (
                                <DropdownMenuItem
                                  onClick={() => onBlockUser(user)}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Block User
                                </DropdownMenuItem>
                              )}
                              {user.isBlocked && onUnblockUser && (
                                <DropdownMenuItem
                                  onClick={() => onUnblockUser(user)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Unblock
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

