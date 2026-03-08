console.log("index.js loaded ✅");
document.addEventListener("DOMContentLoaded", () => {

// =====================
// BASIC AUTH GUARD
// =====================
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token || role !== "user") {
  localStorage.clear();
  window.location.href = "/login.html";
}

// =====================
// LOGOUT
// =====================
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/login.html";
});

// =====================
// MODAL open/close (index.html modal ids)
// =====================
const modal = document.getElementById("addLeadModal");
const editModal = document.getElementById("editLeadModal");
const lostReasonModal = document.getElementById("lostReasonModal");
const lostReasonSelect = document.getElementById("lostReasonSelect");
const confirmLostBtn = document.getElementById("confirmLostBtn");
const cancelLostBtn = document.getElementById("cancelLostBtn");
const lostReason = document.getElementById("lostReason");
const statusSelect = document.getElementById("editLeadStatus");

// ✅ delete modal
const deleteModal = document.getElementById("deleteModal");
const deleteLeadDetails = document.getElementById("deleteLeadDetails");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let deletingLeadId = null;


document.getElementById("addLeadBtn").addEventListener("click", () => {
  modal.classList.remove("hidden");
});

document.getElementById("closeLeadModal").addEventListener("click", () => {
  modal.classList.add("hidden");
});

document.getElementById("closeEditModal").addEventListener("click", () => {
  editModal.classList.add("hidden");
});
cancelDeleteBtn.addEventListener("click", () => {
  deletingLeadId = null;
  deleteModal.classList.add("hidden");
});
confirmDeleteBtn.addEventListener("click", async () => {
  if (!deletingLeadId) return;

  try {
    const res = await fetch(`/api/leads/${deletingLeadId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast({
        title: "❌ Delete failed",
        message: data?.message || "Could not delete lead",
        duration: 4500
      });
      return;
    }

    deleteModal.classList.add("hidden");
    deletingLeadId = null;

    showToast({
      title: "🗑️ Lead Deleted",
      message: "Lead removed successfully.",
      duration: 3500
    });

    await loadLeads();
  } catch (err) {
    console.error(err);
    showToast({
      title: "❌ Error",
      message: "Server error while deleting lead",
      duration: 4500
    });
  }
});


// =====================
// DOM refs (pipeline counts)
// =====================
const countTotal = document.getElementById("countTotal");
const countNew = document.getElementById("countNew");
const countContacted = document.getElementById("countContacted");
const countInterested = document.getElementById("countInterested");
const countClosed = document.getElementById("countClosed");
const conversionRate = document.getElementById("conversionRate");
// =====================
// STATE
// =====================
let leads = [];
let editingLeadId = null;
let currentUserPlan = null;
let pendingLostUpdate = false;

// =====================
// HELPERS
// =====================
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch (e) {
    return String(dateStr).slice(0, 10);
  }
}

function daysDiff(dateStr) {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  const t = new Date();

  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());

  const diff = Math.round((d0 - t0) / (1000 * 60 * 60 * 24));
  return diff;
}

function statusBadge(status) {
  if (status === "new") return `<span class="badge b-new">New</span>`;
  if (status === "contacted") return `<span class="badge b-contacted">Contacted</span>`;
  if (status === "interested") return `<span class="badge b-interested">Interested</span>`;
  if (status === "closed") return `<span class="badge b-closed">Closed</span>`;
  if (status === "lost") return `<span class="badge b-lost">Lost</span>`;
  return `<span class="badge">Unknown</span>`;
}
function followupRowClass(dateStr) {
  if (!dateStr) return "";

  const diff = daysDiff(dateStr);

  if (diff < 0) return "followup-overdue";
  if (diff === 0) return "followup-today";
  return "followup-upcoming";
}
function showFollowupPopup() {
  const today = new Date();
  const todayKey = "followup_toast_shown_" + today.toDateString();

  // ✅ show only once per day
  if (localStorage.getItem(todayKey)) return;

  // ✅ support all possible follow-up keys
  const getFollowupDate = (l) =>
    l.nextFollowUpAt || l.nextFollowup || l.nextFollowupAt || null;

  const todayCount = leads.filter(l => daysDiff(getFollowupDate(l)) === 0).length;
  const missedCount = leads.filter(l => daysDiff(getFollowupDate(l)) < 0).length;

  if (todayCount === 0 && missedCount === 0) return;

  let msg = "";
  if (todayCount > 0) msg += `✅ ${todayCount} follow-up(s) today\n`;
  if (missedCount > 0) msg += `⚠️ ${missedCount} overdue follow-up(s)\n`;

  // ✅ mark shown
  localStorage.setItem(todayKey, "yes");

  showToast({
    title: "📌 Follow-ups Summary",
    message: msg.trim(),
    duration: 6000
  });
}
function getWhatsAppMessage(lead) {

  const defaultTemplates = {
  new: `Hello {name},

Thank you for contacting our coaching institute.

Would you like details about courses or a demo class?`,

  contacted: `Hello {name},

Just following up on our previous conversation.

Please let me know if you need course details or fee structure.`,

  interested: `Hello {name},

Glad to know you're interested in our classes.

Would you like to book a demo class this week?`,

  closed: `Hello {name},

Thank you for connecting earlier.

If you have any questions in the future, feel free to message anytime.`,
lost: `Hello {name},

We noticed you didn’t join earlier.

We are offering a **FREE demo class this week** for selected students.

Would you like to attend the demo?`
};

const savedTemplates = JSON.parse(localStorage.getItem("whatsappTemplates")) || {};

const templates = {
  new: savedTemplates.new || defaultTemplates.new,
  contacted: savedTemplates.contacted || defaultTemplates.contacted,
  interested: savedTemplates.interested || defaultTemplates.interested,
  closed: savedTemplates.closed || defaultTemplates.closed,
  lost: savedTemplates.lost || defaultTemplates.lost
};

  const template = templates[lead.status] || "Hello {name}";

  return template.replace("{name}", lead.name || "there");
}
window.sendWhatsApp = function sendWhatsApp(id) {

  const lead = leads.find(l => l._id === id);
  if (!lead) return;

  const message = getWhatsAppMessage(lead);

  const phone = (lead.phone || "").replace(/\D/g, "");

  const url =
    "https://wa.me/" +
    phone +
    "?text=" +
    encodeURIComponent(message);

  window.open(url, "_blank");

};

window.showToast = function ({ title = "Notification", message = "", duration = 4500 } = {}) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  toast.innerHTML = `
    <div class="toast-row">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-close">✕</div>
    </div>
    <div class="toast-body">${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  // close btn
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  // auto remove
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, duration);
}
window.sendTodayFollowups = function () {

  const todayLeads = leads.filter(l => {
    const diff = daysDiff(l.nextFollowUpAt);
    return diff <= 0; // today or missed
  });

  if (todayLeads.length === 0) {
    showToast({
      title: "No follow-ups",
      message: "No leads require follow-up right now.",
      duration: 4000
    });
    return;
  }

  let opened = 0;

  todayLeads.forEach((lead, i) => {

    const message = getWhatsAppMessage(lead);
    const phone = (lead.phone || "").replace(/\D/g, "");

    const url =
      "https://wa.me/" +
      phone +
      "?text=" +
      encodeURIComponent(message);

    setTimeout(() => {
      window.open(url, "_blank");
    }, i * 700);

    opened++;
  });

  showToast({
    title: "WhatsApp Follow-ups",
    message: `${opened} chats opened for follow-up.`,
    duration: 5000
  });

};

// =====================
// USER INFO (/api/user/me)
// =====================
async function loadUser() {
  try {
    const res = await fetch("/api/user/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
if (data.user.plan === "pro" && data.user.planExpiresAt) {

  showToast({
    title: "🎉 Free Trial Started",
    message: "Your 14-day Growble Pro trial has started.",
    duration: 6000
  });

}
if (data.user.plan === "pro" && data.user.planExpiresAt) {

  const expiry = new Date(data.user.planExpiresAt);
  const now = new Date();

  const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (diff > 0 && diff <= 14) {
    showToast({
      title: "🎁 Free Trial Active",
      message: `Your Growble Pro trial expires in ${diff} day(s).`,
      duration: 6000
    });
  }

}
// 🔔 PLAN MESSAGES
if (data.planExpired) {
  showToast({
    title: "⚠ Plan Expired",
    message: "Your Growble plan has expired. You are now on Free Plan.",
    duration: 6000
  });
}

if (data.planExpiringSoon) {
  showToast({
    title: "⏳ Plan Expiring Soon",
    message: `Your plan will expire in ${data.planExpiringSoon} day(s).`,
    duration: 6000
  });
}

    const name = data?.user?.name || "User";
    const email = data?.user?.email || "";
    const plan = data?.user?.plan || "free";
    currentUserPlan = plan;

    
// ✅ Handle Upgrade Button Visibility
const upgradeContainer = document.getElementById("upgradeBtnContainer");

if (upgradeContainer) {
  if (plan.toLowerCase() !== "pro") {
    upgradeContainer.innerHTML = `
      <button class="btn btn-outline"
        onclick="window.location.href='/payment.html'">
        Upgrade to pro
      </button>
    `;
  } else {
    upgradeContainer.innerHTML = ""; // hide if pro
  }
}

    document.getElementById("userMini").innerHTML =
      `<b>${escapeHtml(name)}</b> • ${escapeHtml(email)}<br/>Plan: <b style="color:#00d4ff">${escapeHtml(plan)}</b>`;

    // ✅ Lock quick action if NOT pro
    const quickActionsBox = document.getElementById("quickActionsBox");

if (quickActionsBox) {

  if (plan === "pro") {

  quickActionsBox.innerHTML = `
    <button class="btn btn-primary"
      style="width:100%;margin-top:10px"
      onclick="sendTodayFollowups()">
      📲 Send WhatsApp follow-ups
    </button>

    <button class="btn btn-outline"
      style="width:100%;margin-top:10px"
      onclick="alert('automation running soon')">
      ⚡ Run follow-up automation
    </button>

    <button class="btn btn-outline"
      style="width:100%;margin-top:10px"
      onclick="openTemplateEditor()">
      ✏ Edit WhatsApp Templates
    </button>
  `;

} else {

  quickActionsBox.innerHTML = `
    <button class="btn btn-outline"
      style="width:100%;margin-top:10px"
      onclick="window.location.href='/payment.html'">
      Unlock premium follow-up automation (pro)
    </button>
  `;

}

}
  } catch (err) {
    document.getElementById("userMini").innerText = "Unable to load user info.";
  }
}

// =====================
// LOAD LEADS (/api/leads)
// =====================
async function loadLeads() {
  try {
    const res = await fetch("/api/leads", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      leads = [];
      showToast({
  title: "⚠ Error Loading Leads",
  message: data?.message || "Failed to load leads",
  duration: 4500
});
      return;
    }

    // backend returns array directly
    leads = Array.isArray(data) ? data : (data?.leads || []);
console.log("First lead:", leads[0]);
renderUI();
showFollowupPopup(); // ✅ toast after dashboard open
  } catch (err) {
    console.error(err);
    leads = [];
    showToast({
  title: "❌ Server Error",
  message: "Server error while loading leads",
  duration: 4500
});
  }
}

// =====================
// PIPELINE COUNTS
// =====================
function renderPipelineCounts(list) {

  const total = list.length;
  const newCount = list.filter(l => l.status === "new").length;
  const contacted = list.filter(l => l.status === "contacted").length;
  const interested = list.filter(l => l.status === "interested").length;
  const closed = list.filter(l => l.status === "closed").length;
  const lost = list.filter(l => l.status === "lost").length;
  const missed = list.filter(l => daysDiff(l.nextFollowUpAt) < 0).length;


  countTotal.innerText = total;
  countNew.innerText = newCount;
  countContacted.innerText = contacted;
  countInterested.innerText = interested;
  countClosed.innerText = closed;
  const missedBox = document.getElementById("countMissed");
  if (missedBox) missedBox.innerText = missed;
  const countLost = document.getElementById("countLost");
  if (countLost) countLost.innerText = lost;

  let conversion = 0;

  if (total > 0) {
    conversion = Math.round((closed / total) * 100);
  }

  conversionRate.innerText = conversion + "%";
}
function renderLostAnalytics(list){

  const box = document.getElementById("lostAnalyticsBox");
  if(!box) return;

  // show box only when rendering
  box.style.display = "block";

  // wait for plan
  if(currentUserPlan === null){
    box.style.display = "none";
    return;
  }

  // ⏳ Wait until plan is loaded
  if(!currentUserPlan) return;

  // 🔒 Free plan lock
  if(currentUserPlan !== "pro"){
    box.innerHTML = `
      <div style="
        padding:15px;
        border-radius:12px;
        background:rgba(0,0,0,0.35);
        border:1px solid rgba(255,255,255,0.08);
        text-align:center;
      ">
        <div style="font-size:24px;margin-bottom:6px;">🔒</div>
        <div style="font-weight:700;margin-bottom:6px;">
          Lost Lead Analytics
        </div>
        <div style="font-size:12px;opacity:0.75;margin-bottom:10px;">
          Available in Growble Pro
        </div>
        <button class="btn btn-primary"
          onclick="window.location.href='/payment.html'">
          Upgrade to Pro
        </button>
      </div>
    `;
    return;
  }

  // 🔒 LOCK FOR FREE USERS
  if(currentUserPlan !== "pro"){
    box.innerHTML = `
      <div style="
        padding:15px;
        border-radius:12px;
        background:rgba(0,0,0,0.35);
        border:1px solid rgba(255,255,255,0.08);
        text-align:center;
      ">
        <div style="font-size:24px;margin-bottom:6px;">🔒</div>
        <div style="font-weight:700;margin-bottom:6px;">
          Lost Lead Analytics
        </div>
        <div style="font-size:12px;opacity:0.75;margin-bottom:10px;">
          Available in Growble Pro
        </div>
        <button class="btn btn-primary"
          onclick="window.location.href='/payment.html'">
          Upgrade to Pro
        </button>
      </div>
    `;
    return;
  }
  const reasons = {
    expensive:0,
    competitor:0,
    not_interested:0,
    no_response:0
  };

  list.forEach(l=>{
    if(l.status === "lost" && l.lostReason){
      if(reasons[l.lostReason] !== undefined){
        reasons[l.lostReason]++;
      }
    }
  });

  const totalLost =
    reasons.expensive +
    reasons.competitor +
    reasons.not_interested +
    reasons.no_response;

  if(totalLost === 0){
    box.innerHTML = `<span class="small">No lost lead data yet.</span>`;
    return;
  }

  box.innerHTML = `
    <div>Too Expensive: <b>${reasons.expensive}</b></div>
    <div>Joined Competitor: <b>${reasons.competitor}</b></div>
    <div>Not Interested: <b>${reasons.not_interested}</b></div>
    <div>No Response: <b>${reasons.no_response}</b></div>
  `;
}

// =====================
// FOLLOW-UP CALENDAR
// =====================
function renderCalendar(list) {
  const todayBox = document.getElementById("todayBox");
  const weekBox = document.getElementById("weekBox");
  todayBox.innerHTML = "";
  weekBox.innerHTML = "";

  const todayLeads = list.filter(l => daysDiff(l.nextFollowUpAt) === 0);
  const weekLeads = list.filter(l => {
    const diff = daysDiff(l.nextFollowUpAt);
    return diff >= 1 && diff <= 7;
  });

  if (todayLeads.length === 0) {
    todayBox.innerHTML = `<div class="small">No follow-ups due today.</div>`;
  } else {
    todayLeads.forEach(l => {
      todayBox.innerHTML += `
        <div class="cal-task">
          <b>${escapeHtml(l.name)}</b><br/>
          <span class="small">${formatDate(l.nextFollowUpAt)} • ${escapeHtml(l.note || "")}</span>
        </div>
      `;
    });
  }

  if (weekLeads.length === 0) {
    weekBox.innerHTML = `<div class="small">No follow-ups this week.</div>`;
  } else {
    weekLeads.forEach(l => {
      weekBox.innerHTML += `
        <div class="cal-task">
          <b>${escapeHtml(l.name)}</b><br/>
          <span class="small">${formatDate(l.nextFollowUpAt)} • ${escapeHtml(l.note || "")}</span>
        </div>
      `;
    });
  }
}

// =====================
// RENDER UI
// =====================
function renderUI() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const follow = document.getElementById("followupFilter").value;

  let filtered = leads.filter(l =>
    (l.name || "").toLowerCase().includes(search) ||
    (l.phone || "").toLowerCase().includes(search)
  );

  if (status !== "all") {
    filtered = filtered.filter(l => l.status === status);
  }

  if (follow !== "all") {
    filtered = filtered.filter(l => {
      const diff = daysDiff(l.nextFollowUpAt);
      if (follow === "today") return diff === 0;
      if (follow === "week") return diff >= 0 && diff <= 7;
      if (follow === "missed") return diff < 0;
      return true;
    });
  }
// ✅ Sort leads
filtered.sort((a, b) => {

  // 1️⃣ Lost leads always go to bottom
  if (a.status === "lost" && b.status !== "lost") return 1;
  if (a.status !== "lost" && b.status === "lost") return -1;

  // 2️⃣ Otherwise sort by follow-up date
  const da = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
  const db = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;

  return da - db;
});

  renderPipelineCounts(filtered);
  renderLostAnalytics(leads);

  // table
  const tbody = document.getElementById("leadsBody");
  tbody.innerHTML = "";

  filtered.forEach(l => {
    const diff = daysDiff(l.nextFollowUpAt);

    const followText =
      l.nextFollowUpAt
        ? (diff === 0 ? "Today" : (diff < 0 ? `${Math.abs(diff)} days missed` : `In ${diff} days`))
        : "-";

    const tr = document.createElement("tr");
tr.className = followupRowClass(l.nextFollowUpAt);


    tr.innerHTML = `
  <td>
    <b>${escapeHtml(l.name)}</b><br/>
    <span class="small">📞 ${escapeHtml(l.phone || "")}</span><br/>
    ${
      l.lastContactedAt
        ? `<span class="small" style="opacity:0.6">
             🕒 Last contacted: ${formatDate(l.lastContactedAt)}
           </span><br/>`
        : ""
    }
    <span class="small">
      ${escapeHtml(
        l.notes
          ? (l.notes.length > 40
              ? l.notes.substring(0, 40) + "..."
              : l.notes)
          : ""
      )}
    </span>
  </td>
  <td>${statusBadge(l.status)}</td>
  <td>
    <b>${formatDate(l.nextFollowUpAt)}</b><br/>
    <span class="small">${followText}</span>
  </td>
  <td style="display:flex; gap:8px; flex-wrap:wrap;">

  <button class="btn btn-outline"
    onclick="openEditLead('${l._id}')">
    Edit
  </button>

  ${
currentUserPlan === "pro"
? `
<button class="btn btn-primary"
  onclick="sendWhatsApp('${l._id}')">
  WhatsApp
</button>
`
: `
<button class="btn btn-outline"
  onclick="showToast({
    title:'🔒 Pro Feature',
    message:'WhatsApp messaging is available in Growble Pro.',
    duration:4000
  })">
  WhatsApp 🔒
</button>
`
}

  <button class="btn btn-danger"
    onclick="deleteLead('${l._id}')">
    Delete
  </button>

</td>
`;

    tbody.appendChild(tr);
  });

  // calendar uses ALL leads
  renderCalendar(leads);
}

// =====================
// FILTER EVENTS
// =====================
document.getElementById("searchInput").addEventListener("input", renderUI);
document.getElementById("statusFilter").addEventListener("change", renderUI);
document.getElementById("followupFilter").addEventListener("change", renderUI);

// =====================
// ADD LEAD (POST /api/leads)
// =====================
document.getElementById("addLeadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById("leadName").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    notes: document.getElementById("leadNote").value.trim(),
    status: document.getElementById("leadStatus").value,
    nextFollowUpAt: document.getElementById("followupDate").value || null,
    lostReason: lostReasonSelect.value || null,
  };

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
  showToast({
    title: "❌ Cannot Add Lead",
    message: data?.message || "Failed to add lead",
    duration: 4500
  });
  return;
}

    showToast({
  title: "✅ Lead Added",
  message: "New lead saved successfully.",
  duration: 3500
});

