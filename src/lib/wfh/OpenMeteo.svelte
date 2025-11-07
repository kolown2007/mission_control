<script lang="ts">
  import { onMount } from 'svelte';
  export let latitude: number = 18.5;
  export let longitude: number = 121.0;

  let loading = true;
  let error: string | null = null;
  let payload: any = null;
  let hours: number = 8;
  let geoStatus: 'idle' | 'requesting' | 'granted' | 'denied' = 'idle';
  let placeName: string | null = null;

  const buildUrl = (lat: number, lon: number) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,pressure_msl&current_weather=true&timezone=auto&forecast_days=2`;

  async function fetchData() {
    loading = true;
    error = null;
    try {
      const res = await fetch(buildUrl(latitude, longitude));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = await res.json();
    } catch (err: any) {
      error = String(err.message || err);
      payload = null;
    } finally {
      loading = false;
    }
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function requestLocation() {
    if (!navigator?.geolocation) {
      error = 'Geolocation not supported by this browser';
      geoStatus = 'denied';
      return;
    }
    geoStatus = 'requesting';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
        // Log only lat/long as requested
        console.log('latitude:', latitude, 'longitude:', longitude);
        geoStatus = 'granted';
        // reverse-geocode to get place name (best-effort)
        reverseGeocode(latitude, longitude).then((name) => {
          placeName = name;
          if (placeName) console.log('place:', placeName);
        }).catch(() => {
          placeName = null;
        });
        // notify parent components about the new location
        dispatch('location', { latitude, longitude });
        fetchData();
      },
      (err) => {
        error = err?.message || 'Geolocation denied';
        geoStatus = 'denied';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function reverseGeocode(lat: number, lon: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      // Prefer named places: city, town, village, state, country
      const addr = data?.address || {};
      return addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state || data.display_name || null;
    } catch (e) {
      return null;
    }
  }

  onMount(() => {
    // Try to request location once on mount, falling back to default coords
    try {
      requestLocation();
    } catch (e) {
      // ignore
    }
    // Ensure initial fetch (in case user denies or geolocation not available)
    fetchData();
    const id = setInterval(fetchData, 10 * 60 * 1000); // refresh every 10 minutes
    return () => clearInterval(id);
  });

  // Helpers
  function getPressureForCurrent() {
    if (!payload?.hourly) return null;
    const times: string[] = payload.hourly.time || [];
    const pressures: number[] = payload.hourly.pressure_msl || [];
    const current = payload.current_weather?.time;
    if (!current) return pressures.length ? pressures[0] : null;
    // Find the first hourly time that is >= current time
    const curDate = new Date(current);
    const idx = times.findIndex((t) => new Date(t) >= curDate);
    if (idx === -1) return pressures.length ? pressures[0] : null;
    return pressures[idx];
  }

  function firstNHours(n = 12) {
    if (!payload?.hourly) return [];
    const times: string[] = payload.hourly.time || [];
    const temps: number[] = payload.hourly.temperature_2m || [];
    const winds: number[] = payload.hourly.wind_speed_10m || [];
    const pressures: number[] = payload.hourly.pressure_msl || [];
    const rows = [];
    const current = payload.current_weather?.time;
    let startIdx = 0;
    if (current) {
      const curDate = new Date(current);
      startIdx = times.findIndex((t) => new Date(t) >= curDate);
      if (startIdx === -1) startIdx = 0;
    }
    for (let i = startIdx; i < Math.min(startIdx + n, times.length); i++) {
      rows.push({ time: times[i], temp: temps[i], wind: winds[i], pressure: pressures[i] });
    }
    return rows;
  }
</script>

<div class="w-full h-full p-4 box-border text-[#00FF00]">
  

  {#if loading}
    <div class="text-lg">Loading weather…</div>
  {:else if error}
    <div class="text-sm text-red-400">Error: {error}</div>
  {:else}
    <!-- Two-column layout: left = current, right = hourly list -->
    <div class="w-full h-full flex flex-col md:flex-row gap-4">
      <div class="md:w-1/2 w-full relative flex items-center justify-center border border-[#00ff0080] rounded p-4 box-border">
        <div class="absolute top-2 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          {#if geoStatus === 'granted'}
            <div class="text-xs">Using device location</div>
          {:else if geoStatus === 'requesting'}
            <div class="text-xs">Requesting location…</div>
          {:else if geoStatus === 'denied'}
            <div class="text-xs">Location denied</div>
          {/if}
          <button class="text-xs border rounded px-2 py-0.5 hover:bg-[#003300]" on:click={requestLocation}>
            Use
          </button>
        </div>
        <div class="w-full text-center">
          <div class="text-sm uppercase tracking-wider">Current {#if placeName}({placeName}) {/if}(lat: {latitude.toFixed(2)}, lon: {longitude.toFixed(2)})</div>
          <div class="mt-2 font-['Space_Mono'] text-[clamp(1.4rem,6vw,3.6rem)]">
            {#if payload.current_weather}
              {payload.current_weather.temperature}°C
            {:else}
              —
            {/if}
          </div>
          <div class="mt-2 text-base">Wind: {payload.current_weather?.windspeed ?? '—'} m/s</div>
          <div class="mt-1 text-base">Pressure: {getPressureForCurrent() ?? '—'} hPa</div>
        </div>
      </div>

  <div class="md:w-1/2 w-full border border-[#00ff0080] rounded p-3 box-border overflow-visible">
  <div class="text-sm uppercase tracking-wider text-center">Next {hours} hours</div>
        <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm font-['Space_Mono']">
          {#each firstNHours(hours) as h}
            <div class="p-2 border border-[#00ff0080] rounded flex flex-col items-center justify-center min-h-12">
              <div class="truncate text-[0.85rem]">{new Date(h.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
              <div class="mt-1 text-lg">{Math.round(h.temp)}°</div>
              <div class="mt-1 text-sm">{Math.round(h.wind)} m/s</div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
