// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  // Clean expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }
}

export const cache = new MemoryCache()

// Run cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000)
