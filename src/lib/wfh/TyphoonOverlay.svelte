<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  // default to a local KMZ file served via the proxy for convenience
  const DEFAULT_KML = '/api/proxy/kml?local=wp3225.kmz';
  export let kmlUrl: string = DEFAULT_KML;
  const dispatch = createEventDispatcher();

  // debug state
  let rawKml: string | null = null;
  let parseError: string | null = null;
  let showDebug = false;

  // parse KML into GeoJSON features: LineStrings (tracks) and Points (placemarks)
  function parseKmlToGeoFeatures(kmlText: string, refDate: Date = new Date()) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, 'application/xml');

    const lineFeatures: any[] = [];
    const pointFeatures: any[] = [];
    const radiusDefs: any[] = []; // { kt, center: [lon,lat], radius_km }

    // helper: haversine distance in km
    const haversine = (lon1: number, lat1: number, lon2: number, lat2: number) => {
      const toRad = (v: number) => v * Math.PI / 180;
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // parse Placemark elements so we can handle Points and Polygons (wind radii) in context
    const placemarks = Array.from(doc.querySelectorAll('Placemark'));
    for (const pm of placemarks) {
      try {
        const nameEl = pm.querySelector('name');
        const name = nameEl?.textContent?.trim() ?? null;
        const descEl = pm.querySelector('description');
        const description = descEl?.textContent?.trim() ?? null;

        // Time: prefer TimeStamp/when, then TimeSpan/begin/end
        // refDate is used to expand shorthand tokens like '09/00Z' into a full UTC timestamp
        let time: string | null = null;
        const whenEl = pm.querySelector('TimeStamp > when') || pm.querySelector('when');
        if (whenEl?.textContent) {
          const w = whenEl.textContent.trim();
          // try to parse ISO-like times; if parseable, keep ISO string
          const d = new Date(w);
          if (!isNaN(d.getTime())) time = d.toISOString();
          else time = w;
        } else {
          const beginEl = pm.querySelector('TimeSpan > begin');
          if (beginEl?.textContent) {
            const d = new Date(beginEl.textContent.trim());
            time = !isNaN(d.getTime()) ? d.toISOString() : beginEl.textContent.trim();
          }
        }

        // helper to parse shorthand tokens like '09/00Z' (day/hour Z) into a full ISO UTC time
        const parseDdHhZ = (token: string, ref: Date): string | null => {
          const m = String(token).match(/\b(\d{1,2})\/(\d{1,2})Z\b/i);
          if (!m) return null;
          const day = Number(m[1]);
          const hour = Number(m[2]);
          if (!Number.isFinite(day) || !Number.isFinite(hour)) return null;
          // start with same month/year as ref
          const yr = ref.getUTCFullYear();
          const mon = ref.getUTCMonth();
          let cand = new Date(Date.UTC(yr, mon, day, hour, 0, 0));
          // adjust month if candidate is far from reference (handle month boundary)
          const diffDays = (cand.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 15) {
            // candidate is in the next month compared to ref; try previous month
            cand = new Date(Date.UTC(yr, mon - 1, day, hour, 0, 0));
          } else if (diffDays < -15) {
            // candidate is in the previous month compared to ref; try next month
            cand = new Date(Date.UTC(yr, mon + 1, day, hour, 0, 0));
          }
          return isNaN(cand.getTime()) ? null : cand.toISOString();
        };

        // extract wind speed (look in name or description)
        let wind_kts: number | null = null;
        const windRegex = /(\d{1,3})\s*(?:KTS|kts|KTS|knots|KTS|KT)\b|(?:WINDS?\s*)(\d{1,3})\s*(?:KTS|kts|knots|KT)/i;
        const combinedText = (name ?? '') + ' ' + (description ?? '');
        const wmatch = combinedText.match(/(\d{1,3})\s*(?:KTS|kts|knots|KT)\b/i) || combinedText.match(/WINDS?\s*(\d{1,3})/i);
        if (wmatch) {
          const num = Number(wmatch[1] ?? wmatch[2]);
          if (!isNaN(num)) wind_kts = num;
        }
        const wind_kph = wind_kts != null ? Math.round(wind_kts * 1.852) : null;

        // Point coordinates
        const pt = pm.querySelector('Point > coordinates');
        if (pt?.textContent) {
          const txt = pt.textContent.trim();
          const [lonS, latS] = txt.split(',');
          const lon = Number(lonS);
          const lat = Number(latS);
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            const props: any = { name, description };
            if (time) props.time = time;
            // if time is missing or not a full ISO timestamp, try to find shorthand tokens like '09/00Z' in name/description
            if (!props.time || isNaN(new Date(props.time).getTime())) {
              const combined = (name ?? '') + ' ' + (description ?? '');
              const shortMatch = combined.match(/\b\d{1,2}\/\d{1,2}Z\b/i);
              if (shortMatch) {
                const parsed = parseDdHhZ(shortMatch[0], refDate);
                if (parsed) props.time = parsed;
              }
            }
            if (wind_kts != null) props.wind_kts = wind_kts;
            if (wind_kph != null) props.wind_kph = wind_kph;
            // create a human-friendly label that shows wind in kph when available
            let displayLabel = name ?? description ?? null;
            if (wind_kph != null) {
              try {
                // replace occurrences like '105 KTS' with '193 km/h' (rounded)
                const replaced = String(displayLabel).replace(/(\d{1,3})\s*(?:KTS|kts|knots|KT)\b/gi, (_, n) => `${Math.round(Number(n) * 1.852)} km/h`);
                // if the name/description didn't contain a KTS mention, append the km/h value
                displayLabel = (replaced && replaced !== String(displayLabel)) ? replaced : `${displayLabel ?? ''} ${wind_kph} km/h`.trim();
              } catch (e) {
                displayLabel = `${displayLabel ?? ''} ${wind_kph} km/h`.trim();
              }
            }
            if (displayLabel) props.label = displayLabel;
            props.tag = /TAU\s|\b(\d{2}\/\d{2}Z)\b/i.test(name ?? description ?? '') ? 'forecast' : 'observed';
            pointFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
          }
        }

        // Polygon / LinearRing coordinates (wind radii) - capture as radius definitions instead of dispatching full polygons
        const ring = pm.querySelector('LinearRing > coordinates') || pm.querySelector('Polygon > outerBoundaryIs > LinearRing > coordinates');
        if (ring?.textContent) {
          const txt = ring.textContent.trim();
          const coords = txt.split(/\s+/).map((pair) => {
            const parts = pair.split(',').map(Number);
            return { lon: parts[0], lat: parts[1] };
          }).filter(c => Number.isFinite(c.lon) && Number.isFinite(c.lat));
          if (coords.length) {
            // compute centroid (simple average)
            const cx = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
            const cy = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
            // compute max distance from centroid in km
            const distances = coords.map(c => haversine(cx, cy, c.lon, c.lat));
            const maxKm = Math.max(...distances);
            // detect kt from name like 'RADIUS OF 34 KT'
            const m = String(name).match(/RADIUS OF\s*(\d{1,3})\s*KT/i);
            const kt = m ? Number(m[1]) : null;
            radiusDefs.push({ kt, center: [cx, cy], radius_km: maxKm, name });
          }
        }
      } catch (err) {
        // continue on parse errors per placemark
        continue;
      }
    }

  // attach radius info heuristically to nearby point features (observed center)
  for (const pf of pointFeatures) {
      const [plon, plat] = pf.geometry.coordinates;
      // find nearest radiusDef center
      let best: any = null;
      let bestDist = Infinity;
      for (const rd of radiusDefs) {
        const d = haversine(plon, plat, rd.center[0], rd.center[1]);
        if (d < bestDist) { bestDist = d; best = rd; }
      }
      // if radius center is reasonably close (< 200 km), attach radius
      if (best && bestDist < 200) {
        pf.properties.radius_km = best.radius_km;
        pf.properties.radius_kt = best.kt;
      }

      // If no radius attached, but there are lineFeatures around, we could compute from lineFeatures bbox — skip for now
    }
    // prefer to choose a single canonical current point:
    // 1) try to find the most recent observed placemark (tag === 'observed') with a timestamp <= now
    // 2) else fallback to interpolated position between timed placemarks
    try {
      // clear any existing isCurrent flags
      for (const pf of pointFeatures) {
        if (pf.properties) pf.properties.isCurrent = !!pf.properties.isCurrent;
      }

      const now = new Date();
      const observedWithTime = pointFeatures
        .filter(p => p.properties?.tag === 'observed' && p.properties?.time)
        .map(p => ({ f: p, t: new Date(p.properties.time) }))
        .filter(x => x.t instanceof Date && !isNaN(x.t.getTime()))
        .sort((a, b) => b.t.getTime() - a.t.getTime()); // newest first

      if (observedWithTime.length) {
        // pick the newest observed point (prefer one with time <= now if available)
        let chosen = observedWithTime.find(x => x.t.getTime() <= now.getTime()) || observedWithTime[0];
        if (chosen) {
          chosen.f.properties = { ...(chosen.f.properties || {}), isCurrent: true };
          // dispatch current feature for external consumers
          try { dispatch('current', chosen.f); } catch (e) {}
        }
      } else {
        // fallback: build points with times and interpolate
        const ptsWithTime = pointFeatures
          .map(p => ({ f: p, t: p.properties?.time ? new Date(p.properties.time) : null }))
          .filter(x => x.t instanceof Date && !isNaN(x.t.getTime()))
          .sort((a, b) => (a.t!.getTime() - b.t!.getTime()));
        if (ptsWithTime.length) {
          // find bracketing points
          let prev = ptsWithTime[0];
          let next = null;
          for (let i = 0; i < ptsWithTime.length; i++) {
            if (ptsWithTime[i].t!.getTime() <= now.getTime()) prev = ptsWithTime[i];
            if (ptsWithTime[i].t!.getTime() > now.getTime()) { next = ptsWithTime[i]; break; }
          }

          let currentFeature = null;
          if (!next) {
            // now is after last known point: use last point as current
            currentFeature = { ...prev.f };
            currentFeature.properties = { ...(currentFeature.properties || {}), isCurrent: true };
          } else if (!prev || prev.t!.getTime() === next.t!.getTime()) {
            // use next as current
            currentFeature = { ...next.f };
            currentFeature.properties = { ...(currentFeature.properties || {}), isCurrent: true };
          } else {
            // interpolate
            const t0 = prev.t!.getTime();
            const t1 = next.t!.getTime();
            const frac = (now.getTime() - t0) / (t1 - t0);
            const [lon0, lat0] = prev.f.geometry.coordinates;
            const [lon1, lat1] = next.f.geometry.coordinates;
            const ilon = lon0 + (lon1 - lon0) * frac;
            const ilat = lat0 + (lat1 - lat0) * frac;
            const wk0 = prev.f.properties?.wind_kph ?? (prev.f.properties?.wind_kts != null ? Math.round(prev.f.properties.wind_kts * 1.852) : null);
            const wk1 = next.f.properties?.wind_kph ?? (next.f.properties?.wind_kts != null ? Math.round(next.f.properties.wind_kts * 1.852) : null);
            const iwk = (wk0 != null && wk1 != null) ? Math.round(wk0 + (wk1 - wk0) * frac) : (wk0 ?? wk1 ?? null);
            const props: any = { isCurrent: true, interpolatedFrom: prev.f.properties?.name ?? null, interpolatedTo: next.f.properties?.name ?? null, interpolatedFraction: frac };
            if (iwk != null) props.wind_kph = iwk;
            props.time = now.toISOString();
            currentFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [ilon, ilat] }, properties: props };
          }

          if (currentFeature) {
            pointFeatures.push(currentFeature);
            try { dispatch('current', currentFeature); } catch (e) {}
          }
        }
      }
    } catch (err) {
      // non-fatal
    }

    return { lineFeatures, pointFeatures, radiusDefs };
  }

  async function fetchAndDispatch() {
    if (!kmlUrl) return;
    try {
      console.info('[TyphoonOverlay] fetching KML from', kmlUrl);
      dispatch('log', { message: `fetch ${kmlUrl}` });
      const res = await fetch(kmlUrl);
      console.info('[TyphoonOverlay] response status', res.status);
      dispatch('log', { message: `response ${res.status}` });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      rawKml = txt;
      console.debug('[TyphoonOverlay] fetched kml length', txt.length);
      dispatch('log', { message: `fetched ${txt.length} bytes` });
      let lineFeatures: any[] = [];
      let pointFeatures: any[] = [];
      try {
  const parsed = parseKmlToGeoFeatures(txt, new Date());
        lineFeatures = parsed.lineFeatures || [];
        pointFeatures = parsed.pointFeatures || [];
        parseError = null;
      } catch (pe: any) {
        parseError = String(pe?.message || pe);
        console.error('[TyphoonOverlay] parse error', parseError);
      }
      const total = (lineFeatures.length + pointFeatures.length);
      console.info('[TyphoonOverlay] parsed features count', total);
      dispatch('log', { message: `parsed ${total} features (${lineFeatures.length} lines, ${pointFeatures.length} points)` });
      if (total) {
        const features: any[] = [];
        // prefer keeping line features first, then points
        features.push(...lineFeatures);
        features.push(...pointFeatures);
        const geo = features.length === 1 ? features[0] : { type: 'FeatureCollection', features };
        dispatch('track', geo);
        dispatch('log', { message: `dispatched track with ${features.length} features` });
        console.info('[TyphoonOverlay] dispatched track event');
      } else {
        console.warn('[TyphoonOverlay] No coordinates or points found in KML');
        dispatch('log', { message: 'no coordinates found' });
      }
    } catch (e: any) {
      console.error('[TyphoonOverlay] Failed to fetch/parse KML', e);
      parseError = String(e?.message || e);
      rawKml = rawKml ?? null;
      dispatch('log', { message: `error: ${e?.message || e}` });
    }
  }

  onMount(() => {
    // fetch once on mount; consumer can also call fetchAndDispatch() by changing kmlUrl prop
    fetchAndDispatch();
  });
</script>

<!-- debug UI: small toggle to view raw KML and parse info -->
<!-- debug UI removed per user request -->
