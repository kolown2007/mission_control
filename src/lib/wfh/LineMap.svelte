<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  // URL to a simplified world GeoJSON. This is fetched at runtime.
  export let geojsonUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
  // base viewBox size (the SVG will scale responsively)
  const VIEW_W = 800;
  const VIEW_H = 450;

  // optional center/zoom props
  export let centerLat: number | null = null;
  export let centerLon: number | null = null;
  export let zoom: number = 1;
  // optional track GeoJSON Feature (LineString or FeatureCollection)
  export let track: any = null;
  // when true, auto-fit the projection to the provided track (center + zoom)
  export let fitToTrack: boolean = true;
  // simplify the track to a straight-ish sampled line with a few points
  export let simplifyTrack: boolean = true;
  // maximum number of points to show on the simplified track (including endpoints)
  export let maxTrackPoints: number = 6;

  type TrackPoint = {
    x: number;
    y: number;
    lon?: number;
    lat?: number;
    properties?: any;
    _time?: Date;
    _label?: string | null;
    // pixel radius computed from a geographic radius (in km) when available
    _pxRadius?: number;
    // convenience flag sometimes set on properties; mirror here for template use
    _isCurrent?: boolean;
    // derived flags for display logic
    _isForecast?: boolean;
    _hiddenBySampling?: boolean;
  };

  let features: any[] = [];
  let pathGenerator: any = null;
  let trackPath: string | null = null;
  let trackPoints: TrackPoint[] = [];
  let projection: any = null;
  let geo: any = null;
  // displayPoints is a simplified/sorted copy of trackPoints used by the template
  let displayPoints: TrackPoint[] = [];
  // visiblePoints: only current + forecast (hide past observed)
  let visiblePoints: TrackPoint[] = [];
  let forecastPath: string | null = null;
  // UI toggles (on-map)
  let showRadii = true;
  let showForecasts = true;

  // Styling
  export let stroke = '#00FF00';
  export let strokeWidth = 1.5;
  export let fill = 'none';
  // whether to render the connecting track line (yellow). Default false to avoid visual clutter.
  export let showTrackLine: boolean = false;

  onMount(async () => {
    try {
      const res = await fetch(geojsonUrl);
      geo = await res.json();
    } catch (e) {
      console.error('Failed to load GeoJSON for LineMap', e);
      geo = null;
    }
  });

  // recompute projection and paths whenever the geo data or view params change
  $: if (geo) {
    try {
  projection = d3.geoNaturalEarth1().precision(0.1);
  projection.fitSize([VIEW_W, VIEW_H], geo as any);
  const baseScale = projection.scale();

      if (centerLat != null && centerLon != null) {
        projection = d3.geoNaturalEarth1().precision(0.1)
          .center([centerLon, centerLat])
          .translate([VIEW_W / 2, VIEW_H / 2])
          .scale(baseScale * Math.max(0.5, zoom));
      }

      pathGenerator = d3.geoPath().projection(projection);

      // If requested, fit the projection to the provided track for better visibility.
      if (fitToTrack && track) {
        try {
          // small padding so points/path aren't flush with edges
          const pad = 40;
          // If track is a FeatureCollection, fit to the whole collection, else fit to the feature/geometry
          const trackGeo = (track.type === 'FeatureCollection') ? track : track;
          projection.fitSize([VIEW_W - pad, VIEW_H - pad], trackGeo as any);
          // recreate the path generator with the adjusted projection
          pathGenerator = d3.geoPath().projection(projection);
        } catch (e) {
          // ignore fit failures and continue with world projection
        }
      }

      if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
        features = geo.features.map((f: any) => ({ id: f.id || f.properties?.name || Math.random(), d: pathGenerator(f) }));
      } else if (geo.type === 'Feature') {
        features = [{ id: geo.id || geo.properties?.name || 0, d: pathGenerator(geo) }];
      } else {
        features = [];
      }

      // compute track path if provided and build a simplified point list
      trackPoints = [];
      if (track && pathGenerator) {
        try {
          // helper: sample coordinates evenly to at most maxPoints
          const sampleCoords = (coords: any[], maxPts: number) => {
            if (!coords || !coords.length) return [];
            if (coords.length <= maxPts) return coords.slice();
            const out: any[] = [];
            for (let i = 0; i < maxPts; i++) {
              const idx = Math.floor(i * (coords.length - 1) / (maxPts - 1));
              out.push(coords[idx]);
            }
            return out;
          };

          // find a representative LineString for the track
          let lineCoords: any[] | null = null;
          if (track.type === 'FeatureCollection' && Array.isArray(track.features)) {
            // prefer the first LineString feature
            for (const f of track.features) {
              if (f?.geometry?.type === 'LineString') { lineCoords = f.geometry.coordinates; break; }
            }
            // fallback: if there are no LineStrings, maybe points exist - form a line from their coords
            if (!lineCoords) {
              const pts = track.features.filter((f: any) => f?.geometry?.type === 'Point');
              if (pts.length >= 2) lineCoords = pts.map((p: any) => p.geometry.coordinates);
            }
          } else if (track.geometry && track.geometry.type === 'LineString') {
            lineCoords = track.geometry.coordinates;
          }

          if (lineCoords && lineCoords.length) {
            let sampled = simplifyTrack ? sampleCoords(lineCoords, Math.max(2, maxTrackPoints)) : lineCoords.slice();
            // ensure at least two points for a visible line: if sampling returned a single point but original has endpoints, use endpoints
            if ((!sampled || sampled.length < 2) && lineCoords.length >= 2) {
              sampled = [lineCoords[0], lineCoords[lineCoords.length - 1]];
            }
            if (sampled.length >= 2) {
              const sampledFeature = { type: 'Feature', geometry: { type: 'LineString', coordinates: sampled } };
              trackPath = pathGenerator(sampledFeature as any);

              // project sampled points only (few dots)
              for (let i = 0; i < sampled.length; i++) {
                const [lon, lat] = sampled[i];
                const p = projection([lon, lat]);
                if (p) {
                  trackPoints.push({ x: p[0], y: p[1], lon, lat, properties: { index: i } });
                }
              }
              // also include any explicit Point features from the FeatureCollection as separate markers
              if (track.type === 'FeatureCollection') {
                for (const f of track.features) {
                  if (f?.geometry?.type === 'Point') {
                    const [flon, flat] = f.geometry.coordinates;
                    const fp = projection([flon, flat]);
                    if (fp) {
                      const props = { ...(f.properties || {}) };
                      // mark as current only if property explicitly suggests it; do NOT default to true
                      if (props.isCurrent == null) props.isCurrent = false;
                      props._isCurrent = !!props.isCurrent;
                      trackPoints.push({ x: fp[0], y: fp[1], lon: flon, lat: flat, properties: props });
                    }
                  }
                }
              }
            } else {
              // if we still couldn't build a two-point line, fall back to single-point markers
              const [lon, lat] = lineCoords[0];
              const p = projection([lon, lat]);
              if (p) trackPoints.push({ x: p[0], y: p[1], lon, lat, properties: { index: 0 } });
              trackPath = null;
            }
            // If for any reason a geo path couldn't be generated but we have at least two projected points,
            // create a simple SVG path from the projected points so a visible line is drawn.
            if ((!trackPath || trackPath === '') && trackPoints.length >= 2) {
              try {
                const d = trackPoints.map((pt, i) => `${i===0? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
                trackPath = d;
              } catch (err) {
                // ignore
              }
            }
          } else {
            // if no line found, try to draw from explicit Point features
            if (track.type === 'FeatureCollection') {
              const pts = track.features.filter((f: any) => f?.geometry?.type === 'Point');
                if (pts.length) {
                // sample the points list if many
                let sampledPoints = simplifyTrack ? sampleCoords(pts.map((p: any) => p.geometry.coordinates), Math.max(2, maxTrackPoints)) : pts.map((p: any) => p.geometry.coordinates);
                if ((!sampledPoints || sampledPoints.length < 2) && pts.length >= 2) {
                  sampledPoints = [pts[0].geometry.coordinates, pts[pts.length - 1].geometry.coordinates];
                }
                if (sampledPoints.length >= 2) {
                  const sampledFeature = { type: 'Feature', geometry: { type: 'LineString', coordinates: sampledPoints } };
                  trackPath = pathGenerator(sampledFeature as any);
                  for (let i = 0; i < sampledPoints.length; i++) {
                    const [lon, lat] = sampledPoints[i];
                    const p = projection([lon, lat]);
                    if (p) trackPoints.push({ x: p[0], y: p[1], lon, lat, properties: { index: i } });
                  }
                } else {
                  // fallback to single point
                  const [lon, lat] = pts[0].geometry.coordinates;
                  const p = projection([lon, lat]);
                  if (p) trackPoints.push({ x: p[0], y: p[1], lon, lat, properties: { index: 0 } });
                  trackPath = null;
                }
              } else {
                trackPath = null;
              }
            } else {
              trackPath = null;
            }
          }
        } catch (e) {
          trackPath = null;
        }
      } else {
        trackPath = null;
      }
    } catch (e) {
      console.error('Failed to compute projection/paths', e);
      features = [];
      trackPath = null;
    }
  }

  // prepare displayPoints reactively from trackPoints: attach parsed times/labels and sort if times present
  $: displayPoints = (trackPoints || []).map(p => {
    const pp: any = { ...p };
    const raw = pp.properties?.time ?? pp.properties?.when ?? pp.properties?.timestamp ?? pp.properties?.TimeStamp ?? pp.properties?.date ?? null;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) pp._time = d;
    }
    pp._label = pp.properties?.name ?? pp.properties?.label ?? pp.properties?.desc ?? pp.properties?.description ?? null;
    // If wind_kph is present, prefer a label that shows km/h (override any existing 'KTS' text)
    const windKph = pp.properties?.wind_kph ?? (pp.properties?.wind_kts != null ? Math.round(pp.properties.wind_kts * 1.852) : null);
    if (windKph != null) {
      try {
        const orig = pp._label ?? pp.properties?.name ?? pp.properties?.description ?? '';
        const replaced = String(orig).replace(/(\d{1,3})\s*(?:KTS|kts|knots|KT)\b/gi, (_, n) => `${Math.round(Number(n) * 1.852)} km/h`);
        pp._label = (replaced && replaced !== String(orig)) ? replaced : `${(orig ?? '').trim()} ${windKph} km/h`.trim();
      } catch (e) {
        pp._label = `${pp._label ?? ''} ${windKph} km/h`.trim();
      }
    }
    return pp;
  });
  $: if (displayPoints.some((p: any) => p._time)) {
    displayPoints = displayPoints.slice().sort((a: any,b: any)=> (a._time?.getTime() ?? 0) - (b._time?.getTime() ?? 0));
  }

  // mark forecast vs observed and limit forecast dots quantity for clarity
  $: if (displayPoints && displayPoints.length) {
    // annotate
    for (const dp of displayPoints) {
      dp._isForecast = !!dp.properties?.tag && String(dp.properties.tag).toLowerCase().includes('forecast');
      dp._isCurrent = !!dp.properties?.isCurrent || !!dp.properties?._isCurrent;
    }
    // if there are many forecast points, only show the nearest N for clarity
    const MAX_FORECAST_POINTS = 8;
    const forecasts = displayPoints.filter((p:any) => p._isForecast);
    if (forecasts.length > MAX_FORECAST_POINTS) {
      // keep the first (earliest) forecasts? We'll keep the first N after sorting by time
      const keep = new Set(forecasts.slice(0, MAX_FORECAST_POINTS).map((p:any) => p));
      for (const p of displayPoints) {
        if (p._isForecast && !keep.has(p)) p._hiddenBySampling = true;
        else p._hiddenBySampling = false;
      }
    } else {
      for (const p of displayPoints) p._hiddenBySampling = false;
    }
  }

  // compute pixel radii for any displayPoints that have a geographic radius (radius_km)
  $: if (projection && displayPoints && displayPoints.length) {
    for (const dp of displayPoints) {
      if (dp.properties?.radius_km && dp.lon != null && dp.lat != null) {
        try {
          const rkm = dp.properties.radius_km;
          const lat = dp.lat;
          const lon = dp.lon;
          const latRad = (lat * Math.PI) / 180;
          const degLonKm = 111.32 * Math.cos(latRad);
          const deltaLon = rkm / degLonKm;
          const p1 = projection([lon, lat]);
          const p2 = projection([lon + deltaLon, lat]);
          const pxr = Math.max(2, Math.abs(p2[0] - p1[0]));
          dp._pxRadius = pxr;
        } catch (e) {
          dp._pxRadius = undefined;
        }
      } else {
        dp._pxRadius = undefined;
      }
    }

  }

  // helper: format lat/lon into human-friendly string
  function fmtLatLon(lon: number, lat: number) {
    const latAbs = Math.abs(lat).toFixed(2);
    const lonAbs = Math.abs(lon).toFixed(2);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${latAbs}°${latDir} ${lonAbs}°${lonDir}`;
  }

  // format a Date/string into a readable UTC date+time string: YYYY-MM-DD HH:MM UTC
  function formatTime(t?: Date | string | null) {
    if (!t) return '';
    const d = t instanceof Date ? t : new Date(t);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
  }

  // center map on a point (use null when lon/lat undefined to satisfy types)
  function centerOnPoint(pt: TrackPoint) {
    centerLon = (pt.lon ?? null) as number | null;
    centerLat = (pt.lat ?? null) as number | null;
  }

  function handleCenterKey(e: KeyboardEvent, pt: TrackPoint) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      centerOnPoint(pt);
    }
  }

  // derive visiblePoints and forecast path (hide past observed points)
  $: {
    const now = new Date();
    visiblePoints = (displayPoints || []).filter((p: TrackPoint) => {
      if (p._isCurrent) return true;
      if (p._isForecast) return true;
      if (p._time) return p._time.getTime() >= now.getTime();
      return false;
    });
  }

  // compute a forecast path from visiblePoints (current + future) for drawing
  $: if (projection && pathGenerator && visiblePoints && visiblePoints.length) {
    try {
      const coords = visiblePoints.map(p => (p.lon != null && p.lat != null) ? [p.lon, p.lat] : null).filter(Boolean) as any[];
      if (coords.length >= 2) {
        const feat = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
        forecastPath = pathGenerator(feat as any);
      } else {
        forecastPath = null;
      }
    } catch (e) {
      forecastPath = null;
    }
  }
</script>

<div class="w-full h-full">
  <svg class="w-full h-full block" viewBox={"0 0 " + VIEW_W + " " + VIEW_H} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="none" />
  {#if features.length}
    {#each features as f (f.id)}
      <path d={f.d} fill={fill} stroke={stroke} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
    {/each}
    {#if showTrackLine && forecastPath}
      <path d={forecastPath} fill="none" stroke="#FFDD00" stroke-width={2} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    {/if}
    {#if visiblePoints.length}
      {#each visiblePoints as pt, idx}
        <g>
          {#if pt._isCurrent}
            <!-- pulsating current marker: outer animated ring + inner solid center -->
            <g aria-hidden="true">
              <circle cx={pt.x} cy={pt.y} r={7} fill="#ff2e2e" stroke="#222" stroke-width="1.4" />
              <!-- outer ring animated via SMIL (works in modern browsers) -->
              <circle cx={pt.x} cy={pt.y} r={7} fill="none" stroke="#ff2e2e" stroke-width="2" opacity="0.9">
                <animate attributeName="r" from="7" to="24" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </g>
            <!-- label: time, wind, coords. Click to center map on this point -->
            {#if pt.lon != null && pt.lat != null}
              <g>
                <text x={pt.x + 12} y={pt.y - 10} font-size="12" fill={stroke} style="pointer-events:auto;cursor:pointer" role="button" tabindex="0" aria-label="Center map on current typhoon location" on:click={() => centerOnPoint(pt)} on:keydown={(e) => handleCenterKey(e, pt)}>
                  {#if pt._time}{formatTime(pt._time)}{/if}{pt.properties?.wind_kph ? ` • ${pt.properties.wind_kph} km/h` : ''}
                </text>
                <text x={pt.x + 12} y={pt.y + 6} font-size="11" fill={stroke}>{fmtLatLon(pt.lon, pt.lat)}</text>
              </g>
            {/if}
          {:else if pt._pxRadius && showRadii}
            {#if pt._isCurrent}
              <circle cx={pt.x} cy={pt.y} r={pt._pxRadius} fill="none" stroke="#ff2e2e" stroke-width="2" stroke-dasharray="6 4" opacity="0.9" />
            {/if}
            <!-- draw a smaller center marker for the point itself -->
            <circle cx={pt.x} cy={pt.y} r={5} fill="#ff4d4d" stroke="#222" stroke-width="1" />
          {:else if pt._isForecast}
            {#if !pt._hiddenBySampling && showForecasts}
              <circle cx={pt.x} cy={pt.y} r={3} fill="#f0c419" stroke="#a66" stroke-width="0.6" opacity="0.6" />
            {/if}
          {:else if idx === visiblePoints.length - 1}
            <circle cx={pt.x} cy={pt.y} r={6} fill="#ff4d4d" stroke="#222" stroke-width="1.2" />
          {:else}
            <circle cx={pt.x} cy={pt.y} r={4} fill="#ffcc00" stroke="#333" stroke-width="0.8" />
          {/if}
          <title>{pt._label ?? (pt._time ? pt._time.toISOString() : `pt ${idx}`)}</title>
        </g>
      {/each}
    {/if}
    
  {:else}
    <!-- simple placeholder grid if features not loaded -->
    <g stroke={stroke} stroke-width="0.5" fill="none">
      <rect x="10" y="10" width={VIEW_W-20} height={VIEW_H-20} rx="6" />
    </g>
    {/if}
  </svg>
</div>

<style>
  /* keep SVG crisp lines */
  svg { shape-rendering: crispEdges; }
</style>
