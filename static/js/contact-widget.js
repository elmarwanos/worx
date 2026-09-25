/* ============================================================
   Worx by Glimpse — contact-widget.js
   A floating "quick contact" dock that follows the viewport on
   every page. Every string and channel below comes from the
   CONTACT dictionary — edit the data, not the markup.
   Opened by its own button or by any [data-contact-open] trigger
   (e.g. the hero button on the home page).
   ============================================================ */

(function () {
  "use strict";

  // --- The dictionary --------------------------------------------
  var CONTACT = {
    title: "Let's talk",
    intro: "Pick a channel or leave a note — we usually reply within a day.",
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

  var dock = el("div", "qc-dock");

  // Panel ------------------------------------------------------
  var panel = el("div", "qc-panel");
  panel.id = "qc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "qc-title");
  panel.hidden = true;

  var head = el("div", "qc-panel-head");
  var headText = el("div");
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

  var channels = el("div", "qc-channels");
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
    row.appendChild(el("span", "qc-ico", item.icon));
    var meta = el("span", "qc-channel-meta");
    meta.appendChild(el("span", "qc-label", item.label));
    meta.appendChild(el("span", "qc-value", item.value));
    row.appendChild(meta);
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

  var submit = el("button", "btn btn-primary", "Send message");
  submit.type = "submit";
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
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 ' +
    '8.38 8.38 0 0 1-3.8-.9L3 20l1.4-4.2A8.38 8.38 0 0 1 3.5 11.5 ' +
    '8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>';
  fab.appendChild(el("span", "qc-fab-label", CONTACT.fabLabel));

  dock.appendChild(panel);
  dock.appendChild(fab);
  document.body.appendChild(dock);

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
      data.message + "\n\n— " + data.name + " (" + data.email + ")"
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

  function updateDock() {
    ticking = false;
    if (isOpen) {
      dock.classList.add("is-ready");
      return;
    }
    var y = window.scrollY || window.pageYOffset;
    var revealAt = hasHero ? window.innerHeight * 0.6 : 180;
    var distToBottom =
      document.documentElement.scrollHeight - y - window.innerHeight;
    var show = y > revealAt && distToBottom > 240;
    dock.classList.toggle("is-ready", show);
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
