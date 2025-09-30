/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap.
 * @param ms The timeout duration in milliseconds.
 * @param timeoutError The error to throw on timeout.
 * @returns A new promise that rejects on timeout.
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error('Operation timed out')
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(timeoutError);
    }, ms);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timeoutId);
      });
  });
};