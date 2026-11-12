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
      headers: { ["Authorization"]: "Bearer " + token }
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
let cachedTemplates = null;

async function fetchTemplates() {
  if (cachedTemplates) return cachedTemplates;

  try {
    const res = await fetch("/api/templates", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    cachedTemplates = await res.json();
    return cachedTemplates;

  } catch (err) {
    console.error("Template fetch error:", err);
    return {};
  }
}

function replaceVariables(template, lead) {
  return template
    .replace(/{name}/g, lead.name || "there")
    .replace(/{phone}/g, lead.phone || "");
}

async function getWhatsAppMessage(lead) {

  const defaultTemplates = {
    new: `Hello {name},\n\nThanks for reaching out to us.

How can we help with your inquiry?`,
    contacted: `Hello {name},\n\nJust following up on our previous conversation.

Let me know if you have any questions or would like to discuss next steps.`,
    interested: `Hello {name},\n\nWe're glad you're interested in what we offer.

What would be most helpful as a next step?`,
    closed: `Hello {name},\n\nFeel free to contact anytime.`,
    lost: `Hello {name},\n\nWe understand the timing may not be right.

If your plans change or you'd like to revisit this, we're happy to help.`
  };

  const savedTemplates = await fetchTemplates();

  let template =
    savedTemplates[lead.status] ||
    defaultTemplates[lead.status] ||
    "Hello {name}";

  // 🔥 auto greeting if missing
  if (!template.toLowerCase().includes("{name}")) {
    template = `Hi {name},\n\n` + template;
  }

  return replaceVariables(template, lead);
}
window.sendWhatsApp = async function sendWhatsApp(id) {

  // Prevent accidental duplicate WhatsApp openings
  if (window.__whatsappOpening) return;
  window.__whatsappOpening = true;

  try {

    const lead = leads.find(l => l._id === id);
    if (!lead) return;

    const message = await getWhatsAppMessage(lead);

    const phone = (lead.phone || "").replace(/\D/g, "");

    if (!phone) {
      showToast({
        title: "⚠ Invalid Phone",
        message: "This lead does not have a valid phone number.",
        duration: 4000
      });
      return;
    }

    const url =
      "https://wa.me/" +
      phone +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank");

  } finally {

    // Allow another WhatsApp click after a short delay
    setTimeout(() => {
      window.__whatsappOpening = false;
    }, 1000);

  }
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
window.sendTodayFollowups = async function () {

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

  const button = document.querySelector(
    '#quickActionsBox button[onclick="sendTodayFollowups()"]'
  );

  if (button) {
    button.disabled = true;
    button.innerHTML = "📲 Sending...";
  }

  try {

    const res = await fetch("/api/leads/send-followups", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Failed to send follow-ups");
    }
    await loadLeads();
    showToast({
      title: "✅ WhatsApp Follow-ups",
      message: data.message || "Follow-ups sent successfully.",
      duration: 6000
    });

  } catch (err) {

    console.error("Bulk WhatsApp follow-up error:", err);

    showToast({
      title: "❌ WhatsApp Error",
      message: err.message || "Failed to send WhatsApp follow-ups.",
      duration: 6000
    });

  } finally {

    if (button) {
      button.disabled = false;
      button.innerHTML = "📲 Send WhatsApp follow-ups";
    }

  }

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
const usage =
data.usage || {};

console.log(
"Usage:",
usage
);
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
    const workspace = data?.workspace || {};
    const teamBtn = document.getElementById("teamBtn");
    if (teamBtn) {
      teamBtn.hidden = !workspace.isOwner && !data.user.workspaceOwner;
    }
const businessName =
data?.user?.businessName || "";

const businessType =
data?.user?.businessType || "";

const offer =
data?.user?.offer || "";

const tone =
data?.user?.tone || "";

const knowledgeBase =
data?.user?.knowledgeBase || "";
    currentUserPlan = plan;
const aiBox =
document.getElementById(
"aiBusinessContent"
);

if(aiBox){

aiBox.innerHTML =

`
<div>

Business:
<b>
${escapeHtml(businessName)}
</b>

</div>

<div>

Industry:
${escapeHtml(businessType)}

</div>

<div>

Offer:
${escapeHtml(offer)}

</div>

<div>

Tone:
${escapeHtml(tone)}

</div>

<div>

Knowledge:
${
knowledgeBase
? "AI trained ✅"
: "Not trained ❌"
}

</div>
`;

}

    
// ✅ Handle Upgrade Button Visibility
const upgradeContainer = document.getElementById("upgradeBtnContainer");

if (upgradeContainer) {
  if (
  plan.toLowerCase() !== "pro" &&
  plan.toLowerCase() !== "agent"
) {
    upgradeContainer.innerHTML = `
      <button class="btn btn-outline"
        onclick="window.location.href='/pricing.html'">
        View plans
      </button>
    `;
  } else {
    upgradeContainer.innerHTML = ""; // hide if pro
  }
}

    document.getElementById("userMini").innerHTML = `
<b>${escapeHtml(name)}</b> • ${escapeHtml(email)}
<br>
Plan: <b style="color:#00d4ff">${escapeHtml(plan)}</b>
${workspace.isOwner ? `<br>Workspace seats: ${workspace.memberCount}/${Number.isFinite(workspace.seatLimit) ? workspace.seatLimit : "Unlimited"}` : `<br>Workspace owner: ${escapeHtml(workspace.ownerName || "")}`}

<br>

${data.user.planExpiresAt
  ? `Expires: <b>${escapeHtml(formatDate(data.user.planExpiresAt))}</b><br>`
  : ""}

🤖 AI Replies:
${usage.aiRepliesUsed || 0}/${usage.aiRepliesLimit || 0}

<br>

${usage.aiQualificationLimit ? `🎯 AI Qualification:
${usage.aiQualificationUsed || 0}/${usage.aiQualificationLimit}<br>` : ""}

<br>

📲 Follow-ups:
${usage.followUpsUsed || 0}/${usage.followUpsLimit || 0}
`;

    // Keep quick actions aligned with each plan's feature access.
    const quickActionsBox = document.getElementById("quickActionsBox");

if (quickActionsBox) {
  const canUseAiReplies = ["starter", "pro", "agent"].includes(plan);
  const canSendFollowups = ["starter", "pro", "agent"].includes(plan);
  const actions = [];

  if (canSendFollowups) {
    actions.push(`
      <button type="button" class="btn btn-primary"
        style="width:100%;margin-top:10px"
        onclick="event.stopPropagation(); sendTodayFollowups()">
        📲 Send WhatsApp follow-ups
      </button>
      <button class="btn btn-outline"
        style="width:100%;margin-top:10px"
        onclick="openTemplateEditor()">
        ✏ Edit WhatsApp Templates
      </button>
    `);
  }

  if (canUseAiReplies) {
    actions.push(`
      <button class="btn btn-primary"
        style="width:100%;margin-top:10px"
        onclick="openAIGenerator()">
        🤖 Generate WhatsApp Message
      </button>
    `);
  }

  if (!canSendFollowups) {
    actions.push(`
      <button class="btn btn-outline"
        style="width:100%;margin-top:10px"
        onclick="window.location.href='/pricing.html'">
        Unlock paid-plan follow-up automation
      </button>
    `);
  }

  quickActionsBox.innerHTML = actions.join("");

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
  if (
  currentUserPlan !== "pro" &&
  currentUserPlan !== "agent"
){
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
  if (
  currentUserPlan !== "pro" &&
  currentUserPlan !== "agent"
) {
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
${["pro", "agent"].includes(currentUserPlan) ? `
<div style="margin-top:6px;font-size:12px;">
  🧠 ${escapeHtml(l.aiLeadTemperature || "cold")} • 🎯 ${l.aiScore || 0}/100
  <br>${escapeHtml(l.aiNextAction || "")}
</div>
` : ""}
    </span>
  </td>
  <td>${statusBadge(l.status)}</td>
  <td>
    <b>${formatDate(l.nextFollowUpAt)}</b><br/>
    <span class="small">${followText}</span>
  </td>
  <td>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">

    <button class="btn btn-outline"
      onclick="openEditLead('${l._id}')">
      Edit
    </button>

    ${
      ["starter", "pro", "agent"].includes(currentUserPlan)
      ? `
      <button type="button" class="btn btn-primary"
  onclick="event.stopPropagation(); sendWhatsApp('${l._id}')">
  WhatsApp
</button>
      `
      : `
      <button class="btn btn-outline"
        onclick="showToast({
          title:'🔒 Starter Feature',
          message:'WhatsApp messaging is available on paid plans.',
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

  </div>
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
window.openEditLead = async function openEditLead(id) {
  const cachedLeadIndex = leads.findIndex(x => x._id === id);
  if (cachedLeadIndex === -1) {
  showToast({
    title: "⚠ Error",
    message: "Lead not found",
    duration: 4000
  });
  return;
}

  let lead = leads[cachedLeadIndex];
  try {
    const requestHeaders = { "Content-Type": "application/json" };
    requestHeaders["Author" + "ization"] = "Be" + "arer " + token;
    const res = await fetch(`/api/leads/${id}`, {
      headers: requestHeaders
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Could not load this lead.");
    }

    lead = data;
    leads[cachedLeadIndex] = lead;
  } catch (error) {
    console.error("Load lead conversation error:", error);
    showToast({
      title: "❌ Could not load messages",
      message: error.message || "Please try again.",
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
const conversationBox = document.getElementById("conversationBox");
conversationBox.innerHTML = "";

if (lead.conversation && lead.conversation.length > 0) {
  lead.conversation.slice(-100).forEach(item => {
    const isCustomer = item.role === "user";
    const timestamp = item.createdAt
      ? new Date(item.createdAt).toLocaleString()
      : "";

    conversationBox.innerHTML += `
      <div style="
        margin-bottom:10px;
        padding:10px 12px;
        border-radius:12px;
        background:${isCustomer ? "rgba(255,255,255,0.07)" : "rgba(0,212,255,0.10)"};
        border:1px solid ${isCustomer ? "rgba(255,255,255,0.10)" : "rgba(0,212,255,0.18)"};
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      ">
        <div style="font-size:11px;font-weight:700;margin-bottom:5px;color:${isCustomer ? "#dce8f5" : "#00d4ff"}">
          ${isCustomer ? "Customer" : "Growble"}
          <span style="float:right;opacity:0.65;font-weight:400">${escapeHtml(timestamp)}</span>
        </div>
        <div>${escapeHtml(item.content)}</div>
      </div>
    `;
  });
} else {
  conversationBox.innerHTML = "<span class='small'>No WhatsApp messages recorded for this lead yet.</span>";
}

const humanTakeoverControls = document.getElementById("humanTakeoverControls");
const humanTakeoverButton = document.getElementById("humanTakeoverButton");
const humanReplyForm = document.getElementById("humanReplyForm");
const humanReplyText = document.getElementById("humanReplyText");
const canUseHumanTakeover =
  currentUserPlan === "pro" || currentUserPlan === "agent";
humanTakeoverControls.style.display = canUseHumanTakeover ? "block" : "none";
humanTakeoverButton.textContent = lead.humanTakeover
  ? "Resume AI replies"
  : "Take over conversation";
humanReplyForm.style.display = lead.humanTakeover ? "block" : "none";
humanTakeoverButton.onclick = async () => {
  try {
    const res = await fetch(`/api/leads/${id}/human-takeover`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ enabled: !lead.humanTakeover })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Could not update human takeover.");
    }
    await window.openEditLead(id);
  } catch (error) {
    showToast({
      title: "❌ Could not update takeover",
      message: error.message,
      duration: 4000
    });
  }
};
document.getElementById("sendHumanReplyButton").onclick = async () => {
  const message = humanReplyText.value.trim();
  if (!message) return;

  try {
    const res = await fetch(`/api/leads/${id}/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Could not send the manual reply.");
    }
    humanReplyText.value = "";
    await window.openEditLead(id);
    showToast({
      title: "✅ Reply sent",
      message: "Your manual WhatsApp reply was sent.",
      duration: 3500
    });
  } catch (error) {
    showToast({
      title: "❌ Reply failed",
      message: error.message,
      duration: 4000
    });
  }
};

// Render activity log (PRO only)
const logBox = document.getElementById("activityLogBox");
const activitySection = document.getElementById("activitySection");

if (
  currentUserPlan !== "pro" &&
  currentUserPlan !== "agent"
) {

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
window.openTemplateEditor = async function () {

  if (!["starter", "pro", "agent"].includes(currentUserPlan)) {
    showToast({
      title: "🔒 Starter Feature",
      message: "WhatsApp templates are available on paid plans.",
      duration: 4000
    });
    return;
  }

  try {
    const res = await fetch("/api/templates", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    const templates = await res.json();

    document.getElementById("tplNew").value = templates.new || "";
    document.getElementById("tplContacted").value = templates.contacted || "";
    document.getElementById("tplInterested").value = templates.interested || "";
    document.getElementById("tplClosed").value = templates.closed || "";

    document.getElementById("templateModal").classList.remove("hidden");

  } catch (err) {
    console.error(err);

    showToast({
      title: "❌ Error",
      message: "Failed to load templates",
      duration: 4000
    });
  }
};
window.saveTemplates = async function () {

  const templates = {
    new: document.getElementById("tplNew").value.trim(),
    contacted: document.getElementById("tplContacted").value.trim(),
    interested: document.getElementById("tplInterested").value.trim(),
    closed: document.getElementById("tplClosed").value.trim()
  };

  try {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ templates })
    });

    if (!res.ok) throw new Error("Failed to save");

    document.getElementById("templateModal").classList.add("hidden");

    showToast({
      title: "Templates Saved",
      message: "Saved 🚀",
      duration: 4000
    });

  } catch (err) {
    console.error(err);

    showToast({
      title: "❌ Error",
      message: "Failed to save templates",
      duration: 4000
    });
  }
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
window.openAIGenerator = function () {
  document.getElementById("aiModal").classList.remove("hidden");
};

window.closeAIModal = function () {
  document.getElementById("aiModal").classList.add("hidden");
};

window.generateAI = async function () {

  const prompt = document.getElementById("aiPrompt").value.trim();

  if (!prompt) {
    showToast({
      title: "⚠ Enter prompt",
      message: "Describe situation first",
      duration: 3000
    });
    return;
  }

  const resultBox = document.getElementById("aiResult");
  const generateButton = document.getElementById("aiGenerateBtn");
  const originalButtonText = generateButton.textContent;
  resultBox.value = "Generating...";
  generateButton.disabled = true;
  generateButton.textContent = "Generating...";

  try {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Could not generate a message.");
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      throw new Error("AI returned an empty message. Please try again.");
    }

    resultBox.value = data.message;

  } catch (err) {
    console.error(err);

    resultBox.value = "";

    showToast({
      title: "❌ AI Error",
      message: err.message || "Could not generate a message. Please try again.",
      duration: 4000
    });
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = originalButtonText;
  }
};

// =====================
// INIT
// =====================
(async function init() {
  await loadUser();
  await loadLeads();
})();
});