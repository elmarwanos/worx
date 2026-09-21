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
    │   ├── contact-widget.js Floating "quick contact" dock — loaded on every
    │   │                     page except /contact (which has the full planner)
    │   └── contact.js        The /contact project planner wizard
