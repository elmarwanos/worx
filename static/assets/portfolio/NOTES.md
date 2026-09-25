# Portfolio page assets

Drop project imagery here. Nothing in this folder is invented, every slot
maps to a real Worx project already listed on `portfolio/index.html`.

## 1. Mars hero image  (required for the hero)

| File | Spec |
|------|------|
| `mars-hero.jpg` | Cinematic, realistic Martian landscape. Landscape orientation, **≥ 2400 px wide**, dark enough on the left third for white text to sit on it (a scrim is applied, but don't start from a bright image). JPG or WebP, aim ≤ 500 KB after compression. |

Then in `portfolio/index.html`, inside `.folio-hero-media`, uncomment:

```html
<img class="folio-hero-img" src="../static/assets/portfolio/mars-hero.jpg" alt="">
```

Until the file is added, a layered CSS gradient in `portfolio.css` stands in
as a placeholder. Canvas particles + atmosphere already render on top.

## 2. Project screenshots  (one set per project, as they become available)

Full-page website screenshots, cropped naturally inside the device frames.
Naming = the project's anchor slug on the page.

| Project | Desktop file | Mobile file | Used by card |
|---------|--------------|-------------|--------------|
| Chaumet | `chaumet-desktop.png` | `chaumet-mobile.png` | laptop (auto-scroll) |
| Modon | `modon-desktop.png` |, | full-bleed scene |
| Hudayriyat Mar Vista |, | `hudayriyat-mar-vista-mobile.png` | phone (auto-scroll) |
| Hyundai | `hyundai-desktop.png` |, | tablet (auto-scroll) |
| Genesis | `genesis-desktop.png` |, | laptop (auto-scroll) |
| Kia Motors | `kia-motors-desktop.png` |, | close-up crop |
| UAE Pavilion | `uae-pavilion-desktop.png` |, | full-bleed scene |
| The Glimpse Project | `the-glimpse-project-desktop.png` |, | monitor (auto-scroll) |
| Wealthface |, | `wealthface-mobile.png` | phone (auto-scroll) |
| Tiara Dream | `tiara-dream-desktop.png` |, | full-bleed scene |
| Hisense | `hisense-desktop.png` | `hisense-mobile.png` | laptop + phone |
| LG & LG Kitchen Planner | `lg-kitchen-planner-desktop.png` |, | tablet (auto-scroll) |

- **Desktop capture:** ~1440 px viewport width, full page height.
- **Mobile capture:** ~390 px viewport width, full page height.
- Chrome DevTools → `Ctrl/Cmd + Shift + P` → "Capture full size screenshot".
- Any size/format is fine, send the raw capture, it will be optimised and placed.

Until a file exists, that card shows a **clearly-marked placeholder panel**
("Project screenshot" / "Project visual"), never a stand-in website.
The auto-scroll on the marked cards activates automatically once the real
image is in place.
