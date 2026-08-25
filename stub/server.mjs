import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4010);
const TOKEN = 'nud_demo_7f3c';
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

const packs = JSON.parse(readFileSync(join(here, 'packs.seed.json'), 'utf8'));
const byId = new Map(packs.map((p) => [p.id, p]));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...CORS,
    ...extraHeaders,
  });
  res.end(payload);
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function summarise(pack) {
  const entries = Object.entries(pack.distribution);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  if (total === 0) return { rating: null, review_count: 0 };
  const sum = entries.reduce((n, [score, c]) => n + Number(score) * c, 0);
  return {
    rating: (Math.round((sum / total) * 10) / 10).toFixed(1),
    review_count: total,
  };
}

const card = (pack) => ({
  id: pack.id,
  title: pack.title,
  creator_handle: pack.creator_handle,
  price_cents: pack.price_cents,
  cover_media_id: pack.cover_media_id,
  ...summarise(pack),
});

const detail = (pack) => ({
  ...card(pack),
  description: pack.description,
  distribution: { ...pack.distribution },
  created_at: pack.created_at,
});

function fingerprint(q, sort) {
  let h = 2166136261;
  for (const ch of `${q}|${sort}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const encodeCursor = (offset, fp) => Buffer.from(`${offset}.${fp}`, 'utf8').toString('base64url');

function decodeCursor(cursor, fp) {
  let decoded;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return { error: 'malformed' };
  }
  const [offset, cursorFp] = decoded.split('.');
  if (cursorFp === undefined || !/^\d+$/.test(offset)) return { error: 'malformed' };
  if (cursorFp !== fp) return { error: 'stale' };
  return { offset: Number(offset) };
}

function listPacks(url, res) {
  const q = (url.searchParams.get('q') ?? '').trim();
  const sort = url.searchParams.get('sort') ?? 'newest';
  const cursor = url.searchParams.get('cursor');

  const SORTS = ['newest', 'price_asc', 'price_desc', 'rating'];
  if (!SORTS.includes(sort)) {
    return fail(res, 400, 'invalid_sort', `sort must be one of ${SORTS.join(', ')}.`);
  }

  let limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  if (url.searchParams.get('empty') === '1') {
    return send(res, 200, { items: [], next_cursor: null });
  }

  const needle = q.toLowerCase();
  let matched = packs.filter(
    (p) =>
      needle === '' ||
      p.title.toLowerCase().includes(needle) ||
      p.creator_handle.toLowerCase().includes(needle),
  );

  matched = [...matched].sort((a, b) => {
    if (sort === 'price_asc') return a.price_cents - b.price_cents || a.id.localeCompare(b.id);
    if (sort === 'price_desc') return b.price_cents - a.price_cents || a.id.localeCompare(b.id);
    if (sort === 'rating') {
      const ra = Number(summarise(a).rating ?? -1);
      const rb = Number(summarise(b).rating ?? -1);
      return rb - ra || a.id.localeCompare(b.id);
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  });

  const fp = fingerprint(q, sort);
  let offset = 0;

  if (cursor !== null) {
    const decoded = decodeCursor(cursor, fp);
    if (decoded.error === 'malformed') {
      return fail(res, 400, 'invalid_cursor', 'That cursor could not be read.');
    }
    if (decoded.error === 'stale') {
      return fail(
        res,
        400,
        'invalid_cursor',
        'That cursor was issued for a different query and is no longer valid.',
      );
    }
    offset = decoded.offset;
  }

  const items = matched.slice(offset, offset + limit).map(card);
  const nextOffset = offset + items.length;
  const next_cursor = nextOffset < matched.length ? encodeCursor(nextOffset, fp) : null;

  send(res, 200, { items, next_cursor });
}

function getPack(id, res) {
  const pack = byId.get(id);
  if (pack === undefined) return fail(res, 404, 'pack_not_found', 'No pack with that id.');
  send(res, 200, detail(pack));
}

function getReviews(id, url, res) {
  const pack = byId.get(id);
  if (pack === undefined) return fail(res, 404, 'pack_not_found', 'No pack with that id.');

  const body = {
    items: url.searchParams.get('empty') === '1' ? [] : pack.reviews,
    can_review: pack.can_review,
    ...summarise(pack),
  };
  if (!pack.can_review) body.reason = pack.reason;

  send(res, 200, body);
}

async function postReview(id, req, res) {
  const pack = byId.get(id);
  if (pack === undefined) return fail(res, 404, 'pack_not_found', 'No pack with that id.');

  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    return fail(res, 400, 'malformed_body', 'The request body was not valid JSON.');
  }

  const { score, body } = parsed ?? {};
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return fail(res, 422, 'invalid_score', 'Score must be a whole number from 1 to 5.');
  }
  if (typeof body !== 'string' || body.trim() === '') {
    return fail(res, 422, 'empty_body', 'A review needs some text.');
  }

  if (!pack.can_review) {
    const messages = {
      already_reviewed: 'You have already reviewed this pack.',
      not_purchased: 'You can only review a pack you have bought.',
      pack_removed: 'This pack has been removed and can no longer be reviewed.',
    };
    return fail(res, 409, pack.reason, messages[pack.reason]);
  }

  pack.distribution[score] += 1;
  pack.reviews = [
    {
      id: `rev_local_${Date.now()}`,
      author_handle: 'you',
      score,
      body,
      created_at: new Date().toISOString(),
    },
    ...pack.reviews,
  ];
  pack.can_review = false;
  pack.reason = 'already_reviewed';

  send(res, 201, summarise(pack));
}

function getMedia(id, res) {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640" role="img">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 52% 42%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 48) % 360} 46% 28%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#g)"/>
  <circle cx="${160 + (h % 320)}" cy="${200 + ((h >>> 8) % 240)}" r="${80 + (h % 90)}"
          fill="#ffffff" fill-opacity="0.10"/>
  <text x="320" y="600" text-anchor="middle" font-family="monospace" font-size="26"
        fill="#ffffff" fill-opacity="0.62">${id}</text>
</svg>`;

  res.writeHead(200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(svg),
    'Cache-Control': 'private, max-age=300',
    ...CORS,
  });
  res.end(svg);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const delay = Number(url.searchParams.get('delay') ?? 0);
  if (Number.isFinite(delay) && delay > 0) await sleep(Math.min(delay, 30_000));

  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return fail(res, 401, 'unauthorized', 'Every request carries the bearer token from the brief.');
  }

  const failWith = Number(url.searchParams.get('fail') ?? 0);
  if (Number.isInteger(failWith) && failWith >= 400 && failWith <= 599) {
    return fail(
      res,
      failWith,
      'forced_failure',
      `The stub was asked for a ${failWith} and is obliging.`,
    );
  }

  if (req.method === 'GET' && path === '/packs') return listPacks(url, res);

  const reviewsMatch = path.match(/^\/packs\/([^/]+)\/reviews$/);
  if (reviewsMatch) {
    if (req.method === 'GET') return getReviews(reviewsMatch[1], url, res);
    if (req.method === 'POST') return postReview(reviewsMatch[1], req, res);
  }

  const packMatch = path.match(/^\/packs\/([^/]+)$/);
  if (packMatch && req.method === 'GET') return getPack(packMatch[1], res);

  const mediaMatch = path.match(/^\/media\/([^/]+)$/);
  if (mediaMatch && req.method === 'GET') return getMedia(mediaMatch[1], res);

  fail(res, 404, 'no_such_route', `${req.method} ${path} is not part of the contract.`);
});

server.listen(PORT, () => {
  console.log(`stub listening on http://localhost:${PORT}  (${packs.length} packs)`);
  console.log(`levers: ?delay=<ms>  ?fail=<status>  ?empty=1`);
});
