document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token || localStorage.getItem("role") !== "user") {
    localStorage.clear();
    window.location.href = "/login.html";
    return;
  }

  const status = document.getElementById("historyStatus");
  const body = document.getElementById("historyBody");
  const planLabel = document.getElementById("currentPlan");
  const expiryLabel = document.getElementById("planExpiry");

  try {
    const response = await fetch("/api/payment/history", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      throw new Error(data.message || "Could not load billing history.");
    }

    planLabel.textContent =
      `Current plan: ${(data.plan || "free").replace(/^\w/, letter => letter.toUpperCase())}`;
    expiryLabel.textContent = data.planExpiresAt
      ? `Access expires ${new Date(data.planExpiresAt).toLocaleDateString()}. Plans are one-time purchases and do not auto-renew.`
      : "No paid plan expiry is currently set.";
    const canBuyTopUps = ["starter", "pro", "agent"].includes(data.plan);
    document.getElementById("topupPurchase").hidden = !canBuyTopUps;
    document.getElementById("topupOffer").hidden = !canBuyTopUps;

    body.replaceChildren();
    if (!data.transactions?.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.className = "empty";
      cell.textContent = "No recent purchases are recorded. Older payments may not be listed.";
    } else {
      data.transactions.forEach(transaction => {
        const row = body.insertRow();
        const dateCell = row.insertCell();
        dateCell.textContent = transaction.processedAt
          ? new Date(transaction.processedAt).toLocaleString()
          : "—";
        const purchaseCell = row.insertCell();
        purchaseCell.textContent = transaction.type === "ai_reply_pack"
          ? `${transaction.aiReplies} AI reply credits`
          : `${transaction.plan || "Paid"} plan · 30 days`;
        const amountCell = row.insertCell();
        amountCell.textContent = `₹${Number(transaction.amount).toLocaleString("en-IN")}`;
      });
    }

    status.textContent = "Showing up to 20 recent purchases.";
  } catch (error) {
    console.error("Billing history load failed:", error);
    status.textContent = error.message || "Could not load billing history.";
    status.style.color = "#ffbaba";
    body.replaceChildren();
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.className = "empty";
    cell.textContent = "Billing history could not be loaded.";
  }
});
