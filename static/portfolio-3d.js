< !DOCTYPE html >
    <html lang="en">

        <head>
            <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Portfolio, Worx by Glimpse</title>
                    <meta name="description"
                        content="Selected work by Worx by Glimpse: Chaumet, Modon, Hyundai, Genesis, Kia, Hudayriyat, UAE Pavilion, Wealthface and more.">

                        <link rel="icon" type="image/png" sizes="32x32" href="../static/assets/favicon-32.png">
                            <link rel="apple-touch-icon" href="../static/assets/apple-touch-icon.png">
                                <meta name="theme-color" content="#150905">
                                    <link rel="preconnect" href="https://fonts.googleapis.com">
                                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                                            <link
                                                href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap"
                                                rel="stylesheet">

                                                <link rel="stylesheet" href="../static/css/base.css">
                                                    <link rel="stylesheet" href="../static/css/layout.css">
                                                        <link rel="stylesheet" href="../static/css/components.css">
                                                            <link rel="stylesheet" href="../static/css/animations.css">
                                                                <link rel="stylesheet" href="../static/css/portfolio.css">

                                                                    <style>
    /* Portfolio hero: new full-screen panoramic Mars image */
                                                                        body[data-page="portfolio"] .site-header {
                                                                            position: absolute !important;
                                                                        top: 0 !important;
                                                                        left: 0 !important;
                                                                        right: 0 !important;
                                                                        width: 100% !important;
                                                                        z-index: 100 !important;
                                                                        background: transparent !important;
                                                                        background-image: none !important;
                                                                        border: 0 !important;
                                                                        box-shadow: none !important;
                                                                        backdrop-filter: none !important;
                                                                        -webkit-backdrop-filter: none !important;
    }

                                                                        body[data-page="portfolio"] .site-header::before,
                                                                        body[data-page="portfolio"] .site-header::after {
                                                                            content: none !important;
                                                                        display: none !important;
    }

                                                                        body[data-page="portfolio"] main {
                                                                            margin - top: 0 !important;
                                                                        padding-top: 0 !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero {
                                                                            position: relative !important;
                                                                        width: 100% !important;
                                                                        height: 100vh !important;
                                                                        height: 100svh !important;
                                                                        min-height: 720px !important;
                                                                        margin: 0 !important;
                                                                        padding: 0 !important;
                                                                        overflow: hidden !important;
                                                                        isolation: isolate;
    }

                                                                        body[data-page="portfolio"] .folio-hero-media {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        transform: none !important;
                                                                        clip-path: none !important;
                                                                        overflow: hidden !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        z-index: 0 !important;
                                                                        background-image: url("../static/assets/portfolio/mars-landscape-hero.png") !important;
                                                                        background-size: cover !important;
                                                                        background-position: center 52% !important;
                                                                        background-repeat: no-repeat !important;
                                                                        transform: scale(1.015) !important;
                                                                        clip-path: none !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo-grade {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 1 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        background:
                                                                        linear-gradient(90deg,
                                                                        rgba(21, 9, 5, .62) 0%,
                                                                        rgba(21, 9, 5, .42) 38%,
                                                                        rgba(21, 9, 5, .24) 68%,
                                                                        rgba(21, 9, 5, .20) 100%),
                                                                        linear-gradient(0deg,
                                                                        rgba(21, 9, 5, .50) 0%,
                                                                        rgba(21, 9, 5, .10) 48%,
                                                                        rgba(21, 9, 5, .22) 100%) !important;
                                                                        opacity: .82 !important;
                                                                        pointer-events: none;
    }

                                                                        body[data-page="portfolio"] .mars-ember-glow {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 2 !important;
                                                                        pointer-events: none;
    }

                                                                        body[data-page="portfolio"] .folio-hero-particles {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 3 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        pointer-events: none;
    }

                                                                        body[data-page="portfolio"] .folio-hero-inner {
                                                                            position: relative !important;
                                                                        z-index: 5 !important;
                                                                        display: flex !important;
                                                                        min-height: 100% !important;
                                                                        flex-direction: column !important;
                                                                        justify-content: flex-end !important;
                                                                        align-items: flex-start !important;
                                                                        padding-top: 150px !important;
                                                                        padding-bottom: clamp(70px, 9vh, 120px) !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero::before,
                                                                        body[data-page="portfolio"] .folio-hero::after,
                                                                        body[data-page="portfolio"] .folio-hero-media::before,
                                                                        body[data-page="portfolio"] .folio-hero-media::after {
                                                                            content: none !important;
                                                                        display: none !important;
    }

                                                                        @media (max-width: 900px) {
                                                                            body[data - page= "portfolio"] .folio-hero {
                                                                            min - height: 650px !important;
      }

                                                                        body[data-page="portfolio"] .mars-photo {
                                                                            background - position: 56% center !important;
      }
    }

                                                                        @media (max-width: 600px) {
                                                                            body[data - page= "portfolio"] .folio-hero {
                                                                            min - height: 620px !important;
      }

                                                                        body[data-page="portfolio"] .mars-photo {
                                                                            background - position: 60% center !important;
      }

                                                                        body[data-page="portfolio"] .folio-hero-inner {
                                                                            padding - top: 120px !important;
                                                                        padding-bottom: 55px !important;
      }
    }
                                                                    </style>


                                                                    <style>
    /* Hero layering: landscape image behind the existing star animation */
                                                                        body[data-page="portfolio"] .folio-hero {
                                                                            position: relative !important;
                                                                        overflow: hidden !important;
                                                                        isolation: isolate !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-media {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 0 !important;
                                                                        overflow: hidden !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 0 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        background-image: url("../static/assets/portfolio/mars-landscape-hero.png") !important;
                                                                        background-size: cover !important;
                                                                        background-position: center center !important;
                                                                        background-repeat: no-repeat !important;
                                                                        opacity: .72 !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo-grade {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 1 !important;
                                                                        background:
                                                                        linear-gradient(90deg,
                                                                        rgba(21, 9, 5, .48) 0%,
                                                                        rgba(21, 9, 5, .26) 46%,
                                                                        rgba(21, 9, 5, .14) 100%),
                                                                        linear-gradient(0deg,
                                                                        rgba(21, 9, 5, .46) 0%,
                                                                        rgba(21, 9, 5, .08) 48%,
                                                                        rgba(21, 9, 5, .18) 100%) !important;
                                                                        opacity: 1 !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .mars-ember-glow {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 2 !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-particles {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 3 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-inner {
                                                                            position: relative !important;
                                                                        z-index: 4 !important;
    }

                                                                        body[data-page="portfolio"] .site-header {
                                                                            z - index: 10 !important;
    }
                                                                    </style>


                                                                    <style>
    /* FINAL HERO LAYERS
                                                                        0 Mars terrain background
                                                                        1 colour/opacity overlay
                                                                        2 existing ember glow
                                                                        3 existing animated stars
                                                                        4 hero copy
                                                                        10 navigation
                                                                        */
                                                                        body[data-page="portfolio"] .folio-hero {
                                                                            position: relative !important;
                                                                        overflow: hidden !important;
                                                                        isolation: isolate !important;
                                                                        background: #150905 !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-media {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 0 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        overflow: hidden !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 0 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;

                                                                        /* Mars terrain background image */
                                                                        background-image: url("../static/assets/portfolio/mars-landscape-hero.png") !important;
                                                                        background-size: cover !important;
                                                                        background-position: center center !important;
                                                                        background-repeat: no-repeat !important;

                                                                        opacity: .82 !important;
                                                                        transform: none !important;
                                                                        clip-path: none !important;
    }

                                                                        body[data-page="portfolio"] .mars-photo-grade {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 1 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        background:
                                                                        linear-gradient(90deg,
                                                                        rgba(21, 9, 5, .52) 0%,
                                                                        rgba(21, 9, 5, .28) 42%,
                                                                        rgba(21, 9, 5, .14) 72%,
                                                                        rgba(21, 9, 5, .10) 100%),
                                                                        linear-gradient(0deg,
                                                                        rgba(21, 9, 5, .52) 0%,
                                                                        rgba(21, 9, 5, .08) 52%,
                                                                        rgba(21, 9, 5, .20) 100%) !important;
                                                                        opacity: 1 !important;
    }

                                                                        body[data-page="portfolio"] .mars-ember-glow {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 2 !important;
                                                                        pointer-events: none !important;
    }

                                                                        /* Existing star animation stays untouched and renders over Mars */
                                                                        body[data-page="portfolio"] .folio-hero-particles {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 3 !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        opacity: 1 !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-inner {
                                                                            position: relative !important;
                                                                        z-index: 4 !important;
    }

                                                                        body[data-page="portfolio"] .site-header {
                                                                            z - index: 10 !important;
    }
                                                                    </style>


                                                                    <style>
    /* Three.js layer: above Mars image/grade, below the existing stars and copy */
                                                                        body[data-page="portfolio"] .mars-3d-canvas {
                                                                            position: absolute !important;
                                                                        inset: 0 !important;
                                                                        z-index: 2 !important;
                                                                        display: block !important;
                                                                        width: 100% !important;
                                                                        height: 100% !important;
                                                                        pointer-events: none !important;
    }

                                                                        body[data-page="portfolio"] .mars-ember-glow {
                                                                            z - index: 3 !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-particles {
                                                                            z - index: 4 !important;
    }

                                                                        body[data-page="portfolio"] .folio-hero-inner {
                                                                            z - index: 5 !important;
    }
                                                                    </style>

                                                                </head>

                                                                <body data-page="portfolio">
                                                                    <a class="skip-link" href="#main">Skip to content</a>

                                                                    <header class="site-header">
                                                                        <div class="container nav-bar">
                                                                            <a class="brand" href="../index.html"><img class="brand-mark" src="../static/assets/mark.png" alt="" width="40"
                                                                                height="40"><span class="brand-text">WORX<small>&lt;like/magic&gt;</small></span></a>
                                                                            <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">
                                                                                <span></span><span></span><span></span>
                                                                            </button>
                                                                            <nav class="nav-links" aria-label="Main navigation">
                                                                                <a href="../index.html" data-nav="home">Home</a>
                                                                                <a href="../services/index.html" data-nav="services">Services</a>
                                                                                <a href="../portfolio/index.html" data-nav="portfolio">Portfolio</a>
                                                                                <a href="../about/index.html" data-nav="about">About</a>
                                                                                <a href="../blogs/index.html" data-nav="blogs">Blog</a>
                                                                                <a href="../contact/index.html" class="btn btn-primary" data-nav="contact">Let's Talk</a>
                                                                            </nav>
                                                                        </div>
                                                                    </header>

                                                                    <main id="main">

                                                                        <!-- ====== Portfolio hero (Mars) ====== -->
                                                                        <section class="folio-hero">
                                                                            <div class="folio-hero-media" aria-hidden="true">
                                                                                <!-- Worx Mars landscape hero asset -->
                                                                                <div class="mars-photo"></div>
                                                                                <div class="mars-photo-grade"></div>
                                                                                <canvas id="mars3d" class="mars-3d-canvas" aria-hidden="true"></canvas>
                                                                                <div class="mars-ember-glow"></div>
                                                                                <canvas class="folio-hero-particles"></canvas>
                                                                            </div>
                                                                            <div class="container folio-hero-inner">
                                                                                <p class="eyebrow">Our Work</p>
                                                                                <h1>Ideas, built to make an <span class="gradient-text">impact</span>.</h1>
                                                                                <p class="folio-hero-lead" data-reveal>
                                                                                    Platforms, apps and campaigns for brands people already know
                                                                                    designed, built, and kept sharp long after launch.
                                                                                </p>
                                                                            </div>
                                                                        </section>

                                                                        <section class="section container folio-showcase-section">
                                                                            <ul class="folio-grid folio-editorial-grid">
                                                                                <li class="folio-card folio-card--laptop" data-scroll data-reveal
                                                                                    data-live-url="https://www.chaumet.com/ae_ar/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/chaumet.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--laptop">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">www.chaumet.com/ae_ar/</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/chaumet.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="folio-device__base"></div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://www.chaumet.com/ae_ar/" title="Live website preview"
                                                                                                    loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://www.chaumet.com/ae_ar/" target="_blank"
                                                                                            rel="noopener">Chaumet<span class="visually-hidden">, see
                                                                                                case study</span></a></h3>
                                                                                        <p class="folio-desc">Tailor-made online flagship for the 240-year-old jewellery Maison, built for luxury
                                                                                            shoppers across the MENA region.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--laptop" data-scroll data-reveal
                                                                                    data-live-url="https://www.genesis.com/ae/en/main.html">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/genesis.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--laptop">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">www.genesis.com/ae/en/main.html</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/genesis.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="folio-device__base"></div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://www.genesis.com/ae/en/main.html"
                                                                                                    title="Live website preview" loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://www.genesis.com/ae/en/main.html" target="_blank"
                                                                                            rel="noopener">Genesis<span class="visually-hidden">, see
                                                                                                case study</span></a></h3>
                                                                                        <p class="folio-desc">Web development and upkeep for the Genesis MEA pages, supporting the marque’s regional
                                                                                            luxury launch.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--duo" data-reveal data-live-url="https://hisenseme.com/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/hisense.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--laptop">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">hisenseme.com</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/hisense.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="folio-device__base"></div>
                                                                                            </div>
                                                                                            <div class="folio-device folio-device--phone">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">hisenseme.com</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/hisense.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://hisenseme.com/" title="Live website preview" loading="lazy"
                                                                                                    tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://hisenseme.com/" target="_blank"
                                                                                            rel="noopener">Hisense<span class="visually-hidden">, see
                                                                                                case study</span></a></h3>
                                                                                        <p class="folio-desc">Regional campaign web builds and content rollouts for one of the world’s
                                                                                            fastest-growing appliance brands.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--phone" data-scroll data-reveal
                                                                                    data-live-url="https://www.hudayriyatisland.ae/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/hudayriyat-mar-vista.png" alt=""
                                                                                            loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--phone">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">www.hudayriyatisland.ae/en</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/hudayriyat-mar-vista.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://www.hudayriyatisland.ae/" title="Live website preview"
                                                                                                    loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://www.hudayriyatisland.ae/en" target="_blank"
                                                                                            rel="noopener">Hudayriyat Mar Vista<span class="visually-hidden">, see case study</span></a></h3>
                                                                                        <p class="folio-desc">iOS and Android app upkeep plus the Marsana Events subpage for Abu Dhabi’s leisure and
                                                                                            recreation estate.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--tablet" data-scroll data-reveal data-live-url="https://hyundai-uae.com/en/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/hyundai.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--tablet">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">hyundai-uae.com/en</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/hyundai.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://hyundai-uae.com/en/" title="Live website preview"
                                                                                                    loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://hyundai-uae.com/en/" target="_blank"
                                                                                            rel="noopener">Hyundai<span class="visually-hidden">, see
                                                                                                case study</span></a></h3>
                                                                                        <p class="folio-desc">A rapidly built iPad app for Hyundai Motors Group, presented at Expo 2020’s Korean
                                                                                            pavilion.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--tablet" data-scroll data-reveal
                                                                                    data-live-url="https://lgkitchenplanner.com/sa_en/built-in-products/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/lg-kitchen-planner.png" alt=""
                                                                                            loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--tablet">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">lgkitchenplanner.com/sa_en/built-in-products</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/lg-kitchen-planner.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://lgkitchenplanner.com/sa_en/built-in-products/"
                                                                                                    title="Live website preview" loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://lgkitchenplanner.com/sa_en/built-in-products/"
                                                                                            target="_blank" rel="noopener">LG &amp; LG Kitchen Planner<span class="visually-hidden">, see case
                                                                                                study</span></a></h3>
                                                                                        <p class="folio-desc">Interactive planning tools that let customers visualise and configure LG’s kitchen
                                                                                            range before they buy.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--full" data-reveal data-live-url="https://www.modon.com/real-estate">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/modon.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-fill"><img class="folio-live-full" src="../static/assets/portfolio/live/modon.png" alt=""
                                                                                                loading="lazy"></div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://www.modon.com/real-estate" title="Live website preview"
                                                                                                    loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://www.modon.com/real-estate" target="_blank"
                                                                                            rel="noopener">Modon<span class="visually-hidden">, see case
                                                                                                study</span></a></h3>
                                                                                        <p class="folio-desc">Ongoing care of the corporate site for one of the UAE’s leading sustainable developers
                                                                                            , Drupal, on-page SEO and press releases.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--monitor" data-scroll data-reveal
                                                                                    data-live-url="https://theglimpseproject.com">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/the-glimpse-project.png" alt=""
                                                                                            loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--monitor">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">www.theglimpseproject.com</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/the-glimpse-project.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div class="folio-device__base"></div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://theglimpseproject.com" title="Live website preview"
                                                                                                    loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://www.theglimpseproject.com/" target="_blank"
                                                                                            rel="noopener">The Glimpse Project<span class="visually-hidden">, see case study</span></a></h3>
                                                                                        <p class="folio-desc">Our own studio site, designed in-house, built by Worx, and tuned to rank among the
                                                                                            best on Google’s Lighthouse.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--full" data-reveal data-live-url="https://tiara.ae/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/tiara-dream.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-fill"><img class="folio-live-full" src="../static/assets/portfolio/live/tiara-dream.png"
                                                                                                alt="" loading="lazy"></div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://tiara.ae/" title="Live website preview" loading="lazy"
                                                                                                    tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://tiara.ae/" target="_blank" rel="noopener">Tiara
                                                                                            Dream<span class="visually-hidden">
                                                                                                see case study</span></a></h3>
                                                                                        <p class="folio-desc">High-value campaign engineering, targeting, budgets and creative formats tuned until
                                                                                            daily enquiries became the norm.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--full" data-reveal
                                                                                    data-live-url="https://calatrava.com/projects/uae-pavilion-at-expo-dubai-united-arab-emirates.html">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/uae-pavilion.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-fill"><img class="folio-live-full" src="../static/assets/portfolio/live/uae-pavilion.png"
                                                                                                alt="" loading="lazy"></div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame"
                                                                                                    src="https://calatrava.com/projects/uae-pavilion-at-expo-dubai-united-arab-emirates.html"
                                                                                                    title="Live website preview" loading="lazy" tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link"
                                                                                            href="https://calatrava.com/projects/uae-pavilion-at-expo-dubai-united-arab-emirates.html"
                                                                                            target="_blank" rel="noopener">UAE Pavilion<span class="visually-hidden">
                                                                                                , see case study</span></a></h3>
                                                                                        <p class="folio-desc">Creative direction across photos, films and bilingual content under the theme “Land of
                                                                                            Dreamers Who Do”.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                                <li class="folio-card folio-card--phone" data-scroll data-reveal data-live-url="https://wealthface.com/">
                                                                                    <div class="folio-scene">
                                                                                        <img class="folio-card-bg" src="../static/assets/portfolio/live/wealthface.png" alt="" loading="lazy">
                                                                                            <span class="folio-floor" aria-hidden="true"></span>
                                                                                            <div class="folio-device folio-device--phone">
                                                                                                <div class="folio-device__screen">
                                                                                                    <div class="folio-browserbar" aria-hidden="true"><span
                                                                                                        class="folio-browserdots"><i></i><i></i><i></i></span><span
                                                                                                            class="folio-browserurl">wealthface.com</span></div>
                                                                                                    <div class="folio-viewport">
                                                                                                        <div class="folio-shot" data-folio-shot><img class="folio-live-shot"
                                                                                                            src="../static/assets/portfolio/live/wealthface.png" alt="" loading="lazy"></div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div class="folio-live-preview" aria-hidden="true">
                                                                                                <iframe class="folio-live-frame" src="https://wealthface.com/" title="Live website preview" loading="lazy"
                                                                                                    tabindex="-1"></iframe>
                                                                                            </div>
                                                                                    </div>
                                                                                    <div class="folio-body">
                                                                                        <h3 class="folio-name"><a class="folio-link" href="https://wealthface.com/" target="_blank"
                                                                                            rel="noopener">Wealthface<span class="visually-hidden">
                                                                                                see case study</span></a></h3>
                                                                                        <p class="folio-desc">An ongoing development partnership on an investment platform where security and clean
                                                                                            UX are non-negotiable.</p>
                                                                                        <span class="folio-cta" aria-hidden="true">
                                                                                            <span class="folio-cta-label">View Case Study</span>
                                                                                            <span class="folio-cta-arrow">&rarr;</span>
                                                                                        </span>
                                                                                    </div>
                                                                                </li>
                                                                            </ul>
                                                                        </section>

                                                                        <section class="section container">
                                                                            <div class="cta-band" data-reveal>
                                                                                <h2>Your project, <span class="gradient-text">next</span></h2>
                                                                                <p>Helping new brands start up and established ones start over.</p>
                                                                                <a href="../contact/index.html" class="btn btn-primary">Start a project</a>
                                                                            </div>
                                                                        </section>

                                                                    </main>

                                                                    <footer class="site-footer">
                                                                        <div class="container">
                                                                            <div class="footer-grid">
                                                                                <div class="footer-about">
                                                                                    <a class="brand brand--footer" href="../index.html"><img src="../static/assets/logo-light.png"
                                                                                        alt="Worx by Glimpse" width="132" height="181"></a>
                                                                                    <p>Your one-stop destination for innovative website and software development, bringing digital aspirations to
                                                                                        life, one line of code at a time.</p>
                                                                                </div>
                                                                                <div>
                                                                                    <h4>Explore</h4>
                                                                                    <ul>
                                                                                        <li><a href="../services/index.html">Services</a></li>
                                                                                        <li><a href="../portfolio/index.html">Portfolio</a></li>
                                                                                        <li><a href="../about/index.html">About us</a></li>
                                                                                        <li><a href="../blogs/index.html">Blog</a></li>
                                                                                        <li><a href="../contact/index.html">Contact</a></li>
                                                                                    </ul>
                                                                                </div>
                                                                                <div>
                                                                                    <h4>Social</h4>
                                                                                    <ul>
                                                                                        <li><a href="https://www.linkedin.com/company/worxbyglimpse" target="_blank" rel="noopener">LinkedIn</a>
                                                                                        </li>
                                                                                        <li><a href="https://www.instagram.com/worxbyglimpse" target="_blank" rel="noopener">Instagram</a></li>
                                                                                        <li><a href="https://www.facebook.com/worxbyglimpse" target="_blank" rel="noopener">Facebook</a></li>
                                                                                        <li><a href="https://www.theglimpseproject.com" target="_blank" rel="noopener">Glimpse</a></li>
                                                                                    </ul>
                                                                                </div>
                                                                                <div>
                                                                                    <h4>Contact</h4>
                                                                                    <ul>
                                                                                        <li><a href="mailto:Hello@worxbyglimpse.com">Hello@worxbyglimpse.com</a></li>
                                                                                        <li><a href="tel:+971555669847">+971 55 566 9847</a></li>
                                                                                        <li>Unit 404 Makateb 2,<br>Dubai Production City,<br>PO Box 503417, Dubai, UAE</li>
                                                                                        </ul>
                                                                                        </div>
                                                                                </div>
                                                                                <div class="footer-bottom">
                                                                                    <span>© <span id="footer-year">2026</span> Worx by Glimpse. All rights reserved.</span>
                                                                                    <span>Built for businesses, by creatives.</span>
                                                                                </div>
                                                                            </div>
                                                                    </footer>

                                                                    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
                                                                    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
                                                                    <script src="../static/js/nav.js"></script>
                                                                    <script src="../static/js/animations.js"></script>
                                                                    <script src="../static/js/main.js"></script>
                                                                    <script type="module" src="../static/js/portfolio-3d.js"></script>
                                                                    <script src="../static/js/portfolio.js"></script>
                                                                </body>

                                                            </html>