<script lang="ts">
  // ── MeshSky — the backdrop every mesh view stands on ─────────────────────────
  // One component so the overview and /mesh cannot drift: this used to live
  // inline in MeshCanvas behind `isGlobe`, which gave the globe a sky and every
  // flat layout a different ground. Screen-fixed on purpose — it is the sky,
  // not the floor, so it does not pan or zoom with the camera.
  //
  // Pair it with a `Canvas ground={false}`: the aurora it masks against is
  // painted by the canvas underneath (`--glass-space`).
</script>

<!-- `mesh-sky` is not styling — it is the SCOPE the mote tokens are declared
     in, so a page that draws no stars does not inherit the field. See
     tokens.css. -->
<div class="sky mesh-sky" aria-hidden="true">
  <!-- The ruling, masked twice: by the veil (where it may exist at all) on the
       outer element, by the light (where it shows) on the inner one. Nested
       rather than composited in one `mask-image`, because the aurora is three
       layers and `mask-composite: intersect` would intersect its three pools
       with each other into almost nothing. Nested masks just multiply. -->
  <div class="sky-grid-veil">
    <div class="sky-grid"></div>
  </div>
  <!-- The star field, as THREE PLANES rather than one background, so they can
       shimmer out of phase. Split by depth and not arbitrarily — each plane
       fades as a unit, so a plane has to be internally consistent in
       brightness or the shimmer contradicts the weights. -->
  <div class="motes motes--far"></div>
  <div class="motes motes--mid"></div>
  <div class="motes motes--near"></div>
</div>

<style>
  .sky {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  /* The ruling exists only where the light does. The aurora is the mask, so the
     grid inherits its shape and its falloff — it comes up inside each pool and is
     simply absent between them, with no edge of its own anywhere. That is what
     stops a grid reading as a floor plan laid over the scene: a floor plan is
     uniform, and light is not.

     The aurora is the mask AND is painted underneath on the canvas — same token,
     two jobs, which is why it cannot just be a layer in one background. Prefixed
     copy for the same reason `CurrentField` and the fade utilities carry one. */
  .sky-grid-veil {
    position: absolute;
    inset: 0;
    -webkit-mask-image: var(--glass-grid-veil);
    mask-image: var(--glass-grid-veil);
  }
  .sky-grid {
    position: absolute;
    inset: 0;
    background-image: var(--glass-grid-fine);
    -webkit-mask-image: var(--glass-aurora);
    mask-image: var(--glass-aurora);
    /* The part a gradient cannot do: a ramp still has hard ends, and this rounds
       them off. Tuned by eye on the overview — this is deliberately soft enough
       that the lattice reads as a haze with a grain to it rather than as ruling.
       The element is static, so the blur is rasterised once and cached, not run
       per frame. */
    filter: blur(1.4px);
  }
  .motes {
    position: absolute;
    inset: 0;
    /* Opacity only, so each plane stays one promoted layer the compositor fades —
       nothing re-rasterises, and the 67 gradients are painted exactly once. */
    will-change: opacity;
  }
  /* SHIMMER, as three planes fading out of phase.

     The periods do not divide into each other, which is the whole trick: three
     coprime-ish cycles never line up, so the field never pulses as one thing even
     though only three values are moving. It is a group approximation of a
     per-star twinkle, and the honest upgrade is an element per star — worth it
     only if this reads as breathing rather than as scintillation.

     THE FAINT PLANE SWINGS HARDEST, which is not a stylistic choice: dim stars
     visibly scintillate and bright ones hold steady, because atmospheric
     scattering moves a small absolute amount of light and that is a large share
     of a dim star and a rounding error on a bright one. Inverting this reads as
     lamps on a dimmer. */
  .motes--far {
    background-image: var(--glass-motes-far);
    animation: mote-shimmer-far 3.7s ease-in-out infinite alternate;
  }
  .motes--mid {
    background-image: var(--glass-motes-mid);
    animation: mote-shimmer-mid 5.3s ease-in-out infinite alternate;
  }
  .motes--near {
    background-image: var(--glass-motes-near);
    animation: mote-shimmer-near 8.9s ease-in-out infinite alternate;
  }
  @keyframes mote-shimmer-far {
    from {
      opacity: 0.45;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes mote-shimmer-mid {
    from {
      opacity: 0.68;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes mote-shimmer-near {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 1;
    }
  }
  /* The field is the design; the shimmer is the flourish. Held at full rather than
     at the dim end — a reduced-motion reader gets the field as drawn, not the
     bottom of someone else's animation. */
  @media (prefers-reduced-motion: reduce) {
    .motes {
      animation: none;
      opacity: 1;
    }
  }
</style>
