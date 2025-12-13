"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface ReceiptData {
  amount?: number;
  merchant?: string;
  date?: string;
  description?: string;
  items?: Array<{ name: string; price: number }>;
  receiptUrl?: string;
}

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete: (data: ReceiptData) => void;
  initialMode?: "camera" | "upload" | null;
}

export function ReceiptScanner({
  open,
  onOpenChange,
  onScanComplete,
  initialMode = null,
}: ReceiptScannerProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const breakpoint = useBreakpoint();
  // Show camera option only on mobile/tablet (below lg breakpoint = 1024px)
  const isMobileOrTablet = !breakpoint || breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md";

  // Cleanup camera stream when dialog closes
  React.useEffect(() => {
    if (!open) {
      stopCamera();
      setPreview(null);
      setSelectedFile(null);
      setShowCamera(false);
    }
  }, [open]);

  // Handle initial mode (camera or upload)
  React.useEffect(() => {
    if (open && initialMode) {
      if (initialMode === "camera" && isMobileOrTablet) {
        // Small delay to ensure dialog is fully open
        setTimeout(() => {
          startCamera();
        }, 100);
      } else if (initialMode === "upload") {
        // Small delay to ensure dialog is fully open
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, isMobileOrTablet]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
        setSelectedFile(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
        setShowCamera(false);
      }
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/v2/receipts/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scan receipt");
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Include receiptUrl if available
        const receiptData = {
          ...result.data,
          receiptUrl: result.receiptUrl,
        };
        onScanComplete(receiptData);
        toast({
          title: "Receipt Scanned",
          description: "Transaction data extracted successfully",
          variant: "success",
        });
        onOpenChange(false);
      } else {
        throw new Error("No data extracted from receipt");
      }
    } catch (error) {
      console.error("Error scanning receipt:", error);
      toast({
        title: "Scan Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to scan receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Scan Receipt</DialogTitle>
          <DialogDescription>
            Take a photo or upload an image of your receipt to automatically extract transaction details
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Camera View */}
          {showCamera && (
            <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    stopCamera();
                    setShowCamera(false);
                  }}
                  className="rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="rounded-full h-16 w-16"
                  size="medium"
                >
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview Image */}
          {preview && !showCamera && (
            <div className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full h-full object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          {!preview && !showCamera && (
            <div className="flex flex-col gap-3">
              {/* Camera button - only on mobile/tablet */}
              {isMobileOrTablet && (
                <Button
                  type="button"
                  onClick={startCamera}
                  className="w-full"
                  size="medium"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Take Photo
                </Button>
              )}
              <Button
                type="button"
                variant={isMobileOrTablet ? "outline" : "default"}
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                size="medium"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={isMobileOrTablet ? "environment" : undefined}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Scan Button */}
          {preview && !showCamera && (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRemoveImage}
                className="flex-1"
              >
                Remove
              </Button>
              <Button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="flex-1"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Scan Receipt
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

