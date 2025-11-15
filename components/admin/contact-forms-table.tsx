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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Eye, CheckCircle2, MessageSquare, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils/timestamp";

export interface ContactForm {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "pending" | "read" | "replied" | "resolved";
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  User?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ContactFormsTableProps {
  contactForms: ContactForm[];
  loading?: boolean;
  onUpdate?: () => void;
}

export function ContactFormsTable({ contactForms, loading, onUpdate }: ContactFormsTableProps) {
  const [selectedContact, setSelectedContact] = useState<ContactForm | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleView = (contact: ContactForm) => {
    setSelectedContact(contact);
    setStatus(contact.status);
    setAdminNotes(contact.adminNotes || "");
    setIsDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedContact) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/contact-forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedContact.id,
          status,
          adminNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update contact form");
      }

      setIsDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating contact form:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "destructive",
      read: "secondary",
      replied: "default",
      resolved: "outline",
    };

    const icons: Record<string, React.ReactNode> = {
      pending: <Mail className="h-3 w-3 mr-1" />,
      read: <Eye className="h-3 w-3 mr-1" />,
      replied: <MessageSquare className="h-3 w-3 mr-1" />,
      resolved: <CheckCircle2 className="h-3 w-3 mr-1" />,
    };

    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center w-fit">
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactForms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No contact forms found
                </TableCell>
              </TableRow>
            ) : (
              contactForms.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="text-sm">{formatDateTime(contact.createdAt)}</TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell className="max-w-xs truncate">{contact.subject}</TableCell>
                  <TableCell>{getStatusBadge(contact.status)}</TableCell>
                  <TableCell>
                    {contact.User ? (
                      <span className="text-sm text-muted-foreground">
                        {contact.User.name || contact.User.email}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Guest</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(contact)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contact Form Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedContact && formatDateTime(selectedContact.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4 px-6">
              <div className="space-y-2">
                <Label>Name</Label>
                <p className="text-sm">{selectedContact.name}</p>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-sm">{selectedContact.email}</p>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <p className="text-sm font-medium">{selectedContact.subject}</p>
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {selectedContact.message}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this contact form..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

