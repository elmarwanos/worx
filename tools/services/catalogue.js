/* ============================================================
   Worx | tools/services/catalogue.js
   The single source of truth for every Worx service.
   `node tools/services/build.js` turns this into:
     - the Services mega menu in every page header
     - the fleet panels, star map, marquee, flight-plan crews
       and mission builder on services/index.html
   Edit here, then re-run the build. Never hand-edit the
   generated blocks (they sit between WORX:GEN markers).

   Fields
     division.id      anchor on the services page (#sys-<id>)
     division.scene   which animated scene the fleet panel uses
     service.page     detail page in /services, when one exists
     service.short    one line for menus and hover cards
     service.subs     capabilities listed under the service
   ============================================================ */

module.exports = [
  {
    id: "development",
    name: "Development",
    tagline: "Websites and platforms engineered to load fast, rank well and scale.",
    scene: "web",
    services: [
      {
        slug: "web-development",
        name: "Web Development",
        page: "web-development.html",
        short: "Fast, secure, search-friendly websites on the right stack.",
        subs: ["Sitecore", "Ibexa DXP", "SharePoint", "WordPress", "Drupal", "Joomla", "ASP.NET", "AngularJS", "Ruby on Rails", "CMS development", "Laravel", "PHP", "Python", "Enterprise development", "Website maintenance", "Pentesting", "WhatsApp integration"]
      },
      {
        slug: "ecommerce",
        name: "E-commerce Development",
        short: "Storefronts that sell, from boutique brands to marketplaces.",
        subs: ["Shopify", "Shopify Plus", "WooCommerce", "Magento", "BigCommerce", "Mirakl marketplaces", "Headless commerce"]
      },
      {
        slug: "custom-platforms",
        name: "Custom Platforms",
        page: "custom-platforms.html",
        short: "Portals, dashboards and tools built around your workflow.",
        subs: ["Web portals", "Dashboards & tooling", "Integrations", "Smart automation", "Interactive configurators", "Security & compliance"]
      }
    ]
  },
  {
    id: "mobile",
    name: "Mobile",
    tagline: "Apps people keep, on every platform they carry.",
    scene: "mobile",
    services: [
      {
        slug: "mobile-apps",
        name: "Mobile App Development",
        page: "mobile-apps.html",
        short: "Native and cross-platform apps, maintained for years.",
        subs: ["iOS apps", "Android apps", "Flutter", "React Native", "Hybrid apps", "Progressive web apps", "Event & kiosk apps", "Unity & 3D apps", "Backend & APIs", "App maintenance"]
      }
    ]
  },
  {
    id: "creative",
    name: "Design & Creative",
    tagline: "Interfaces, identities, words and motion that make brands unmistakable.",
    scene: "uiux",
    services: [
      {
        slug: "ui-ux-design",
        name: "UI/UX Design",
        page: "ui-ux-design.html",
        short: "Research-driven interfaces that make the right action obvious.",
        subs: ["UX design", "UX audit", "UX workshops", "Landing page design", "Responsive web design", "Design systems", "Prototyping", "PSD to HTML", "Graphic design", "Google 3D map design"]
      },
      {
        slug: "branding",
        name: "Digital Branding & Creatives",
        short: "Identities with a point of view, from logo to packaging.",
        subs: ["Logo design", "Corporate identity", "Brand guidelines", "Packaging design", "Brochure design", "Business card design"]
      },
      {
        slug: "video-animation",
        name: "2D/3D Video Animation",
        short: "Explainers, product films and walkthroughs that move people.",
        subs: ["Explainer videos", "Character animation", "Whiteboard animation", "Product demo videos", "Video game trailers", "Medical animation", "3D architectural walkthroughs"]
      },
      {
        slug: "copywriting",
        name: "Copywriting",
        short: "Words that sound like you and sell like a pro.",
        subs: ["Website copy", "Ad & campaign copy", "Brand voice", "Content writing", "Arabic & English translation"]
      }
    ]
  },
  {
    id: "emerging",
    name: "Emerging Tech",
    tagline: "AI and immersive experiences that put you a step ahead.",
    scene: "arvr",
    services: [
      {
        slug: "artificial-intelligence",
        name: "Artificial Intelligence",
        short: "Chatbots, automation and search that work while you sleep.",
        subs: ["AI chatbots", "Robotic process automation", "AI enterprise search", "Metaverse development"]
      },
      {
        slug: "ar-vr",
        name: "AR / VR & Mixed Reality",
        page: "ar-vr.html",
        short: "Immersive activations engineered to stop crowds.",
        subs: ["Augmented reality", "Virtual reality", "Mixed reality", "Interactive activations", "3D & Unity", "Event support"]
      }
    ]
  },
  {
    id: "it",
    name: "IT & Enterprise",
    tagline: "The systems, clouds and people that keep a business running.",
    scene: "platform",
    services: [
      {
        slug: "erp-crm",
        name: "ERP & CRM",
        short: "One connected system for finance, people, supply and sales.",
        subs: ["NetSuite", "SAP", "Microsoft Dynamics 365", "Oracle Cloud", "Odoo", "CRM development"]
      },
      {
        slug: "it-outsourcing",
        name: "IT Resource Outsourcing",
        short: "Vetted specialists who join your team in days.",
        subs: ["Hire scrum masters", "Hire project managers", "Hire SQA engineers", "Hire ReactJS developers", "Hire NodeJS developers", "Hire .NET developers", "Hire React Native developers", "Hire mobile app developers", "Hire SharePoint developers", "Hire Dynamics 365 developers", "Hire AWS resources", "Hire Azure developers"]
      },
      {
        slug: "cloud",
        name: "Cloud Transformation",
        short: "Move to the cloud and keep it secure, fast and affordable.",
        subs: ["Digital cloud transformation", "Cloud migration", "AWS", "Microsoft Azure", "Security & compliance"]
      }
    ]
  }
];
