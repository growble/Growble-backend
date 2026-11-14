document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("salesAssistantPanel");
  const toggle = document.getElementById("salesAssistantToggle");
  const closeButton = document.getElementById("salesAssistantClose");
  const heroButton = document.getElementById("salesAssistantHero");
  const chat = document.getElementById("salesAssistantMessages");
  const status = document.getElementById("salesAssistantStatus");
  const form = document.getElementById("salesAssistantForm");
  const questionInput = document.getElementById("salesAssistantQuestion");
  const sendButton = document.getElementById("salesAssistantSend");
  const messages = [];
  let requestPending = false;
  let statusLoaded = false;

  function appendMessage(role, content) {
    const bubble = document.createElement("div");
    bubble.className = `sales-assistant-message ${role}`;
    bubble.textContent = content;
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }

  function updateStatus(data) {
    if (!Number.isInteger(data.questionsRemaining)) return;
    const limit = Number.isInteger(data.dailyLimit) ? data.dailyLimit : 5;
    status.textContent =
      `${data.questionsRemaining} of ${limit} visitor questions remaining today. Resets at midnight UTC.`;
  }

  async function loadStatus() {
    if (statusLoaded) return;
    statusLoaded = true;
    try {
      const response = await fetch("/api/public-assistant/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Daily chat availability could not be loaded.");
      }
      updateStatus(data);
    } catch (error) {
      console.error("Public assistant status failed:", error);
    }
  }

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "Close Growble AI" : "Ask Growble AI";
    if (isOpen) {
      loadStatus();
      questionInput.focus();
    }
  }

  appendMessage(
    "assistant",
    "Hi! Tell me a little about what your business needs, and I can explain how Growble works or suggest a plan. No sign-up is needed to ask."
  );

  toggle.addEventListener("click", () => {
    setOpen(panel.hidden);
  });
  closeButton.addEventListener("click", () => setOpen(false));
  heroButton.addEventListener("click", () => setOpen(true));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = questionInput.value.trim();
    if (!content || requestPending) return;

    messages.push({ role: "user", content });
    appendMessage("visitor", content);
    questionInput.value = "";
    requestPending = true;
    sendButton.disabled = true;
    sendButton.textContent = "…";

    try {
      const response = await fetch("/api/public-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.slice(-8) })
      });
      const data = await response.json().catch(() => ({}));
      updateStatus(data);
      if (!response.ok) {
        throw new Error(data.message || "Could not answer your question.");
      }
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The assistant returned an empty answer. Please try again.");
      }

      messages.push({ role: "assistant", content: data.reply });
      appendMessage("assistant", data.reply);
    } catch (error) {
      console.error("Public assistant request failed:", error);
      appendMessage(
        "assistant",
        error.message || "The assistant is unavailable. Please try again or contact support@growble.app."
      );
    } finally {
      requestPending = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      questionInput.focus();
    }
  });
});
