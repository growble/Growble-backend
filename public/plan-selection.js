document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const plan = button.dataset.plan;
      const allowedPlans = ["free", "starter", "pro", "agent"];

      if (!allowedPlans.includes(plan)) {
        return;
      }

      if (localStorage.getItem("token")) {
        window.location.href = plan === "free"
          ? "/index.html"
          : `/payment.html?plan=${encodeURIComponent(plan)}`;
        return;
      }

      window.location.href = `/signup.html?plan=${encodeURIComponent(plan)}`;
    });
  });
});
