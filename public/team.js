document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const membersEl = document.getElementById("members");
  const invitationsEl = document.getElementById("invitations");
  const statusEl = document.getElementById("status");
  const inviteArea = document.getElementById("inviteArea");
  const headers = { Authorization: `Bearer ${token}` };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }

  function renderMembers(members, canManage) {
    membersEl.replaceChildren();
    for (const member of members) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("span");
      label.textContent = `${member.name} · ${member.email}${member.isOwner ? " · Owner" : ""}`;
      row.append(label);
      if (canManage && !member.isOwner) {
        const remove = document.createElement("button");
        remove.className = "danger";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Remove ${member.email} from this workspace?`)) return;
          try {
            await request(`/api/team/members/${encodeURIComponent(member._id)}`, {
              method: "DELETE"
            });
            await load();
          } catch (error) {
            statusEl.textContent = error.message;
          }
        });
        row.append(remove);
      }
      membersEl.append(row);
    }
  }

  function renderInvitations(invitations) {
    invitationsEl.replaceChildren();
    for (const invitation of invitations) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("span");
      label.textContent =
        `${invitation.email} · expires ${new Date(invitation.expiresAt).toLocaleDateString()}`;
      const revoke = document.createElement("button");
      revoke.className = "danger";
      revoke.textContent = "Revoke";
      revoke.addEventListener("click", async () => {
        try {
          await request(`/api/team/invitations/${encodeURIComponent(invitation._id)}`, {
            method: "DELETE"
          });
          await load();
        } catch (error) {
          statusEl.textContent = error.message;
        }
      });
      row.append(label, revoke);
      invitationsEl.append(row);
    }
  }

  async function load() {
    statusEl.textContent = "";
    try {
      const data = await request("/api/team/members");
      const members = data.members.map((member) => ({
        ...member,
        isOwner: String(member._id) === data.ownerId
      }));
      renderMembers(members, data.canManage);
      document.getElementById("seatSummary").textContent =
        `Plan seats: ${members.length} / ${
          Number.isFinite(data.seatLimit) ? data.seatLimit : "Unlimited"
        } · The owner uses one seat.`;
      inviteArea.hidden = !data.canManage;
      if (data.canManage) {
        const inviteData = await request("/api/team/invitations");
        renderInvitations(inviteData.invitations);
      }
    } catch (error) {
      membersEl.textContent = error.message;
    }
  }

  document.getElementById("inviteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await request("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: document.getElementById("inviteEmail").value })
      });
      document.getElementById("inviteEmail").value = "";
      statusEl.textContent = "Invitation sent.";
      await load();
    } catch (error) {
      statusEl.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  load();
});
