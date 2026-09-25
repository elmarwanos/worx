# Worx | Website

Static, multi-page marketing site for **Worx**, the web & software
development sister company of [The Glimpse Project](https://www.theglimpseproject.com).

No build step, no framework, open `index.html` or serve the folder and it runs.

## Structure

```
Worx/
├── index.html              Home, hero, stats, services, clients, process,
│                           testimonials, blog teasers, FAQ, CTA
├── about/index.html        Intro, vision & mission, goals, process
├── services/
│   ├── index.html          Service catalogue
│   ├── web-development.html
│   ├── mobile-apps.html
│   ├── ui-ux-design.html
│   ├── custom-platforms.html
│   ├── seo-sem.html
│   └── ar-vr.html
├── portfolio/index.html    Project case studies (Chaumet, Modon, Hyundai…)
├── blogs/
│   ├── index.html
│   ├── performance-seo.html
│   ├── choosing-your-stack.html
│   └── ar-activations.html
├── contact/index.html      Project planner: a 5-step wizard that
│                           personalises from ?service= / referrer /
│                           returning-visitor memory, builds a brief +
│                           service recommendation, hands off via mailto
└── static/
    ├── css/
    │   ├── base.css        Design tokens, reset, typography, utilities
    │   ├── layout.css      Header, nav, footer
    │   ├── components.css  Buttons, cards, FAQ, forms, marquee…
    │   └── animations.css  Reveal states + CSS fallbacks
    ├── js/
    │   ├── nav.js            Header scroll state, mobile menu, active link
    │   ├── animations.js     GSAP: hero stagger, scroll reveals, counters, marquee
    │   ├── main.js           FAQ accordion, footer year
    │   ├── contact-widget.js Floating "quick contact" dock, loaded on every
    │   │                     page except /contact (which has the full planner)
    │   └── contact.js        The /contact project planner wizard
    └── assets/
        ├── Dark Logo.png / Light Logo.png   Source logos (full stacked lockup)
        ├── favicon.png                       Source square mark
        ├── Starting Color Palette.png        Brand palette reference
        ├── logo-light.png                    Web-sized stacked logo (used in footer)
        ├── logo-dark.png                     Web-sized stacked logo for light backgrounds
        ├── mark.png                          Cream eye mark (header)
        ├── tile-orange.png / tile-cream.png  Square brand tiles (hero art)
        └── favicon-32.png, apple-touch-icon.png
```

The web-sized PNGs are derived from the source files with Pillow. If a source
logo changes, regenerate them rather than editing the derivatives.

## Editing

- **Colors / fonts / spacing**, everything is a CSS variable at the top of
  `static/css/base.css` (`:root`). The six brand colours from the palette are
  defined as `--brand-*` tokens; `--accent` (orange), `--accent-2` (amber) and
  `--accent-deep` (ember) are mapped from them. Dark surfaces (`--ink`,
  `--surface`, `--panel`) are derived from the cocoa brown.
- **Content**, each page is plain HTML; copy lives where you'd expect it.
- **Animations**, add `data-reveal` to any element to give it a scroll-in
  reveal. Stat counters use `data-count` / `data-suffix`. All motion respects
  `prefers-reduced-motion`.
- **Navigation highlighting**, each page sets `<body data-page="...">`,
  matched against `data-nav` on the header links.

## Running locally

```sh
cd Worx
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly from the filesystem also works.)

## Dependencies

Loaded from CDN, no install needed:

- [GSAP 3.12](https://gsap.com) + ScrollTrigger, scroll animations
- Google Fonts, Jost (display, echoes the geometric wordmark), Inter (body),
  JetBrains Mono (the `<like/magic>` tag)

If the CDN is unreachable, CSS fallbacks keep the site fully usable.
