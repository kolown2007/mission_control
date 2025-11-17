<script lang="ts">
	import '../app.css';

	export let data: { ssoPresent?: boolean; user?: { id: string | number; name?: string | null } | null };

</script>

<svelte:head>
	<title>{data?.ssoPresent ? 'KoloWn App' : 'Mission Control'}</title>
	
</svelte:head>

<slot />
