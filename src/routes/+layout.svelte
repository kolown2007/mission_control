<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import { user, ssoPresent } from '$lib/stores/user';

	export let data: { ssoPresent?: boolean; user?: { id: string | number; name?: string | null } | null };

	onMount(() => {
		// Log the page data to the browser console for debugging
		console.log('page data:', data);

		// Initialize client-side stores from server-provided data (fast) and
		// fall back to window.pageData if present (safety for non-sveltekit entrypoints)
		const initialUser = data?.user ?? (typeof window !== 'undefined' ? (window as any).pageData?.user ?? null : null);
		user.set(initialUser);
		ssoPresent.set(Boolean(data?.ssoPresent ?? (typeof window !== 'undefined' && !!(window as any).pageData?.ssoPresent)));
	});

</script>

<svelte:head>
	<title>{data?.ssoPresent ? 'KoloWn App' : 'Mission Control'}</title>
	
</svelte:head>

<slot />
