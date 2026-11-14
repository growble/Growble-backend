document.addEventListener("DOMContentLoaded", () => {
  const plans = {
    starter: { name: "Starter", price: 499 },
    pro: { name: "Pro AI", price: 999 },
    agent: { name: "AI Sales Agent", price: 1499 }
  };
  const params = new URLSearchParams(window.location.search);
  const isAiReplyPack = params.get("product") === "ai-reply-pack";
  const planId = params.get("plan") || "pro";
  const plan = Object.prototype.hasOwnProperty.call(plans, planId)
    ? plans[planId]
    : null;
  const token = localStorage.getItem("token");
  const payBtn = document.getElementById("payBtn");
  const status = document.getElementById("paymentStatus");
  const retryButton = document.getElementById("retryActivationBtn");
  let pendingPaymentId = null;
  let checkingActivation = false;

  if (!isAiReplyPack && !plan) {
    window.location.replace("/pricing.html");
    return;
  }

  if (isAiReplyPack) {
    document.getElementById("purchaseTitle").textContent = "Buy";
    document.getElementById("planName").textContent = "100 AI Reply Credits";
    document.getElementById("purchaseDescription").textContent =
      "One-time top-up for active paid workspaces. Credits carry forward until used.";
    document.getElementById("planPrice").innerHTML =
      "₹99 <span style=\"font-size:16px\">one-time</span>";
    document.getElementById("purchaseBenefits").innerHTML = `
      <li>✅ 100 additional AI-generated replies</li>
      <li>✅ Used after your plan's monthly AI reply allowance</li>
      <li>✅ Credits carry forward across monthly resets</li>
    `;
    payBtn.textContent = "Buy AI Reply Credits";
  } else {
    document.getElementById("planName").textContent = plan.name;
    document.getElementById("planPrice").innerHTML =
      `₹${plan.price} <span style="font-size:16px">/30 days</span>`;
    document.getElementById("purchaseDescription").textContent =
      "One-time payment. Your plan stays active for 30 days and does not auto-renew.";
    document.getElementById("purchaseBenefits").innerHTML = `
      <li>✅ Paid plan access for 30 days</li>
      <li>✅ Plan limits and features shown on the pricing page</li>
      <li>✅ Buy again to extend your plan</li>
    `;
  }

  if (!token) {
    window.location.href = `/login.html${window.location.search}`;
    return;
  }

  function showStatus(message, type = "info") {
    status.textContent = message;
    status.style.display = "block";
    status.style.color = type === "error"
      ? "#ffbaba"
      : type === "success"
        ? "#b8ffd4"
        : "#fcd34d";
  }

  async function checkActivation(paymentId) {
    const response = await fetch(
      `/api/payment/activation/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = `/login.html${window.location.search}`;
      throw new Error("Your session expired. Sign in again to check activation.");
    }
    if (!response.ok) {
      throw new Error(data.message || "Could not check payment activation.");
    }

    return data.activated === true;
  }

  async function waitForActivation(paymentId) {
    if (checkingActivation) return;
    checkingActivation = true;
    retryButton.disabled = true;
    retryButton.style.display = "none";
    showStatus("Payment received. Waiting for Growble to confirm and activate it…");

    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (await checkActivation(paymentId)) {
          showStatus(
            "Purchase activated successfully. Redirecting to your dashboard…",
            "success"
          );
          window.setTimeout(() => {
            window.location.href = "/index.html";
          }, 1200);
          return;
        }
        if (attempt < 9) {
          await new Promise(resolve => window.setTimeout(resolve, 2000));
        }
      }

      showStatus(
        `Activation is still processing (reference ${paymentId}). Do not pay again; check again shortly or contact support@growble.app.`
      );
      retryButton.style.display = "block";
    } catch (error) {
      console.error("Payment activation check failed:", error);
      showStatus(
        `${error.message} Payment reference: ${paymentId}. It may still be processing; do not pay again.`,
        "error"
      );
      retryButton.style.display = "block";
    } finally {
      checkingActivation = false;
      retryButton.disabled = false;
    }
  }

  retryButton.addEventListener("click", () => {
    if (pendingPaymentId) waitForActivation(pendingPaymentId);
  });

  payBtn.addEventListener("click", async () => {
    payBtn.disabled = true;
    const originalButtonText = payBtn.textContent;
    payBtn.textContent = "Connecting to payment...";

    try {
      const endpoint = isAiReplyPack
        ? "/api/payment/create-ai-reply-order"
        : "/api/payment/create-order";
      const orderResponse = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(isAiReplyPack ? {} : { plan: planId }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (orderResponse.status === 401) {
        localStorage.removeItem("token");
        window.location.href = `/login.html${window.location.search}`;
        return;
      }

      const orderData = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !orderData.orderId || !orderData.keyId) {
        throw new Error(
          orderData.error || "Could not start checkout. Please try again or contact support."
        );
      }

      if (typeof Razorpay !== "function") {
        throw new Error("The payment window could not load. Check your connection and try again.");
      }

      const purchaseDescription = isAiReplyPack
        ? "One-time AI reply credit top-up"
        : `${plan.name} Plan - ₹${plan.price} for 30 days`;
      let checkoutCompleted = false;
      const checkout = new Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: "INR",
        order_id: orderData.orderId,
        name: "Growble",
        description: purchaseDescription,
        modal: {
          ondismiss: () => {
            if (!checkoutCompleted) {
              payBtn.disabled = false;
              payBtn.textContent = originalButtonText;
            }
          }
        },
        handler: async function (paymentResponse) {
          checkoutCompleted = true;
          pendingPaymentId = paymentResponse.razorpay_payment_id;
          try {
            const controller = new AbortController();
            const verificationTimeout = window.setTimeout(
              () => controller.abort(),
              8000
            );
            let verifyResponse;
            try {
              verifyResponse = await fetch("/api/payment/verify", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                signal: controller.signal,
                body: JSON.stringify({
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_order_id: paymentResponse.razorpay_order_id,
                  razorpay_signature: paymentResponse.razorpay_signature
                })
              });
            } finally {
              window.clearTimeout(verificationTimeout);
            }
            const verifyData = await verifyResponse.json().catch(() => ({}));

            if (!verifyResponse.ok) {
              console.error(
                "Payment signature verification failed:",
                verifyData.message || "Unknown verification error"
              );
            }
          } catch (error) {
            console.error("Payment signature check unavailable:", error);
          }
          await waitForActivation(pendingPaymentId);
        }
      });

      checkout.on("payment.failed", event => {
        showStatus(
          event.error?.description || "Payment failed. You have not been charged successfully.",
          "error"
        );
      });
      checkout.open();
    } catch (error) {
      console.error("Could not start payment:", error);
      showStatus(error.message || "Could not start payment. Please try again shortly.", "error");
      payBtn.disabled = false;
      payBtn.textContent = originalButtonText;
    }
  });
});
