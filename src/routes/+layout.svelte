<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';

	export let data: { ssoPresent?: boolean; user?: { id: string | number; name?: string | null } | null };

	onMount(() => {
		// Log the page data to the browser console for debugging
		console.log('page data:', data);
	});

</script>

<svelte:head>
	<title>{data?.ssoPresent ? 'KoloWn App' : 'Mission Control'}</title>
	
</svelte:head>

<slot />
