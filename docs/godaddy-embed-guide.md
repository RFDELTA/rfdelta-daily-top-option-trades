# GoDaddy Embed Guide

Paste each numbered section from `godaddy-top-option-trades-blocks.html` into a separate GoDaddy HTML block, in order. The six iframes load only committed report content. A `ResizeObserver` inside each Vercel page posts its measured height; the parent listener accepts messages only from the listed Vercel and custom-domain origins.

## No Secondary Scrollbar

Keep these iframe attributes unchanged:

```html
scrolling="no"
style="display:block;width:100%;border:0;overflow:hidden;"
```

Leave GoDaddy Forced Height blank. The inline height is a loading fallback and will be replaced after render. Each report section is shorter than the former all-in-one embed, so ad sections can sit between them without trapping a second vertical scroll area.

## Width

The contained wrapper fills the complete width of the GoDaddy HTML section:

```html
<div style="width:100%;max-width:none;margin:0;overflow:visible;">
```

Code inside the iframe cannot make the parent GoDaddy section wider. If the theme imposes a narrow content column, first try GoDaddy's full-width section/layout setting. That is the most reliable fix.

For the desktop theme shown on `rfdelta.com`, a viewport breakout can be tested by replacing the wrapper in each block with the following. The `280px` rail represents the persistent left navigation and may need adjustment if the theme changes.

```html
<style>
.rfdelta-options-wide {
  --rfdelta-site-rail: 280px;
  position: relative;
  width: calc(100vw - var(--rfdelta-site-rail));
  max-width: none;
  margin-left: calc((100% - (100vw - var(--rfdelta-site-rail))) / 2);
  overflow: visible;
}
@media (max-width: 900px) {
  .rfdelta-options-wide {
    --rfdelta-site-rail: 0px;
    width: 100vw;
    margin-left: calc((100% - 100vw) / 2);
  }
}
</style>
<div class="rfdelta-options-wide">
  <!-- existing iframe -->
</div>
```

This breakout works only if GoDaddy's parent containers allow visible overflow. If the builder clips the section, no iframe or child CSS can override that ancestor; use the theme's full-width section or host the entire page on the Vercel/custom origin.

## Origin Changes

If a custom domain replaces the Vercel origin, update both:

1. each iframe `src`
2. `allowedOrigins` in every standalone block

Do not add `*` to the parent origin allowlist.
