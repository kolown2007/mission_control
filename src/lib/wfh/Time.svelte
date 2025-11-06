<script lang="ts">
  import { onMount } from 'svelte';

  let time = new Date();

  const updateTime = () => {
    time = new Date();
  };

  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center justify-center w-full h-full p-4">
  <div class="flex gap-[0.5vw] font-['Space_Mono'] text-[clamp(2.5rem,8vw,8rem)] text-[#00FF00] leading-none">
    <span>{time.getHours().toString().padStart(2, '0')}</span>:
    <span>{time.getMinutes().toString().padStart(2, '0')}</span>:
    <span>{time.getSeconds().toString().padStart(2, '0')}</span>
  </div>
</div>