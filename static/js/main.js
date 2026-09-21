/* ============================================================
   Worx by Glimpse — main.js
   Page behaviours that aren't navigation or animation:
   FAQ accordion, footer year.
   (The /contact page has its own planner — static/js/contact.js.)
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

  // --- Footer year -----------------------------------------------
  var year = document.querySelector("#footer-year");
  if (year) year.textContent = new Date().getFullYear();
})();
