import { createClient } from '@supabase/supabase-js';

export type SupabaseQueryError = {
	name?: string | null;
	code?: string | null;
	message?: string | null;
	details?: string | null;
};

type NavigatorWithConnection = Navigator & {
	connection?: {
		type?: string;
		effectiveType?: string;
		rtt?: number;
		downlink?: number;
		saveData?: boolean;
	};
	mozConnection?: {
		type?: string;
		effectiveType?: string;
		rtt?: number;
		downlink?: number;
		saveData?: boolean;
	};
	webkitConnection?: {
		type?: string;
		effectiveType?: string;
		rtt?: number;
		downlink?: number;
		saveData?: boolean;
	};
};

export type ClientRuntimeContext = {
	timestampIso: string;
	online: boolean | null;
	visibilityState: DocumentVisibilityState | 'unknown';
	hasFocus: boolean | null;
	userAgent: string;
	language: string;
	platform: string;
	connectionType: string | null;
	effectiveType: string | null;
	rttMs: number | null;
	downlinkMbps: number | null;
	saveData: boolean | null;
};

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
		|| blob.includes('aborterror')
		|| blob.includes('operation was aborted')
		|| blob.includes('the user aborted a request')
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
	const namedMessage = maybeError.name
		? maybeError.message
			? `${maybeError.name}: ${maybeError.message}`
			: maybeError.name
		: maybeError.message;
	const parts = [maybeError.code, namedMessage, maybeError.details].filter(Boolean);
	return parts.length > 0 ? parts.join(' | ') : 'error desconocido';
};

export const getClientRuntimeContext = (): ClientRuntimeContext => {
	const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithConnection) : null;
	const doc = typeof document !== 'undefined' ? document : null;
	const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

	return {
		timestampIso: new Date().toISOString(),
		online: typeof navigator !== 'undefined' ? navigator.onLine : null,
		visibilityState: doc?.visibilityState ?? 'unknown',
		hasFocus: doc && typeof doc.hasFocus === 'function' ? doc.hasFocus() : null,
		userAgent: nav?.userAgent ?? 'unknown',
		language: nav?.language ?? 'unknown',
		platform: nav?.platform ?? 'unknown',
		connectionType: connection?.type ?? null,
		effectiveType: connection?.effectiveType ?? null,
		rttMs: typeof connection?.rtt === 'number' ? connection.rtt : null,
		downlinkMbps: typeof connection?.downlink === 'number' ? connection.downlink : null,
		saveData: typeof connection?.saveData === 'boolean' ? connection.saveData : null,
	};
};

export const formatClientRuntimeContext = (context: ClientRuntimeContext): string => {
	const onlineLabel = context.online === null ? 'online=n/d' : `online=${context.online ? 'si' : 'no'}`;
	const focusLabel = context.hasFocus === null ? 'focus=n/d' : `focus=${context.hasFocus ? 'si' : 'no'}`;
	const connectionLabel = context.connectionType ? `conn=${context.connectionType}` : 'conn=n/d';
	const effectiveTypeLabel = context.effectiveType ? `net=${context.effectiveType}` : 'net=n/d';
	const rttLabel = context.rttMs === null ? 'rtt=n/d' : `rtt=${context.rttMs}ms`;
	const downlinkLabel = context.downlinkMbps === null ? 'downlink=n/d' : `downlink=${context.downlinkMbps}Mbps`;
	const saveDataLabel = context.saveData === null ? 'saveData=n/d' : `saveData=${context.saveData ? 'si' : 'no'}`;

	return [
		`ts=${context.timestampIso}`,
		onlineLabel,
		`visibility=${context.visibilityState}`,
		focusLabel,
		connectionLabel,
		effectiveTypeLabel,
		rttLabel,
		downlinkLabel,
		saveDataLabel,
		`lang=${context.language}`,
		`platform=${context.platform}`,
	].join(' | ');
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
	const maxAttempts = canRetry ? 3 : 1;
	const { signal: requestSignal, ...initWithoutSignal } = init ?? {};

	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const nextInit = canRetry && attempt > 1 && requestSignal ? initWithoutSignal : init;
			const response = await fetch(input, nextInit);
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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	global: {
		fetch: fetchWithRetry,
	},
});
