import { setTimeout as delay } from 'node:timers/promises';

/**
 * Fault injection. Two independent mechanisms:
 *
 * 1. Per request  -> `?_delay=2000&_status=500` (or the `x-chaos-delay` /
 *    `x-chaos-status` headers) affect exactly that one call.
 * 2. Rules        -> registered through `/api/__chaos/rules`, they target a
 *    *specific* response (method + path + query match), which is what makes
 *    the "make `q=sor` slow, keep `q=sorvete` fast" scenario reproducible.
 */

export type MatchMode = 'equals' | 'contains' | 'startsWith';

export interface ChaosRule {
  id: string;
  label: string;
  method: string | null;
  pathContains: string | null;
  queryMatch: Record<string, string>;
  matchMode: MatchMode;
  delayMs: number;
  status: number | null;
  message: string | null;
  remaining: number | null;
  hits: number;
  createdAt: string;
}

export interface ChaosRuleInput {
  label?: string;
  method?: string;
  pathContains?: string;
  queryMatch?: Record<string, string>;
  matchMode?: MatchMode;
  delayMs?: number;
  status?: number;
  message?: string;
  times?: number;
}

export interface ChaosOutcome {
  delayMs: number;
  status: number | null;
  message: string | null;
  ruleId: string | null;
}

const rules = new Map<string, ChaosRule>();
let ruleCounter = 0;

function isMatchMode(value: unknown): value is MatchMode {
  return value === 'equals' || value === 'contains' || value === 'startsWith';
}

function toStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') out[key] = raw;
  }
  return out;
}

export function parseChaosRuleInput(body: unknown): ChaosRuleInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const source = body as Record<string, unknown>;
  const input: ChaosRuleInput = {};

  if (typeof source['label'] === 'string') input.label = source['label'];
  if (typeof source['method'] === 'string') input.method = source['method'];
  if (typeof source['pathContains'] === 'string') input.pathContains = source['pathContains'];
  if (source['queryMatch'] !== undefined) input.queryMatch = toStringRecord(source['queryMatch']);
  if (isMatchMode(source['matchMode'])) input.matchMode = source['matchMode'];
  if (typeof source['delayMs'] === 'number' && Number.isFinite(source['delayMs'])) {
    input.delayMs = Math.max(0, Math.min(60_000, Math.trunc(source['delayMs'])));
  }
  if (typeof source['status'] === 'number' && Number.isFinite(source['status'])) {
    input.status = Math.max(100, Math.min(599, Math.trunc(source['status'])));
  }
  if (typeof source['message'] === 'string') input.message = source['message'];
  if (typeof source['times'] === 'number' && Number.isFinite(source['times'])) {
    input.times = Math.max(1, Math.trunc(source['times']));
  }

  return input;
}

export function createRule(input: ChaosRuleInput, createdAt: string): ChaosRule {
  ruleCounter += 1;
  const rule: ChaosRule = {
    id: `chaos_${ruleCounter}`,
    label: input.label ?? 'unnamed rule',
    method: input.method ? input.method.toUpperCase() : null,
    pathContains: input.pathContains ?? null,
    queryMatch: input.queryMatch ?? {},
    matchMode: input.matchMode ?? 'equals',
    delayMs: input.delayMs ?? 0,
    status: input.status ?? null,
    message: input.message ?? null,
    remaining: input.times ?? null,
    hits: 0,
    createdAt,
  };
  rules.set(rule.id, rule);
  return rule;
}

export function listRules(): ChaosRule[] {
  return [...rules.values()];
}

export function deleteRule(id: string): boolean {
  return rules.delete(id);
}

export function clearRules(): void {
  rules.clear();
}

function queryMatches(rule: ChaosRule, params: URLSearchParams): boolean {
  for (const [key, expected] of Object.entries(rule.queryMatch)) {
    const actual = params.get(key) ?? '';
    if (rule.matchMode === 'equals' && actual !== expected) return false;
    if (rule.matchMode === 'contains' && !actual.includes(expected)) return false;
    if (rule.matchMode === 'startsWith' && !actual.startsWith(expected)) return false;
  }
  return true;
}

function readNumberParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function resolveChaos(
  method: string,
  pathname: string,
  params: URLSearchParams,
  headers: Record<string, string | string[] | undefined>,
): ChaosOutcome {
  const outcome: ChaosOutcome = { delayMs: 0, status: null, message: null, ruleId: null };

  const headerDelay = headers['x-chaos-delay'];
  const headerStatus = headers['x-chaos-status'];

  const perRequestDelay = readNumberParam(params, '_delay')
    ?? (typeof headerDelay === 'string' ? Number(headerDelay) : null);
  const perRequestStatus = readNumberParam(params, '_status')
    ?? (typeof headerStatus === 'string' ? Number(headerStatus) : null);

  if (perRequestDelay !== null && Number.isFinite(perRequestDelay)) {
    outcome.delayMs = Math.max(0, Math.min(60_000, Math.trunc(perRequestDelay)));
  }
  if (perRequestStatus !== null && Number.isFinite(perRequestStatus)) {
    outcome.status = Math.max(100, Math.min(599, Math.trunc(perRequestStatus)));
    outcome.message = 'Injected failure (per-request `_status`)';
  }

  for (const rule of rules.values()) {
    if (rule.remaining !== null && rule.remaining <= 0) continue;
    if (rule.method !== null && rule.method !== method.toUpperCase()) continue;
    if (rule.pathContains !== null && !pathname.includes(rule.pathContains)) continue;
    if (!queryMatches(rule, params)) continue;

    rule.hits += 1;
    if (rule.remaining !== null) rule.remaining -= 1;
    outcome.ruleId = rule.id;
    outcome.delayMs = Math.max(outcome.delayMs, rule.delayMs);
    if (rule.status !== null) {
      outcome.status = rule.status;
      outcome.message = rule.message ?? `Injected failure (rule ${rule.id})`;
    }
    break;
  }

  return outcome;
}

/**
 * Artificial latency requested by the challenge. Promise-based timer from
 * `node:timers/promises` -- it is the delay itself, never a workaround for a
 * race condition.
 */
export async function applyDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  try {
    await delay(ms, undefined, signal ? { signal } : undefined);
  } catch {
    // client aborted while we were holding the response back
  }
}
