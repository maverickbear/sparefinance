/**
 * Progress Tracker
 * Simple in-memory progress tracking for long-running operations
 * Note: In production, consider using Redis or a database for distributed systems
 */

export interface ProgressData {
  jobId: string;
  progress: number; // 0-100
  message: string;
  current: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  startedAt: Date;
  updatedAt: Date;
}

class ProgressTracker {
  private progressMap = new Map<string, ProgressData>();

  /**
   * Create a new progress tracker
   */
  create(jobId: string, total: number, initialMessage: string = 'Starting...'): void {
    const now = new Date();
    this.progressMap.set(jobId, {
      jobId,
      progress: 0,
      message: initialMessage,
      current: 0,
      total,
      status: 'pending',
      startedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Update progress
   */
  update(jobId: string, current: number, message?: string): void {
    const progress = this.progressMap.get(jobId);
    if (!progress) {
      return; // Job not found
    }

    const newProgress = Math.min(100, Math.round((current / progress.total) * 100));
    
    progress.progress = newProgress;
    progress.current = current;
    progress.status = 'processing';
    progress.updatedAt = new Date();
    
    if (message) {
      progress.message = message;
    }
  }

  /**
   * Mark as completed
   */
  complete(jobId: string, message?: string): void {
    const progress = this.progressMap.get(jobId);
    if (!progress) {
      return;
    }

    progress.progress = 100;
    progress.current = progress.total;
    progress.status = 'completed';
    progress.updatedAt = new Date();
    
    if (message) {
      progress.message = message;
    }
  }

  /**
   * Mark as error
   */
  error(jobId: string, errorMessage: string): void {
    const progress = this.progressMap.get(jobId);
    if (!progress) {
      return;
    }

    progress.status = 'error';
    progress.error = errorMessage;
    progress.updatedAt = new Date();
  }

  /**
   * Get progress
   */
  get(jobId: string): ProgressData | null {
    return this.progressMap.get(jobId) || null;
  }

  /**
   * Remove progress (cleanup)
   */
  remove(jobId: string): void {
    this.progressMap.delete(jobId);
  }

  /**
   * Cleanup old progress entries (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [jobId, progress] of this.progressMap.entries()) {
      if (progress.updatedAt.getTime() < oneHourAgo) {
        this.progressMap.delete(jobId);
      }
    }
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    progressTracker.cleanup();
  }, 5 * 60 * 1000);
}

