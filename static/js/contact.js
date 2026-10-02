/* ============================================================
   Worx | contact.js
   The /contact "project planner": five short questions, one at
   a time, answered in plain language and interactive cards,
   never a technical spec sheet. Worx makes the technical calls
   during discovery; the client just explains what they need.

     1. What do you need?  (the services, as on /services, the kind of
        build, and their idea in their own words)
     2. What do you want it to achieve?
     3. Timeline
     4. Budget
     5. Let's make it happen.  (company + personal details)

   All answers live in one structured object (state.form). There
   is no backend in this static build: on send it POSTs the
   answers straight to Formspree (FORMSPREE_ENDPOINT below), which
   relays them by email, then shows a success screen in place of
   the form.

   Everything the questionnaire asks comes from the CONFIG block
   at the top, edit the data, not the render code.
   ============================================================ */

(function () {
  "use strict";

  var mount = document.getElementById("contact-wizard");
  if (!mount) return;

  /* ----------------------------------------------------------
     1. CONFIG
     ---------------------------------------------------------- */

  var STORE_KEY = "worx.contact.v4";
  var MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
  var FORMSPREE_ENDPOINT = "https://formspree.io/f/xeaojvzn";
  var IDEA_CAP = 1400; // keep the idea field a reasonable size

  // EmailJS sends the client a confirmation email once Formspree has
  // captured the lead (Formspree's own autoresponder is a paid feature).
  var EMAILJS_PUBLIC_KEY = "wm49sHmSgdQ04r0O-";
  var EMAILJS_SERVICE_ID = "service_5rgzqe1";
  var EMAILJS_TEMPLATE_ID = "template_j30lcxg";

  var BUILD_OPTIONS = [
    { value: "website",    label: "Website",             desc: "A site that tells people who you are, or gets you found" },
    { value: "web-app",    label: "Web application",     desc: "Something people log into and actually use" },
    { value: "mobile-app", label: "Mobile application",  desc: "An app for iOS or Android" },
    { value: "platform",   label: "Software / platform", desc: "A bigger system, for your team or your customers" },
    { value: "unsure",     label: "Not sure yet",        desc: "Tell us the idea and we'll help shape it" }
  ];

  var GOAL_OPTIONS = [
    { value: "customers",   label: "Get more customers" },
    { value: "sell-more",   label: "Sell more products or services" },
    { value: "credibility", label: "Build credibility for my business" },
    { value: "launch",      label: "Launch a new idea" },
    { value: "efficiency",  label: "Make something easier or more efficient" },
    { value: "replace",     label: "Replace or improve an existing system" },
    { value: "other",       label: "Something else" }
  ];

  // Timeline, preserved as-is from the previous questionnaire.
  var TIMELINE_OPTIONS = [
    { value: "lt-1m",    label: "Less than 1 month" },
    { value: "1-3m",     label: "1–3 months" },
    { value: "3-6m",     label: "3–6 months" },
    { value: "6m-plus",  label: "6+ months" },
    { value: "flexible", label: "Flexible" }
  ];

  // Budget, a continuous AED slider, $1,000-equivalent increments.
  var BUDGET_MIN = 5000;
  var BUDGET_MAX = 250000;
  var BUDGET_STEP = 1000;
  // the gauge opens with its needle at the middle of the dial
  var DEFAULT_BUDGET_AMOUNT = 125000;

  var STEPS = [
    { id: "build",    legend: "What do you need?", type: "build" },
    { id: "goal",     legend: "What do you want it to achieve?", type: "goal" },
    { id: "timeline", legend: "What's your timeline?",
      type: "radio", field: "timeline", options: TIMELINE_OPTIONS },
    { id: "budget",   legend: "What's your budget?",
      hint: "A ballpark in AED, drag to adjust. We'll refine the exact figure together.", type: "budget" },
    { id: "final",    legend: "Let's make it happen.",
      hint: "Tell us a little about you and your company so we can get back to you.", type: "final" }
  ];

  /* ----------------------------------------------------------
     2. STATE
     ---------------------------------------------------------- */

  function freshForm() {
    return {
      services: [],
      buildType: "", idea: "",
      goal: "", goalOther: "",
      timeline: "",
      budget: null,
      companyName: "", companyWebsite: "",
      name: "", email: "", phone: ""
    };
  }

  var state = {
    stepIndex: 0,
    view: "form",             // "form" | "success"
    form: freshForm(),
    completedAt: null
  };

  // Services picked in the brief builder on /services arrive as
  // ?services=Web Development,UI/UX Design. They become the brief on
  // question 1 (removable), ride on the mission ticket and go with the
  // enquiry. A fresh pick always wins over a saved draft (init()).
  var incoming = [];
  try {
    var picked = new URLSearchParams(window.location.search).get("services");
    if (picked) {
      incoming = picked.split(",").map(function (x) { return x.trim().slice(0, 60); })
        .filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 16);
    }
  } catch (e) {}

  // The services, grouped as on /services (the page carries them as
  // #cw-services, written by tools/services/build.js from catalogue.js,
  // so both pages always offer the same list).
  var SERVICE_GROUPS = [];
  try { SERVICE_GROUPS = JSON.parse(document.getElementById("cw-services").textContent) || []; } catch (e) {}
  var ALL_SERVICES = [];
  SERVICE_GROUPS.forEach(function (g) { g.services.forEach(function (n) { ALL_SERVICES.push(n); }); });
  // a pick that arrives must be one of them
  if (ALL_SERVICES.length) incoming = incoming.filter(function (x) { return ALL_SERVICES.indexOf(x) >= 0; });

  // the build card a pick points to, when it only points to one
  var SERVICE_BUILD = {
    "Web Development": "website", "E-commerce Development": "website", "UI/UX Design": "website",
    "Mobile App Development": "mobile-app",
    "Custom Platforms": "platform", "CMS & CRM": "platform", "Cloud Transformation": "platform",
    "Artificial Intelligence": "platform", "IT Resource Outsourcing": "platform",
    "CRAMS": "platform"
  };
  function buildFromServices(list) {
    var types = [];
    list.forEach(function (x) { var t = SERVICE_BUILD[x]; if (t && types.indexOf(t) < 0) types.push(t); });
    return types.length === 1 ? types[0] : "";
  }

  var firstRender = true;

  /* ----------------------------------------------------------
     3. HELPERS
     ---------------------------------------------------------- */

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "for") n.htmlFor = v;
        else if (k === "checked" || k === "hidden" || k === "disabled") n[k] = !!v;
        else n.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function labelFor(list, value) {
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i].label;
    return "";
  }

  function isLastStep() { return state.stepIndex === STEPS.length - 1; }

  function anyAnswered() {
    var f = state.form;
    return !!((f.services && f.services.length) || f.buildType || f.idea.trim() || f.goal ||
      f.timeline || f.companyName.trim() || f.name.trim() || f.email.trim() || f.phone.trim());
  }

  function formatAED(amount) {
    return "AED " + amount.toLocaleString("en-US");
  }

  function budgetAmount() {
    var b = state.form.budget;
    return b && typeof b.amount === "number" ? b.amount : DEFAULT_BUDGET_AMOUNT;
  }

  function applyBudget(amount) {
    amount = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, amount || DEFAULT_BUDGET_AMOUNT));
    state.form.budget = { currency: "AED", amount: amount, label: formatAED(amount) };
  }

  // Full mission access: past the top of the scale, no ceiling
  var FULL_LABEL = "Full mission access";
  function applyFullBudget() {
    state.form.budget = { currency: "AED", amount: BUDGET_MAX, full: true, label: FULL_LABEL + " (" + formatAED(BUDGET_MAX) + "+)" };
  }
  function budgetFull() { return !!(state.form.budget && state.form.budget.full); }
  function budgetText() { return budgetFull() ? FULL_LABEL : formatAED(budgetAmount()); }

  /* ----------------------------------------------------------
     4. PERSISTENCE  (best-effort, the questionnaire works without it)
     ---------------------------------------------------------- */

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== 4 || !data.updatedAt) return null;
      if (Date.now() - data.updatedAt > MAX_AGE) {
        window.localStorage.removeItem(STORE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 4,
        updatedAt: Date.now(),
        completedAt: state.completedAt,
        stepIndex: state.stepIndex,
        form: state.form
      }));
    } catch (e) { /* storage full or unavailable, carry on */ }
  }

  function clearState() {
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  /* ----------------------------------------------------------
     5. COPY + MAIL HANDOFF
     ---------------------------------------------------------- */

  function applyCopy(saved) {
    var title = document.getElementById("contact-title");
    var intro = document.getElementById("contact-intro");
    if (incoming.length) {
      if (title) title.innerHTML = 'Your brief is <span class="gradient-text">on board</span>';
      if (intro) intro.textContent = "You picked " + (incoming.length === 1 ? "a service" : incoming.length + " services") +
        ". A few quick questions and it's on its way to the crew.";
    } else if (saved && saved.completedAt) {
      if (title) title.innerHTML = 'Good to <span class="gradient-text">hear from you</span>';
      if (intro) intro.textContent = "We've already got your enquiry on file, send another any time.";
    } else if (saved && anyAnswered()) {
      if (title) title.innerHTML = 'Welcome <span class="gradient-text">back</span>';
      if (intro) intro.textContent = "Pick up right where you left off.";
    }
  }

  function truncate(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // Formspree reads _subject/_replyto itself (sets the notification
  // email's subject line and Reply-To respectively); everything else
  // shows up as a plain field in that notification and in the
  // Formspree dashboard.

  // EmailJS reads these as {{variable}} placeholders in template_j30lcxg.
  // company_name is Worx's own name (the sender), not the client's.
  function buildEmailJsParams() {
    var f = state.form;
    return {
      to_name: f.name,
      to_email: f.email,
      reply_to: f.email,
      company_name: "The Worx Team",
      client_company: f.companyName,
      services: f.services && f.services.length ? f.services.join(", ") : "-",
      build_type: labelFor(BUILD_OPTIONS, f.buildType) || "-",
      // the Quick Enquiry widget shares this template: both send the
      // client's words as {{message}}
      message: truncate(f.idea.trim(), IDEA_CAP),
      idea: truncate(f.idea.trim(), IDEA_CAP),
      goal: f.goal === "other" ? (f.goalOther.trim() || "Something else") : (labelFor(GOAL_OPTIONS, f.goal) || "-"),
      timeline: labelFor(TIMELINE_OPTIONS, f.timeline) || "-",
      budget: f.budget ? f.budget.label : "-"
    };
  }

  function sendConfirmationEmail() {
    if (typeof emailjs === "undefined") return;
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, buildEmailJsParams())
      .catch(function (err) {
        // Best effort: the lead is already captured via Formspree, so a
        // failed confirmation email never blocks the success screen.
        console.error("EmailJS confirmation failed:", err);
      });
  }

  function buildFormspreePayload() {
    var f = state.form;
    return {
      _subject: "New enquiry, " + (f.companyName || "Website project") +
        (f.buildType ? " (" + labelFor(BUILD_OPTIONS, f.buildType) + ")" : ""),
      _replyto: f.email,
      services: f.services && f.services.length ? f.services.join(", ") : "-",
      building: labelFor(BUILD_OPTIONS, f.buildType) || "-",
      idea: truncate(f.idea.trim(), IDEA_CAP),
      goal: labelFor(GOAL_OPTIONS, f.goal) || "-",
      goalOther: f.goal === "other" ? f.goalOther.trim() : "",
      timeline: labelFor(TIMELINE_OPTIONS, f.timeline) || "-",
      budget: f.budget ? f.budget.label : "-",
      companyName: f.companyName,
      companyWebsite: f.companyWebsite.trim(),
      name: f.name,
      email: f.email,
      phone: f.phone
    };
  }

  /* ----------------------------------------------------------
     6. SKELETON  (built once)
     ---------------------------------------------------------- */

  var els = {};

  function buildSkeleton() {
    els.progressFill = h("i");
    els.progress = h("div", { "class": "cw-progress", "aria-hidden": "true" }, [els.progressFill]);

    els.stepCount = h("p", { "class": "cw-step-count" });
    els.startOver = h("button", { type: "button", "class": "cw-startover" }, ["Start over"]);
    var headRow = h("div", { "class": "cw-head-row" }, [els.stepCount, els.startOver]);
    els.head = h("div", { "class": "cw-head" }, [els.progress, headRow]);

    els.resume = h("div", { "class": "cw-resume", hidden: true });

    els.steps = h("div", { "class": "cw-steps" });
    els.live = h("p", { "class": "cw-live", "aria-live": "polite", role: "status" });

    els.back = h("button", { type: "button", "class": "btn btn-ghost", "data-back": "" }, ["Back"]);
    els.next = h("button", { type: "button", "class": "btn btn-primary", "data-next": "" }, ["Next"]);
    els.nav = h("div", { "class": "cw-nav" }, [els.back, els.next]);

    els.form = h("form", { "class": "cw-form", novalidate: "" }, [els.steps, els.live, els.nav]);
    els.stage = h("div", { "class": "cw-stage" }, [els.form]);

    mount.appendChild(h("div", { "class": "cw" }, [els.head, els.resume, els.stage]));

    els.back.addEventListener("click", onBack);
    els.next.addEventListener("click", onNext);
    // No submit button in the form, so Enter in a text field would
    // otherwise implicitly submit and reload the page, use it to
    // advance instead, which doubles as free keyboard navigation.
    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.view !== "success") onNext();
    });
    els.startOver.addEventListener("click", function () {
      if (anyAnswered() && !window.confirm("Clear your answers and start over?")) return;
      resetAll();
    });
  }

  /* ----------------------------------------------------------
     7. RENDER
     ---------------------------------------------------------- */

  function render() {
    if (state.view === "success") renderSuccess();
    else renderStep();
    renderProgress();
    renderNav();
    firstRender = false;
  }

  function renderStep() {
    var step = STEPS[state.stepIndex];
    els.steps.innerHTML = "";
    // Question 1's cards get the full page width; every other question
    // stays in the narrow conversational column.
    els.stage.classList.toggle("cw-stage--wide", step.id === "build" || step.id === "final");

    var legend = h("legend", { "class": "cw-legend", tabindex: "-1" }, [step.legend]);
    var fieldset = h("fieldset", { "class": "cw-step" }, [
      legend,
      step.hint ? h("p", { "class": "cw-hint" }, [step.hint]) : null
    ]);

    var body = null;
    if (step.type === "build") body = renderBuild();
    else if (step.type === "goal") body = renderGoal();
    else if (step.type === "radio") body = renderRadio(step);
    else if (step.type === "budget") body = renderBudget();
    else if (step.type === "final") body = renderFinal();
    if (body) fieldset.appendChild(body);

    els.err = h("p", { id: "cw-error", "class": "cw-error", role: "alert", hidden: true });
    fieldset.appendChild(els.err);
    els.steps.appendChild(fieldset);

    els.live.textContent = "Question " + (state.stepIndex + 1) + " of " + STEPS.length +
      ": " + step.legend;
    if (!firstRender) legend.focus();
  }

  // Renders a set of interactive answer cards and wires a single-select
  // change handler. `onPick` fires with the chosen value. `extraClass`
  // (optional) adds a layout modifier, e.g. the wide 4-across grid on Q1.
  function renderCards(options, groupName, current, ariaLabel, onPick, extraClass) {
    var group = h("div", {
      "class": "cw-options" + (extraClass ? " " + extraClass : ""),
      role: "radiogroup", "aria-label": ariaLabel
    });
    options.forEach(function (opt) {
      var checked = current === opt.value;
      var input = h("input", { type: "radio", name: groupName, value: opt.value, checked: checked });
      var label = h("label", { "class": "cw-option" + (checked ? " is-selected" : "") }, [
        input,
        h("span", { "class": "cw-option-body" }, [
          h("span", { "class": "cw-option-label" }, [opt.label]),
          // a plain space keeps label and description apart in the
          // element's text (screen readers, the cursor readout)
          opt.desc ? " " : null,
          opt.desc ? h("span", { "class": "cw-option-desc" }, [opt.desc]) : null
        ])
      ]);
      input.addEventListener("change", function () {
        group.querySelectorAll(".cw-option").forEach(function (el) {
          el.classList.remove("is-selected");
        });
        label.classList.add("is-selected");
        onPick(opt.value);
      });
      group.appendChild(label);
    });
    return group;
  }

  // --- The answer cards: every choice is a mission module -------------
  // Each card gets a blueprint that draws itself in as the card arrives,
  // comes alive under the pointer (one motion per blueprint, named by its
  // class in contact.css: ba-type, ba-bars, ba-swipe, ba-nudge, ba-data,
  // ba-spin, ba-spin-r, ba-pulse, ba-lift) and glows once picked; the card
  // tilts toward the pointer and locks on when chosen. Purely decorative:
  // the radio and its label are unchanged.
  var BUILD_ART = {
    "website": '<rect x="6" y="6" width="108" height="60" rx="5"/><path d="M6 16h108"/><circle cx="13" cy="11" r="1.6"/><circle cx="19" cy="11" r="1.6"/><circle cx="25" cy="11" r="1.6"/><g class="ba-type"><path d="M16 28h44"/><path d="M16 36h32"/><path d="M16 44h38"/></g><g class="ba-pulse"><rect x="72" y="24" width="32" height="30" rx="3"/><path d="M72 48l10-9 7 6 6-4 9 7"/></g>',
    "web-app": '<rect x="6" y="6" width="108" height="60" rx="5"/><path d="M30 6v60"/><path d="M12 18h12"/><path d="M12 26h12"/><path d="M12 34h12"/><g class="ba-bars"><path d="M44 56V42"/><path d="M56 56V32"/><path d="M68 56V46"/><path d="M80 56V26"/><path d="M92 56V38"/></g><circle class="ba-pulse" cx="102" cy="16" r="4"/>',
    "mobile-app": '<rect x="42" y="4" width="36" height="64" rx="7"/><path d="M54 9h12"/><g class="ba-swipe"><rect x="47" y="16" width="26" height="18" rx="2"/><path d="M47 42h26"/><path d="M47 49h18"/><path d="M47 56h22"/></g><g class="ba-nudge"><path d="M26 30l-8 6 8 6"/><path d="M94 30l8 6-8 6"/></g>',
    "platform": '<circle class="ba-pulse" cx="60" cy="36" r="8"/><circle cx="20" cy="16" r="5"/><circle cx="100" cy="16" r="5"/><circle cx="20" cy="56" r="5"/><circle cx="100" cy="56" r="5"/><path d="M25 18l28 13"/><path d="M95 18l-28 13"/><path d="M25 54l28-13"/><path d="M95 54l-28-13"/><g class="ba-data"><path d="M25 18l28 13"/><path d="M95 54l-28-13"/></g>',
    "unsure": '<g class="ba-spin"><ellipse cx="60" cy="36" rx="40" ry="13"/></g><g class="ba-spin-r"><ellipse cx="60" cy="36" rx="20" ry="30"/></g><circle class="ba-pulse" cx="60" cy="36" r="4"/><circle cx="100" cy="36" r="2.4"/><circle cx="60" cy="6" r="1.8"/>'
  };
  var GOAL_ART = {
    "customers": '<circle cx="36" cy="30" r="7"/><path d="M22 58c2-9 8-13 14-13s12 4 14 13"/><circle cx="84" cy="30" r="7"/><path d="M70 58c2-9 8-13 14-13s12 4 14 13"/><g class="ba-lift"><circle cx="60" cy="22" r="8"/><path d="M44 62c3-11 9-16 16-16s13 5 16 16"/></g>',
    "sell-more": '<g class="ba-bars"><path d="M24 62V48"/><path d="M42 62V40"/><path d="M60 62V32"/><path d="M78 62V24"/></g><g class="ba-type"><path d="M18 42l22-12 16 6 30-22"/></g><path d="M78 14h10v10"/>',
    "credibility": '<path d="M60 6l28 10v17c0 16-12 26-28 33-16-7-28-17-28-33V16z"/><g class="ba-type"><path d="M47 35l9 9 17-18"/></g><g class="ba-pulse"><path d="M60 14l18 7v12c0 11-8 18-18 23"/></g>',
    "launch": '<g class="ba-lift"><path d="M60 6c10 8 14 20 14 32l-6 10H52l-6-10c0-12 4-24 14-32z"/><circle cx="60" cy="28" r="5"/><path d="M46 38l-8 9 8 4"/><path d="M74 38l8 9-8 4"/></g><g class="ba-nudge"><path d="M55 54l-2 8"/><path d="M60 54v11"/><path d="M65 54l2 8"/></g>',
    "efficiency": '<g class="ba-spin"><circle cx="42" cy="36" r="14"/><path d="M42 16v6"/><path d="M42 50v6"/><path d="M22 36h6"/><path d="M56 36h6"/><path d="M28 22l4 4"/><path d="M52 46l4 4"/><path d="M28 50l4-4"/><path d="M52 26l4-4"/></g><circle cx="42" cy="36" r="5"/><g class="ba-type"><path d="M90 12l-12 22h12l-10 24"/></g>',
    "replace": '<rect x="10" y="20" width="30" height="30" rx="4"/><g class="ba-pulse"><rect x="80" y="20" width="30" height="30" rx="4"/></g><g class="ba-nudge"><path d="M48 29h24l-6-6"/><path d="M72 43H48l6 6"/></g>',
    "other": '<g class="ba-pulse"><path d="M60 8l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/></g><g class="ba-spin"><circle cx="92" cy="18" r="2.4"/><circle cx="28" cy="56" r="2.8"/><circle cx="96" cy="58" r="1.8"/></g>'
  };
  // timelines are trajectories: the further off, the longer the flight
  var TIMELINE_ART = {
    "lt-1m": '<circle cx="12" cy="58" r="3"/><path d="M12 58Q30 30 48 44"/><circle class="ba-pulse" cx="50" cy="45" r="5"/><g class="ba-data"><path d="M12 58Q30 30 48 44"/></g>',
    "1-3m": '<circle cx="12" cy="58" r="3"/><path d="M12 58Q46 12 78 40"/><circle class="ba-pulse" cx="81" cy="42" r="6"/><g class="ba-data"><path d="M12 58Q46 12 78 40"/></g>',
    "3-6m": '<circle cx="12" cy="58" r="3"/><path d="M12 58Q60 -2 104 36"/><circle class="ba-pulse" cx="107" cy="38" r="7"/><g class="ba-data"><path d="M12 58Q60 -2 104 36"/></g>',
    "6m-plus": '<circle class="ba-pulse" cx="60" cy="36" r="8"/><ellipse cx="60" cy="36" rx="48" ry="18"/><g class="ba-spin"><circle cx="108" cy="36" r="3"/></g><path d="M18 36h-8"/>',
    "flexible": '<path d="M30 36C30 20 54 20 60 36C66 52 90 52 90 36C90 20 66 20 60 36C54 52 30 52 30 36Z"/><g class="ba-data"><path d="M30 36C30 20 54 20 60 36C66 52 90 52 90 36C90 20 66 20 60 36C54 52 30 52 30 36Z"/></g>'
  };
  var BUILD_CODE = { "website": "WEB", "web-app": "APP", "mobile-app": "MOB", "platform": "SYS", "unsure": "IDEA" };
  var fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // a short haptic tick on phones that have one
  function buzz(p) { if (!reducedMotion && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
  // art: value -> blueprint; code(i, value): the card's module code
  function dressCards(group, art, code, rowLayout) {
    group.classList.add("cw-modules");
    if (rowLayout) group.classList.add("cw-modules--row");
    var cards = group.querySelectorAll(".cw-option");
    Array.prototype.forEach.call(cards, function (card, i) {
      var input = card.querySelector("input");
      var v = input ? input.value : "";
      var box = document.createElement("span");
      box.className = "cw-art";
      box.setAttribute("aria-hidden", "true");
      box.innerHTML = '<svg viewBox="0 0 120 72">' + (art[v] || "") + "</svg>";
      var tag = document.createElement("span");
      tag.className = "cw-art-code";
      tag.setAttribute("aria-hidden", "true");
      tag.textContent = code(i, v);
      // every stroke draws in (pathLength 1 makes one dash fit any shape)
      Array.prototype.forEach.call(box.querySelectorAll("path, rect, circle, ellipse"), function (el, k) {
        el.setAttribute("pathLength", "1");
        el.style.setProperty("--k", k);
      });
      card.style.setProperty("--i", i);
      var body = card.querySelector(".cw-option-body");
      card.insertBefore(box, body);
      body.insertBefore(tag, body.firstChild);
      var vf = document.createElement("span");
      vf.className = "cw-art-vf";
      vf.setAttribute("aria-hidden", "true");
      card.appendChild(vf);
      if (!fineHover || reducedMotion) return;
      // the card leans toward the pointer
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", ((x - 0.5) * 10).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - y) * 8).toFixed(2) + "deg");
        card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
    // a pick locks on: the brackets snap in and a scan crosses the card
    group.addEventListener("change", function (e) {
      var card = e.target.closest(".cw-option");
      if (!card) return;
      card.classList.remove("is-locking"); void card.offsetWidth; card.classList.add("is-locking");
    });
  }
  var pad2c = function (n) { return (n < 9 ? "0" : "") + (n + 1); };
  function dressBuildCards(group) {
    dressCards(group, BUILD_ART, function (i, v) { return "MODULE " + pad2c(i) + " · " + (BUILD_CODE[v] || ""); }, false);
  }

  // --- Question 1: what to build + their idea, in their own words ----
  function renderBuild() {
    var box = h("div", null);
    if (SERVICE_GROUPS.length) box.appendChild(renderServices());
    var buildCards = renderCards(BUILD_OPTIONS, "buildType", state.form.buildType,
      "What do you want to build?", function (value) {
        state.form.buildType = value;
        clearError();
        renderProgress();
        saveState();
      }, "cw-options--build");
    dressBuildCards(buildCards);
    box.appendChild(buildCards);

    var idea = h("div", { "class": "cw-followup" }, [
      h("p", { "class": "cw-followup-title" }, ["Tell us about your idea (optional)"]),
      h("p", { "class": "cw-hint" }, ["Give us the idea in your own words. No technical details needed."])
    ]);
    var textarea = h("textarea", {
      id: "cw-idea", name: "idea", "class": "cw-input cw-textarea-lg", rows: "6",
      "aria-label": "Tell us about your idea",
      placeholder: "Tell us what you're imagining, what problem you're trying to solve, or what you'd like to improve…"
    });
    textarea.value = state.form.idea;
    textarea.addEventListener("input", function () {
      state.form.idea = textarea.value;
      clearError();
      saveState();
    });
    idea.appendChild(textarea);
    box.appendChild(idea);
    return box;
  }

  // The services they need: the same list, groups and chips as the
  // brief builder on /services. Picks made there arrive ticked; either
  // a service or a build card is enough to go on.
  function renderServices() {
    var f = state.form;
    if (!f.services) f.services = [];
    var count = h("span", { "class": "cw-svc-count" });
    var paintCount = function () {
      var n = f.services.length;
      count.textContent = n ? n + (n === 1 ? " service" : " services") + " on board" : "Pick any that fit";
      wrap.classList.toggle("is-armed", n > 0);
    };
    var wrap = h("div", { "class": "cw-svc", role: "group", "aria-label": "The services you need" }, [
      h("div", { "class": "cw-svc-head" }, [
        h("p", { "class": "cw-svc-title" }, [h("i", { "aria-hidden": "true" }), "The services you need"]),
        count
      ])
    ]);
    var grid = h("div", { "class": "cw-svc-grid" });
    var i = 0;
    SERVICE_GROUPS.forEach(function (g) {
      var group = h("div", { "class": "cw-svc-group" }, [h("p", null, [g.division])]);
      g.services.forEach(function (name) {
        var on = f.services.indexOf(name) >= 0;
        var chip = h("button", { type: "button", "class": "cw-chip", "aria-pressed": on ? "true" : "false", style: "--i:" + (i++) }, [name]);
        chip.addEventListener("click", function () {
          var was = chip.getAttribute("aria-pressed") === "true";
          chip.setAttribute("aria-pressed", was ? "false" : "true");
          f.services = was ? f.services.filter(function (n) { return n !== name; })
            : ALL_SERVICES.filter(function (n) { return n === name || f.services.indexOf(n) >= 0; });
          chip.classList.remove("is-pop");
          if (!was && !reducedMotion) { void chip.offsetWidth; chip.classList.add("is-pop"); }
          paintCount();
          clearError();
          renderProgress();
          saveState();
        });
        chip.addEventListener("animationend", function (e) { if (e.animationName === "cw-chip-pulse") chip.classList.remove("is-pop"); });
        group.appendChild(chip);
      });
      grid.appendChild(group);
    });
    wrap.appendChild(grid);
    wrap.appendChild(h("p", { "class": "cw-svc-then" }, ["And what kind of build is it?"]));
    paintCount();
    return wrap;
  }

  // --- Question 2: what they want it to achieve ----------------------
  function renderGoal() {
    var box = h("div", null);
    var otherWrap = h("div", { "class": "cw-reveal", hidden: state.form.goal !== "other" });

    var goalCards = renderCards(GOAL_OPTIONS, "goal", state.form.goal,
      "What do you want it to achieve?", function (value) {
        state.form.goal = value;
        clearError();
        otherWrap.hidden = value !== "other";
        renderProgress();
        saveState();
      }, "cw-options--goal");
    dressCards(goalCards, GOAL_ART, function (i) { return "OBJECTIVE " + pad2c(i); }, true);
    box.appendChild(goalCards);

    otherWrap.appendChild(buildControl(
      { id: "goalOther", label: "Tell us a bit more (optional)", type: "text", required: false,
        placeholder: "A sentence or two is plenty" },
      state.form.goalOther,
      function (val) { state.form.goalOther = val; saveState(); }
    ));
    box.appendChild(otherWrap);
    return box;
  }

  // --- Timeline: preserved single-choice cards ------------------------
  function renderRadio(step) {
    var cards = renderCards(step.options, step.field, state.form[step.field], step.legend, function (value) {
      state.form[step.field] = value;
      clearError();
      renderProgress();
      renderNav();
      saveState();
    }, "cw-options--timeline");
    if (step.field === "timeline") dressCards(cards, TIMELINE_ART, function (i) { return "TRAJECTORY " + pad2c(i); }, true);
    return cards;
  }

  // --- Budget: the thrust reactor ------------------------------------
  // A round instrument the budget drives: a bezel, a glass face, a thrust
  // scale with its redline, a plasma arc that fills and a needle that
  // swings (and hums) as the figure climbs. The figure counts to the
  // slider, and the mission class the amount buys is named beside it.
  // Quick picks for a thumb; the slider (keyboard, screen readers) below.
  //
  // Full mission access, the last pick, is off the scale (see overload):
  //   slam      the needle hits the stop pin
  //   redline   it fights the pin, the ticks burn red one by one, the
  //             overload lamp blinks, heat haze warps the dial, sparks
  //             spit off the pin, the figure runs away
  //   critical  the reactor shakes harder and harder, hairline cracks
  //             creep over the glass, smoke, electrical arcs, the
  //             figure splits into red and blue
  //   hold      a beat of stillness
  //   break     time slows: a flash, a shockwave, the glass bursts into
  //             shards, the needle snaps and its tip flies at the camera,
  //             spinning and blurring until it fills the screen; the stub
  //             stays jammed on the pin, white hot, and slowly cools; the
  //             ticks shake loose, the console jolts
  //   after     embers, smoke and the odd arc over the wreck
  // The glass breaks along one fracture web (glassWeb): the cracks and the
  // pieces are the same shapes. Sparks, glass, dust, steam and arcs are a small physics system on
  // a canvas over the gauge (reactorFX). Any other pick, or the slider,
  // repairs it, and coming back to the question starts it fresh at the
  // middle of the dial. Reduced motion: straight to the broken gauge, still.
  var BUDGET_TIERS = [
    { max: 20000, name: "Launchpad", desc: "A focused site, a landing page or an MVP." },
    { max: 60000, name: "Low orbit", desc: "A full website, a store or a first app." },
    { max: 150000, name: "Deep orbit", desc: "Web apps, platforms and their integrations." },
    { max: Infinity, name: "Interstellar", desc: "Enterprise systems, built across platforms." }
  ];
  var BUDGET_PICKS = [15000, 40000, 90000, 180000, 250000];
  function tierOf(a) { for (var i = 0; i < BUDGET_TIERS.length; i++) if (a < BUDGET_TIERS[i].max) return i; return BUDGET_TIERS.length - 1; }
  function shortAED(a) { return a >= 1000 ? Math.round(a / 1000) + "K" : String(a); }

  // the dial's geometry, in svg units: centre, a 220 degree sweep
  var GX = 130, GY = 125, SWEEP = 220, START = 200, gaugeUid = 0;
  function dialPt(p, r) {
    var a = (START - SWEEP * p) * Math.PI / 180;
    return [GX + Math.cos(a) * r, GY - Math.sin(a) * r];
  }
  function arcPath(p0, p1, r) {
    var a = dialPt(p0, r), b = dialPt(p1, r);
    return "M" + a[0].toFixed(2) + " " + a[1].toFixed(2) + "A" + r + " " + r + " 0 " + ((p1 - p0) * SWEEP > 180 ? 1 : 0) + " 1 " + b[0].toFixed(2) + " " + b[1].toFixed(2);
  }
  // where the needle slams: the stop pin just past the top of the scale
  var PIN = dialPt(1.03, 84), IMPACT = dialPt(0.97, 62);

  // the fracture: one web that is both the cracks and the shards. Rays
  // run out from the impact, rings circle it, each edge jagged; the cells
  // between them are the pieces of glass. The cracks are drawn along the
  // web's edges, so every shard that flies is exactly a piece the cracks
  // cut. The first three rays are the hairlines that creep in before the
  // break. Cells: ring 0-1 blast at the camera, ring 2-3 fall out of the
  // frame, the rest stay in it, a little out of true, and some let go later.
  var WEB_RAYS = 13, WEB_RINGS = [9, 20, 34, 52, 76, 106, 150, 200];
  function glassWeb() {
    var I = IMPACT, N = WEB_RAYS, rings = WEB_RINGS, V = [], cells = [], i, k;
    var angles = [];
    for (i = 0; i < N; i++) angles.push(i / N * Math.PI * 2 + (Math.random() - 0.5) * 0.28);
    var jag = function (p, q, amt) {
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, o = (Math.random() - 0.5) * amt;
      return [mx - dy / l * o, my + dx / l * o];
    };
    for (k = 0; k < rings.length; k++) {
      V.push(angles.map(function (a) {
        var r = rings[k] * (1 + (Math.random() - 0.5) * 0.22), aa = a + (Math.random() - 0.5) * 0.08;
        return [I[0] + Math.cos(aa) * r, I[1] + Math.sin(aa) * r];
      }));
    }
    // a jagged midpoint on every ring edge and every ray edge
    var ringMid = V.map(function (row, rk) { return row.map(function (p, ri) { return jag(p, row[(ri + 1) % N], 2 + rk * 1.6); }); });
    var rayMid = V.map(function (row, rk) { return row.map(function (p, ri) { return jag(rk ? V[rk - 1][ri] : I, p, 2 + rk * 1.8); }); });
    var inFace = function (p) { return Math.hypot(p[0] - GX, p[1] - GY) < 108; };
    for (k = 0; k < rings.length; k++) {
      for (i = 0; i < N; i++) {
        var n = (i + 1) % N, pts;
        if (k === 0) pts = [I, rayMid[0][i], V[0][i], ringMid[0][i], V[0][n], rayMid[0][n]];
        else pts = [V[k - 1][i], ringMid[k - 1][i], V[k - 1][n], rayMid[k][n], V[k][n], ringMid[k][i], V[k][i], rayMid[k][i]];
        if (!pts.some(inFace)) continue;
        // keep the piece inside the frame: points past the rim sit on it
        pts = pts.map(function (p) {
          var dx = p[0] - GX, dy = p[1] - GY, d = Math.hypot(dx, dy);
          return d > 107 ? [GX + dx / d * 107, GY + dy / d * 107] : p;
        });
        cells.push({ pts: pts, ring: k });
      }
    }
    var f1 = function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); };
    var rays = angles.map(function (a, ri) {
      var d = "M" + f1(I);
      for (var rk = 0; rk < rings.length; rk++) d += "L" + f1(rayMid[rk][ri]) + "L" + f1(V[rk][ri]);
      return { d: d, early: ri % 4 === 1 && ri < 12 };
    });
    var ringPaths = V.map(function (row, rk) {
      var d = "M" + f1(row[0]);
      for (var ri = 0; ri < N; ri++) d += "L" + f1(ringMid[rk][ri]) + "L" + f1(row[(ri + 1) % N]);
      return { d: d, ring: rk };
    });
    return { cells: cells, rays: rays, rings: ringPaths };
  }

  // a vintage instrument: a brass bezel, knurled and screwed down, an aged
  // ivory face (foxed with age, lit from behind like an old dashboard), a
  // serif scale with painted green, amber and red bands, a blued steel
  // needle with a red lacquered tip on a brass hub, a red jewel lamp, and
  // domed glass over it all
  function gaugeSVG(u, web) {
    var ticks = "", labels = "";
    for (var t = 0; t <= 44; t++) {
      var p = t / 44, major = t % 11 === 0;
      var a = dialPt(p, major ? 70 : (t % 11 === 5 || t % 11 === 6) ? 76 : 79), b = dialPt(p, 84);
      ticks += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"' + (major ? ' class="is-major"' : "") + "/>";
      if (major) { var l = dialPt(p, 58); labels += '<text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '">' + Math.round(p * 100) + "</text>"; }
    }
    // the cracks: rays first, then the rings, each ring a beat later
    var cracks = web.rays.map(function (c) { return '<path d="' + c.d + '" pathLength="1"' + (c.early ? ' class="is-early"' : "") + "/>"; }).join("") +
      web.rings.map(function (c) { return '<path d="' + c.d + '" pathLength="1" style="transition-delay:' + (0.04 + c.ring * 0.035).toFixed(3) + 's"/>'; }).join("");
    // the pane: each piece of glass as a facet, hidden until it breaks
    var pane = web.cells.map(function (c) {
      return '<polygon points="' + c.pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '" style="--fo:' + (0.03 + Math.random() * 0.13).toFixed(3) +
        ";--fx:" + ((Math.random() - 0.5) * 1.4).toFixed(2) + "px;--fy:" + ((Math.random() - 0.5) * 1.4).toFixed(2) + "px;--fr:" + ((Math.random() - 0.5) * 1.6).toFixed(2) + 'deg"/>';
    }).join("");
    var screws = [45, 135, 225, 315].map(function (deg) {
      var r = deg * Math.PI / 180, x = GX + Math.cos(r) * 112, y = GY + Math.sin(r) * 112, s = (deg * 1.7) % 180;
      return '<g class="cw-g-screw"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="url(#cwh' + u + ')"/><path d="M' + (x - 2.2).toFixed(1) + " " + y.toFixed(1) + "h4.4" + '" transform="rotate(' + s.toFixed(0) + " " + x.toFixed(1) + " " + y.toFixed(1) + ')"/></g>';
    }).join("");
    return '<svg viewBox="0 0 260 250">' +
      "<defs>" +
        '<linearGradient id="cwb' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbeab4"/><stop offset=".2" stop-color="#c8963c"/><stop offset=".45" stop-color="#6b4715"/><stop offset=".62" stop-color="#e8c476"/><stop offset=".8" stop-color="#9a6a24"/><stop offset="1" stop-color="#4a300c"/></linearGradient>' +
        '<radialGradient id="cwf' + u + '" cx=".46" cy=".4" r=".66"><stop offset="0" stop-color="#fbf3de"/><stop offset=".55" stop-color="#efe1bd"/><stop offset=".85" stop-color="#d9c08e"/><stop offset="1" stop-color="#b3935c"/></radialGradient>' +
        '<linearGradient id="cwn' + u + '" x1="0" x2="1"><stop offset="0" stop-color="#3b4a5c"/><stop offset=".5" stop-color="#10151c"/><stop offset="1" stop-color="#2a3442"/></linearGradient>' +
        '<linearGradient id="cwr' + u + '" x1="0" x2="1"><stop offset="0" stop-color="#e0473a"/><stop offset=".5" stop-color="#a3170f"/><stop offset="1" stop-color="#c8342a"/></linearGradient>' +
        '<radialGradient id="cwh' + u + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff4cc"/><stop offset=".4" stop-color="#c8963c"/><stop offset="1" stop-color="#4a300c"/></radialGradient>' +
        '<radialGradient id="cwj' + u + '" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#ffd6cc"/><stop offset=".35" stop-color="#d4261c"/><stop offset="1" stop-color="#4a0604"/></radialGradient>' +
        '<radialGradient id="cws' + u + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1a0c05" stop-opacity=".95"/><stop offset=".5" stop-color="#3a1f0e" stop-opacity=".6"/><stop offset="1" stop-color="#3a1f0e" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="cwl' + u + '" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="cwc' + u + '"><circle cx="' + GX + '" cy="' + GY + '" r="106"/></clipPath>' +
        // where glass has fallen out, there is no glare and no crack
        '<mask id="cwk' + u + '" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="250"><rect width="260" height="250" fill="#fff"/><g class="cw-g-holes"></g></mask>' +
        // age: foxing and stains in the paper of the face
        '<filter id="cwa' + u + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="7"/><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.1  0 0 0 -1.6 1.05"/></filter>' +
        '<filter id="cwx' + u + '" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.07" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      "</defs>" +
      // the brass: a knurled outer ring, the bezel, its screws
      '<circle class="cw-g-knurl" cx="' + GX + '" cy="' + GY + '" r="119.5"/>' +
      '<circle class="cw-g-bezel" cx="' + GX + '" cy="' + GY + '" r="112" stroke="url(#cwb' + u + ')"/>' +
      '<circle class="cw-g-rim" cx="' + GX + '" cy="' + GY + '" r="116.8"/>' +
      // the face, aged, lit from behind
      '<circle cx="' + GX + '" cy="' + GY + '" r="106" fill="url(#cwf' + u + ')"/>' +
      '<g clip-path="url(#cwc' + u + ')"><rect x="20" y="15" width="220" height="220" filter="url(#cwa' + u + ')" class="cw-g-age"/></g>' +
      '<circle class="cw-g-heat" cx="' + GX + '" cy="' + GY + '" r="106"/>' +
      '<circle class="cw-g-scorch" cx="' + IMPACT[0].toFixed(1) + '" cy="' + IMPACT[1].toFixed(1) + '" r="70" fill="url(#cws' + u + ')" clip-path="url(#cwc' + u + ')"/>' +
      screws +
      // the dial: everything the heat haze warps
      '<g class="cw-g-dial">' +
        '<path class="cw-g-band cw-g-band--g" d="' + arcPath(0, 0.6, 88) + '"/>' +
        '<path class="cw-g-band cw-g-band--a" d="' + arcPath(0.6, 0.85, 88) + '"/>' +
        '<path class="cw-g-band cw-g-band--r" d="' + arcPath(0.85, 1, 88) + '"/>' +
        '<path class="cw-g-edge" d="' + arcPath(0, 1, 84) + '"/>' +
        '<g class="cw-gauge-ticks">' + ticks + "</g>" +
        '<g class="cw-g-labels">' + labels + "</g>" +
        '<text class="cw-g-cap" x="' + GX + '" y="94">THRUST</text>' +
        '<text class="cw-g-unit" x="' + GX + '" y="103">per cent</text>' +
        '<g class="cw-g-lamp"><circle cx="' + GX + '" cy="152" r="6.5" class="cw-g-lampring"/><circle cx="' + GX + '" cy="152" r="4.6" fill="url(#cwj' + u + ')" class="cw-g-jewel"/></g>' +
        '<text class="cw-g-brand" x="' + GX + '" y="176">Worx Instrument Co.</text>' +
        '<text class="cw-g-serial" x="' + GX + '" y="185">DUBAI · Nº 250</text>' +
      "</g>" +
      '<circle class="cw-g-pin" cx="' + PIN[0].toFixed(1) + '" cy="' + PIN[1].toFixed(1) + '" r="2.4" fill="url(#cwh' + u + ')"/>' +
      // the needle: blued steel with a counterweight, a red lacquered tip;
      // a stub and a tip, so it can snap
      '<g class="cw-gauge-needle"><g class="cw-g-hum">' +
        '<g class="cw-g-stub"><path d="M128.6 125L129.2 150h1.6l.6-25z" fill="url(#cwn' + u + ')"/><circle cx="130" cy="147" r="4.2" fill="none" stroke="url(#cwn' + u + ')" stroke-width="2"/><polygon points="127.4,125 128.8,84 131.2,84 132.6,125" fill="url(#cwn' + u + ')"/><polygon class="cw-g-hot" points="127.4,125 128.8,84 131.2,84 132.6,125"/></g>' +
        '<g class="cw-g-tip"><polygon points="128.8,84 129.4,62 130.6,62 131.2,84" fill="url(#cwn' + u + ')"/><polygon points="129.4,62 130,36 130.6,62" fill="url(#cwr' + u + ')"/></g>' +
      "</g></g>" +
      '<circle cx="' + GX + '" cy="' + GY + '" r="9" fill="url(#cwh' + u + ')" class="cw-gauge-hub"/>' +
      '<path class="cw-g-hubslot" d="M126 122.5l8 5"/>' +
      '<circle cx="' + GX + '" cy="' + GY + '" r="2" class="cw-g-hubcore"/>' +
      // the glass: domed, with a window's reflection, the pane's facets
      // and the cracks waiting in it
      '<g clip-path="url(#cwc' + u + ')"><g mask="url(#cwk' + u + ')">' +
        '<circle class="cw-g-dome" cx="' + GX + '" cy="' + GY + '" r="106"/>' +
        '<ellipse cx="96" cy="58" rx="84" ry="40" transform="rotate(-28 96 58)" fill="url(#cwl' + u + ')" class="cw-g-glare"/>' +
        '<path class="cw-g-glint" d="M44 118A88 88 0 0 1 84 46"/>' +
        '<g class="cw-g-pane">' + pane + "</g>" +
        '<g class="cw-gauge-crack">' + cracks + "</g>" +
      "</g></g>" +
    "</svg>";
  }

  // --- the reactor's physics: sparks, shards, embers, steam, arcs
  function reactorFX(gaugeEl, wrap) {
    var cv = document.createElement("canvas");
    cv.className = "cw-gauge-fx"; cv.setAttribute("aria-hidden", "true");
    gaugeEl.appendChild(cv);
    var svg = gaugeEl.querySelector("svg"), g = cv.getContext("2d");
    var parts = [], rings = [], bolts = [], stars = [], raf = 0, last = 0, seen = false;
    var W = 0, H = 0, dpr = 1, sc = 1, ox = 0, oy = 0, floor = 0;
    var ambient = 0, nextArc = 0, onArc = null, ts = 1, slowFor = 0;
    function fit() {
      var r = cv.getBoundingClientRect(), s = svg.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (Math.round(r.width * dpr) !== cv.width || Math.round(r.height * dpr) !== cv.height) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      W = r.width; H = r.height; sc = s.width / 260; ox = s.left - r.left; oy = s.top - r.top; floor = oy + 236 * sc;
    }
    var X = function (x) { return ox + x * sc; }, Y = function (y) { return oy + y * sc; };
    function add(p) { if (parts.length < 420) parts.push(p); }
    var api = {
      sparks: function (n, x, y, spread, power, dir) {
        for (var i = 0; i < n; i++) {
          var a = (dir == null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * spread), v = (0.5 + Math.random()) * power;
          add({ k: "s", x: X(x), y: Y(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, dec: 0.012 + Math.random() * 0.02, w: 0.8 + Math.random() * 1.2 });
        }
      },
      // fine splinters: small slivers thrown out with the blast
      shards: function (n, x, y) {
        fit();
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7, sz = (2 + Math.random() * 5) * sc, pts = [];
          var m = 3 + (Math.random() * 2 | 0);
          for (var q = 0; q < m; q++) { var aa = q / m * Math.PI * 2 + Math.random() * 0.8; pts.push(Math.cos(aa) * sz * (0.4 + Math.random() * 0.9), Math.sin(aa) * sz * (0.3 + Math.random() * 0.5)); }
          add({ k: "g", x: X(x + (Math.random() - 0.5) * 30), y: Y(y + (Math.random() - 0.5) * 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
            flip: Math.random() * 6, vf: (Math.random() - 0.5) * 0.5, z: 1, vz: 0, g0: 0.34, delay: 0, fly: false, pts: pts, life: 1, rest: 0 });
        }
      },
      // a real piece of the pane (svg points): "fly" blasts it at the
      // camera, spinning, growing as it comes; "fall" lets it drop out of
      // the frame after its delay (it trembles for a moment first)
      pane: function (pts, mode, delay) {
        fit();
        var cx = 0, cy = 0, rel = [];
        pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
        cx /= pts.length; cy /= pts.length;
        pts.forEach(function (p) { rel.push((p[0] - cx) * sc, (p[1] - cy) * sc); });
        var dx = cx - IMPACT[0], dy = cy - IMPACT[1], dl = Math.hypot(dx, dy) || 1, fly = mode === "fly";
        var push = fly ? 1.2 + Math.random() * 3.2 : 0.2 + Math.random() * 0.7;
        add({ k: "g", x: X(cx), y: Y(cy), vx: dx / dl * push, vy: dy / dl * push - (fly ? 1.2 : 0), rot: 0, vr: (Math.random() - 0.5) * (fly ? 0.22 : 0.06),
          flip: 0, vf: (Math.random() - 0.5) * (fly ? 0.34 : 0.1), z: 1, vz: fly ? 0.012 + Math.random() * 0.02 : 0, g0: fly ? 0.04 : 0.3,
          delay: delay || 0, fly: fly, pts: rel, life: 1, rest: 0, big: true });
      },
      // glass dust: glitter that catches the light as it falls
      glitter: function (n, x, y, spread) {
        fit();
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2, v = Math.random() * (spread || 4);
          add({ k: "d", x: X(x), y: Y(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, ph: Math.random() * 6, life: 1, dec: 0.006 + Math.random() * 0.01 });
        }
      },
      // the instant of impact: a star of light at the point of failure
      impact: function (x, y) { stars.push({ x: X(x), y: Y(y), t: 0, rays: 22 }); },
      // a jet of steam from a point, blasting out and billowing
      steam: function (n, x, y, dir, power) {
        for (var i = 0; i < n; i++) {
          var a = dir + (Math.random() - 0.5) * 0.5, v = (0.6 + Math.random()) * power;
          add({ k: "m", x: X(x), y: Y(y), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (4 + Math.random() * 5) * sc, gr: 0.5 + Math.random() * 0.6, life: 1, dec: 0.01 + Math.random() * 0.008, a: 0.5 });
        }
      },
      smoke: function (n, x, y, big) {
        for (var i = 0; i < n; i++) add({ k: "m", x: X(x + (Math.random() - 0.5) * 50), y: Y(y + (Math.random() - 0.5) * 20), vx: (Math.random() - 0.3) * 0.5, vy: -0.5 - Math.random() * 0.9, r: (big ? 18 : 10) * sc, gr: 0.28 + Math.random() * 0.3, life: 1, dec: 0.004 + Math.random() * 0.004, a: big ? 0.34 : 0.22 });
      },
      embers: function (n, x, y) {
        for (var i = 0; i < n; i++) add({ k: "e", x: X(x + (Math.random() - 0.5) * 120), y: Y(y + (Math.random() - 0.5) * 60), vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.7, ph: Math.random() * 6, life: 1, dec: 0.004 + Math.random() * 0.006 });
      },
      shock: function (x, y) { rings.push({ x: X(x), y: Y(y), r: 4, a: 1 }, { x: X(x), y: Y(y), r: -30, a: 0.6 }); },
      arc: function () {
        // a crackle of current across the wreck, from the hub or the rim
        var a0 = Math.random() * Math.PI * 2, a1 = a0 + 1 + Math.random() * 2.5;
        var from = Math.random() < 0.5 ? [GX, GY] : [GX + Math.cos(a0) * 100, GY + Math.sin(a0) * 100];
        var to = [GX + Math.cos(a1) * (40 + Math.random() * 64), GY + Math.sin(a1) * (40 + Math.random() * 64)];
        var pts = [], n = 9;
        for (var i = 0; i <= n; i++) {
          var k = i / n, jit = i && i < n ? (Math.random() - 0.5) * 22 : 0;
          pts.push(X(from[0] + (to[0] - from[0]) * k + jit), Y(from[1] + (to[1] - from[1]) * k + (Math.random() - 0.5) * 22 * (i && i < n ? 1 : 0)));
        }
        bolts.push({ pts: pts, life: 1 });
        api.sparks(6, to[0], to[1], 0, 2.2);
        if (onArc) onArc();
      },
      ambient: function (level) { ambient = level; if (level) start(); },
      // time slows right down, then eases back to full speed
      slowmo: function (ms) { ts = 0.12; slowFor = ms; start(); },
      onArc: function (fn) { onArc = fn; },
      clear: function () { parts = []; rings = []; bolts = []; stars = []; ambient = 0; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); },
      start: function () { start(); }
    };
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
    function tick(now) {
      raf = 0;
      if (!wrap.isConnected) { if (seen) { api.clear(); return; } raf = requestAnimationFrame(tick); return; }
      seen = true;
      var dt = last ? Math.min(50, now - last) : 16; last = now;
      if (ts < 1) ts = Math.min(1, ts + dt / slowFor * 0.88);
      var f = dt / 16 * ts; dt *= ts;
      fit();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      // the wreck keeps smouldering
      if (ambient) {
        if (Math.random() < 0.05 * f * ambient) api.smoke(1, GX + (Math.random() - 0.5) * 60, GY + 10, false);
        if (Math.random() < 0.08 * f * ambient) api.embers(1, GX, GY + 20);
        if (now > nextArc) { if (nextArc) api.arc(); nextArc = now + 700 + Math.random() * 2200 / ambient; }
      }
      // smoke under everything else
      g.globalCompositeOperation = "source-over";
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        if (p.k !== "m") continue;
        p.x += p.vx * f; p.y += p.vy * f; p.r += p.gr * f; p.life -= p.dec * f;
        p.vx *= Math.pow(0.95, f); p.vy = p.vy * Math.pow(0.95, f) - 0.02 * f;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        var sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        sg.addColorStop(0, "rgba(236,228,214," + (p.a * p.life * 0.8).toFixed(3) + ")"); sg.addColorStop(0.6, "rgba(200,190,176," + (p.a * p.life * 0.3).toFixed(3) + ")"); sg.addColorStop(1, "rgba(160,150,140,0)");
        g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      }
      // the glass: each piece tumbles in three dimensions (its flip
      // squashes it edge on), catches the light when it faces the lamp,
      // and shows the green of its cut edge
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        if (p.k !== "g") continue;
        var jit = 0;
        if (p.delay > 0) {
          p.delay -= dt;
          if (p.delay < 320) jit = (Math.random() - 0.5) * 1.4 * sc;   // it trembles, then lets go
        } else {
          p.vy += p.g0 * f; p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f; p.flip += p.vf * f;
          if (p.fly) {
            // coming at the camera, faster and faster
            p.z += p.vz * f; p.vz *= Math.pow(1.045, f);
            if (p.z > 2.4) p.life -= 0.045 * f;
          } else if (p.y > floor) {
            p.y = floor; p.vy *= -0.3; p.vx *= 0.5; p.vr *= 0.5; p.vf *= 0.4;
            if (Math.abs(p.vy) > 2 && p.big) api.glitter(4, (p.x - ox) / sc, (p.y - oy) / sc, 2.5);
            if (Math.abs(p.vy) < 1) { p.vy = 0; p.rest += dt; }
          }
          p.vx *= 0.995;
          if (p.rest > 1100) p.life -= 0.018 * f;
        }
        if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y > H + 60) { parts.splice(i, 1); continue; }
        var cf = Math.cos(p.flip), sx = Math.abs(cf) < 0.06 ? (cf < 0 ? -0.06 : 0.06) : cf;
        var glint = Math.pow(Math.max(0, Math.sin(p.flip * 1.3 + p.rot + 0.6)), 10);
        var la = p.life * (p.fly ? Math.max(0, 1 - (p.z - 1) * 0.12) + 0.2 : 1);
        g.save(); g.translate(p.x + jit, p.y); g.rotate(p.rot); g.scale(p.z * sx, p.z);
        g.beginPath(); g.moveTo(p.pts[0], p.pts[1]);
        for (var q = 2; q < p.pts.length; q += 2) g.lineTo(p.pts[q], p.pts[q + 1]);
        g.closePath();
        g.fillStyle = "rgba(255,246,232," + ((0.05 + (1 - Math.abs(cf)) * 0.07 + glint * 0.6) * la).toFixed(3) + ")"; g.fill();
        g.lineWidth = 0.8 / p.z; g.strokeStyle = "rgba(255,248,236," + ((0.32 + glint * 0.6) * la).toFixed(3) + ")"; g.stroke();
        // the cut edge of the glass, faintly green
        g.beginPath(); g.moveTo(p.pts[0], p.pts[1]); g.lineTo(p.pts[2], p.pts[3]); g.lineTo(p.pts[4], p.pts[5]);
        g.lineWidth = 1.6 / p.z; g.strokeStyle = "rgba(186,255,222," + ((0.28 + glint * 0.5) * la).toFixed(3) + ")"; g.stroke();
        g.restore();
        if (glint > 0.85 && Math.random() < 0.25 * f) api.glitter(1, (p.x - ox) / sc, (p.y - oy) / sc, 0.6);
      }
      // sparks, embers, shockwaves, arcs: light, added up
      g.globalCompositeOperation = "lighter";
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        if (p.k === "s") {
          p.vy += 0.22 * f; p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.985; p.life -= p.dec * f;
          if (p.y > floor) { p.y = floor; p.vy *= -0.4; p.vx *= 0.7; }
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          var hot = p.life > 0.6 ? "255,244,214" : p.life > 0.3 ? "250,167,25" : "229,90,40";
          g.strokeStyle = "rgba(" + hot + "," + Math.min(1, p.life * 1.4).toFixed(3) + ")"; g.lineWidth = p.w;
          g.beginPath(); g.moveTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); g.lineTo(p.x, p.y); g.stroke();
        } else if (p.k === "d") {
          p.vy += 0.07 * f; p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.98; p.life -= p.dec * f;
          if (p.y > floor) { p.y = floor; p.vy *= -0.3; p.vx *= 0.6; }
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          // it twinkles: a four point star when it catches the light
          var tw = Math.sin(now * 0.025 + p.ph * 7);
          if (tw > 0.55) {
            var sl = (1.5 + (tw - 0.55) * 7) * p.life;
            g.strokeStyle = "rgba(255,250,240," + p.life.toFixed(3) + ")"; g.lineWidth = 0.8;
            g.beginPath(); g.moveTo(p.x - sl, p.y); g.lineTo(p.x + sl, p.y); g.moveTo(p.x, p.y - sl); g.lineTo(p.x, p.y + sl); g.stroke();
          } else { g.fillStyle = "rgba(255,244,228," + (p.life * 0.5).toFixed(3) + ")"; g.fillRect(p.x, p.y, 1, 1); }
        } else if (p.k === "e") {
          p.x += (p.vx + Math.sin(now * 0.003 + p.ph) * 0.3) * f; p.y += p.vy * f; p.life -= p.dec * f;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          var fl = 0.5 + 0.5 * Math.sin(now * 0.02 + p.ph * 5);
          g.fillStyle = "rgba(250," + (140 + fl * 60 | 0) + ",40," + (p.life * (0.5 + fl * 0.5)).toFixed(3) + ")";
          g.beginPath(); g.arc(p.x, p.y, 1.1 + fl * 0.6, 0, Math.PI * 2); g.fill();
        }
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var rg = rings[i]; rg.r += 5.5 * f * sc; rg.a -= 0.028 * f;
        if (rg.a <= 0) { rings.splice(i, 1); continue; }
        if (rg.r <= 0) continue;
        g.strokeStyle = "rgba(255,226,180," + (rg.a * 0.8).toFixed(3) + ")"; g.lineWidth = 1 + rg.a * 5;
        g.beginPath(); g.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); g.stroke();
      }
      for (i = stars.length - 1; i >= 0; i--) {
        var st = stars[i]; st.t += dt / 340;
        if (st.t >= 1) { stars.splice(i, 1); continue; }
        var ease = 1 - Math.pow(1 - st.t, 3), sa = (1 - st.t);
        var core = g.createRadialGradient(st.x, st.y, 0, st.x, st.y, 60 * sc * (0.4 + ease));
        core.addColorStop(0, "rgba(255,252,244," + sa.toFixed(3) + ")"); core.addColorStop(0.3, "rgba(255,214,150," + (sa * 0.5).toFixed(3) + ")"); core.addColorStop(1, "rgba(250,167,25,0)");
        g.fillStyle = core; g.beginPath(); g.arc(st.x, st.y, 60 * sc * (0.4 + ease), 0, Math.PI * 2); g.fill();
        for (var ry = 0; ry < st.rays; ry++) {
          var ra = ry / st.rays * Math.PI * 2 + (ry % 2) * 0.1, rl = (ry % 3 ? 70 : 150) * sc * ease;
          g.strokeStyle = "rgba(255,246,228," + (sa * (ry % 3 ? 0.35 : 0.8)).toFixed(3) + ")"; g.lineWidth = ry % 3 ? 0.6 : 1.2;
          g.beginPath(); g.moveTo(st.x + Math.cos(ra) * rl * 0.15, st.y + Math.sin(ra) * rl * 0.15); g.lineTo(st.x + Math.cos(ra) * rl, st.y + Math.sin(ra) * rl); g.stroke();
        }
      }
      for (i = bolts.length - 1; i >= 0; i--) {
        var bt = bolts[i]; bt.life -= 0.09 * f;
        if (bt.life <= 0) { bolts.splice(i, 1); continue; }
        if (Math.random() < 0.5) {   // current flickers
          [[5, "250,167,25", 0.3], [1.3, "255,246,228", 1]].forEach(function (pass) {
            g.strokeStyle = "rgba(" + pass[1] + "," + (pass[2] * bt.life).toFixed(3) + ")"; g.lineWidth = pass[0];
            g.beginPath(); g.moveTo(bt.pts[0], bt.pts[1]);
            for (var q2 = 2; q2 < bt.pts.length; q2 += 2) g.lineTo(bt.pts[q2] + (Math.random() - 0.5) * 2, bt.pts[q2 + 1] + (Math.random() - 0.5) * 2);
            g.stroke();
          });
        }
      }
      g.globalCompositeOperation = "source-over";
      if (parts.length || rings.length || bolts.length || stars.length || ambient) raf = requestAnimationFrame(tick);
    }
    return api;
  }

  // the needle's tip, snapped off, flies at the camera: out of the gauge,
  // spinning faster, growing and blurring as it comes, until it fills the
  // screen and hits the lens (a smear of red and blue, a blink)
  function flyToCamera(tipEl, deg) {
    var r = tipEl.getBoundingClientRect();
    if (!r.width || !tipEl.animate) return;
    var len = Math.hypot(r.width, r.height), w = Math.max(6, len / 7);
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var fly = h("div", { "class": "cw-flytip", "aria-hidden": "true" });
    fly.innerHTML = '<svg viewBox="0 0 10 64" preserveAspectRatio="none"><defs><linearGradient id="cwft" x1="0" x2="1"><stop offset="0" stop-color="#fff6e4"/><stop offset=".5" stop-color="#faa719"/><stop offset="1" stop-color="#c04527"/></linearGradient></defs><polygon points="3.4,64 5,0 6.6,64" fill="url(#cwft)"/><circle cx="5" cy="3" r="2.2" fill="#fff3dc"/></svg>';
    fly.style.cssText = "left:" + (cx - w / 2).toFixed(1) + "px;top:" + (cy - len / 2).toFixed(1) + "px;width:" + w.toFixed(1) + "px;height:" + len.toFixed(1) + "px";
    document.body.appendChild(fly);
    var dx = window.innerWidth * 0.5 - cx + (Math.random() - 0.5) * 120, dy = window.innerHeight * 0.45 - cy;
    var anim = fly.animate([
      { transform: "translate(0,0) rotate(" + deg + "deg) scale(1)", filter: "blur(0) drop-shadow(0 0 6px #faa719)", opacity: 1 },
      { offset: 0.3, transform: "translate(" + (dx * 0.06).toFixed(1) + "px," + (dy * 0.06 - 30).toFixed(1) + "px) rotate(" + (deg + 90) + "deg) scale(1.4)", filter: "blur(0) drop-shadow(0 0 10px #faa719)", opacity: 1 },
      { offset: 0.75, transform: "translate(" + (dx * 0.55).toFixed(1) + "px," + (dy * 0.55).toFixed(1) + "px) rotate(" + (deg + 420) + "deg) scale(5)", filter: "blur(3px) drop-shadow(0 0 18px #faa719)", opacity: 1 },
      { transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) rotate(" + (deg + 900) + "deg) scale(26)", filter: "blur(22px) drop-shadow(0 0 40px #faa719)", opacity: 0.2 }
    ], { duration: 1500, easing: "cubic-bezier(0.55, 0, 0.9, 0.6)", fill: "forwards" });
    setTimeout(function () {
      var lens = h("div", { "class": "cw-lens", "aria-hidden": "true" });
      document.body.appendChild(lens);
      setTimeout(function () { lens.remove(); }, 600);
    }, 1320);
    anim.onfinish = function () { fly.remove(); };
  }

  // the whole screen blinks white at the break
  function screenFlash() {
    var fl = h("div", { "class": "cw-flash", "aria-hidden": "true" });
    document.body.appendChild(fl);
    setTimeout(function () { fl.remove(); }, 700);
  }

  function renderBudget() {
    // every visit starts the gauge fresh at the middle of the dial: an
    // earlier Full mission access does not come back broken
    if (!state.form.budget || budgetFull()) applyBudget(DEFAULT_BUDGET_AMOUNT);
    var amount = budgetAmount();
    var wrap = h("div", { "class": "cw-reactor" });
    var u = ++gaugeUid;

    var web = glassWeb();
    var gauge = h("div", { "class": "cw-gauge", "aria-hidden": "true" });
    gauge.innerHTML = gaugeSVG(u, web) + '<span class="cw-gauge-glow"></span>';
    var fx = reactorFX(gauge, wrap);
    var needle = gauge.querySelector(".cw-gauge-needle"), stub = gauge.querySelector(".cw-g-stub"), tip = gauge.querySelector(".cw-g-tip");
    var dial = gauge.querySelector(".cw-g-dial"), heat = gauge.querySelector("#cwx" + u + " feDisplacementMap"), turb = gauge.querySelector("#cwx" + u + " feTurbulence");
    var svgTicks = [].slice.call(gauge.querySelectorAll(".cw-gauge-ticks line"));
    var cracks = [].slice.call(gauge.querySelectorAll(".cw-gauge-crack path"));
    var facets = [].slice.call(gauge.querySelectorAll(".cw-g-pane polygon")), holes = gauge.querySelector(".cw-g-holes");
    // a piece leaves the frame: its facet goes, and a hole opens in the
    // glass (no glare, no cracks where there is no glass)
    function dropCell(k) {
      if (facets[k].classList.contains("is-gone")) return false;
      facets[k].classList.add("is-gone");
      var hole = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      hole.setAttribute("points", facets[k].getAttribute("points"));
      hole.setAttribute("fill", "#000");
      holes.appendChild(hole);
      return true;
    }
    function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }

    var tierName = h("p", { "class": "cw-reactor-tier" });
    var value = h("p", { "class": "cw-budget-value", role: "status", "aria-live": "polite" }, [formatAED(amount)]);
    var tierDesc = h("p", { "class": "cw-reactor-desc" });
    var read = h("div", { "class": "cw-reactor-read" }, [tierName, value, tierDesc]);
    var core = h("div", { "class": "cw-reactor-core" }, [gauge, read]);

    var range = h("input", {
      type: "range", "class": "cw-range",
      min: String(BUDGET_MIN), max: String(BUDGET_MAX), step: String(BUDGET_STEP), value: String(amount),
      "aria-label": "Budget range in AED", "aria-valuetext": formatAED(amount)
    });

    // the figure counts toward the slider rather than jumping
    var shown = amount, raf = 0, lastTier = -1;
    function countTo(a) {
      if (reducedMotion) { shown = a; value.textContent = formatAED(a); return; }
      cancelAnimationFrame(raf);
      (function step() {
        shown += (a - shown) * 0.22;
        if (Math.abs(a - shown) < 60) shown = a;
        value.textContent = formatAED(Math.round(shown / 100) * 100);
        if (shown !== a) raf = requestAnimationFrame(step);
      })();
    }
    function paint(a) {
      var p = (a - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN);
      range.style.setProperty("--cw-fill", (p * 100).toFixed(2) + "%");
      wrap.style.setProperty("--p", p.toFixed(4));
      var ti = tierOf(a);
      wrap.setAttribute("data-tier", ti);
      if (ti !== lastTier) {
        tierName.textContent = "Mission class · " + BUDGET_TIERS[ti].name;
        tierDesc.textContent = BUDGET_TIERS[ti].desc;
        if (lastTier !== -1) { wrap.classList.remove("is-shift"); void wrap.offsetWidth; wrap.classList.add("is-shift"); }
        lastTier = ti;
      }
      picks.forEach(function (b) { b.classList.toggle("is-on", !budgetFull() && +b.getAttribute("data-amount") === a); });
    }
    function set(a, fromPick) {
      a = Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, a));
      if (fromPick) range.value = String(a);
      repair();
      applyBudget(a);
      paint(a);
      countTo(a);
      range.setAttribute("aria-valuetext", formatAED(a));
      renderProgress();
      saveState();
    }
    var picks = BUDGET_PICKS.map(function (a) {
      // "AED" and the figure as two parts, so a phone can stack them into
      // a tile; --lv fills the tile's little thrust bar
      var b = h("button", { type: "button", "class": "cw-pick", "data-amount": String(a), "aria-label": formatAED(a) + (a >= BUDGET_MAX ? " or more" : ""),
        style: "--lv:" + ((a - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)).toFixed(3) }, [
        h("small", null, ["AED"]), " ", h("b", null, [shortAED(a) + (a >= BUDGET_MAX ? "+" : "")])
      ]);
      b.addEventListener("click", function () { buzz(8); set(a, true); });
      return b;
    });
    range.addEventListener("input", function () { set(parseInt(range.value, 10) || DEFAULT_BUDGET_AMOUNT, false); });

    // --- Full mission access: pushing the reactor past its limit ---
    var full = h("button", { type: "button", "class": "cw-pick cw-pick--full", "aria-pressed": "false" }, [
      h("i", { "aria-hidden": "true" }), "Full mission access"
    ]);
    var timers = [], director = 0, scramble = 0;
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    // the needle's angle for a share of the scale (0 at the bottom left)
    var angleOf = function (p) { return -110 + 220 * p; };

    // the figure runs away: faster and faster, past anything real
    function runaway() {
      var v = BUDGET_MAX, speed = 1.03;
      (function spin() {
        speed = Math.min(1.32, speed + 0.004);
        v = v * speed + Math.random() * 9000;
        // past a billion the digits glitch: the dial cannot count that high
        value.textContent = v > 1e9 ? formatAED(1e9 + Math.floor(Math.random() * 8.99e9)).replace(/\d/g, function (dg) { return Math.random() < 0.3 ? "#%&*"[(Math.random() * 4) | 0] : dg; }) : formatAED(Math.round(v));
        scramble = setTimeout(spin, 45);
      })();
    }
    function stopDirector() {
      cancelAnimationFrame(director); director = 0;
      clearTimeout(scramble);
      core.style.transform = "";
      needle.style.transform = "";
      dial.removeAttribute("filter");
      if (heat) heat.setAttribute("scale", "0");
    }
    function repair() {
      timers.forEach(clearTimeout); timers = [];
      stopDirector();
      if (!wrap.classList.contains("is-full")) return;
      wrap.classList.remove("is-full", "is-redline", "is-critical", "is-hold", "is-broken", "is-settled", "is-zap");
      svgTicks.forEach(function (l) { l.removeAttribute("style"); });
      cracks.forEach(function (c) { c.classList.remove("is-on"); });
      facets.forEach(function (fa) { fa.classList.remove("is-gone"); });
      holes.innerHTML = "";
      fx.clear();
      full.classList.remove("is-on"); full.setAttribute("aria-pressed", "false");
      lastTier = -1;
    }
    function scatterTicks(settled) {
      svgTicks.forEach(function (l, k) {
        var a = Math.PI * (1 - k / 44);
        l.style.setProperty("--tx", (Math.cos(a) * (20 + Math.random() * 60)).toFixed(1) + "px");
        l.style.setProperty("--ty", (60 + Math.random() * 110).toFixed(1) + "px");
        l.style.setProperty("--tr", ((Math.random() - 0.5) * 720).toFixed(0) + "deg");
        l.style.transitionDelay = (settled ? 0 : Math.random() * 0.2).toFixed(2) + "s";
        l.style.stroke = "";
      });
    }
    function brokenCopy() {
      value.textContent = "No limit";
      tierName.textContent = "Mission class · Off the scale";
      tierDesc.textContent = "No ceiling. We scope the whole mission with you, every platform, every team.";
    }
    function broken(settled) {
      stopDirector();
      wrap.classList.remove("is-redline", "is-critical", "is-hold");
      wrap.classList.add("is-broken");
      if (settled) wrap.classList.add("is-settled");
      // what is left of the needle stays jammed against the pin
      needle.style.transform = "rotate(" + (angleOf(1.03) + 1.5) + "deg)";
      cracks.forEach(function (c) { c.classList.add("is-on"); });
      scatterTicks(settled);
      brokenCopy();
      // the glass: the middle goes at once, the next ring falls out, the
      // rest hangs on in the frame
      var flying = [], falling = [];
      web.cells.forEach(function (c, k) {
        if (c.ring <= 1) flying.push(k);
        else if (c.ring === 2 || (c.ring === 3 && Math.random() < 0.6) || (c.ring === 4 && Math.random() < 0.15)) falling.push(k);
      });
      flying.concat(falling).forEach(dropCell);
      if (reducedMotion) return;
      // the hub flickers when current crackles over the wreck
      fx.onArc(function () { wrap.classList.remove("is-zap"); void wrap.offsetWidth; wrap.classList.add("is-zap"); });
      fx.ambient(1);
      if (settled) return;
      // the break itself
      fx.slowmo(900);
      flyToCamera(tip, angleOf(1.03) + 1.5);
      screenFlash();
      var con = wrap.closest(".ct-console") || wrap;
      con.classList.remove("cw-impact"); void con.offsetWidth; con.classList.add("cw-impact");
      later(function () { con.classList.remove("cw-impact"); }, 900);
      fx.shock(IMPACT[0], IMPACT[1]);
      fx.impact(IMPACT[0], IMPACT[1]);
      // the pieces of the pane: the middle blasts at the camera, the next
      // ring trembles and falls out of the frame, one after another
      flying.forEach(function (k) { fx.pane(web.cells[k].pts, "fly", Math.random() * 40); });
      falling.forEach(function (k) {
        var c = web.cells[k];
        fx.pane(c.pts, "fall", 90 + (c.ring - 2) * 260 + Math.random() * 420);
      });
      fx.shards(40, IMPACT[0], IMPACT[1]);
      fx.glitter(90, IMPACT[0], IMPACT[1], 7);
      // and long after, a loose piece lets go now and then
      (function loosen(n) {
        if (!n) return;
        later(function () {
          var pool = [];
          web.cells.forEach(function (c, k) { if (c.ring >= 3 && !facets[k].classList.contains("is-gone")) pool.push(k); });
          if (!pool.length) return;
          var k = pool[(Math.random() * pool.length) | 0], c = web.cells[k], m = centroid(c.pts);
          dropCell(k);
          fx.pane(c.pts, "fall", 380);
          later(function () { fx.glitter(10, m[0], m[1], 2); }, 380);
          loosen(n - 1);
        }, 1800 + Math.random() * 3200);
      })(7);
      fx.sparks(90, IMPACT[0], IMPACT[1], 0, 6);
      fx.sparks(30, PIN[0], PIN[1], 1.2, 7, -Math.PI / 2);
      // where it snapped: a spray of white-hot sparks
      var snap = dialPt(1.03, 41);
      fx.sparks(40, snap[0], snap[1], 0, 5);
      // the boiler lets go: steam blasts out all round the rim
      for (var sj = 0; sj < 8; sj++) { var sa = sj / 8 * Math.PI * 2 + Math.random() * 0.4; fx.steam(7, GX + Math.cos(sa) * 110, GY + Math.sin(sa) * 110, sa, 7); }
      fx.smoke(8, GX, GY, true);
      fx.embers(24, GX, GY);
      later(function () { fx.arc(); }, 260);
      later(function () { fx.arc(); }, 520);
    }
    function overload() {
      if (wrap.classList.contains("is-full")) return;
      buzz([20, 40, 20, 40, 60]);
      repair();
      applyFullBudget();
      range.value = String(BUDGET_MAX);
      paint(BUDGET_MAX);
      range.setAttribute("aria-valuetext", FULL_LABEL);
      full.classList.add("is-on"); full.setAttribute("aria-pressed", "true");
      wrap.classList.add("is-full");
      renderProgress();
      saveState();
      if (reducedMotion) { broken(true); return; }

      // slam: the needle hits the pin (css), then the director takes it
      tierName.textContent = "Warning · Thrust at limit";
      tierDesc.textContent = "The reactor is running past what the dial can show.";
      runaway();
      later(function () { wrap.classList.add("is-redline"); }, 260);
      svgTicks.slice().reverse().forEach(function (l, k) { later(function () { l.style.stroke = "#ff5a45"; }, 300 + k * 26); });
      later(function () {
        wrap.classList.add("is-critical");
        tierName.textContent = "Critical · Limit exceeded";
        tierDesc.textContent = "Hold on.";
        fx.ambient(0.6);
      }, 1500);
      // the glass starts to go: hairline cracks creep out of the impact
      [1650, 2000, 2350].forEach(function (ms, k) { later(function () { var early = cracks.filter(function (c) { return c.classList.contains("is-early"); }); if (early[k]) early[k].classList.add("is-on"); fx.glitter(6, IMPACT[0], IMPACT[1], 1.5); fx.sparks(8, IMPACT[0], IMPACT[1], 0, 2.5); }, ms); });
      later(function () { wrap.classList.add("is-hold"); fx.ambient(0); }, 2750);
      later(function () { broken(false); }, 2880);

      var t0 = performance.now(), lastSpark = 0, lastSeed = 0;
      (function direct(now) {
        var t = now - t0;
        if (t > 260 && t < 2750) {
          var crit = t > 1500 ? (t - 1500) / 1250 : 0;
          var amp = t < 1500 ? 1.5 + (t - 260) / 1240 * 2.5 : 4 + crit * 7;
          // the needle fights the pin: pinned just past it, juddering
          var n = Math.sin(t * 0.09) * 0.55 + Math.sin(t * 0.23 + 1) * 0.3 + (Math.random() - 0.5) * 0.5;
          needle.style.transform = "rotate(" + (angleOf(1.03) + 1.5 + Math.abs(n) * amp).toFixed(2) + "deg)";
          // the whole reactor shakes, worse and worse
          var s = t < 1500 ? 0.5 : 1 + crit * 4.5;
          core.style.transform = "translate(" + ((Math.random() - 0.5) * s * 2).toFixed(2) + "px," + ((Math.random() - 0.5) * s * 2).toFixed(2) + "px) rotate(" + ((Math.random() - 0.5) * s * 0.25).toFixed(2) + "deg)";
          // heat haze warps the dial
          if (heat) {
            if (!dial.getAttribute("filter")) dial.setAttribute("filter", "url(#cwx" + u + ")");
            heat.setAttribute("scale", Math.min(8, (t - 260) / 2400 * 8).toFixed(2));
            if (now - lastSeed > 60) { lastSeed = now; turb.setAttribute("seed", String((Math.random() * 100) | 0)); }
          }
          // sparks spit off the pin
          if (now - lastSpark > (t < 1500 ? 140 : 70)) {
            lastSpark = now; fx.sparks(t < 1500 ? 3 : 7, PIN[0], PIN[1], 1.6, t < 1500 ? 2.6 : 4, -Math.PI / 2 - 0.4);
            // past critical the seal goes: steam hisses out by the pin, harder and harder
            if (t > 1500) fx.steam(1 + (crit * 3 | 0), 226, 70, -0.7, 3 + crit * 5);
          }
        } else if (t >= 2750) {
          // the hold: a beat of stillness before it goes
          core.style.transform = "";
          if (heat) heat.setAttribute("scale", "0");
          return;
        }
        director = requestAnimationFrame(direct);
      })(t0);
    }
    full.addEventListener("click", overload);

    wrap.appendChild(core);
    wrap.appendChild(h("div", { "class": "cw-picks", role: "group", "aria-label": "Quick budget picks" }, picks.concat([full])));
    wrap.appendChild(range);
    wrap.appendChild(h("div", { "class": "cw-range-scale", "aria-hidden": "true" }, [
      h("span", null, [formatAED(BUDGET_MIN)]),
      h("span", null, [formatAED(BUDGET_MAX) + "+"])
    ]));
    paint(amount);
    return wrap;
  }

  // --- Final: the crew manifest and the mission ticket ----------------
  // The details are a numbered manifest; beside it (above it on a phone)
  // the mission ticket fills in live: the brief so far, then the crew as
  // they type, stamped "Cleared for launch" once everything needed is in.
  // It lifts off when the enquiry is sent (contact.css "the ticket").
  function renderFinal() {
    var box = h("div", { "class": "cw-final" });
    var f = state.form;

    var ticketId = "WX-" + String(Date.now()).slice(-5);
    var row = function (k, cls) {
      var v = h("b", { "class": cls || null });
      return { el: h("div", { "class": "cw-ticket-row" }, [h("span", null, [k]), v]), v: v };
    };
    var tServices = row("Services"), tBuild = row("Build"), tGoal = row("Objective"), tTime = row("Trajectory"), tBudget = row("Budget");
    var tCompany = row("Company", "is-crew"), tName = row("Crew", "is-crew"), tMail = row("Channel", "is-crew");
    var stamp = h("span", { "class": "cw-ticket-stamp" }, ["Cleared for launch"]);
    var ticket = h("aside", { "class": "cw-ticket", "aria-label": "Your mission ticket" }, [
      h("p", { "class": "cw-ticket-head" }, [h("i", { "aria-hidden": "true" }), "Mission ticket ", h("span", null, [ticketId])]),
      h("div", { "class": "cw-ticket-rows" }, [tServices.el, tBuild.el, tGoal.el, tTime.el, tBudget.el]),
      h("div", { "class": "cw-ticket-tear", "aria-hidden": "true" }),
      h("div", { "class": "cw-ticket-rows" }, [tCompany.el, tName.el, tMail.el]),
      h("div", { "class": "cw-ticket-foot" }, [h("span", { "class": "cw-ticket-code", "aria-hidden": "true" }), stamp])
    ]);
    els.ticket = ticket;

    var put = function (r, text, empty) {
      var v = text && String(text).trim();
      if (r.v.textContent === (v || empty)) return;
      r.v.textContent = v || empty;
      r.el.classList.toggle("is-empty", !v);
      if (v && !reducedMotion) { r.el.classList.remove("is-fresh"); void r.el.offsetWidth; r.el.classList.add("is-fresh"); }
    };
    var updateTicket = function () {
      put(tServices, f.services && f.services.length ? f.services.join(", ") : "", "None picked");
      put(tBuild, labelFor(BUILD_OPTIONS, f.buildType), "Not set");
      put(tGoal, f.goal === "other" ? (f.goalOther || "Something else") : labelFor(GOAL_OPTIONS, f.goal), "Not set");
      put(tTime, labelFor(TIMELINE_OPTIONS, f.timeline), "Not set");
      put(tBudget, budgetText(), "Not set");
      put(tCompany, f.companyName, "Awaiting");
      put(tName, f.name, "Awaiting");
      put(tMail, f.email, "Awaiting");
      ticket.classList.toggle("is-cleared", !!(f.companyName.trim() && f.name.trim() && validEmail(f.email) && f.phone.trim()));
    };

    var n = 0;
    var field = function (def, key) {
      n++;
      var c = buildControl(def, f[key], function (v) { f[key] = v; clearError(); saveState(); updateTicket(); });
      c.style.setProperty("--i", n);
      var lab = c.querySelector("label");
      lab.insertBefore(h("span", { "class": "cw-field-n", "aria-hidden": "true" }, [pad2(n)]), lab.firstChild);
      return c;
    };

    var manifest = h("div", { "class": "cw-manifest" }, [
      h("div", { "class": "cw-field-group" }, [
        h("p", { "class": "cw-field-group-title" }, ["Company"]),
        field({ id: "companyName", label: "Company name", type: "text", required: true, placeholder: "Acme Trading LLC", autocomplete: "organization" }, "companyName"),
        field({ id: "companyWebsite", label: "Company website (optional)", type: "text", required: false, placeholder: "https://", autocomplete: "url", inputmode: "url", spellcheck: "false" }, "companyWebsite")
      ]),
      h("div", { "class": "cw-field-group" }, [
        h("p", { "class": "cw-field-group-title" }, ["Crew"]),
        field({ id: "name", label: "Your name", type: "text", required: true, placeholder: "Jane Doe", autocomplete: "name" }, "name"),
        field({ id: "email", label: "Email", type: "email", required: true, placeholder: "jane@company.com", autocomplete: "email", spellcheck: "false" }, "email"),
        field({ id: "phone", label: "Phone / WhatsApp", type: "tel", required: true, placeholder: "+971 50 000 0000", autocomplete: "tel" }, "phone")
      ])
    ]);

    box.appendChild(manifest);
    box.appendChild(ticket);
    updateTicket();
    return box;
  }

  // Shared text/email/tel input builder.
  function buildControl(def, value, onChange) {
    var id = "cw-" + def.id;
    var control = h("input", {
      id: id, name: def.id, "class": "cw-input", type: def.type || "text",
      placeholder: def.placeholder || "", value: value,
      autocomplete: def.autocomplete || "off",
      inputmode: def.inputmode || null,
      spellcheck: def.spellcheck || null,
      autocapitalize: def.type === "email" || def.inputmode === "url" ? "off" : null,
      "aria-required": def.required ? "true" : false,
      "aria-describedby": "cw-error"
    });
    control.addEventListener("input", function () {
      control.removeAttribute("aria-invalid");
      onChange(control.value);
    });

    var labelKids = [def.label];
    if (def.required) {
      labelKids.push(h("span", { "class": "cw-req", "aria-hidden": "true", title: "required" }, ["*"]));
    }
    return h("div", { "class": "cw-field" }, [
      h("label", { "for": id }, labelKids),
      control
    ]);
  }

  // --- Success screen ---------------------------------------------
  function renderSuccess() {
    els.steps.innerHTML = "";
    var panel = h("div", { "class": "cw-step" }, [
      h("div", { "class": "cw-success-icon", "aria-hidden": "true" }, ["✓"]),
      h("h2", { "class": "cw-legend", tabindex: "-1" }, [
        "You're on our ", h("span", { "class": "gradient-text" }, ["radar"]), "."
      ]),
      h("p", { "class": "cw-hint" }, [
        "Thanks for reaching out. We'll review your enquiry and get back to you shortly."
      ])
    ]);
    var again = h("button", { type: "button", "class": "btn btn-ghost" }, ["Start a new enquiry"]);
    again.addEventListener("click", resetAll);
    panel.appendChild(h("div", { "class": "cw-actions" }, [again]));

    els.steps.appendChild(panel);
    els.live.textContent = "Enquiry sent. We'll be in touch shortly.";
    if (!firstRender) panel.querySelector(".cw-legend").focus();
  }

  function renderProgress() {
    var total = STEPS.length;
    var current = state.view === "success" ? total : state.stepIndex + 1;
    var pct = Math.round((current / total) * 100);
    els.progressFill.style.width = pct + "%";
    els.stepCount.textContent = pad2(current) + " / " + pad2(total);
    els.startOver.hidden = state.view === "success" || !anyAnswered();
  }

  function renderNav() {
    if (state.view === "success") {
      els.nav.hidden = true;
      return;
    }
    els.nav.hidden = false;
    els.back.hidden = state.stepIndex === 0;
    els.next.textContent = isLastStep() ? "Send my enquiry" : "Next";
  }

  /* ----------------------------------------------------------
     8. NAV / VALIDATION
     ---------------------------------------------------------- */

  // `fieldId` (optional) marks that input invalid and moves focus to
  // it, so the visitor lands right where the fix is needed.
  function showError(msg, fieldId) {
    if (!els.err) return;
    els.err.textContent = msg;
    els.err.hidden = false;
    var field = fieldId && document.getElementById("cw-" + fieldId);
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }
  function clearError() {
    if (els.err) els.err.hidden = true;
  }

  // Returns "" when the step is complete, otherwise a message.
  function stepError(step) {
    var f = state.form;
    if (step.id === "build") {
      if (!f.buildType && !(f.services && f.services.length)) return "Pick a service or a build to continue.";
    } else if (step.id === "goal") {
      if (!f.goal) return "Pick one to continue.";
    } else if (step.id === "timeline") {
      if (!f.timeline) return "Pick a timeline to continue.";
    } else if (step.id === "final") {
      if (!f.companyName.trim()) return { msg: "Please add your company name.", field: "companyName" };
      if (!f.name.trim()) return { msg: "Please add your name.", field: "name" };
      if (!validEmail(f.email)) return { msg: "Please add a valid email address.", field: "email" };
      if (!f.phone.trim()) return { msg: "Please add a phone number.", field: "phone" };
    }
    // "budget" always has a value (the slider defaults on first render).
    return "";
  }

  function validateStep() {
    var err = stepError(STEPS[state.stepIndex]);
    if (!err) return true;
    if (typeof err === "string") showError(err);
    else showError(err.msg, err.field);
    return false;
  }

  // The jump between questions: the question on screen streaks away, a
  // readout flashes the jump ("JUMP · 03 / 05") and the next one arrives
  // from the other side; back runs it the other way (contact.css
  // "the jump").
  var jumping = false;
  function jump(dir, change) {
    var old = els.steps.querySelector(".cw-step");
    if (reducedMotion || !old || jumping) { change(); return; }
    jumping = true;
    if (!els.jump) {
      els.jump = h("div", { "class": "cw-jump", "aria-hidden": "true" }, [
        h("span", { "class": "cw-jump-streaks" }, [h("i"), h("i"), h("i"), h("i"), h("i"), h("i")]),
        h("span", { "class": "cw-jump-read" })
      ]);
      els.stage.appendChild(els.jump);
    }
    var to = state.stepIndex + dir;
    els.jump.querySelector(".cw-jump-read").textContent = "JUMP · " + pad2(to + 1) + " / " + pad2(STEPS.length);
    els.stage.classList.remove("is-jump-fwd", "is-jump-back"); void els.stage.offsetWidth;
    els.stage.classList.add(dir > 0 ? "is-jump-fwd" : "is-jump-back");
    old.classList.add(dir > 0 ? "is-out-fwd" : "is-out-back");
    window.setTimeout(function () {
      change();
      var fresh = els.steps.querySelector(".cw-step");
      if (fresh) fresh.classList.add(dir > 0 ? "is-in-fwd" : "is-in-back");
      jumping = false;
      window.setTimeout(function () { els.stage.classList.remove("is-jump-fwd", "is-jump-back"); }, 700);
    }, 330);
  }

  function onNext() {
    if (jumping || !validateStep()) return;
    clearError();
    if (isLastStep()) { submitEnquiry(); return; }
    jump(1, function () {
      state.stepIndex++;
      render();
      saveState();
    });
  }

  function onBack() {
    if (jumping) return;
    clearError();
    jump(-1, function () {
      if (state.stepIndex > 0) state.stepIndex--;
      render();
      saveState();
    });
  }

  function submitEnquiry() {
    els.next.disabled = true;
    els.next.textContent = "Sending…";
    if (els.ticket) els.ticket.classList.add("is-launching");
    clearError();

    fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildFormspreePayload())
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Formspree responded with " + res.status);

        sendConfirmationEmail();

        state.completedAt = Date.now();
        saveState();
        // a beat for the ticket's lift-off before the result
        window.setTimeout(function () {
          state.view = "success";
          render();
        }, reducedMotion ? 0 : 750);
          
      })
      .catch(function () {
        if (els.ticket) els.ticket.classList.remove("is-launching");
        els.next.disabled = false;
        els.next.textContent = "Send my enquiry";
        showError("Something went wrong sending your enquiry, please try again, or email us directly at hello@worxbyglimpse.com.");
      });
  }

  function resetAll() {
    clearState();
    state.stepIndex = 0;
    state.view = "form";
    state.form = freshForm();
    state.completedAt = null;
    var t = document.getElementById("contact-title");
    var i = document.getElementById("contact-intro");
    var e = document.getElementById("contact-eyebrow");
    if (t) t.innerHTML = 'Let\'s get to <span class="gradient-text">work</span>';
    if (i) i.textContent = "Tell us what you're trying to accomplish, in your own words. A few quick questions, no technical jargon.";
    if (e) e.textContent = "Contact";
    hideResume();
    render();
  }

  /* ----------------------------------------------------------
     9. RESUME BANNER
     ---------------------------------------------------------- */

  function showResume() {
    els.resume.hidden = false;
    els.resume.innerHTML = "";
    els.resume.appendChild(h("p", null, ["Pick up where you left off?"]));
    var resumeBtn = h("button", { type: "button", "class": "btn btn-primary" }, ["Resume"]);
    var freshBtn = h("button", { type: "button", "class": "btn btn-ghost" }, ["Start fresh"]);
    resumeBtn.addEventListener("click", hideResume);
    freshBtn.addEventListener("click", resetAll);
    els.resume.appendChild(h("div", { "class": "cw-resume-actions" }, [resumeBtn, freshBtn]));
  }
  function hideResume() {
    els.resume.hidden = true;
  }

  /* ----------------------------------------------------------
     10. INIT
     ---------------------------------------------------------- */

  function init() {
    if (typeof emailjs !== "undefined") emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

    var fallback = document.querySelector(".cw-fallback");
    if (fallback) fallback.hidden = true;

    buildSkeleton();

    var saved = loadState();
    if (saved) {
      if (saved.form) {
        var ff = freshForm();
        Object.keys(ff).forEach(function (k) {
          if (saved.form[k] != null) ff[k] = saved.form[k];
        });
        state.form = ff;
      }
      state.completedAt = saved.completedAt || null;
      state.stepIndex = Math.min(Math.max(saved.stepIndex || 0, 0), STEPS.length - 1);
      if (!state.form.budget) applyBudget(DEFAULT_BUDGET_AMOUNT);
    }

    // services arriving from /services: they are the brief now. A sent
    // enquiry on file starts a new one; a draft keeps its answers but
    // takes the new list and opens on question 1.
    if (incoming.length) {
      if (saved && saved.completedAt) { state.form = freshForm(); applyBudget(DEFAULT_BUDGET_AMOUNT); state.completedAt = null; }
      state.form.services = incoming.slice();
      if (!state.form.buildType) state.form.buildType = buildFromServices(incoming);
      state.stepIndex = 0;
      state.view = "form";
      saveState();
    }

    applyCopy(saved);

    if (incoming.length) {
      // straight into the brief
    } else if (saved && saved.completedAt) {
      state.view = "success";           // already sent, offer to start another
    } else if (saved && anyAnswered()) {
      showResume();                     // half-finished, offer to resume
    } else {
      state.stepIndex = 0;              // nothing meaningful saved, start clean
    }

    render();

    // arriving with a brief from /services: skip the hero and bring the
    // planner up (as the hero's own "open channel" key does), once the
    // page has settled so the landing point holds
    if (incoming.length) {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      var toPlanner = function () {
        var target = document.getElementById("contact-planner");
        if (!target) return;
        var instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: instant ? "auto" : "smooth" });
      };
      var go = function () {
        window.setTimeout(function () {
          var from = window.scrollY;
          toPlanner();
          // if the glide never got going, land there directly
          window.setTimeout(function () {
            var target = document.getElementById("contact-planner");
            if (target && Math.abs(window.scrollY - from) < 40 && target.getBoundingClientRect().top > 200) {
              window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: "auto" });
            }
          }, 900);
        }, 350);
      };
      if (document.readyState === "complete") go();
      else window.addEventListener("load", go, { once: true });
    }
  }

  init();

  // on a phone the floating WhatsApp beacon would sit over the planner's
  // Back / Next buttons: it steps aside while the planner is on screen
  // (WhatsApp is in the hero and the channels either side of it)
  var planner = document.getElementById("contact-planner");
  if (planner && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      document.body.classList.toggle("ct-planner-in", en[0].isIntersecting);
    }, { rootMargin: "-25% 0px -25% 0px" }).observe(planner);
  }
})();
