<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { user, ssoPresent } from '$lib/stores/user';
	import { browser } from '$app/environment';

	export let data: { ssoPresent?: boolean; user?: { id: string | number; name?: string | null } | null };

	// Synchronously seed the client store so SSR/hydration shows the user immediately.
	// Prefer the server-provided `data` (from +layout.server.ts), otherwise fall back
	// to `window.pageData` if present (main app injection).
	const initialUser = data?.user ?? (browser ? (window as any).pageData?.user ?? null : null);
	user.set(initialUser);
	ssoPresent.set(Boolean(data?.ssoPresent ?? (browser && !!(window as any).pageData?.ssoPresent)));

	onMount(() => {
			// Log the page data to the browser console for debugging
			console.log('page data:', data);

			// Ensure client-side fallback remains in place
			if (browser && (window as any).pageData) {
				user.set((window as any).pageData.user ?? null);
				ssoPresent.set(!!(window as any).pageData.ssoPresent);
			}
	});

</script>

<svelte:head>
	<title>{data?.ssoPresent ? 'KoloWn App' : 'Mission Control'}</title>
	
</svelte:head>

<slot />
