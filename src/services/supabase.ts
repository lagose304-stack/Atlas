import { createClient } from '@supabase/supabase-js';

export type SupabaseQueryError = {
	code?: string | null;
	message?: string | null;
	details?: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const wait = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});

export const isLikelyTransientNetworkError = (error: SupabaseQueryError | null | undefined): boolean => {
	const blob = `${error?.code ?? ''} ${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
	return (
		blob.includes('failed to fetch')
		|| blob.includes('networkerror')
		|| blob.includes('network request failed')
		|| blob.includes('load failed')
		|| blob.includes('fetch failed')
		|| blob.includes('etimedout')
		|| blob.includes('econnreset')
		|| blob.includes('enotfound')
	);
};

export const describeSupabaseError = (error: unknown): string => {
	if (!error || typeof error !== 'object') {
		return 'error desconocido';
	}

	const maybeError = error as SupabaseQueryError;
	const parts = [maybeError.code, maybeError.message, maybeError.details].filter(Boolean);
	return parts.length > 0 ? parts.join(' | ') : 'error desconocido';
};

const isRetryableHttpStatus = (status: number): boolean => {
	return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

const getMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
	if (init?.method) {
		return init.method.toUpperCase();
	}
	if (input instanceof Request) {
		return input.method.toUpperCase();
	}
	return 'GET';
};

const fetchWithRetry: typeof fetch = async (input, init) => {
	const method = getMethod(input, init);
	const canRetry = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
	const maxAttempts = canRetry ? 2 : 1;

	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetch(input, init);
			if (canRetry && attempt < maxAttempts && isRetryableHttpStatus(response.status)) {
				await wait(350 * attempt);
				continue;
			}
			return response;
		} catch (error) {
			lastError = error;
			const retryable = attempt < maxAttempts && isLikelyTransientNetworkError(error as SupabaseQueryError);
			if (!retryable) {
				throw error;
			}
			await wait(350 * attempt);
		}
	}

	throw lastError instanceof Error ? lastError : new Error('fetch failed');
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	global: {
		fetch: fetchWithRetry,
	},
});
