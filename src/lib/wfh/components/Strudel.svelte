<script lang="ts">
  // Props for initial code
  export let code: string = `setcps(1)
n("<0 1 2 3 4>*8").scale('G4 minor')
.s("gm_lead_6_voice")
.clip(sine.range(.2,.8).slow(8))
.jux(rev)
.room(2)
.sometimes(add(note("12")))
.lpf(perlin.range(200,20000).slow(4))`;

  // Encode the code for URL
  $: encodedCode = encodeURIComponent(code);
  $: iframeSrc = `https://strudel.cc/?${encodedCode}`;
</script>

<div class="strudel-container">
  <iframe 
    src={iframeSrc}
    title="Strudel REPL"
    allow="autoplay; microphone"
  ></iframe>
</div>

<style>
  .strudel-container {
    width: 100%;
    height: 100%;
    background: rgba(0, 20, 40, 0.8);
   
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    backdrop-filter: blur(10px);
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
  }
</style>