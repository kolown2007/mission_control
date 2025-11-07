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

  let features: any[] = [];
  let pathGenerator: any = null;

  // Styling
  export let stroke = '#00FF00';
  export let strokeWidth = 1.5;
  export let fill = 'none';

  onMount(async () => {
    try {
      const res = await fetch(geojsonUrl);
      const geo = await res.json();
      // Use a Natural Earth projection and fit to base viewBox
      let projection = d3.geoNaturalEarth1().precision(0.1);
      // first compute a base scale that fits the world
      projection.fitSize([VIEW_W, VIEW_H], geo as any);
      const baseScale = projection.scale();

      // if a center is provided, create a projection centered on that coordinate and apply zoom multiplier
      if (centerLat != null && centerLon != null) {
        projection = d3.geoNaturalEarth1().precision(0.1)
          .center([centerLon, centerLat])
          .translate([VIEW_W / 2, VIEW_H / 2])
          .scale(baseScale * Math.max(0.5, zoom));
      }

      pathGenerator = d3.geoPath().projection(projection);

      // If the GeoJSON contains FeatureCollection, use its features
      if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
        features = geo.features.map((f: any) => ({ id: f.id || f.properties?.name || Math.random(), d: pathGenerator(f) }));
      } else if (geo.type === 'Feature') {
        features = [{ id: geo.id || geo.properties?.name || 0, d: pathGenerator(geo) }];
      } else if (geo.objects) {
        // Some sources return TopoJSON — try to handle common names if present
        // Fallback: attempt to convert via topojson-client if available at runtime
        // But if not, just leave empty.
        features = [];
      }
    } catch (e) {
      console.error('Failed to load GeoJSON for LineMap', e);
      features = [];
    }
  });
</script>

<div class="w-full h-full">
  <svg class="w-full h-full block" viewBox={"0 0 " + VIEW_W + " " + VIEW_H} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="none" />
  {#if features.length}
    {#each features as f (f.id)}
      <path d={f.d} fill={fill} stroke={stroke} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
    {/each}
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
