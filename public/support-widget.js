(() => {
  if (
    !localStorage.getItem("token") ||
    localStorage.getItem("role") !== "user"
  ) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    #growbleSupportLauncher {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9998;
      min-height: 48px;
      padding: 0 18px;
      border: 1px solid rgba(0,212,255,.65);
      border-radius: 999px;
      background: #00d4ff;
      color: #07131d;
      font: 700 14px Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 8px 26px rgba(0,0,0,.38);
    }
    #growbleSupportPanel {
      position: fixed;
      right: 22px;
      bottom: 82px;
      z-index: 9999;
      width: min(410px, calc(100vw - 28px));
      height: min(680px, calc(100vh - 112px));
      overflow: hidden;
      border: 1px solid rgba(0,212,255,.35);
      border-radius: 16px;
      background: #0b1220;
      box-shadow: 0 16px 50px rgba(0,0,0,.5);
    }
    #growbleSupportPanel[hidden] { display: none; }
    #growbleSupportPanel iframe { width: 100%; height: 100%; border: 0; }
    @media (max-width: 560px) {
      #growbleSupportLauncher { right: 14px; bottom: 14px; }
      #growbleSupportPanel {
        right: 8px;
        bottom: 72px;
        width: calc(100vw - 32px);
        height: calc(100vh - 110px);
      }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "growbleSupportPanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Growble support chat");

  const frame = document.createElement("iframe");
  frame.dataset.src = "/support.html?mode=widget";
  frame.title = "Growble support assistant";
  panel.appendChild(frame);

  const launcher = document.createElement("button");
  launcher.id = "growbleSupportLauncher";
  launcher.type = "button";
  launcher.textContent = "Growble Help";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", panel.id);
  launcher.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !frame.src) {
      frame.src = frame.dataset.src;
    }
    launcher.setAttribute("aria-expanded", String(!panel.hidden));
    launcher.textContent = panel.hidden ? "Growble Help" : "Close Help";
  });

  document.body.append(panel, launcher);
})();
