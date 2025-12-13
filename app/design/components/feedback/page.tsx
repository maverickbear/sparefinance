"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/toast-provider";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  Save,
  Upload,
  Download,
} from "lucide-react";

export default function FeedbackPage() {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveConfirmOpen, setDestructiveConfirmOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="p-4 lg:p-8 space-y-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Feedback Components</h1>
          <p className="text-muted-foreground">
            Toast notifications, alerts, and confirmation dialogs used throughout the application
          </p>
        </div>

        {/* Toast Notifications */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Toast Notifications</h2>
          <p className="text-muted-foreground mb-6">
            Non-intrusive notifications that appear at the top of the screen and auto-dismiss after 3 seconds.
            Used for success messages, errors, and general feedback after user actions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Success Toast */}
            <Card>
              <CardHeader>
                <CardTitle>Success Toast</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> toast-success-default<br />
                  Used when an action completes successfully (e.g., "Account created", "Profile updated")
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      toast({
                        title: "Success",
                        description: "Your changes have been saved successfully.",
                        variant: "success",
                      })
                    }
                  >
                    Show Success Toast
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`toast({
  title: "Success",
  description: "Your changes have been saved successfully.",
  variant: "success",
})`}
                  </code>
                </div>
                <div className="border rounded-lg p-4 bg-background">
                  <div className="relative">
                    <Alert className="pr-10">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>
                        Your changes have been saved successfully.
                      </AlertDescription>
                    </Alert>
                    <button className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity text-muted-foreground hover:bg-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Toast */}
            <Card>
              <CardHeader>
                <CardTitle>Error Toast</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> toast-error-destructive<br />
                  Used when an action fails or an error occurs (e.g., "Failed to save", "Network error")
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    onClick={() =>
                      toast({
                        title: "Error",
                        description: "Failed to save changes. Please try again.",
                        variant: "destructive",
                      })
                    }
                  >
                    Show Error Toast
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`toast({
  title: "Error",
  description: "Failed to save changes. Please try again.",
  variant: "destructive",
})`}
                  </code>
                </div>
                <div className="border rounded-lg p-4 bg-background">
                  <div className="relative">
                    <Alert variant="destructive" className="pr-10">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>
                        Failed to save changes. Please try again.
                      </AlertDescription>
                    </Alert>
                    <button className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Default Toast */}
            <Card>
              <CardHeader>
                <CardTitle>Default Toast</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> toast-info-default<br />
                  Used for informational messages without a specific success/error state
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Info",
                        description: "Your session will expire in 5 minutes.",
                      })
                    }
                  >
                    Show Default Toast
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`toast({
  title: "Info",
  description: "Your session will expire in 5 minutes.",
})`}
                  </code>
                </div>
                <div className="border rounded-lg p-4 bg-background">
                  <div className="relative">
                    <Alert className="pr-10">
                      <AlertTitle>Info</AlertTitle>
                      <AlertDescription>
                        Your session will expire in 5 minutes.
                      </AlertDescription>
                    </Alert>
                    <button className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity text-muted-foreground hover:bg-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Toast with Title Only */}
            <Card>
              <CardHeader>
                <CardTitle>Toast - Title Only</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> toast-success-title-only<br />
                  Simplified toast with only a title, no description
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      toast({
                        title: "Saved",
                        variant: "success",
                      })
                    }
                  >
                    Show Title Only Toast
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`toast({
  title: "Saved",
  variant: "success",
})`}
                  </code>
                </div>
                <div className="border rounded-lg p-4 bg-background">
                  <div className="relative">
                    <Alert className="pr-10">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Saved</AlertTitle>
                    </Alert>
                    <button className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity text-muted-foreground hover:bg-secondary">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inline Alerts */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Inline Alerts</h2>
          <p className="text-muted-foreground mb-6">
            Contextual alerts displayed within forms, dialogs, or pages. They remain visible until dismissed or the condition changes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Success Alert */}
            <Card>
              <CardHeader>
                <CardTitle>Success Alert</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-success-inline<br />
                  Used to show successful completion of an action within a form or page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported 25 transactions.
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert>
  <CheckCircle2 className="h-4 w-4" />
  <AlertDescription>
    Successfully imported 25 transactions.
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Error Alert */}
            <Card>
              <CardHeader>
                <CardTitle>Error Alert</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-error-destructive<br />
                  Used to display errors or validation failures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Failed to load data. Please try again.
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Failed to load data. Please try again.
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Info Alert */}
            <Card>
              <CardHeader>
                <CardTitle>Info Alert</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-info-default<br />
                  Used to provide informational context or instructions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>John Doe</strong> invited you to join their household. 
                    Sign in to accept the invitation.
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>
    <strong>John Doe</strong> invited you to join their household. 
    Sign in to accept the invitation.
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Warning Alert */}
            <Card>
              <CardHeader>
                <CardTitle>Warning Alert</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-warning-destructive<br />
                  Used to warn users about potentially destructive actions or important notices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: This will permanently delete your account</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>All your data will be permanently deleted</li>
                      <li>Your active subscription will be cancelled immediately</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Warning: This will permanently delete your account</AlertTitle>
  <AlertDescription>
    <ul className="list-disc list-inside space-y-1 mt-2">
      <li>All your data will be permanently deleted</li>
      <li>Your active subscription will be cancelled immediately</li>
      <li>This action cannot be undone</li>
    </ul>
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Error Alert with List */}
            <Card>
              <CardHeader>
                <CardTitle>Error Alert with List</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-error-list-destructive<br />
                  Used to display multiple errors, typically in import/validation scenarios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Errors found:</div>
                      <div className="max-h-32 overflow-y-auto text-sm">
                        <div>Line 5: Invalid date format</div>
                        <div>Line 12: Missing required field</div>
                        <div>Line 18: Amount must be a number</div>
                        <div className="text-muted-foreground">
                          ... and 5 more errors
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
    <div className="space-y-1">
      <div className="font-medium">Errors found:</div>
      <div className="max-h-32 overflow-y-auto text-sm">
        {errors.map((error, idx) => (
          <div key={idx}>{error}</div>
        ))}
      </div>
    </div>
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Success Alert with Count */}
            <Card>
              <CardHeader>
                <CardTitle>Success Alert with Count</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> alert-success-count<br />
                  Used to show import/operation results with success and error counts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported 25 transactions.
                    3 errors occurred.
                  </AlertDescription>
                </Alert>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<Alert>
  <CheckCircle2 className="h-4 w-4" />
  <AlertDescription>
    Successfully imported {success} transaction{success !== 1 ? "s" : ""}.
    {errors > 0 && \` \${errors} error\${errors !== 1 ? "s" : ""} occurred.\`}
  </AlertDescription>
</Alert>`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Confirmation Dialogs */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Confirmation Dialogs</h2>
          <p className="text-muted-foreground mb-6">
            Modal dialogs that require user confirmation before proceeding with an action. Used for destructive or important actions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Confirmation Dialog */}
            <Card>
              <CardHeader>
                <CardTitle>Default Confirmation Dialog</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> dialog-confirm-default<br />
                  Standard confirmation dialog for general actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Show Default Dialog</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button>Show Dialog</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Destructive Confirmation Dialog */}
            <Card>
              <CardHeader>
                <CardTitle>Destructive Confirmation Dialog</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> dialog-confirm-destructive<br />
                  Confirmation dialog for destructive actions (delete, remove, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog open={destructiveConfirmOpen} onOpenChange={setDestructiveConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Show Destructive Dialog</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account and all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Account</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground 
          hover:bg-destructive/90"
      >
        Delete Account
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* ConfirmDialog Component */}
            <Card>
              <CardHeader>
                <CardTitle>ConfirmDialog Component</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> dialog-confirm-wrapper<br />
                  Reusable wrapper component for confirmations with consistent behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(true)}
                >
                  Show ConfirmDialog
                </Button>
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title="Save Changes?"
                  description="You have unsaved changes. Do you want to save them before leaving?"
                  onConfirm={async () => {
                    // Simulate async action
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    toast({ title: "Success", description: "Changes saved", variant: "success" });
                  }}
                  confirmLabel="Save"
                  cancelLabel="Discard"
                />
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Save Changes?"
  description="You have unsaved changes."
  onConfirm={async () => {
    await saveChanges();
  }}
  confirmLabel="Save"
  cancelLabel="Discard"
