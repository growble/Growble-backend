document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token || localStorage.getItem("role") !== "user") {
    localStorage.clear();
    window.location.href = "/login.html";
    return;
  }

  const authorizeButton = document.getElementById("authorizeBtn");
  const connectButton = document.getElementById("connectBtn");
  const selection = document.getElementById("pageSelection");
  const pageList = document.getElementById("availablePageList");
  const connectedPages = document.getElementById("connectedPages");
  const connectedPageList = document.getElementById("connectedPageList");
  const status = document.getElementById("status");
  let facebookAccessToken = "";
  let canConnectPages = false;
  let facebookSdkReady;
  let resolveFacebookSdk;

  facebookSdkReady = new Promise(resolve => {
    resolveFacebookSdk = resolve;
    setTimeout(() => {
      resolveFacebookSdk(new Error("Facebook could not be loaded. Please refresh and try again."));
    }, 15000);
  });
  window.addEventListener("facebook-sdk-error", () => {
    resolveFacebookSdk(new Error("Facebook could not be loaded. Please refresh and try again."));
  }, { once: true });
  window.fbAsyncInit = async function () {
    try {
      const config = await request("/api/meta/facebook-leads/config");
      window.FB.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: "v26.0"
      });
      resolveFacebookSdk();
    } catch (error) {
      showStatus(error.message || "Facebook Lead Ads is unavailable.", true);
      resolveFacebookSdk(error);
    }
  };

  function showStatus(message, isError = false, isSuccess = false) {
    status.textContent = message;
    status.className = "status" + (isError ? " error" : "") + (isSuccess ? " success" : "");
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

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = "/login.html";
      throw new Error("Your session expired. Please sign in again.");
    }
    if (!response.ok) {
      throw new Error(data.message || "The request could not be completed.");
    }
    return data;
  }

  async function loadConnectedPages() {
    const data = await request("/api/meta/facebook-leads/status");
    renderConnectedPages(data.pages);
  }

  function renderConnectedPages(pages) {
    connectedPageList.replaceChildren();
    connectedPages.hidden = pages.length === 0;

    pages.forEach(page => {
      const row = document.createElement("div");
      row.className = "page-option";
      const name = document.createElement("span");
      name.textContent = page.pageName;
      name.style.flex = "1";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary";
      button.textContent = "Disconnect";
      button.addEventListener("click", async () => {
        if (!window.confirm(`Disconnect ${page.pageName} from Facebook Lead Ads?`)) {
          return;
        }
        button.disabled = true;
        try {
          await request(
            `/api/meta/facebook-leads/pages/${encodeURIComponent(page.pageId)}`,
            { method: "DELETE" }
          );
          await loadConnectedPages();
          showStatus(`${page.pageName} disconnected.`, false, true);
        } catch (error) {
          showStatus(error.message || "Could not disconnect the Page.", true);
          button.disabled = false;
        }
      });
      row.append(name, button);
      connectedPageList.appendChild(row);
    });
  }

  try {
    const data = await request("/api/meta/facebook-leads/status");
    canConnectPages = data.canConnect;
    renderConnectedPages(data.pages);
    if (!canConnectPages) {
      authorizeButton.textContent = "View Pro plans";
      showStatus("Facebook Lead Ads connections are available on Pro and Agent.");
    }
  } catch (error) {
    showStatus(error.message, true);
    authorizeButton.disabled = true;
    return;
  }

  authorizeButton.addEventListener("click", async () => {
    if (!canConnectPages) {
      window.location.href = "/pricing.html";
      return;
    }

    authorizeButton.disabled = true;
    authorizeButton.textContent = "Opening Facebook…";
    showStatus("");

    try {
      const sdkError = await facebookSdkReady;
      if (sdkError) throw sdkError;
      if (!window.FB) throw new Error("Facebook could not be loaded. Please refresh and try again.");

      window.FB.login(async response => {
        try {
          if (!response.authResponse?.accessToken) {
            throw new Error("Facebook authorization was cancelled or not granted.");
          }
          facebookAccessToken = response.authResponse.accessToken;
          showStatus("Loading the Pages you can manage…");

          const data = await request("/api/meta/facebook-leads/pages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: facebookAccessToken })
          });
          renderPages(data.pages);
        } catch (error) {
          showStatus(error.message || "Could not load your Facebook Pages.", true);
        } finally {
          authorizeButton.disabled = false;
          authorizeButton.textContent = "Continue with Facebook";
        }
      }, {
        scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval",
        return_scopes: true,
        auth_type: "rerequest"
      });
    } catch (error) {
      showStatus(error.message || "Facebook authorization could not start.", true);
      authorizeButton.disabled = false;
      authorizeButton.textContent = "Continue with Facebook";
    }
  });

  function renderPages(pages) {
    pageList.replaceChildren();
    if (!pages.length) {
      showStatus("No Facebook Pages are available to this account. Check your Page access and try again.", true);
      selection.hidden = true;
      return;
    }

    pages.forEach((page, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "page-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `facebook-page-${index}`;
      checkbox.value = page.id;
      checkbox.checked = true;
      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = page.name;
      wrapper.append(checkbox, label);
      pageList.appendChild(wrapper);
    });

    selection.hidden = false;
    showStatus("Choose which Pages should send new lead forms to Growble.");
  }

  connectButton.addEventListener("click", async () => {
    const pageIds = [...pageList.querySelectorAll("input:checked")]
      .map(input => input.value);
    if (!facebookAccessToken || !pageIds.length) {
      showStatus("Select at least one Facebook Page.", true);
      return;
    }

    connectButton.disabled = true;
    connectButton.textContent = "Connecting…";
    try {
      const data = await request("/api/meta/facebook-leads/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: facebookAccessToken, pageIds })
      });
      showStatus(data.message, false, true);
      await loadConnectedPages();
      selection.hidden = true;
      facebookAccessToken = "";
    } catch (error) {
      showStatus(error.message || "Could not connect the selected Pages.", true);
    } finally {
      connectButton.disabled = false;
      connectButton.textContent = "Connect selected Pages";
    }
  });
});
