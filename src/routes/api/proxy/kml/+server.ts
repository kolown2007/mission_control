import type { RequestHandler } from '@sveltejs/kit';
import AdmZip from 'adm-zip';
import { readFile } from 'fs/promises';
import path from 'path';

const CACHE_TTL = 60 * 1000; // 60s cache
const cache = new Map<string, { ts: number; body: string }>();

function getCached(key: string) {
  const rec = cache.get(key);
  if (!rec) return null;
  if (Date.now() - rec.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return rec.body;
}
function setCached(key: string, body: string) {
  cache.set(key, { ts: Date.now(), body });
}

function isProbablyXml(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer).subarray(0, 64);
  const s = new TextDecoder().decode(bytes);
  return s.trim().startsWith('<');
}

function extractKmlFromKmz(buf: Buffer) {
  try {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    const kmlEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('.kml'));
    return kmlEntry ? kmlEntry.getData().toString('utf8') : null;
  } catch (e) {
    return null;
  }
}

function findFirstHref(kmlText: string, base?: string) {
  // find all <href> elements and prefer ones that point to .kml or .kmz
  const re = /<href[^>]*>([^<\s]+)<\/href>/gi;
  let match: RegExpExecArray | null;
  const candidates: string[] = [];
  while ((match = re.exec(kmlText)) !== null) {
    candidates.push(match[1]);
  }

  for (const raw of candidates) {
    // normalize and resolve relative URLs if base provided
    let resolved = raw;
    try {
      if (base) resolved = String(new URL(raw, base));
    } catch (e) {
      // ignore resolution errors and use raw
    }
    const lower = resolved.toLowerCase();
    if (lower.endsWith('.kml') || lower.endsWith('.kmz') || lower.includes('.kml?') || lower.includes('.kmz?')) {
      return resolved;
    }
  }

  // no kml/kmz hrefs found
  return null;
}

async function resolveKmlRecursive(url: string, depth = 0): Promise<string> {
  if (depth > 6) throw new Error('too many redirects/links');
  const cached = getCached(url);
  if (cached) return cached;

  let res;
  try {
    // log fetch attempts for debugging
    console.debug(`[kml-proxy] fetching (${depth})`, url);
    res = await fetch(url);
  } catch (fetchErr: any) {
    console.error('[kml-proxy] fetch error', url, (fetchErr as any)?.stack ?? fetchErr);
    throw new Error(`fetch error for ${url}: ${(fetchErr as any)?.message || String(fetchErr)}`);
  }

  if (!res.ok) {
    const statusText = res.statusText || '';
    // try to read body for more context (best-effort)
    let bodySnippet = '';
    try {
      const txt = await res.text();
      bodySnippet = txt.slice(0, 1024);
    } catch (e) {
      bodySnippet = '<failed to read body>';
    }
    console.error(`[kml-proxy] bad response ${res.status} ${statusText} from ${url} - body:`, bodySnippet.slice(0, 400));
    throw new Error(`fetch failed ${res.status} for ${url}`);
  }

  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  // If content-type suggests text/xml/kml, prefer text path (keeps decoding simple)
  let kmlText: string | null = null;
  try {
    if (contentType.includes('xml') || contentType.includes('kml') || contentType.includes('text')) {
      kmlText = await res.text();
    } else {
      // binary path (KMZ or other) - get arrayBuffer and inspect
      const buf = await res.arrayBuffer();
      if (isProbablyXml(buf)) {
        kmlText = new TextDecoder().decode(buf);
      } else {
        const b = Buffer.from(buf);
        kmlText = extractKmlFromKmz(b);
      }
    }
  } catch (e) {
    console.error('[kml-proxy] error reading response body for', url, (e as any)?.stack ?? e);
    throw new Error(`error reading response for ${url}: ${String(e)}`);
  }

  if (!kmlText) throw new Error('No KML found in response');

  const href = findFirstHref(kmlText, url);
  if (href && href !== url) {
    const final = await resolveKmlRecursive(href, depth + 1);
    setCached(url, final);
    return final;
  }

  setCached(url, kmlText);
  return kmlText;
}

// Limit hosts for safety (can be extended)
const allowedHosts = ['nhc.noaa.gov', 'www.nhc.noaa.gov'];

export const GET: RequestHandler = async ({ url }) => {
  const target = url.searchParams.get('url');
  const local = url.searchParams.get('local');

  // support reading a local file (developer convenience) via ?local=filename.kmz
  if (local) {
    // only allow simple filenames to avoid directory traversal
    if (!/^[\w.\-]+\.(kml|kmz)$/i.test(local)) {
      console.warn('[kml-proxy] invalid local filename', local);
      return new Response('invalid local filename', { status: 400 });
    }
    const filePath = path.resolve(process.cwd(), local);
    console.info('[kml-proxy] reading local file', filePath);
    let buf: Buffer | null = null;
    try {
      buf = await readFile(filePath);
    } catch (e: any) {
      // try static folder as fallback (developer convenience)
      const staticPath = path.resolve(process.cwd(), 'static', local);
      try {
        buf = await readFile(staticPath);
        console.info('[kml-proxy] read local file from static', staticPath);
      } catch (e2: any) {
        console.error('[kml-proxy] failed reading local file', filePath, (e as any)?.stack ?? e);
        console.error('[kml-proxy] also failed reading from static path', staticPath, (e2 as any)?.stack ?? e2);
        return new Response('failed to read local file', { status: 500 });
      }
    }

    // if kml file, return as text
    if (local.toLowerCase().endsWith('.kml')) {
      const txt = Buffer.from(buf).toString('utf8');
      return new Response(txt, { headers: { 'content-type': 'application/vnd.google-earth.kml+xml; charset=utf-8', 'access-control-allow-origin': '*' } });
    }
    // kmz path: extract KML from buffer
    const kmlText = extractKmlFromKmz(Buffer.from(buf));
    if (!kmlText) {
      console.error('[kml-proxy] No KML found inside local KMZ', local);
      return new Response('No KML found in local KMZ', { status: 502 });
    }
    return new Response(kmlText, { headers: { 'content-type': 'application/vnd.google-earth.kml+xml; charset=utf-8', 'access-control-allow-origin': '*' } });
  }

  if (!target) return new Response('missing url', { status: 400 });

  try {
    const parsed = new URL(target);
    if (!allowedHosts.includes(parsed.hostname)) {
      console.warn('[kml-proxy] host not allowed', parsed.hostname);
      return new Response('host not allowed', { status: 403 });
    }
  } catch (e) {
    console.warn('[kml-proxy] invalid url', target, e);
    return new Response('invalid url', { status: 400 });
  }

  try {
    console.info('[kml-proxy] resolving', target);
    const kml = await resolveKmlRecursive(target);
    console.info('[kml-proxy] resolved kml length', kml ? kml.length : 0);
    return new Response(kml, {
      headers: {
        'content-type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'access-control-allow-origin': '*'
      }
    });
  } catch (err: any) {
    // include stack/message to help debugging in dev only
    const msg = String(err?.message || err);
    console.error('[kml-proxy] failed to resolve', target, (err as any)?.stack ?? err);
    return new Response(msg, { status: 502 });
  }
};
