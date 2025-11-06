<script>
  import './wfh.css';
  import Time from './Time.svelte';
  import Pulsar from './Pulsar.svelte';
  import Horizon from './Horizon.svelte';
  import Wavy from './Wavy.svelte';
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
</svelte:head>

<div class="fixed inset-0 bg-black overflow-auto scrollbar-hide flex items-stretch justify-center p-4">
  <div class="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 grid-rows-4 gap-5 w-full max-w-none h-full text-[#00FF00] font-['Space_Mono']">
    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full">
      <Time />
    </div>
    
    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full">
      <Horizon />
    </div>

    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full">
      <Pulsar />
    </div>

    <div class="relative border border-[#00ff0080] rounded-2xl flex items-center justify-center p-2.5 h-full">
      <Wavy />
    </div>
  </div>
</div>