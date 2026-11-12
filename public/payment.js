document.addEventListener("DOMContentLoaded", () => {
  const plans = {
    starter: { name: "Starter", price: 499 },
    pro: { name: "Pro AI", price: 999 },
    agent: { name: "AI Sales Agent", price: 1499 }
  };
  const planId = new URLSearchParams(window.location.search).get("plan") || "pro";
  const plan = Object.prototype.hasOwnProperty.call(plans, planId)
    ? plans[planId]
    : null;

  if (!plan) {
    window.location.replace("/pricing.html");
    return;
  }

  document.getElementById("planName").textContent = plan.name;
  document.getElementById("planPrice").innerHTML =
    `₹${plan.price} <span style="font-size:16px">/month</span>`;

  const token = localStorage.getItem("token");

  if (!token) {
    alert("please login first");
    window.location.href = `/login.html?plan=${encodeURIComponent(planId)}`;
    return;
  }

  const payBtn = document.getElementById("payBtn");

  payBtn.addEventListener("click", async () => {
    payBtn.disabled = true;
    const originalButtonText = payBtn.textContent;
    payBtn.textContent = "Connecting to payment...";
    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({ plan: planId }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      // ✅ handle expired session
      if (res.status === 401) {
        alert("session expired. please login again");
        localStorage.removeItem("token");
        window.location.href = `/login.html?plan=${encodeURIComponent(planId)}`;
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.orderId || !data.keyId) {
        alert(data.error || "Could not start checkout. Please try again or contact support.");
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,
        name: "Growble",
        description: `${plan.name} Plan - ₹${plan.price}/month`,

        handler: async function (response) {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok) {
              alert(verifyData?.message || "payment verification failed");
              return;
            }

            alert("payment successful ✅ Plan will activate shortly 🎉");

            // ✅ Check plan status repeatedly until webhook upgrades plan
            const checkPlan = async () => {
              const planRes = await fetch("/api/user/me", {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${token}`
                }
              });

              const planData = await planRes.json();

              if (planData?.user?.plan === planId) {
                alert(`${plan.name} activated 🎉`);
                window.location.href = "/index.html";
                return true;
              }

              return false;
            };

            let attempts = 0;
            const interval = setInterval(async () => {
              attempts++;
              const activated = await checkPlan();

              if (activated || attempts >= 10) {
                clearInterval(interval);
              }
            }, 2000);

          } catch (err) {
            console.error(err);
            alert("verification error");
          }
        }
      };

      if (typeof Razorpay !== "function") {
        alert("The payment window could not load. Check your connection and try again.");
        return;
      }

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error(err);
      alert("Could not start checkout. Please try again shortly.");
    } finally {
      payBtn.disabled = false;
      payBtn.textContent = originalButtonText;
    }
  });
});
