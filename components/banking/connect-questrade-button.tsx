"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast-provider";
import { Loader2, ExternalLink } from "lucide-react";
import { useWriteGuard } from "@/hooks/use-write-guard";

interface ConnectQuestradeButtonProps {
  onSuccess?: () => void;
}

export function ConnectQuestradeButton({
  onSuccess,
}: ConnectQuestradeButtonProps) {
  const { toast } = useToast();
  const { checkWriteAccess } = useWriteGuard();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [manualAuthToken, setManualAuthToken] = useState("");

  const handleConnect = async () => {
    if (!checkWriteAccess()) return;
    if (!manualAuthToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Questrade authorization token",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/questrade/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualAuthToken: manualAuthToken.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect Questrade account");
      }

      toast({
        title: "Account connected",
        description:
          "Your Questrade account has been connected successfully. Your positions and transactions are being synchronized.",
        variant: "success",
      });

      setIsOpen(false);
      setManualAuthToken("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error connecting Questrade account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect Questrade account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (open && !checkWriteAccess()) return;
        setIsOpen(open);
      }}>
        <DialogTrigger asChild>
          <Button 
            variant="outline"
            onClick={(e) => {
              if (!checkWriteAccess()) {
                e.preventDefault();
                return;
              }
            }}
          >
            Connect Questrade
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Questrade Account</DialogTitle>
            <DialogDescription>
              To connect your Questrade account, you need to generate an authorization token in the Questrade API Centre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Authorization Token</Label>
              <Input
                id="token"
                type="text"
                placeholder="Enter your Questrade authorization token"
                value={manualAuthToken}
                onChange={(e) => setManualAuthToken(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Get your token at{" "}
                <a
                  href="https://www.questrade.com/api/documentation/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Questrade API Centre
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold mb-2">How to get your token:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Log in to your Questrade account</li>
                <li>Go to API Centre in the top right menu</li>
                <li>Click "Activate API" and accept the terms</li>
                <li>Click "Register a personal app"</li>
                <li>Click "New manual authorization"</li>
                <li>Copy the authorization token and paste it here</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}

