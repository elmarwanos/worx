/* ============================================================
   Worx | contact-widget.js
   A floating "quick contact" dock that follows the viewport on
   every page. Every string and channel below comes from the
   CONTACT dictionary, edit the data, not the markup.
   Opened by its own button or by any [data-contact-open] trigger
   (e.g. the hero button on the home page).
   ============================================================ */

(function () {
  "use strict";

  // --- The dictionary --------------------------------------------
  var CONTACT = {
    title: "Let's talk",
    intro: "Pick a channel or leave a note, we usually reply within a day.",
    recipient: "Hello@worxbyglimpse.com",
    subjectPrefix: "Project enquiry from ",
    fabLabel: "Contact",
    channels: {
      email: {
        icon: "✉️",
        label: "Email",
        value: "Hello@worxbyglimpse.com",
        href: "mailto:Hello@worxbyglimpse.com"
      },
      phone: {
        icon: "📞",
        label: "Phone",
        value: "+971 55 566 9847",
        href: "tel:+971555669847"
      },
      whatsapp: {
        icon: "💬",
        label: "WhatsApp",
        value: "Message the studio",
        href: "https://wa.me/971555669847",
        external: true
      },
      office: {
        icon: "📍",
        label: "Studio",
        value: "Dubai Production City",
        href: "https://maps.google.com/?q=Publishing+Pavilion+Me%27aisem+First+Dubai+Production+City+Dubai",
        external: true
      }
    }
  };

  // The dedicated /contact page already has the full form.
  if (document.body.dataset.page === "contact") return;

  var prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Build the DOM from the dictionary ------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // the site root, from this script's own address (for Marwan's portrait)
  var me = document.currentScript || document.querySelector('script[src*="contact-widget.js"]');
  var ROOT = me ? me.src.replace(/static\/js\/contact-widget\.js.*$/, "") : "";

  var dock = el("div", "qc-dock");

  // Panel ------------------------------------------------------
  var panel = el("div", "qc-panel");
  panel.id = "qc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "qc-title");
  panel.hidden = true;

  // the console's bar: the relay's id and Dubai's clock
  var bar = el("div", "qc-bar");
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = '<span class="qc-rec"></span><span class="qc-bar-id">WORX RELAY \u00B7 QUICK CHANNEL</span><span class="qc-bar-t"><time data-qc-clock>--:--</time> GST</span>';
  panel.appendChild(bar);
  var vf = el("span", "qc-vf");
  vf.setAttribute("aria-hidden", "true");
  panel.appendChild(vf);

  var head = el("div", "qc-panel-head");
  var headText = el("div");
  var status = el("p", "qc-status", "Channel open");
  status.setAttribute("aria-hidden", "true");
  headText.appendChild(status);
  var title = el("h3", null, CONTACT.title);
  title.id = "qc-title";
  headText.appendChild(title);
  headText.appendChild(el("p", null, CONTACT.intro));
  var closeBtn = el("button", "qc-close", "✕");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close contact panel");
  head.appendChild(headText);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  // first: open the channel, the full brief on the contact page
  var call = el("a", "qc-call");
  call.href = ROOT + "contact/index.html";
  call.innerHTML = '<span class="qc-call-beacon" aria-hidden="true"><i></i></span>' +
    '<span class="qc-call-txt"><small aria-hidden="true"><span>Relay \u00B7 live</span><span>Plan your project</span></small><b>Open Channel</b></span>' +
    '<span class="qc-call-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
  panel.appendChild(call);

  var channels = el("div", "qc-channels");
  var chN = 0;
  Object.keys(CONTACT.channels).forEach(function (key) {
    var item = CONTACT.channels[key];
    var row = item.href ? el("a", "qc-channel") : el("div", "qc-channel");
    if (item.href) {
      row.href = item.href;
      if (item.external) {
        row.target = "_blank";
        row.rel = "noopener";
      }
    }
    // a numbered channel on the console, not an emoji
    var ch = el("span", "qc-ico", "CH " + ("0" + (++chN)).slice(-2));
    ch.setAttribute("aria-hidden", "true");
    row.appendChild(ch);
    var meta = el("span", "qc-channel-meta");
    meta.appendChild(el("span", "qc-label", item.label));
    meta.appendChild(el("span", "qc-value", item.value));
    row.appendChild(meta);
    var go = el("span", "qc-go", item.href ? "\u2197" : "");
    go.setAttribute("aria-hidden", "true");
    row.appendChild(go);
    channels.appendChild(row);
  });
  panel.appendChild(channels);

  // Quick message form --------------------------------------
  var form = el("form", "qc-form");
  form.setAttribute("novalidate", "");

  function field(id, label, type) {
    var wrap = el("div");
    var lab = el("label", null, label);
    lab.setAttribute("for", "qc-" + id);
    var input = el(type === "textarea" ? "textarea" : "input");
    input.id = "qc-" + id;
    input.name = id;
    if (type === "textarea") input.rows = 3;
    else input.type = type;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  form.appendChild(field("name", "Your name", "text"));
  form.appendChild(field("email", "Email", "email"));
  form.appendChild(field("message", "Message", "textarea"));

  var submit = el("button", "qc-send");
  submit.type = "submit";
  submit.innerHTML = '<span class="qc-send-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span>Transmit message</span>';
  form.appendChild(submit);

  var note = el("p", "qc-note");
  note.setAttribute("role", "status");
  note.setAttribute("aria-live", "polite");
  form.appendChild(note);
  panel.appendChild(form);

  // Floating button -----------------------------------------
  var fab = el("button", "qc-fab");
  fab.type = "button";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "qc-panel");
  // the beacon: a live radar in a dark well, the label, its status
  fab.innerHTML =
    '<span class="qc-radar" aria-hidden="true"><i class="qc-radar-sweep"></i><i class="qc-radar-blip"></i><i class="qc-radar-ping"></i></span>' +
    '<span class="qc-fab-vf" aria-hidden="true"></span>';
  var fabTxt = el("span", "qc-fab-txt");
  fabTxt.appendChild(el("span", "qc-fab-label", CONTACT.fabLabel));
  var fabSub = el("small", "qc-fab-sub", "Relay \u00B7 live");
  fabSub.setAttribute("aria-hidden", "true");
  fabTxt.appendChild(fabSub);
  fab.appendChild(fabTxt);

  dock.appendChild(panel);
  dock.appendChild(fab);
  document.body.appendChild(dock);

  // Dubai's time on the console's bar
  var clock = panel.querySelector("[data-qc-clock]");
  try {
    var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false });
    var tickClock = function () { clock.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 15000);
  } catch (e) {}

  // --- Open / close -------------------------------------------
  var isOpen = false;
  var lastFocus = null;
  var narrow = window.matchMedia("(max-width: 480px)");

  function focusable() {
    return panel.querySelectorAll(
      'a[href], button:not([disabled]), input, textarea'
    );
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    panel.hidden = false;
    dock.classList.add("is-ready", "is-open");
    shown = true;
    fab.tabIndex = 0;
    fab.removeAttribute("aria-hidden");
    fab.setAttribute("aria-expanded", "true");
    if (narrow.matches) document.body.style.overflow = "hidden";
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onOutsideClick, true);
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    dock.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onOutsideClick, true);
    var delay = prefersReducedMotion ? 0 : 220;
    window.setTimeout(function () {
      if (!isOpen) panel.hidden = true;
    }, delay);
    onScroll();
    if (returnFocus !== false && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Tab") {
      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function onOutsideClick(event) {
    if (!dock.contains(event.target)) close(false);
  }

  fab.addEventListener("click", function () {
    isOpen ? close() : open();
  });
  closeBtn.addEventListener("click", function () {
    close();
  });

  // External triggers, e.g. the hero button --------------------
  document.querySelectorAll("[data-contact-open]").forEach(function (trigger) {
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      open();
    });
  });

  // --- Form: hand off to the mail client ----------------------
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim()
    };
    if (!data.name || !data.email || !data.message) {
      note.textContent = "Please fill in every field.";
      return;
    }
    var subject = encodeURIComponent(CONTACT.subjectPrefix + data.name);
    var body = encodeURIComponent(
      data.message + "\n\n- " + data.name + " (" + data.email + ")"
    );
    window.location.href =
      "mailto:" + CONTACT.recipient + "?subject=" + subject + "&body=" + body;
    note.textContent = "Opening your mail app…";
    form.reset();
  });

  // --- Follow the viewport: reveal after the hero, hide at the
  //     footer so the dock never covers the page's own contact.
  var hasHero = !!document.querySelector(".hero");
  var ticking = false;
  var shown = null;

  function updateDock() {
    ticking = false;
    if (isOpen) {
      dock.classList.add("is-ready");
      shown = true;
      fab.tabIndex = 0;
      fab.removeAttribute("aria-hidden");
      return;
    }
    var y = window.scrollY || window.pageYOffset;
    var revealAt = hasHero ? window.innerHeight * 0.6 : 180;
    var distToBottom =
      document.documentElement.scrollHeight - y - window.innerHeight;
    var show = y > revealAt && distToBottom > 240;
    if (show === shown) return;
    shown = show;
    dock.classList.toggle("is-ready", show);
    // while it's faded out, keep the button out of the Tab order and
    // away from screen readers too
    fab.tabIndex = show ? 0 : -1;
    if (show) fab.removeAttribute("aria-hidden");
    else fab.setAttribute("aria-hidden", "true");
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateDock);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateDock();
})();
