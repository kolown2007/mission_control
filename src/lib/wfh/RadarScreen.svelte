<script lang="ts">
  import './wfh.css';
  import Time from './Time.svelte';
  import Pulsar from './Pulsar.svelte';
  import LineMap from './LineMap.svelte';
  import OpenMeteo from './OpenMeteo.svelte';

  let centerLat: number | null = null;
  let centerLon: number | null = null;
  // increased default zoom so the map appears closer by default
  let mapZoom = 2.4;

  function handleLocation(e: CustomEvent<{latitude:number, longitude:number}>) {
    centerLat = e.detail.latitude;
    centerLon = e.detail.longitude;
    // when we have the device location, zoom in a bit more for a closer view
    mapZoom = 3.2;
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
</svelte:head>

<div class="fixed inset-0 bg-black overflow-auto scrollbar-hide flex items-stretch justify-center p-4">
  <div class="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 grid-rows-4 gap-5 w-full max-w-none h-full text-[#00FF00] font-['Space_Mono']">
    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
      <Time />
    </div>
    
    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
      <LineMap {centerLat} {centerLon} zoom={mapZoom} />
    </div>

    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
      <Pulsar />
    </div>

    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
      <OpenMeteo latitude={14.48} longitude={121.0} on:location={handleLocation} />
    </div>
  </div>
</div>