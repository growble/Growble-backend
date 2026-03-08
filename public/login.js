document.getElementById("loginBtn").addEventListener("click", async () => {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");

  const email = emailEl.value.trim();
  const password = passEl.value;

  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toastTitle");
  const toastMsg = document.getElementById("toastMsg");
  const toastOkBtn = document.getElementById("toastOkBtn");
  const toastIcon = document.getElementById("toastIcon");

  let redirectTimer = null;

  function setLoading(isLoading) {
    if (isLoading) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span class="spinner"></span>
          Logging in...
        </span>
      `;
    } else {
      loginBtn.disabled = false;
      loginBtn.innerHTML = "Login";
    }
  }

  function showToast({ type = "success", title = "", msg = "", redirectUrl = null }) {
    // clear previous timer
    if (redirectTimer) clearTimeout(redirectTimer);

    // reset classes
    toast.classList.remove("hidden", "toast-success", "toast-error", "toast-shake");
    toastOkBtn.textContent = redirectUrl ? "Continue →" : "OK";

    if (type === "success") {
      toast.classList.add("toast-success");
      toastIcon.textContent = "✅";
    } else if (type === "error") {
      toast.classList.add("toast-error", "toast-shake");
      toastIcon.textContent = "❌";
    }

    toastTitle.textContent = title;
    toastMsg.textContent = msg;

    toast.classList.remove("hidden");

    toastOkBtn.onclick = () => {
      toast.classList.add("hidden");
      if (redirectUrl) window.location.href = redirectUrl;
    };

    // auto redirect only for success login
    if (redirectUrl) {
      redirectTimer = setTimeout(() => {
        toast.classList.add("hidden");
        window.location.href = redirectUrl;
      }, 1600);
    }
  }

  if (!email || !password) {
    showToast({
      type: "error",
      title: "Missing Details",
      msg: "Email and password are required."
    });
    return;
  }

  try {
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast({
        type: "error",
        title: "Login Failed",
        msg: data.message || "Invalid email or password."
      });
      return;
    }
localStorage.clear();

localStorage.setItem("token", data.token);
localStorage.setItem("role", data.user.role);

// 🔥 Redirect based on role
if (data.user.role === "admin") {
  showToast({
    type: "success",
    title: "Admin Login Successful 🚀",
    msg: "Welcome to Admin Dashboard!",
    redirectUrl: "/admin.html"
  });
} else {
  showToast({
    type: "success",
    title: "Login Successful 🎉",
    msg: "Welcome back to Growble!",
    redirectUrl: "/index.html"
  });
}

  } catch (err) {
    console.error(err);
    showToast({
      type: "error",
      title: "Server Error",
      msg: "Something went wrong. Please try again."
    });
  } finally {
    setLoading(false);
  }
});
// Show / Hide Password
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.textContent = isPassword ? "Hide" : "Show";
  });
}