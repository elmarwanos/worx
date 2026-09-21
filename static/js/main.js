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
