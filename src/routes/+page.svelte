<script lang="ts">
  // TypeScript sometimes resolves generated `.d.svelte.ts` helpers and
  // complains about arbitrary extensions. Suppress the IDE error here.
  // @ts-ignore
  import WFH from '$lib/wfh/RadarScreen.svelte';

  export let data: any;
</script>

<main>
  <WFH user={data?.user} />
</main>