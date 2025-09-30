import { useRef, useCallback } from 'react';

/**
 * Hook to prevent duplicate API requests by caching the promise of in-flight requests.
 * This is more efficient than polling and allows the caller to implement their own timeout logic.
 */
export const useRequestDeduplication = () => {
  // Use a Map to store the promise of the in-flight request.
  const activeRequests = useRef<Map<string, Promise<any>>>(new Map());

  const executeRequest = useCallback(async <T,>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    // If a request with the same key is already in progress, return its promise.
    const existingRequest = activeRequests.current.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    // Otherwise, execute the new request.
    const newRequestPromise = requestFn().finally(() => {
      // Once the request is complete (either resolved or rejected),
      // remove it from the active requests map. This allows subsequent calls to re-trigger the request.
      activeRequests.current.delete(key);
    });

    // Store the new request promise in the map.
    activeRequests.current.set(key, newRequestPromise);

    return newRequestPromise;
  }, []);

  return { executeRequest };
};