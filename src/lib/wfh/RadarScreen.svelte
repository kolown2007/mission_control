<script lang="ts">
  import './components/wfh.css';
  import Time from './components/Time.svelte';
  import Pulsar from './components/Pulsar.svelte';
  import LineMap from './components/LineMap.svelte';
  import OpenMeteo from './components/OpenMeteo.svelte';
  import { onMount } from 'svelte';
  import TyphoonOverlay from './components/TyphoonOverlay.svelte';
  import Strudel from './components/Strudel.svelte';

  let centerLat: number | null = null;
  let centerLon: number | null = null;
  // increased default zoom so the map appears closer by default
  let mapZoom = 2.4;
  // track window width so we can avoid rendering heavy panels on small screens
  let innerWidth = 0;
  let typhoonTrack: any = null;
  let typhoonLog: string | null = null;

  // panels available for the bottom-right slot; clicking the slot picks a random other panel
  const panelOptions: any[] = [
    { id: 'OpenMeteo', comp: OpenMeteo, props: { latitude: 14.48, longitude: 121.0 } },
    { id: 'Pulsar', comp: Pulsar, props: {} },
    { id: 'Time', comp: Time, props: {} },
    { id: 'LineMap', comp: LineMap, props: { centerLat, centerLon, zoom: mapZoom, track: typhoonTrack } }
  ];
  // start with OpenMeteo as the default
  let lastPanelIndex = panelOptions.findIndex(p => p.id === 'OpenMeteo') >= 0 ? panelOptions.findIndex(p => p.id === 'OpenMeteo') : 0;

  function pickRandomExcept(current: number) {
    if (panelOptions.length <= 1) return current;
    let next = current;
    while (next === current) next = Math.floor(Math.random() * panelOptions.length);
    return next;
  }

  function onLastDivClick() {
    lastPanelIndex = pickRandomExcept(lastPanelIndex);
  }

  function onLastDivKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onLastDivClick();
    }
  }

  function handleTyphoonLog(e: CustomEvent<{message:string}>) {
    const m = e.detail?.message || String(e.detail);
    console.log('[TyphoonOverlay log]', m);
    typhoonLog = m;
    // clear after 8s
    setTimeout(() => {
      if (typhoonLog === m) typhoonLog = null;
    }, 8000);
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    innerWidth = window.innerWidth;
    const onResize = () => (innerWidth = window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

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
    {#if innerWidth >= 768}
      <div class="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 grid-rows-4 gap-5 w-full max-w-none h-full text-[#00FF00] font-['Space_Mono']">
        <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
          <Time />
        </div>
        
        <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
          <LineMap {centerLat} {centerLon} zoom={mapZoom} track={typhoonTrack} />
          <!-- TyphoonOverlay fetches a KML and emits `track` with GeoJSON; default URL uses proxy -->
          <TyphoonOverlay on:track={(e) => (typhoonTrack = e.detail)} on:log={handleTyphoonLog} />
          {#if typhoonLog}
            <div class="absolute top-2 left-2 bg-black/60 text-[#00FF00] text-xs px-2 py-1 rounded select-none z-20">{typhoonLog}</div>
          {/if}
              <!-- badge image on the right-bottom edge of the LineMap panel; non-blocking -->
              <img src="/ernie.png" alt="badge" class="absolute right-3 bottom-3 w-48 h-48 opacity-95 pointer-events-none z-20" />
          </div>

        <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
          <Strudel />
        </div>

        <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full min-h-0 overflow-hidden">
          <div role="button" tabindex="0" class="w-full h-full flex items-stretch justify-center relative" on:click={onLastDivClick} on:keydown={onLastDivKey} aria-label="Switch panel">
            <div class="flex-1 flex items-center justify-center">
              <svelte:component this={panelOptions[lastPanelIndex].comp}
                {...panelOptions[lastPanelIndex].props}
                on:location={handleLocation}
              />
            </div>
              <!-- Removed static image from the right side; pointer-events:none so clicks go to the panel underneath -->
            
          </div>
        </div>
      </div>
    {:else}
      <!-- Small screens: only render the OpenMeteo panel to avoid clipping and reduce rendering cost -->
      <div class="w-full max-w-none h-full">
        <div class="relative border border-[#00ff0080] rounded-2xl p-2.5 h-full min-h-0 overflow-auto">
          <OpenMeteo latitude={14.48} longitude={121.0} on:location={handleLocation} />
        </div>
      </div>
    {/if}
  </div>