modal.classList.add("hidden");
document.getElementById("addLeadForm").reset();

await loadLeads();

  } catch (err) {
    console.error(err);
    showToast({
  title: "❌ Server Error",
  message: "Something went wrong on server",
  duration: 4500
});
  }
});

// =====================
// EDIT LEAD (open modal)
// =====================
window.openEditLead = function openEditLead(id) {
  const lead = leads.find(x => x._id === id);
  if (!lead) {
  showToast({
    title: "⚠ Error",
    message: "Lead not found",
    duration: 4000
  });
  return;
}

  editingLeadId = id;

  document.getElementById("editLeadName").value = lead.name || "";
  document.getElementById("editLeadPhone").value = lead.phone || "";
  document.getElementById("editLeadNote").value = lead.notes || "";
  document.getElementById("editLeadStatus").value = lead.status || "new";

  document.getElementById("editFollowupDate").value =
    lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "";

  editModal.classList.remove("hidden");
// Render activity log (PRO only)
const logBox = document.getElementById("activityLogBox");
const activitySection = document.getElementById("activitySection");

if (currentUserPlan !== "pro") {

  activitySection.style.display = "block";

  logBox.innerHTML = `
    <div style="
      padding:15px;
      border-radius:12px;
      background:rgba(0,0,0,0.25);
      border:1px solid rgba(255,255,255,0.08);
      text-align:center;
    ">
      <div style="font-size:22px;margin-bottom:8px;">🔒</div>
      <div style="font-weight:600;margin-bottom:6px;">
        Activity Log is available in Pro Plan
      </div>
      <div style="font-size:12px;opacity:0.7;margin-bottom:12px;">
        Track every status change, follow-up update and automation history.
      </div>
      <button 
        class="btn btn-primary"
        onclick="window.location.href='/payment.html'">
        Upgrade to Pro
      </button>
    </div>
  `;

} else {

  activitySection.style.display = "block";
  logBox.innerHTML = "";

  if (lead.activityLog && lead.activityLog.length > 0) {
    lead.activityLog.slice().reverse().forEach(item => {
      logBox.innerHTML += `
        <div style="
          font-size:12px;
          margin-bottom:8px;
          padding:8px;
          border-radius:8px;
          background:rgba(255,255,255,0.05);
        ">
          ${item.action}<br/>
          <span style="opacity:0.6">${formatDate(item.date)}</span>
        </div>
      `;
    });
  } else {
    logBox.innerHTML = "<span class='small'>No activity yet.</span>";
  }
}
};

