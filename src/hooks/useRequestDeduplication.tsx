import { useRef, useCallback } from 'react';

/**
 * Hook to prevent duplicate API requests
 */
export const useRequestDeduplication = () => {
  const activeRequests = useRef<Set<string>>(new Set());

  const executeRequest = useCallback(async <T,>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    // If request is already in progress, wait for it to complete
    if (activeRequests.current.has(key)) {
      // Return a promise that resolves when the active request completes
      return new Promise<T>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!activeRequests.current.has(key)) {
            clearInterval(checkInterval);
            // Re-execute the request since we don't have the original result
            executeRequest(key, requestFn).then(resolve).catch(reject);
          }
        }, 100);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Request timeout'));
        }, 30000);
      });
    }

    // Mark request as active
    activeRequests.current.add(key);

    try {
      const result = await requestFn();
      return result;
    } finally {
      // Remove from active requests
      activeRequests.current.delete(key);
    }
  }, []);

  return { executeRequest };
};