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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, Star } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/src/infrastructure/utils/timestamp";

export interface Feedback {
  id: string;
  userId: string;
  rating: number;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  User?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface FeedbackTableProps {
  feedbacks: Feedback[];
  loading?: boolean;
}

export function FeedbackTable({ feedbacks, loading }: FeedbackTableProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleView = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setIsDialogOpen(true);
  };


  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-4 w-4",
              star <= rating ? "text-yellow-400 fill-current" : "text-muted-foreground"
            )}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">({rating}/5)</span>
      </div>
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
      <div className="hidden lg:block rounded-[12px] border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No feedback submissions found
                </TableCell>
              </TableRow>
            ) : (
              feedbacks.map((feedback) => (
                <TableRow key={feedback.id}>
                  <TableCell className="text-sm">{formatDateTime(feedback.createdAt)}</TableCell>
                  <TableCell>
                    {feedback.User ? (
                      <span className="text-sm">
                        {feedback.User.name || feedback.User.email}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>{renderStars(feedback.rating)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {feedback.feedback || (
                      <span className="text-muted-foreground italic">No additional feedback</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => handleView(feedback)}
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
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedFeedback && formatDateTime(selectedFeedback.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4 px-6">
              <div className="space-y-2">
                <Label>User</Label>
                <p className="text-sm">
                  {selectedFeedback.User
                    ? selectedFeedback.User.name || selectedFeedback.User.email
                    : "Unknown"}
                </p>
                {selectedFeedback.User?.email && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFeedback.User.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-2">
                  {renderStars(selectedFeedback.rating)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Feedback</Label>
                {selectedFeedback.feedback ? (
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                    {selectedFeedback.feedback}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No additional feedback provided
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

