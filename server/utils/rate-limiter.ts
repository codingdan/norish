/**
 * Token bucket rate limiter for controlling request rates.
 */

export interface RateLimiterOptions {
  /** Maximum tokens in the bucket */
  capacity: number;
  /** Tokens added per second */
  refillRate: number;
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.tokens = options.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume one token. Returns true if successful, false if rate limited.
   */
  tryConsume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get current token count (for monitoring).
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Singleton rate limiter for AI normalization (10 requests per minute)
let aiNormalizationLimiter: TokenBucketRateLimiter | null = null;

export function getAINormalizationLimiter(): TokenBucketRateLimiter {
  if (!aiNormalizationLimiter) {
    aiNormalizationLimiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRate: 10 / 60,
    });
  }
  return aiNormalizationLimiter;
}
