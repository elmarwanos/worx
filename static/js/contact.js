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
    els.stage.classList.toggle("cw-stage--wide", step.id === "build");

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

    els.err = h("p", { "class": "cw-error", role: "alert", hidden: true });
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

  // --- Question 1: what to build + their idea, in their own words ----
  function renderBuild() {
    var box = h("div", null);
    box.appendChild(renderCards(BUILD_OPTIONS, "buildType", state.form.buildType,
      "What do you want to build?", function (value) {
        state.form.buildType = value;
        clearError();
        renderProgress();
        saveState();
      }, "cw-options--build"));

    var idea = h("div", { "class": "cw-followup" }, [
      h("p", { "class": "cw-followup-title" }, ["Tell us about your idea (optional)"]),
      h("p", { "class": "cw-hint" }, ["Give us the idea in your own words. No technical details needed."])
    ]);
    var textarea = h("textarea", {
      id: "cw-idea", "class": "cw-input cw-textarea-lg", rows: "6",
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

    box.appendChild(renderCards(GOAL_OPTIONS, "goal", state.form.goal,
      "What do you want it to achieve?", function (value) {
        state.form.goal = value;
        clearError();
        otherWrap.hidden = value !== "other";
        renderProgress();
        saveState();
      }, "cw-options--goal"));

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
    return renderCards(step.options, step.field, state.form[step.field], step.legend, function (value) {
      state.form[step.field] = value;
      clearError();
      renderProgress();
      renderNav();
      saveState();
    });
  }

  // --- Budget: continuous AED slider, $1,000-equivalent steps ---------
  function renderBudget() {
    if (!state.form.budget) applyBudget(DEFAULT_BUDGET_AMOUNT);
    var amount = budgetAmount();
    var wrap = h("div", null);

    var value = h("p", {
      "class": "cw-budget-value", role: "status", "aria-live": "polite"
    }, [formatAED(amount)]);

    var range = h("input", {
      type: "range", "class": "cw-range",
      min: String(BUDGET_MIN), max: String(BUDGET_MAX), step: String(BUDGET_STEP), value: String(amount),
      "aria-label": "Budget range in AED", "aria-valuetext": formatAED(amount)
    });
    range.addEventListener("input", function () {
      var a = parseInt(range.value, 10) || DEFAULT_BUDGET_AMOUNT;
      applyBudget(a);
      value.textContent = formatAED(a);
      range.setAttribute("aria-valuetext", formatAED(a));
      renderProgress();
      saveState();
    });

    wrap.appendChild(value);
    wrap.appendChild(range);
    wrap.appendChild(h("div", { "class": "cw-range-scale", "aria-hidden": "true" }, [
      h("span", null, [formatAED(BUDGET_MIN)]),
      h("span", null, [formatAED(BUDGET_MAX)])
    ]));
    return wrap;
  }

  // --- Final: company + personal details, then send -------------------
  function renderFinal() {
    var box = h("div", null);

    box.appendChild(h("div", { "class": "cw-field-group" }, [
      h("p", { "class": "cw-field-group-title" }, ["Company"]),
      buildControl(
        { id: "companyName", label: "Company name", type: "text", required: true, placeholder: "Acme Trading LLC" },
        state.form.companyName,
        function (v) { state.form.companyName = v; clearError(); saveState(); }
      ),
      buildControl(
        { id: "companyWebsite", label: "Company website (optional)", type: "text", required: false, placeholder: "https://" },
        state.form.companyWebsite,
        function (v) { state.form.companyWebsite = v; saveState(); }
      )
    ]));

    box.appendChild(h("div", { "class": "cw-field-group" }, [
      h("p", { "class": "cw-field-group-title" }, ["Personal"]),
      buildControl(
        { id: "name", label: "Your name", type: "text", required: true, placeholder: "Jane Doe" },
        state.form.name,
        function (v) { state.form.name = v; clearError(); saveState(); }
      ),
      buildControl(
        { id: "email", label: "Email", type: "email", required: true, placeholder: "jane@company.com" },
        state.form.email,
        function (v) { state.form.email = v; clearError(); saveState(); }
      ),
      buildControl(
        { id: "phone", label: "Phone / WhatsApp", type: "tel", required: true, placeholder: "+971 50 000 0000" },
        state.form.phone,
        function (v) { state.form.phone = v; clearError(); saveState(); }
      )
    ]));

    return box;
  }

  // Shared text/email/tel input builder.
  function buildControl(def, value, onChange) {
    var id = "cw-" + def.id;
    var control = h("input", {
      id: id, "class": "cw-input", type: def.type || "text",
      placeholder: def.placeholder || "", value: value,
      "aria-required": def.required ? "true" : false
    });
    control.addEventListener("input", function () { onChange(control.value); });

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

  function showError(msg) {
    if (!els.err) return;
    els.err.textContent = msg;
    els.err.hidden = false;
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
      if (!f.companyName.trim()) return "Please add your company name.";
      if (!f.name.trim()) return "Please add your name.";
      if (!validEmail(f.email)) return "Please add a valid email address.";
      if (!f.phone.trim()) return "Please add a phone number.";
    }
    // "budget" always has a value (the slider defaults on first render).
    return "";
  }

  function validateStep() {
    var msg = stepError(STEPS[state.stepIndex]);
    if (msg) { showError(msg); return false; }
    return true;
  }

  function onNext() {
    if (!validateStep()) return;
    clearError();
    if (isLastStep()) { submitEnquiry(); return; }
    state.stepIndex++;
    render();
    saveState();
  }

  function onBack() {
    if (state.stepIndex > 0) state.stepIndex--;
    clearError();
    render();
    saveState();
  }

  function submitEnquiry() {
    els.next.disabled = true;
    els.next.textContent = "Sending…";
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
        state.view = "success";
        render();
          
      })
      .catch(function () {
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
        var ff = freshForm()
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
