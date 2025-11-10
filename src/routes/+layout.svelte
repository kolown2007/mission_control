<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	// receive server-provided data (from +layout.server.ts)
	export let data: any;

	let alerted = false;

	$: if (!alerted && data?.ssoPresent) {
		// run after hydration
		setTimeout(() => {
			try {
				alert('SSO cookie detected');
			} catch (e) {
				console.info('[auth-alert] SSO cookie detected');
			}
			alerted = true;
		}, 0);
	}

	onMount(() => {
		if (!alerted && data?.ssoPresent) {
			alert('SSO cookie detected');
			alerted = true;
		}
	});
</script>

<svelte:head>
	<title>Mission Control</title>
</svelte:head>

<slot />
