<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	// Receive server-provided data via the `data` prop (from +layout.server.ts)
	export let data: any;

	let alerted = false;

	// Alert the user once if the server reported an authenticated user.
	$: if (!alerted && data?.user) {
		// Run after hydration so we don't block SSR -> client transition.
		setTimeout(() => {
			try {
				alert(`SSO detected: user id=${data.user.id}`);
			} catch (e) {
				console.info('[auth-alert] SSO detected, user id=', data.user.id);
			}
			alerted = true;
		}, 0);
	}

	onMount(() => {
		if (!alerted && data?.user) {
			alert(`SSO detected: user id=${data.user.id}`);
			alerted = true;
		}
	});
</script>

<svelte:head>
	<title>Mission Control</title>
</svelte:head>

<slot />
