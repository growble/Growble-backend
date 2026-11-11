document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token || localStorage.getItem("role") !== "admin") {
    localStorage.clear();
    window.location.href = "/login.html";
    return;
  }

  const elements = {
    error: document.getElementById("adminError"),
    totalUsers: document.getElementById("totalUsers"),
    activeUsers: document.getElementById("activeUsers"),
    totalLeads: document.getElementById("totalLeads"),
    connectedUsers: document.getElementById("connectedUsers"),
    aiConfigured: document.getElementById("aiConfigured"),
    aiRepliesUsed: document.getElementById("aiRepliesUsed"),
    followUpsUsed: document.getElementById("followUpsUsed"),
    usersBody: document.getElementById("usersBody"),
    userCount: document.getElementById("userCount"),
    pageLabel: document.getElementById("pageLabel"),
    previousPage: document.getElementById("previousPage"),
    nextPage: document.getElementById("nextPage"),
    search: document.getElementById("searchInput"),
    plan: document.getElementById("planFilter"),
    status: document.getElementById("statusFilter")
  };

  let currentPage = 1;
  let totalPages = 1;
  let searchTimer;
  let planChart;
  let leadChart;
  let usageChart;

  function showError(message) {
    elements.error.textContent = message;
    elements.error.style.display = "block";
  }

  function clearError() {
    elements.error.textContent = "";
    elements.error.style.display = "none";
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + token
      }
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "/login.html";
      throw new Error("Your admin session has expired.");
    }

    if (!response.ok) {
      throw new Error(data.message || "The request could not be completed.");
    }

    return data;
  }

  function makeChart(canvasId, currentChart, config) {
    if (!window.Chart) return currentChart;
    const canvas = document.getElementById(canvasId);
    if (currentChart) currentChart.destroy();
    return new Chart(canvas, config);
  }

  function buildCharts(data) {
    planChart = makeChart("planChart", planChart, {
      type: "doughnut",
      data: {
        labels: data.plans.map(item => item._id || "Unknown"),
        datasets: [{
          data: data.plans.map(item => item.count),
          backgroundColor: ["#64748b", "#00d4ff", "#1f9d55", "#a855f7"]
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: "#dce8f5" } } }
      }
    });

    const leadStatuses = ["new", "contacted", "interested", "closed", "lost"];
    const leadCounts = new Map(
      data.leads.byStatus.map(item => [item._id, item.count])
    );
    leadChart = makeChart("leadChart", leadChart, {
      type: "bar",
      data: {
        labels: leadStatuses,
        datasets: [{
          label: "Leads",
          data: leadStatuses.map(status => leadCounts.get(status) || 0),
          backgroundColor: "#00d4ff",
          borderRadius: 6
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#c5d2df" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#c5d2df", precision: 0 } }
        }
      }
    });

    usageChart = makeChart("usageChart", usageChart, {
      type: "bar",
      data: {
        labels: ["AI replies", "Follow-ups"],
        datasets: [{
          label: "Used this month",
          data: [data.usage.aiReplies, data.usage.followUps],
          backgroundColor: ["#a855f7", "#00d4ff"],
          borderRadius: 6
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#c5d2df" }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: "#c5d2df", precision: 0 } }
        }
      }
    });
  }

  async function loadStats() {
    try {
      const data = await request("/api/admin/stats");
      elements.totalUsers.textContent = data.users.total;
      elements.activeUsers.textContent = data.users.activeLast7Days;
      elements.totalLeads.textContent = data.leads.total;
      elements.connectedUsers.textContent = data.users.whatsappConnected;
      elements.aiConfigured.textContent = data.users.aiConfigured;
      elements.aiRepliesUsed.textContent = data.usage.aiReplies;
      elements.followUpsUsed.textContent = data.usage.followUps;
      buildCharts(data);
    } catch (error) {
      console.error("Admin stats fetch failed:", error);
      showError(error.message || "Could not load dashboard analytics.");
    }
  }

  function appendTextCell(row, value, secondary = []) {
    const cell = document.createElement("td");
    cell.textContent = value || "—";
    const details = Array.isArray(secondary) ? secondary : [secondary];
    details.filter(Boolean).forEach(detail => {
      const note = document.createElement("span");
      note.className = "subtle";
      note.textContent = detail;
      cell.appendChild(note);
    });
    row.appendChild(cell);
    return cell;
  }

  function appendBadgeCell(row, label, className) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + className;
    badge.textContent = label;
    cell.appendChild(badge);
    row.appendChild(cell);
  }

  function appendPlanCell(row, user) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge plan";
    badge.textContent = user.plan || "free";
    cell.appendChild(badge);

    if (user.planExpiresAt) {
      const expiry = document.createElement("span");
      expiry.className = "subtle";
      expiry.textContent = `Expires ${new Date(user.planExpiresAt).toLocaleDateString()}`;
      cell.appendChild(expiry);
    }

    row.appendChild(cell);
  }

  function renderUsers(users) {
    elements.usersBody.replaceChildren();

    if (!users.length) {
      const row = elements.usersBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 8;
      cell.className = "empty-state";
      cell.textContent = "No customer accounts match these filters.";
      return;
    }

    users.forEach(user => {
      const row = document.createElement("tr");
      appendTextCell(row, user.name, [user.businessName, user.email]);
      appendPlanCell(row, user);
      appendTextCell(
        row,
        `${user.usage.aiReplies.used} / ${user.usage.aiReplies.limit}`,
        "AI replies this month"
      );
      appendTextCell(
        row,
        `${user.usage.followUps.used} / ${user.usage.followUps.limit}`,
        "Follow-ups this month"
      );
      appendBadgeCell(
        row,
        user.whatsapp?.connected ? "Connected" : "Not connected",
        user.whatsapp?.connected ? "connected" : "not-connected"
      );
      appendBadgeCell(
        row,
        user.aiSetupCompleted ? "Trained" : "Not trained",
        user.aiSetupCompleted ? "connected" : "not-connected"
      );
      appendBadgeCell(
        row,
        user.isActive ? "Active" : "Suspended",
        user.isActive ? "active" : "suspended"
      );

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn ${user.isActive ? "btn-suspend" : "btn-activate"}`;
      button.textContent = user.isActive ? "Suspend" : "Activate";
      button.dataset.userId = user._id;
      button.dataset.active = String(user.isActive);
      actionCell.appendChild(button);
      row.appendChild(actionCell);
      elements.usersBody.appendChild(row);
    });
  }

  async function loadUsers(page = 1) {
    currentPage = page;
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search: elements.search.value.trim(),
      plan: elements.plan.value,
      status: elements.status.value
    });

    try {
      const data = await request(`/api/admin/users?${params}`);
      renderUsers(data.users);
      totalPages = Math.max(data.pagination.pages, 1);
      elements.userCount.textContent =
        `${data.pagination.total} customer account${data.pagination.total === 1 ? "" : "s"}`;
      elements.pageLabel.textContent =
        `Page ${data.pagination.page} of ${totalPages}`;
      elements.previousPage.disabled = currentPage <= 1;
      elements.nextPage.disabled = currentPage >= totalPages;
    } catch (error) {
      console.error("Admin users fetch failed:", error);
      showError(error.message || "Could not load customer accounts.");
      elements.usersBody.replaceChildren();
      const row = elements.usersBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 8;
      cell.className = "empty-state";
      cell.textContent = "Customer accounts could not be loaded.";
    }
  }

  async function toggleUser(button) {
    const isActive = button.dataset.active === "true";
    const action = isActive ? "suspend" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} this account?`)) {
      return;
    }

    button.disabled = true;
    try {
      await request(`/api/admin/users/${encodeURIComponent(button.dataset.userId)}/suspend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive })
      });
      clearError();
      await Promise.all([loadUsers(currentPage), loadStats()]);
    } catch (error) {
      console.error("Update customer status failed:", error);
      showError(error.message || "Could not update this account.");
      button.disabled = false;
    }
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    clearError();
    loadStats();
    loadUsers(currentPage);
  });

  elements.previousPage.addEventListener("click", () => {
    if (currentPage > 1) loadUsers(currentPage - 1);
  });
  elements.nextPage.addEventListener("click", () => {
    if (currentPage < totalPages) loadUsers(currentPage + 1);
  });
  elements.usersBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-user-id]");
    if (button) toggleUser(button);
  });

  function applyFilters() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      clearError();
      loadUsers(1);
    }, 250);
  }

  elements.search.addEventListener("input", applyFilters);
  elements.plan.addEventListener("change", applyFilters);
  elements.status.addEventListener("change", applyFilters);

  loadStats();
  loadUsers();
});
