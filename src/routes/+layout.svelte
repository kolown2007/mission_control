<script lang="ts">
	import '../app.css';

	// receive server-provided data (see +layout.server.ts)
	export let data: { ssoPresent?: boolean };

	// theme color used by some browsers to tint the title/toolbar area
	const themeColor = data?.ssoPresent ? '#28a745' : '#0b1220';
</script>

<svelte:head>
	<title>Mission Control</title>
	<meta name="theme-color" content={themeColor} />
	<!-- Helpful for Windows/Edge/Chrome and many mobile browsers -->
</svelte:head>

<slot />
