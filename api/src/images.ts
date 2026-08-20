/**
 * Private media. Deterministic SVG art generated from the image id -- no CDN,
 * no avatar service, no external asset of any kind.
 */

export interface GeneratedImage {
  contentType: string;
  body: string;
  etag: string;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sequence(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function initialsFrom(id: string): string {
  const parts = id
    .replace(/^avatar-/, '')
    .split('-')
    .filter((part) => part.length > 0 && !/^\d+$/.test(part));
  const first = parts[0]?.[0] ?? 'S';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? 'v';
  return `${first}${second}`.toUpperCase();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function avatarSvg(id: string): string {
  const seed = hash(id);
  const hue = seed % 360;
  const initials = escapeXml(initialsFrom(id));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 68% 62%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 48) % 360} 72% 44%)"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g)"/>
  <text x="64" y="64" text-anchor="middle" dominant-baseline="central"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="48" font-weight="600"
        fill="rgba(12,10,20,0.86)">${initials}</text>
</svg>`;
}

/** Curated hues so covers stay in the product's palette instead of rainbowing. */
const COVER_HUES = [258, 268, 282, 232, 212, 196, 312, 244];

function coverSvg(id: string): string {
  const seed = hash(id);
  const rand = sequence(seed);
  const baseHue = COVER_HUES[seed % COVER_HUES.length] ?? 258;
  const hue = (baseHue + Math.floor(rand() * 12) - 6 + 360) % 360;
  const hueB = (hue + 18 + Math.floor(rand() * 24)) % 360;
  const blobs = Array.from({ length: 4 }, (_, index) => {
    const cx = Math.round(rand() * 640);
    const cy = Math.round(rand() * 420);
    const r = 90 + Math.round(rand() * 190);
    const blobHue = (hue + index * 14 - 14 + 360) % 360;
    const opacity = (0.14 + rand() * 0.2).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${blobHue} 62% 52%)" opacity="${opacity}"/>`;
  }).join('\n    ');

  const bars = Array.from({ length: 7 }, (_, index) => {
    const x = 44 + index * 82;
    const h = 26 + Math.round(rand() * 150);
    const y = 400 - h;
    return `<rect x="${x}" y="${y}" width="34" height="${h}" rx="10" fill="rgba(255,255,255,0.10)"/>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 44% 16%)"/>
      <stop offset="100%" stop-color="hsl(${hueB} 50% 8%)"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="52"/>
    </filter>
  </defs>
  <rect width="640" height="420" fill="url(#bg)"/>
  <g filter="url(#soft)">
    ${blobs}
  </g>
  <g opacity="0.55">
    ${bars}
  </g>
  <rect width="640" height="420" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
</svg>`;
}

export function generateImage(id: string): GeneratedImage {
  const body = id.startsWith('avatar-') ? avatarSvg(id) : coverSvg(id);
  return {
    contentType: 'image/svg+xml; charset=utf-8',
    body,
    etag: `"img-${hash(id).toString(16)}"`,
  };
}
