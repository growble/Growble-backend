document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token || localStorage.getItem("role") !== "user") {
    window.location.replace("/login.html");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "widget") {
    document.body.classList.add("widget-mode");
    document.getElementById("dashboardLink").hidden = true;
    document.getElementById("fullPageLink").target = "_top";
  } else {
    document.getElementById("fullPageLink").hidden = true;
  }

  const messages = [];
  const chat = document.getElementById("chatMessages");
  const form = document.getElementById("supportForm");
  const questionInput = document.getElementById("supportQuestion");
  const sendButton = document.getElementById("sendQuestion");
  const status = document.getElementById("supportStatus");
  const accountSummary = document.getElementById("accountSummary");
  const billingLink = document.getElementById("billingLink");
  let requestPending = false;
  let questionsRemaining = 10;
  let dailyLimit = 10;

  function appendMessage(role, content) {
    const bubble = document.createElement("div");
    bubble.className = `message ${role}`;
    bubble.textContent = content;
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }

  function updateQuestionStatus(remaining, resetsAt, limit) {
    questionsRemaining = remaining;
    if (Number.isInteger(limit)) {
      dailyLimit = limit;
    }
    const resetText = resetsAt
      ? new Date(resetsAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short"
      })
      : "midnight UTC";
    status.textContent =
      `${questionsRemaining} of ${dailyLimit} support questions remaining today. Resets at ${resetText}.`;
  }

  function addSummaryItem(label, value) {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.textContent = `${label}: ${value}`;
    accountSummary.appendChild(item);
  }

  async function loadSupportStatus() {
    try {
      const response = await fetch("/api/support/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        window.location.replace("/login.html");
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || "Could not load support status.");
      }

      updateQuestionStatus(data.questionsRemaining, data.resetsAt, data.dailyLimit);
      accountSummary.replaceChildren();
      const workspace = data.workspace || {};
      const usage = workspace.usage || {};
      const seats = workspace.seats || {};
      addSummaryItem(
        "Plan",
        `${workspace.plan || "free"}${workspace.planExpiresAt
          ? ` · expires ${new Date(workspace.planExpiresAt).toLocaleDateString()}`
          : ""}`
      );
      addSummaryItem(
        "AI replies",
        `${usage.aiReplies?.used || 0}/${usage.aiReplies?.includedLimit || 0} included · ` +
          `${usage.aiReplies?.purchasedCredits || 0} top-up credits`
      );
      addSummaryItem(
        "AI lead qualifications",
        `${usage.aiLeadQualifications?.used || 0}/${usage.aiLeadQualifications?.includedLimit || 0}`
      );
      addSummaryItem(
        "Follow-ups",
        `${usage.followUps?.used || 0}/${usage.followUps?.includedLimit || 0}`
      );
      addSummaryItem(
        "Team seats",
        `${seats.used || 0}/${seats.includedLimit || 0}`
      );
      addSummaryItem(
        "WhatsApp",
        workspace.whatsappConnected ? "Connected" : "Not connected"
      );
      billingLink.hidden = !workspace.billingHistoryAvailable;
    } catch (error) {
      console.error("Support status load failed:", error);
      status.textContent = error.message || "Could not load support status.";
      status.style.color = "#ffbaba";
      accountSummary.replaceChildren();
      addSummaryItem("Workspace details", "Unavailable");
    }
  }

  appendMessage(
    "assistant",
    "Hi! I can help with Growble plans, usage, billing steps, and setup. I can see a limited, read-only summary of your workspace."
  );
  loadSupportStatus();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const content = questionInput.value.trim();
    if (!content || requestPending) return;

    messages.push({ role: "user", content });
    appendMessage("user", content);
    questionInput.value = "";
    requestPending = true;
    sendButton.disabled = true;
    sendButton.textContent = "…";

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messages: messages.slice(-8) })
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        window.location.replace("/login.html");
        return;
      }
      if (Number.isInteger(data.questionsRemaining)) {
        updateQuestionStatus(data.questionsRemaining, data.resetsAt, data.dailyLimit);
      }
      if (!response.ok) {
        throw new Error(data.message || "Could not get a support answer.");
      }

      messages.push({ role: "assistant", content: data.reply });
      appendMessage("assistant", data.reply);
    } catch (error) {
      console.error("Support chat request failed:", error);
      appendMessage(
        "assistant",
        error.message || "Growble support chat is unavailable. Please try again or email support@growble.app."
      );
    } finally {
      requestPending = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      questionInput.focus();
    }
  });
});
