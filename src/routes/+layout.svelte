<script lang="ts">
	import '../app.css';

	
	export let data: { ssoPresent?: boolean };

</script>

<svelte:head>
	<title>{data?.ssoPresent ? 'KoloWn App' : 'Mission Control'}</title>
	
</svelte:head>

<slot />
