import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiErrorBody } from './types.ts';

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-chaos-delay,x-chaos-status',
  'access-control-expose-headers': 'x-request-id,x-chaos-rule,x-total-count',
  'access-control-max-age': '600',
};

let requestCounter = 0;

export function nextRequestId(): string {
  requestCounter += 1;
  return `req_${requestCounter.toString(36)}`;
}

export function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    ...extraHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): void {
  const payload: ApiErrorBody = { error: { code, message, requestId } };
  sendJson(res, status, payload, extraHeaders);
}

export async function readJsonBody(req: IncomingMessage, limitBytes = 32_768): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.byteLength;
    if (size > limitBytes) throw new Error('payload too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) return null;
  return JSON.parse(raw) as unknown;
}

export function readString(source: unknown, key: string): string | null {
  if (typeof source !== 'object' || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export function readNumber(source: unknown, key: string): number | null {
  if (typeof source !== 'object' || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
