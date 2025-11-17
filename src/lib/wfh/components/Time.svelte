<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/user';

  let time = new Date();

  const updateTime = () => {
    time = new Date();
  };

  // derived display values for 12-hour clock (no leading zero on hours)
  const hour12 = () => {
    const h = time.getHours() % 12;
    return h === 0 ? 12 : h;
  };
  const two = (n: number) => n.toString().padStart(2, '0');
  const ampm = () => (time.getHours() >= 12 ? 'PM' : 'AM');

  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center justify-center w-full h-full p-4">
  <div class="relative">
    {#if $user}
      <div class="absolute -top-6 left-0 text-sm text-white/80 select-none">{$user.name ?? $user.id}</div>
    {/if}

    <div class="flex gap-[0.5vw] font-['Space_Mono'] text-[clamp(2.5rem,8vw,8rem)] text-[#00FF00] leading-none">
      <span>{hour12()}</span>:
      <span>{two(time.getMinutes())}</span>:
      <span>{two(time.getSeconds())}</span>
      <span class="ml-2 text-[clamp(0.8rem,1.5vw,1.25rem)] align-top">{ampm()}</span>
    </div>
  </div>
</div>