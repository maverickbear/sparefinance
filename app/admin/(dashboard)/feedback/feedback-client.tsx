"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackTable, Feedback } from "@/components/admin/feedback-table";
import { Loader2, Star } from "lucide-react";

interface FeedbackPageClientProps {
  feedbacks: Feedback[];
  metrics: {
    total: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
  };
}

export function FeedbackPageClient({ feedbacks, metrics }: FeedbackPageClientProps) {
  return (
    <div className="w-full p-4 lg:p-8">
      <div className="space-y-6">
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.averageRating.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">out of 5.0</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">5 Star Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.ratingDistribution[5] || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.total > 0
                    ? `${((metrics.ratingDistribution[5] || 0) / metrics.total * 100).toFixed(1)}%`
                    : "0%"} of total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Ratings (1-2)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(metrics.ratingDistribution[1] || 0) + (metrics.ratingDistribution[2] || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.total > 0
                    ? `${(((metrics.ratingDistribution[1] || 0) + (metrics.ratingDistribution[2] || 0)) / metrics.total * 100).toFixed(1)}%`
                    : "0%"} of total
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              Breakdown of feedback by rating
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = metrics.ratingDistribution[rating] || 0;
                  const percentage = metrics.total > 0
                    ? (count / metrics.total) * 100
                    : 0;
                  return (
                    <div key={rating} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rating} Star{rating !== 1 ? 's' : ''}</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= rating
                                    ? "text-yellow-400 fill-current"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-muted-foreground">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Feedback</CardTitle>
            <CardDescription>
              View and manage feedback submissions from users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackTable
              feedbacks={feedbacks}
              loading={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
