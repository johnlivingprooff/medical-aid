/**
 * Performance Optimization Utilities
 * Caching strategies, lazy loading, API optimization, and bundle analysis
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

// API Response Cache Implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memory: JSON.stringify(Object.fromEntries(this.cache)).length
    };
  }
}

export const apiCache = new APICache();

// Enhanced API Client with Caching
interface APIClientOptions {
  cache?: boolean;
  cacheTTL?: number;
  retries?: number;
  timeout?: number;
}

class EnhancedAPIClient {
  private baseURL: string;
  private requestQueue = new Map<string, Promise<any>>();

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  private generateCacheKey(url: string, options?: any): string {
    return `${url}_${JSON.stringify(options || {})}`;
  }

  private async makeRequest<T>(
    method: string, 
    endpoint: string, 
    data?: any, 
    options: APIClientOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = this.generateCacheKey(url, { method, data });

    // Check cache for GET requests
    if (method === 'GET' && options.cache !== false) {
      const cached = apiCache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Prevent duplicate requests
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const requestPromise = this.executeRequest<T>(method, url, data, options);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful GET requests
      if (method === 'GET' && options.cache !== false) {
        apiCache.set(cacheKey, result, options.cacheTTL);
      }

      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any,
    options: APIClientOptions = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = options.timeout || 30000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers here
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Implement retry logic
      if (options.retries && options.retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.executeRequest(method, url, data, { 
          ...options, 
          retries: options.retries - 1 
        });
      }
      
      throw error;
    }
  }

  get<T>(endpoint: string, options?: APIClientOptions): Promise<T> {
    return this.makeRequest<T>('GET', endpoint, undefined, options);
  }

  post<T>(endpoint: string, data?: any, options?: APIClientOptions): Promise<T> {
    return this.makeRequest<T>('POST', endpoint, data, options);
  }

  put<T>(endpoint: string, data?: any, options?: APIClientOptions): Promise<T> {
    return this.makeRequest<T>('PUT', endpoint, data, options);
  }

  delete<T>(endpoint: string, options?: APIClientOptions): Promise<T> {
    return this.makeRequest<T>('DELETE', endpoint, undefined, options);
  }

  // Cache management methods
  invalidateCache(pattern: string): void {
    apiCache.invalidate(pattern);
  }

  clearCache(): void {
    apiCache.clear();
  }

  getCacheStats() {
    return apiCache.getStats();
  }
}

export const optimizedApiClient = new EnhancedAPIClient();

// Debounced API Hook
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized Search Hook
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedQuery = useDebounced(query, debounceMs);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const data = await searchFn(searchQuery);
      setResults(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  }, [searchFn]);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearResults: () => setResults([])
  };
}

// Infinite Scroll Hook
export function useInfiniteScroll<T>(
  fetchMore: (page: number) => Promise<{ data: T[], hasMore: boolean }>,
  initialData: T[] = []
) {
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchMore(page);
      setData(prev => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load more data');
    } finally {
      setLoading(false);
    }
  }, [fetchMore, page, loading, hasMore]);

  const reset = useCallback(() => {
    setData(initialData);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, [initialData]);

  return {
    data,
    loading,
    hasMore,
    error,
    loadMore,
    reset
  };
}

// Virtual List Hook for Large Data Sets
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };
}

// Memory Usage Monitor
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<any>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo({
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Performance Metrics Hook
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<{
    renderTime: number;
    apiCalls: number;
    cacheHits: number;
    errors: number;
  }>({
    renderTime: 0,
    apiCalls: 0,
    cacheHits: 0,
    errors: 0
  });

  const startTime = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const endTimer = useCallback(() => {
    const duration = performance.now() - startTime.current;
    setMetrics(prev => ({ ...prev, renderTime: duration }));
  }, []);

  const incrementApiCalls = useCallback(() => {
    setMetrics(prev => ({ ...prev, apiCalls: prev.apiCalls + 1 }));
  }, []);

  const incrementCacheHits = useCallback(() => {
    setMetrics(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
  }, []);

  const incrementErrors = useCallback(() => {
    setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({
      renderTime: 0,
      apiCalls: 0,
      cacheHits: 0,
      errors: 0
    });
  }, []);

  return {
    metrics,
    startTimer,
    endTimer,
    incrementApiCalls,
    incrementCacheHits,
    incrementErrors,
    resetMetrics
  };
}

// Lazy Image Loading
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;

    if (imgRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
            };
            img.onerror = () => {
              setIsError(true);
            };
            img.src = src;
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(imgRef.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [src]);

  return {
    imgRef,
    imageSrc,
    isLoaded,
    isError
  };
}

// Component Bundle Analyzer
export const BundleAnalyzer = {
  trackComponentLoad: (componentName: string) => {
    console.log(`Component loaded: ${componentName} at ${Date.now()}`);
    
    // Track in performance API
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`component-${componentName}-loaded`);
    }
  },

  getComponentMetrics: () => {
    if (typeof performance === 'undefined') return [];
    
    return performance
      .getEntriesByType('mark')
      .filter(entry => entry.name.startsWith('component-'))
      .map(entry => ({
        component: entry.name.replace('component-', '').replace('-loaded', ''),
        loadTime: entry.startTime
      }));
  },

  generateReport: () => {
    const metrics = BundleAnalyzer.getComponentMetrics();
    const cacheStats = apiCache.getStats();
    
    return {
      componentMetrics: metrics,
      cacheStats,
      memoryUsage: 'memory' in performance ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      } : null,
      timestamp: new Date().toISOString()
    };
  }
};

// Preload Critical Resources
export function preloadResources(resources: string[]) {
  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    
    if (resource.endsWith('.js')) {
      link.as = 'script';
    } else if (resource.endsWith('.css')) {
      link.as = 'style';
    } else if (resource.match(/\.(jpg|jpeg|png|webp|svg)$/)) {
      link.as = 'image';
    }
    
    document.head.appendChild(link);
  });
}