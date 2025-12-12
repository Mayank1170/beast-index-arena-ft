const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 2000;
/**
 * Retry helper with exponential backoff for RPC calls
 * Automatically handles rate limiting (429 errors) and account not found errors
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    delay = INITIAL_RETRY_DELAY
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        // Check if it's a rate limit error
        const isRateLimit = error?.message?.includes('429') ||
            error?.code === 429 ||
            error?.message?.includes('Too many requests');

        // Check if account doesn't exist
        const isAccountNotFound = error?.message?.includes('Account does not exist') ||
            error?.message?.includes('could not find account');

        if (isAccountNotFound) {
            throw error;
        }

        if (retries > 0 && isRateLimit) {
            console.warn(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * 2); // Exponential backoff
        }

        throw error;
    }
}
