"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/page-header";
import { useToast } from "@/components/toast-provider";
import { feedbackSchema, FeedbackData } from "@/lib/validations/feedback";
import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";


export default function FeedbackPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const form = useForm<FeedbackData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      rating: undefined,
      feedback: "",
    },
  });

  const handleRatingClick = (rating: number) => {
    setSelectedRating(rating);
    form.setValue("rating", rating);
  };

  async function onSubmit(data: FeedbackData) {
    if (!data.rating) {
      toast({
        title: "Rating required",
        description: "Please select a rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit feedback");
      }

      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback helps us improve Spare Finance.",
      });

      form.reset();
      setSelectedRating(null);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Feedback"
        description="Share your thoughts and help us improve Spare Finance"
      />

      <Card>
        <CardHeader>
          <CardTitle>Rate Your Experience</CardTitle>
          <CardDescription>
            How would you rate your experience with Spare Finance?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label>Rating *</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRatingClick(rating)}
                    disabled={isSubmitting}
                    className={cn(
                      "transition-colors hover:scale-110",
                      selectedRating && selectedRating >= rating
                        ? "text-yellow-400"
                        : "text-muted-foreground hover:text-yellow-300"
                    )}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8",
                        selectedRating && selectedRating >= rating
                          ? "fill-current"
                          : ""
                      )}
                    />
                  </button>
                ))}
              </div>
              {form.formState.errors.rating && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.rating.message}
                </p>
              )}
              {selectedRating && (
                <p className="text-sm text-muted-foreground">
                  {selectedRating === 1 && "Poor"}
                  {selectedRating === 2 && "Fair"}
                  {selectedRating === 3 && "Good"}
                  {selectedRating === 4 && "Very Good"}
                  {selectedRating === 5 && "Excellent"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Additional Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                {...form.register("feedback")}
                placeholder="Tell us more about your experience, what you like, or what we can improve..."
                rows={6}
                disabled={isSubmitting}
              />
              {form.formState.errors.feedback && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.feedback.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || !selectedRating} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