// =====================
// EDIT LEAD (submit PUT)
// =====================
document.getElementById("editLeadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
const status = document.getElementById("editLeadStatus").value;

if(status === "lost" && !pendingLostUpdate){
  lostReasonModal.classList.remove("hidden");
  return;
}
  if (!editingLeadId) return;

  const payload = {
    name: document.getElementById("editLeadName").value.trim(),
    phone: document.getElementById("editLeadPhone").value.trim(),
    notes: document.getElementById("editLeadNote").value.trim(),
    status: document.getElementById("editLeadStatus").value,
    nextFollowUpAt: document.getElementById("editFollowupDate").value || null,
    lostReason: lostReasonSelect.value || null
  };

  try {
    const res = await fetch(`/api/leads/${editingLeadId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
  showToast({
    title: "❌ Update Failed",
    message: data?.message || "Failed to update lead",
    duration: 4500
  });
  return;
}

    editModal.classList.add("hidden");
editingLeadId = null;

showToast({
  title: "✏️ Lead Updated",
  message: "Changes saved successfully.",
  duration: 3500
});

await loadLeads();

  } catch (err) {
    console.error(err);
    showToast({
  title: "❌ Server Error",
  message: "Server error updating lead",
  duration: 4500
});
  }
});

// =====================
// DELETE LEAD
// =====================
window.deleteLead = function deleteLead(id) {
  const lead = leads.find(x => x._id === id);
  if (!lead) return;

  deletingLeadId = id;

  deleteLeadDetails.innerHTML = `
    <div style="font-weight:900;color:#00d4ff;margin-bottom:6px;">${lead.name || "Unnamed Lead"}</div>
    <div style="font-size:13px;opacity:0.85;">📞 ${lead.phone || "-"}</div>
    <div style="font-size:12px;opacity:0.7;margin-top:6px;">Status: ${lead.status || "-"}</div>
  `;

  deleteModal.classList.remove("hidden");
};
window.openTemplateEditor = function () {

  if (currentUserPlan !== "pro") {

    showToast({
      title: "🔒 Pro Feature",
      message: "WhatsApp templates are available in Growble Pro.",
      duration: 4000
    });

    return;
  }

  const templates = JSON.parse(localStorage.getItem("whatsappTemplates")) || {};

  document.getElementById("tplNew").value = templates.new || "";
  document.getElementById("tplContacted").value = templates.contacted || "";
  document.getElementById("tplInterested").value = templates.interested || "";
  document.getElementById("tplClosed").value = templates.closed || "";

  document.getElementById("templateModal").classList.remove("hidden");

};
window.saveTemplates = function () {

  const templates = {
    new: document.getElementById("tplNew").value.trim(),
    contacted: document.getElementById("tplContacted").value.trim(),
    interested: document.getElementById("tplInterested").value.trim(),
    closed: document.getElementById("tplClosed").value.trim()
  };

  localStorage.setItem("whatsappTemplates", JSON.stringify(templates));

  document.getElementById("templateModal").classList.add("hidden");

  showToast({
    title: "Templates Saved",
    message: "WhatsApp templates updated successfully.",
    duration: 4000
  });

};
window.closeTemplateModal = function () {
  document.getElementById("templateModal").classList.add("hidden");
};
confirmLostBtn.addEventListener("click", () => {

  const reason = lostReasonSelect.value;

  if(!reason){
    showToast({
      title:"Reason Required",
      message:"Please select why the lead was lost.",
      duration:4000
    });
    return;
  }

  pendingLostUpdate = true;

  lostReasonModal.classList.add("hidden");

  document.getElementById("editLeadForm").dispatchEvent(
    new Event("submit")
  );

});
cancelLostBtn.addEventListener("click", () => {

  pendingLostUpdate = false;
  lostReasonModal.classList.add("hidden");

});

// =====================
// INIT
// =====================
(async function init() {
  await loadUser();
  await loadLeads();
})();
});