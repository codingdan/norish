import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("TokenBucketRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within capacity", async () => {
    const { TokenBucketRateLimiter } = await import("@/server/utils/rate-limiter");
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 1,
    });

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
  });

  it("blocks requests when exhausted", async () => {
    const { TokenBucketRateLimiter } = await import("@/server/utils/rate-limiter");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillRate: 1,
    });

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("refills tokens over time", async () => {
    const { TokenBucketRateLimiter } = await import("@/server/utils/rate-limiter");
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillRate: 1,
    });

    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);

    vi.advanceTimersByTime(1000);

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("does not exceed capacity when refilling", async () => {
    const { TokenBucketRateLimiter } = await import("@/server/utils/rate-limiter");
    const limiter = new TokenBucketRateLimiter({
      capacity: 3,
      refillRate: 10,
    });

    vi.advanceTimersByTime(10000);

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });
});
