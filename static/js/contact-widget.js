/* ============================================================
   Worx | contact-widget.js
   A floating dock that follows the viewport on every page: the
   WhatsApp beacon (straight to the studio's chat) and the Mission
   Control console, a quick transmission form. Every string and
   channel below comes from the CONTACT dictionary, edit the data,
   not the markup.
   The console opens from any [data-contact-open] trigger and from
   every "Quick Enquiry" CTA; without JS those CTAs keep
   their own link to the contact page.
   ============================================================ */

(function () {
  "use strict";

  // --- The dictionary --------------------------------------------
  var CONTACT = {
    title: "Quick Enquiry",
    intro: "Pick a channel or leave a note, we usually reply within a day.",
    recipient: "Hello@worxbyglimpse.com",
    subjectPrefix: "Project enquiry from ",
    ctaText: /quick enquiry|get a quote|talk to mission control/i,
    whatsapp: {
      href: "https://wa.me/971555669847",
      greeting: "Hi Worx, I'd like to talk about a project.",
      label: "WhatsApp",
      ariaLabel: "Chat with Worx on WhatsApp (opens in a new tab)",
      sender: "Worx \u00B7 Mission Control",
      bubble: "Mission Control Online.\nTap to Open Comms."
    },
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
    '<span class="qc-call-txt"><small aria-hidden="true"><span>Relay \u00B7 live</span><span>Plan your project</span></small><b>Make Contact</b></span>' +
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

  // The WhatsApp beacon ------------------------------------
  // a green core on a dark glass puck, a signal halo sweeping round
  // it, a satellite on its orbit, pings going out; under the pointer
  // it opens into a pill with the crew's status and Dubai's clock.
  var WA = CONTACT.whatsapp;
  var waHref = WA.href + "?text=" + encodeURIComponent(WA.greeting);
  var WA_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  var waWrap = el("div", "qc-wa-wrap");

  // the incoming message: typing, then a line from the crew
  var bubble = el("a", "qc-wa-bubble");
  bubble.href = waHref;
  bubble.target = "_blank";
  bubble.rel = "noopener";
  bubble.tabIndex = -1;
  bubble.setAttribute("aria-hidden", "true");
  bubble.innerHTML =
    '<span class="qc-wa-bubble-face"><span class="qc-wa-bubble-tile"><img src="' + ROOT + 'static/assets/logo-dark.png" alt="" width="40" height="55" decoding="async"></span><i></i></span>' +
    '<span class="qc-wa-bubble-body"><small></small><span class="qc-wa-typing"><i></i><i></i><i></i></span><span class="qc-wa-bubble-msg"></span></span>';
  bubble.querySelector("small").textContent = WA.sender;
  bubble.querySelector(".qc-wa-bubble-msg").textContent = WA.bubble;
  waWrap.appendChild(bubble);

  var fab = el("a", "qc-wa");
  fab.href = waHref;
  fab.target = "_blank";
  fab.rel = "noopener";
  fab.setAttribute("aria-label", WA.ariaLabel);
  // the glass pill (clipped to a puck until hovered), then the orb
  fab.innerHTML =
    '<span class="qc-wa-shell" aria-hidden="true"><span class="qc-wa-txt"><b></b><small><i></i>Crew online \u00B7 <time data-qc-clock>--:--</time> GST</small></span></span>' +
    '<span class="qc-wa-orb" aria-hidden="true">' +
      '<i class="qc-wa-ping"></i><i class="qc-wa-ping"></i>' +
      '<i class="qc-wa-orbit"><b></b></i>' +
      '<i class="qc-wa-halo"></i>' +
      '<span class="qc-wa-core">' + WA_GLYPH + '</span>' +
    '</span>';
  fab.querySelector(".qc-wa-txt b").textContent = WA.label;
  waWrap.appendChild(fab);

  dock.appendChild(panel);
  dock.appendChild(waWrap);
  document.body.appendChild(dock);

  // Dubai's time on the console's bar
  var clocks = dock.querySelectorAll("[data-qc-clock]");
  try {
    var fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false });
    var tickClock = function () {
      var t = fmt.format(new Date());
      Array.prototype.forEach.call(clocks, function (c) { c.textContent = t; });
    };
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
    hideBubble();
    if (narrow.matches) document.body.style.overflow = "hidden";
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onOutsideClick, true);
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    dock.classList.remove("is-open");
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

  // once they've opened the chat, the crew's message stays quiet
  var SEEN_KEY = "worx-wa-seen";
  function seen() {
    try { return !!window.sessionStorage.getItem(SEEN_KEY); } catch (e) { return false; }
  }
  function markSeen() {
    hideBubble();
    try { window.sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
  }
  fab.addEventListener("click", markSeen);
  bubble.addEventListener("click", markSeen);

  // the crew's message: it only ever comes up under the pointer (or
  // keyboard focus), never on its own at load
  var bubbleTimers = [];
  var bubbleDone = seen();
  function clearBubbleTimers() {
    bubbleTimers.forEach(window.clearTimeout);
    bubbleTimers = [];
  }
  function hideBubble() {
    bubbleDone = true;
    clearBubbleTimers();
    waWrap.classList.remove("is-typing", "is-talking");
  }

  // ...and every time the pointer rests on the beacon: the Worx tile
  // flips in, a beat of typing, then the line. Moving onto the bubble
  // keeps it up; leaving both lets it go.
  var canHover = window.matchMedia("(hover: hover)");
  var leaveTimer = 0;
  function hoverIn(event) {
    if (event.pointerType === "touch" || !canHover.matches || isOpen) return;
    window.clearTimeout(leaveTimer);
    bubbleDone = true;
    if (waWrap.classList.contains("is-talking") || waWrap.classList.contains("is-typing")) return;
    clearBubbleTimers();
    waWrap.classList.add("is-typing");
    bubbleTimers.push(window.setTimeout(function () {
      waWrap.classList.remove("is-typing");
      waWrap.classList.add("is-talking");
    }, prefersReducedMotion ? 0 : 700));
  }
  function hoverOut(event) {
    if (event.pointerType === "touch") return;
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(function () {
      clearBubbleTimers();
      waWrap.classList.remove("is-typing", "is-talking");
    }, 260);
  }
  fab.addEventListener("pointerenter", hoverIn);
  fab.addEventListener("pointerleave", hoverOut);
  bubble.addEventListener("pointerenter", hoverIn);
  bubble.addEventListener("pointerleave", hoverOut);
  fab.addEventListener("focus", function () { hoverIn({ pointerType: "" }); });
  fab.addEventListener("blur", function () { hoverOut({ pointerType: "" }); });
  // (the beacon never speaks up on its own: its line only comes on hover)
  closeBtn.addEventListener("click", function () {
    close();
  });

  // Triggers: [data-contact-open] and every "Talk to Mission
  // Control" CTA. A service page's CTA carries its service in the
  // link (?services=...), which becomes the note's opening line.
  function prefill(trigger) {
    var href = trigger.getAttribute("href") || "";
    var m = href.match(/[?&]services=([^&#]+)/);
    if (!m || form.message.value.trim()) return;
    try {
      form.message.value = "I'm interested in " + decodeURIComponent(m[1].replace(/\+/g, " ")) + ". ";
    } catch (e) {}
  }

  Array.prototype.filter.call(
    document.querySelectorAll("a, button"),
    function (node) {
      return !dock.contains(node) &&
        (node.hasAttribute("data-contact-open") || CONTACT.ctaText.test(node.textContent));
    }
  ).forEach(function (trigger) {
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "qc-panel");
    trigger.addEventListener("click", function (event) {
      // a modified click still opens the contact page in a new tab
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      prefill(trigger);
      // from inside the mobile menu: let the menu slide away first
      var toggle = document.querySelector(".nav-toggle");
      if (document.body.classList.contains("nav-open") && toggle) {
        toggle.click();
        window.setTimeout(open, prefersReducedMotion ? 0 : 320);
      } else {
        open();
      }
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
    if (!show) waWrap.classList.remove("is-typing", "is-talking");
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
