/* ============================================================
   Worx by Glimpse — main.js
   Page behaviours that aren't navigation or animation:
   FAQ accordion, contact form handling, footer year.
   ============================================================ */

(function () {
  "use strict";

  // --- FAQ accordion -------------------------------------------
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var question = item.querySelector(".faq-question");
    var answer = item.querySelector(".faq-answer");
    if (!question || !answer) return;

    question.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");

      // Close any other open item first
      document.querySelectorAll(".faq-item.is-open").forEach(function (open) {
        open.classList.remove("is-open");
        open.querySelector(".faq-answer").style.maxHeight = null;
        open.querySelector(".faq-question")
          .setAttribute("aria-expanded", "false");
      });

      if (!isOpen) {
        item.classList.add("is-open");
        answer.style.maxHeight = answer.scrollHeight + "px";
        question.setAttribute("aria-expanded", "true");
      }
    });
  });

  // --- Contact form ---------------------------------------------
  // There is no backend in this static build, so the form opens
  // the visitor's mail client with the message pre-filled.
  var form = document.querySelector("#contact-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var name = form.querySelector("#field-name").value.trim();
      var email = form.querySelector("#field-email").value.trim();
      var message = form.querySelector("#field-message").value.trim();

      var subject = encodeURIComponent("Project enquiry from " + name);
      var body = encodeURIComponent(
        message + "\n\n— " + name + " (" + email + ")"
      );

      window.location.href =
        "mailto:Hello@worxbyglimpse.com?subject=" + subject + "&body=" + body;
    });
  }

  // --- Footer year -----------------------------------------------
  var year = document.querySelector("#footer-year");
  if (year) year.textContent = new Date().getFullYear();
})();
