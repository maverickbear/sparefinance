import { z } from "zod";

export const feedbackSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  feedback: z.string().max(5000, "Feedback must be less than 5000 characters").optional(),
});

export type FeedbackData = z.infer<typeof feedbackSchema>;

