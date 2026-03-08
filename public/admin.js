document.addEventListener("DOMContentLoaded", () => {

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
  return;
}

// logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

let currentPage = 1;
let currentSearch = "";
let planChart, leadChart, growthChart;

// ====================
// LOAD STATS
// ====================
async function loadStats(){
  try {
    const res = await fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.href = "/login.html";
      }
      return;
    }

    // ===== BASIC STATS =====
    document.getElementById("totalUsers").innerText =
      data.users?.total || 0;

    document.getElementById("activeUsers").innerText =
      data.users?.activeLast7Days || 0;

    document.getElementById("totalLeads").innerText =
      data.leads?.total || 0;

    document.getElementById("totalAutomations").innerText =
      data.automations?.total || 0;

    // ===== BUILD CHARTS =====
    buildPlanChart(data.plans || []);
    buildLeadChart(data.leads?.byStatus || []);
    buildGrowthChart(data.recentUsers || []);

  } catch (err) {
    console.error("Stats fetch failed:", err);
  }
}

// ====================
// LOAD USERS
// ====================
async function loadUsers(page=1){
  currentPage = page;

  const res = await fetch(
    `/api/admin/users?page=${page}&limit=10&search=${currentSearch}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  if(!res.ok) return alert("Failed to load users");

  renderUsers(data.users);
  renderPagination(data.pagination);
}

function renderUsers(users){
  const tbody = document.getElementById("usersBody");
  tbody.innerHTML = "";

  users.forEach(u=>{
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.plan}</td>
      <td>
        <span class="badge ${u.isActive ? 'active' : 'suspended'}">
          ${u.isActive ? "Active" : "Suspended"}
        </span>
      </td>
      <td>
        <button onclick="toggleUser('${u._id}', ${u.isActive})">
          ${u.isActive ? "Suspend" : "Activate"}
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function renderPagination(pagination){
  const div = document.getElementById("pagination");
  div.innerHTML = "";

  for(let i=1;i<=pagination.pages;i++){
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.onclick = ()=> loadUsers(i);
    div.appendChild(btn);
  }
}

// ====================
// TOGGLE USER
// ====================
window.toggleUser = async function(id,isActive){
  const res = await fetch(`/api/admin/users/${id}/suspend`,{
    method:"PATCH",
    headers:{
      "Content-Type":"application/json",
      Authorization:`Bearer ${token}`
    },
    body:JSON.stringify({ isActive: !isActive })
  });

  const data = await res.json();
  if(!res.ok) return alert(data.message);

  loadUsers(currentPage);
loadStats();
};

// ====================
// SEARCH
// ====================
document.getElementById("searchInput")
.addEventListener("input",(e)=>{
  currentSearch = e.target.value;
  loadUsers(1);
});
function buildPlanChart(plans) {

  const labels = plans.map(p => p._id);
  const values = plans.map(p => p.count);

  const ctx = document.getElementById("planChart");

  if (planChart) planChart.destroy();

  planChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ["#00d4ff","#1f9d55","#ff9800","#a855f7"]
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Users by Plan"
        }
      }
    }
  });
}

function buildLeadChart(statusData) {

  const labels = statusData.map(s => s._id);
  const values = statusData.map(s => s.count);

  const ctx = document.getElementById("leadChart");

  if (leadChart) leadChart.destroy();

  leadChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Leads",
        data: values,
        backgroundColor: "#00d4ff"
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Leads by Status"
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function buildLeadChart(statusData) {

  const labels = statusData.map(s => s._id);
  const values = statusData.map(s => s.count);

  const ctx = document.getElementById("leadChart");

  if (leadChart) leadChart.destroy();

  leadChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Leads",
        data: values,
        backgroundColor: "#00d4ff"
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Leads by Status"
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// INIT
loadStats();
loadUsers();

});
