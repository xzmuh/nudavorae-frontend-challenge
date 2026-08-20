import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { applyDelay, clearRules, createRule, deleteRule, listRules, parseChaosRuleInput, resolveChaos } from './chaos.ts';
import { SORTS, categoryFacets, parseCatalogQuery, searchCatalog, toListItem } from './catalog.ts';
import { priceRange, reviewsByServiceId, services, servicesById } from './data.ts';
import { generateImage } from './images.ts';
import { CORS_HEADERS, nextRequestId, readJsonBody, readNumber, readString, sendError, sendJson } from './http.ts';
import type { CatalogMeta, Paginated, Review, ServiceDetail } from './types.ts';

const PORT = Number(process.env['PORT'] ?? 4000);

/** The one fixed token the front-end interceptor attaches to every request. */
const FIXED_TOKEN = 'svc_demo_fixed_token_2026';

const PUBLIC_PATHS = new Set(['/api/health']);

function isAuthorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return false;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token === FIXED_TOKEN;
}

function detailOf(id: string): ServiceDetail | null {
  const service = servicesById.get(id);
  if (service === undefined) return null;
  const { ratingSum, ...rest } = service;
  return { ...rest, ratingAvg: service.ratingCount > 0 ? ratingSum / service.ratingCount : 0 };
}

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasMore: start + slice.length < total,
  };
}

function handleChaosRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  requestId: string,
  body: unknown,
): boolean {
  if (!pathname.startsWith('/api/__chaos')) return false;

  if (req.method === 'GET' && pathname === '/api/__chaos/rules') {
    sendJson(res, 200, { items: listRules() });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/__chaos/rules') {
    const input = parseChaosRuleInput(body);
    if (input === null) {
      sendError(res, 400, 'invalid_rule', 'Rule payload must be a JSON object.', requestId);
      return true;
    }
    sendJson(res, 201, createRule(input, new Date().toISOString()));
    return true;
  }

  if (req.method === 'DELETE' && pathname === '/api/__chaos/rules') {
    clearRules();
    sendJson(res, 200, { cleared: true });
    return true;
  }

  const match = /^\/api\/__chaos\/rules\/([^/]+)$/.exec(pathname);
  if (req.method === 'DELETE' && match?.[1] !== undefined) {
    const removed = deleteRule(match[1]);
    if (!removed) {
      sendError(res, 404, 'rule_not_found', `No chaos rule with id ${match[1]}.`, requestId);
      return true;
    }
    sendJson(res, 200, { deleted: match[1] });
    return true;
  }

  sendError(res, 404, 'not_found', `No chaos route for ${req.method} ${pathname}.`, requestId);
  return true;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const requestId = nextRequestId();
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, services: services.length, requestId });
    return;
  }

  if (!pathname.startsWith('/api/')) {
    sendError(res, 404, 'not_found', `Unknown path ${pathname}.`, requestId);
    return;
  }

  if (!PUBLIC_PATHS.has(pathname) && !isAuthorized(req)) {
    sendError(res, 401, 'unauthorized', 'Missing or invalid bearer token.', requestId);
    return;
  }

  const body = method === 'POST' ? await readJsonBody(req).catch(() => null) : null;

  if (handleChaosRoutes(req, res, pathname, requestId, body)) return;

  // Fault injection is resolved before the handler so a *specific* response can
  // be delayed or forced to fail.
  const chaos = resolveChaos(method, pathname, url.searchParams, req.headers);
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  await applyDelay(chaos.delayMs, controller.signal);
  if (res.writableEnded || controller.signal.aborted) return;

  const chaosHeaders: Record<string, string> = { 'x-request-id': requestId };
  if (chaos.ruleId !== null) chaosHeaders['x-chaos-rule'] = chaos.ruleId;

  if (chaos.status !== null && chaos.status >= 400) {
    sendError(res, chaos.status, 'injected_failure', chaos.message ?? 'Injected failure.', requestId, chaosHeaders);
    return;
  }

  // ---------------------------------------------------------------- route 1
  if (method === 'GET' && pathname === '/api/meta') {
    const meta: CatalogMeta = {
      categories: categoryFacets(),
      priceRange: { minCents: priceRange.minCents, maxCents: priceRange.maxCents },
      sorts: SORTS,
      total: services.length,
    };
    sendJson(res, 200, meta, chaosHeaders);
    return;
  }

  // ---------------------------------------------------------------- route 2
  if (method === 'GET' && pathname === '/api/services') {
    const query = parseCatalogQuery(url.searchParams);
    const result = searchCatalog(query);
    sendJson(res, 200, { ...result, query: { q: query.q, sort: query.sort } }, {
      ...chaosHeaders,
      'x-total-count': String(result.total),
    });
    return;
  }

  const serviceMatch = /^\/api\/services\/([^/]+)$/.exec(pathname);
  const reviewsMatch = /^\/api\/services\/([^/]+)\/reviews$/.exec(pathname);

  // ---------------------------------------------------------------- route 3
  if (method === 'GET' && serviceMatch?.[1] !== undefined) {
    const detail = detailOf(serviceMatch[1]);
    if (detail === null) {
      sendError(res, 404, 'service_not_found', `No service with id ${serviceMatch[1]}.`, requestId, chaosHeaders);
      return;
    }
    const related = services
      .filter((item) => item.category === detail.category && item.id !== detail.id)
      .slice(0, 6)
      .map(toListItem);
    sendJson(res, 200, { service: detail, related }, chaosHeaders);
    return;
  }

  // ---------------------------------------------------------------- route 4
  if (method === 'GET' && reviewsMatch?.[1] !== undefined) {
    const serviceId = reviewsMatch[1];
    if (!servicesById.has(serviceId)) {
      sendError(res, 404, 'service_not_found', `No service with id ${serviceId}.`, requestId, chaosHeaders);
      return;
    }
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '5');
    const all = reviewsByServiceId.get(serviceId) ?? [];
    sendJson(
      res,
      200,
      paginate(all, Number.isFinite(page) ? page : 1, Number.isFinite(pageSize) ? Math.min(20, Math.max(1, pageSize)) : 5),
      chaosHeaders,
    );
    return;
  }

  // ---------------------------------------------------------------- route 5
  if (method === 'POST' && reviewsMatch?.[1] !== undefined) {
    const serviceId = reviewsMatch[1];
    const service = servicesById.get(serviceId);
    if (service === undefined) {
      sendError(res, 404, 'service_not_found', `No service with id ${serviceId}.`, requestId, chaosHeaders);
      return;
    }

    const rating = readNumber(body, 'rating');
    if (rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendError(res, 422, 'invalid_rating', 'Field `rating` must be an integer between 1 and 5.', requestId, chaosHeaders);
      return;
    }

    const comment = readString(body, 'comment') ?? '';
    const authorName = readString(body, 'authorName') ?? 'You';
    const list = reviewsByServiceId.get(serviceId) ?? [];
    const review: Review = {
      id: `rev_${serviceId}_${Date.now().toString(36)}`,
      serviceId,
      authorName,
      authorHandle: 'you.demo',
      authorAvatarImageId: `avatar-${authorName.toLowerCase().replace(/[^a-z]+/g, '-')}-0`,
      rating,
      comment: comment.slice(0, 600),
      createdAt: new Date().toISOString(),
    };

    list.unshift(review);
    reviewsByServiceId.set(serviceId, list);
    service.ratingSum += rating;
    service.ratingCount += 1;

    sendJson(
      res,
      201,
      {
        review,
        ratingAvg: service.ratingSum / service.ratingCount,
        ratingCount: service.ratingCount,
      },
      chaosHeaders,
    );
    return;
  }

  // ---------------------------------------------------------------- route 6
  const imageMatch = /^\/api\/images\/([^/]+)$/.exec(pathname);
  if (method === 'GET' && imageMatch?.[1] !== undefined) {
    const image = generateImage(decodeURIComponent(imageMatch[1]));
    res.writeHead(200, {
      ...CORS_HEADERS,
      ...chaosHeaders,
      'content-type': image.contentType,
      'content-length': Buffer.byteLength(image.body),
      etag: image.etag,
      'cache-control': 'private, max-age=600',
    });
    res.end(image.body);
    return;
  }

  sendError(res, 404, 'not_found', `No route for ${method} ${pathname}.`, requestId, chaosHeaders);
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (!res.headersSent) sendError(res, 500, 'internal_error', message, nextRequestId());
    else res.end();
  });
});

server.listen(PORT, () => {
  process.stdout.write(
    `API ready on http://localhost:${PORT}  (${services.length} services, fixed token: ${FIXED_TOKEN})\n`,
  );
});
