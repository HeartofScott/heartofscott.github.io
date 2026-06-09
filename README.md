# The Firewalkers — Site Files
### firewalkers.earth · Updated June 2026

## Files in this package

| File | Description | Status |
|------|-------------|--------|
| `datacentre-watch.html` | Data Centre Watch intelligence hub | New page — upload to site root |
| `community.html` | Community wall, allied orgs, video hub | Replaces existing community.html |
| `_nav.html` | Shared nav + footer snippet (reference) | Copy-paste component |
| `README.md` | This file | — |

## Before uploading

### 1. Formspree endpoints
Both `datacentre-watch.html` and `community.html` contain forms with:
```
action="https://formspree.io/f/YOUR_FORM_ID"
```
Replace `YOUR_FORM_ID` with your actual Formspree form IDs.
You'll need two separate forms:
- One for "Report a Site" (datacentre-watch.html)
- One for "Affiliate Application" (community.html)
Create free forms at https://formspree.io

### 2. YouTube channel link
In `community.html`, update:
```
href="https://www.youtube.com/@firewalkers"
```
Replace `@firewalkers` with your actual YouTube channel handle once created.

### 3. Image paths
Both pages use `/images/logos/Smaller logo.png` and `/images/logos/firewalker-logo.png`
These match your existing image paths. No changes needed.

### 4. Navigation — add Data Centre Watch to your existing pages
The new consistent nav includes "Data Centre Watch" as a top-level item.
Add this link to the nav on your existing pages (index.html, good-ai.html, campaigns.html, hearth.html, media.html):
```html
<a href="/datacentre-watch.html">Data Centre Watch</a>
```

---

## Mobile optimisations applied

All pages have been built with:
- `font-size: 16px` on all form inputs (prevents iOS zoom on focus)
- `-webkit-tap-highlight-color: transparent` on all interactive elements
- `touch-action: manipulation` on buttons (removes 300ms tap delay)
- `min-height: 44px` on all tap targets (Apple HIG standard)
- `-webkit-overflow-scrolling: touch` on scrollable nav elements
- `viewport meta` with `width=device-width, initial-scale=1.0`
- `clamp()` font sizing throughout for fluid type scaling
- `aspect-ratio: 16/9` with `min-height` fallback for older iOS Safari
- Reduced motion support via `@media (prefers-reduced-motion: reduce)`
- 2-column → 1-column breakpoints at both 900px and 480px
- Hero stats wrap to 2×2 grid on mobile (not single column)
- All buttons go full-width on mobile with centered text
- Forms collapse to single column on mobile
- Footer collapses to single column on mobile

---

## Sitemap

```
firewalkers.earth/
├── index.html               (existing — add DCW to nav)
├── good-ai.html             (existing — add DCW to nav)
├── campaigns.html           (existing — add DCW to nav)
├── hearth.html              (existing — add DCW to nav)
├── media.html               (existing — add DCW to nav)
├── community.html           ← REPLACE with new file
├── datacentre-watch.html    ← NEW file
└── posts/
    ├── why-i-built-the-firewalkers.html  (existing)
    ├── come-help-us-build-this.html      (existing)
    └── ...
```

---

## One paragraph — use everywhere

*The Firewalkers is a global movement founded in Scotland in June 2026 by a technologist, businessman, father of five, and Celtic druid who could no longer hold his love of technology and his love of the land in separate pockets. The AI revolution is the fastest industrial land grab in human history. It is consuming water, energy, and ancient landscapes in 12-week planning windows that most communities don't know exist. The Firewalkers exist to change that — by giving communities the tools, the intelligence, and the network to walk through this fire. We use AI to hold AI to account. We are not anti-technology. We are pro-wisdom. And we believe the future belongs to the stewards, not the extractors.*

---

The Firewalkers · firewalkers.earth · Founded June 2026