/>`}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Destructive ConfirmDialog */}
            <Card>
              <CardHeader>
                <CardTitle>Destructive ConfirmDialog</CardTitle>
                <CardDescription>
                  <strong>Name:</strong> dialog-confirm-destructive-wrapper<br />
                  ConfirmDialog component with destructive variant styling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="destructive"
                  onClick={() => setDestructiveConfirmOpen(true)}
                >
                  Show Destructive ConfirmDialog
                </Button>
                <ConfirmDialog
                  open={destructiveConfirmOpen}
                  onOpenChange={setDestructiveConfirmOpen}
                  title="Delete Transaction"
                  description="This will permanently delete this transaction. This action cannot be undone."
                  onConfirm={async () => {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    toast({ title: "Success", description: "Transaction deleted", variant: "success" });
                  }}
                  confirmLabel="Delete"
                  cancelLabel="Cancel"
                  variant="destructive"
                />
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm whitespace-pre-wrap">
{`<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete Transaction"
  description="This action cannot be undone."
  onConfirm={async () => {
    await deleteTransaction();
  }}
  confirmLabel="Delete"
  cancelLabel="Cancel"
  variant="destructive"
/>`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Usage Guidelines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>When to Use Each Component</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Toast Notifications</h4>
                  <p className="text-sm text-muted-foreground">
                    Use for non-critical feedback after user actions. Auto-dismiss after 3 seconds. 
                    Examples: "Saved successfully", "Error occurred", "Upload complete"
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Inline Alerts</h4>
                  <p className="text-sm text-muted-foreground">
                    Use within forms, dialogs, or pages to show contextual information that needs to remain visible.
                    Examples: Validation errors, import results, warning messages
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Confirmation Dialogs</h4>
                  <p className="text-sm text-muted-foreground">
                    Use for actions that are destructive or irreversible. Requires explicit user confirmation.
                    Examples: Delete account, remove item, cancel subscription
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Naming Convention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium mb-1">Toast Names</h4>
                  <p className="text-sm text-muted-foreground">
                    Format: <code>toast-{`{type}`}-{`{variant}`}</code><br />
                    Examples: toast-success-default, toast-error-destructive, toast-info-default
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Alert Names</h4>
                  <p className="text-sm text-muted-foreground">
                    Format: <code>alert-{`{type}`}-{`{variant}`}</code><br />
                    Examples: alert-success-inline, alert-error-destructive, alert-warning-destructive
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Dialog Names</h4>
                  <p className="text-sm text-muted-foreground">
                    Format: <code>dialog-{`{type}`}-{`{variant}`}</code><br />
                    Examples: dialog-confirm-default, dialog-confirm-destructive
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

