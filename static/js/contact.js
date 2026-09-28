/* ============================================================
   Worx | contact.js
   The /contact "project planner": five short questions, one at
   a time, answered in plain language and interactive cards,
   never a technical spec sheet. Worx makes the technical calls
   during discovery; the client just explains what they need.

     1. What do you want to build?  (+ their idea, in their words)
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
  var DEFAULT_BUDGET_AMOUNT = 50000;

  var STEPS = [
    { id: "build",    legend: "What do you want to build?", type: "build" },
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

  // Services picked in the mission builder on /services arrive as
  // ?services=Web Development,SEO and seed the idea box.
  try {
    var picked = new URLSearchParams(window.location.search).get("services");
    if (picked) {
      state.form.idea = "Services I'm interested in: " +
        picked.split(",").map(function (s) { return s.trim(); }).filter(Boolean).join(", ") + ".\n\n";
    }
  } catch (e) {}

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
    return !!(f.buildType || f.idea.trim() || f.goal ||
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
    if (saved && saved.completedAt) {
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

  // This is where you would add the EMAILJS service ID

  function buildFormspreePayload() {
    var f = state.form;
    return {
      _subject: "New enquiry, " + (f.companyName || "Website project") +
        (f.buildType ? " (" + labelFor(BUILD_OPTIONS, f.buildType) + ")" : ""),
      _replyto: f.email,
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
  // A gauge the budget drives: its arc fills and its needle swings as the
  // figure climbs, the figure counts up to where the slider is, and the
  // mission tier the amount buys is named beneath it. Quick picks for a
  // thumb; the slider itself (keyboard and screen readers) underneath.
  var BUDGET_TIERS = [
    { max: 20000, name: "Launchpad", desc: "A focused site, a landing page or an MVP." },
    { max: 60000, name: "Low orbit", desc: "A full website, a store or a first app." },
    { max: 150000, name: "Deep orbit", desc: "Web apps, platforms and their integrations." },
    { max: Infinity, name: "Interstellar", desc: "Enterprise systems, built across platforms." }
  ];
  var BUDGET_PICKS = [15000, 40000, 90000, 180000, 250000];
  function tierOf(a) { for (var i = 0; i < BUDGET_TIERS.length; i++) if (a < BUDGET_TIERS[i].max) return i; return BUDGET_TIERS.length - 1; }
  function shortAED(a) { return a >= 1000 ? Math.round(a / 1000) + "K" : String(a); }

  function renderBudget() {
    if (!state.form.budget) applyBudget(DEFAULT_BUDGET_AMOUNT);
    var amount = budgetAmount();
    var wrap = h("div", { "class": "cw-reactor" });

    // the gauge: a half ring of ticks, the fill arc, the needle
    var ticks = "";
    for (var t = 0; t <= 40; t++) {
      var ang = Math.PI * (1 - t / 40), major = t % 10 === 0;
      var r1 = major ? 88 : 93, r2 = 100;
      ticks += '<line x1="' + (120 + Math.cos(ang) * r1).toFixed(1) + '" y1="' + (124 - Math.sin(ang) * r1).toFixed(1) + '" x2="' + (120 + Math.cos(ang) * r2).toFixed(1) + '" y2="' + (124 - Math.sin(ang) * r2).toFixed(1) + '"' + (major ? ' class="is-major"' : "") + "/>";
    }
    var gauge = h("div", { "class": "cw-gauge", "aria-hidden": "true" });
    gauge.innerHTML =
      '<svg viewBox="0 0 240 136">' +
        '<defs><linearGradient id="cw-gauge-g" x1="0" x2="1"><stop offset="0" stop-color="#c04527"/><stop offset=".55" stop-color="#e57d23"/><stop offset="1" stop-color="#faa719"/></linearGradient></defs>' +
        '<g class="cw-gauge-ticks">' + ticks + "</g>" +
        '<path class="cw-gauge-track" d="M28 124A92 92 0 0 1 212 124" pathLength="1"/>' +
        '<path class="cw-gauge-fill" d="M28 124A92 92 0 0 1 212 124" pathLength="1"/>' +
        '<g class="cw-gauge-needle"><path d="M120 124L120 44"/><circle cx="120" cy="44" r="3"/></g>' +
        '<circle class="cw-gauge-hub" cx="120" cy="124" r="7"/>' +
      "</svg>" +
      '<span class="cw-gauge-glow"></span>';

    var tierName = h("p", { "class": "cw-reactor-tier" });
    var value = h("p", { "class": "cw-budget-value", role: "status", "aria-live": "polite" }, [formatAED(amount)]);
    var tierDesc = h("p", { "class": "cw-reactor-desc" });
    var read = h("div", { "class": "cw-reactor-read" }, [tierName, value, tierDesc]);

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
      picks.forEach(function (b) { b.classList.toggle("is-on", +b.getAttribute("data-amount") === a); });
    }
    function set(a, fromPick) {
      a = Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, a));
      if (fromPick) range.value = String(a);
      applyBudget(a);
      paint(a);
      countTo(a);
      range.setAttribute("aria-valuetext", formatAED(a));
      renderProgress();
      saveState();
    }
    var picks = BUDGET_PICKS.map(function (a) {
      var b = h("button", { type: "button", "class": "cw-pick", "data-amount": String(a) }, ["AED " + shortAED(a) + (a >= BUDGET_MAX ? "+" : "")]);
      b.addEventListener("click", function () { set(a, true); });
      return b;
    });
    range.addEventListener("input", function () { set(parseInt(range.value, 10) || DEFAULT_BUDGET_AMOUNT, false); });

    wrap.appendChild(h("div", { "class": "cw-reactor-core" }, [gauge, read]));
    wrap.appendChild(h("div", { "class": "cw-picks", role: "group", "aria-label": "Quick budget picks" }, picks));
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
    var tBuild = row("Build"), tGoal = row("Objective"), tTime = row("Trajectory"), tBudget = row("Budget");
    var tCompany = row("Company", "is-crew"), tName = row("Crew", "is-crew"), tMail = row("Channel", "is-crew");
    var stamp = h("span", { "class": "cw-ticket-stamp" }, ["Cleared for launch"]);
    var ticket = h("aside", { "class": "cw-ticket", "aria-label": "Your mission ticket" }, [
      h("p", { "class": "cw-ticket-head" }, [h("i", { "aria-hidden": "true" }), "Mission ticket ", h("span", null, [ticketId])]),
      h("div", { "class": "cw-ticket-rows" }, [tBuild.el, tGoal.el, tTime.el, tBudget.el]),
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
      put(tBuild, labelFor(BUILD_OPTIONS, f.buildType), "Not set");
      put(tGoal, f.goal === "other" ? (f.goalOther || "Something else") : labelFor(GOAL_OPTIONS, f.goal), "Not set");
      put(tTime, labelFor(TIMELINE_OPTIONS, f.timeline), "Not set");
      put(tBudget, formatAED(budgetAmount()), "Not set");
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
      if (!f.buildType) return "Pick one to continue.";
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

    applyCopy(saved);

    if (saved && saved.completedAt) {
      state.view = "success";           // already sent, offer to start another
    } else if (saved && anyAnswered()) {
      showResume();                     // half-finished, offer to resume
    } else {
      state.stepIndex = 0;              // nothing meaningful saved, start clean
    }

    render();
  }

  init();
})();
