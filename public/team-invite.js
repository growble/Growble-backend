document.addEventListener("DOMContentLoaded", async () => {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const status = document.getElementById("status");
  const actions = document.getElementById("actions");
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    status.textContent = "This invitation link is invalid.";
    return;
  }

  const authToken = localStorage.getItem("token");
  if (!authToken) {
    status.textContent = "Sign in or create an account using the invited email address.";
    const login = document.createElement("a");
    login.href = `/login.html?invite=${encodeURIComponent(token)}`;
    login.textContent = "Log in";
    const signup = document.createElement("a");
    signup.href = `/signup.html?invite=${encodeURIComponent(token)}`;
    signup.textContent = "Create account";
    actions.append(login, signup);
    return;
  }

  try {
    const response = await fetch("/api/team/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ token })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not accept this invitation.");
    status.textContent = `${data.message} Redirecting to the dashboard…`;
    window.setTimeout(() => {
      window.location.href = "/index.html";
    }, 1200);
  } catch (error) {
    status.textContent = error.message;
    const login = document.createElement("a");
    login.href = `/login.html?invite=${encodeURIComponent(token)}`;
    login.textContent = "Switch account";
    actions.append(login);
  }
});
