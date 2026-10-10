export class ApiError extends Error {
    constructor(message: string, readonly code = 'INTERNAL', readonly details: readonly {
        path: string;
        message: string;
    }[] = []) {
        super(message);
    }
}
/** No ownership input: the browser supplies its HttpOnly same-origin Cookie. */
export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
        const options = { method, credentials: 'same-origin' as const, cache: 'no-store' as const, ...(signal ? { signal } : {}), ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
        response = await fetch(`/api${path}`, options);
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
            throw error;
        throw new ApiError('通信できませんでした。接続を確認して再試行してください。', 'NETWORK');
    }
    if (response.status === 204) {
        if (method === 'DELETE' && !(typeof body === 'object' && body !== null && 'website' in body && body.website))
            return undefined as T;
        throw new ApiError('送信は受け付けられませんでした。入力内容を確認してください。', 'DISCARDED');
    }
    let payload: unknown;
    try {
        payload = await response.json();
    }
    catch {
        throw new ApiError('応答を読み取れませんでした。再試行してください。');
    }
    if (!response.ok) {
        const error = (payload as {
            error?: {
                message?: string;
                code?: string;
                details?: {
                    path: string;
                    message: string;
                }[];
            };
        })?.error;
        throw new ApiError(error?.message ?? '処理できませんでした。再試行してください。', error?.code, error?.details);
    }
    if (typeof payload !== 'object' || payload === null || !('data' in payload))
        throw new ApiError('応答の形式が不正です。');
    return (payload as {
        data: T;
    }).data;
}
