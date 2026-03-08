document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("please login first");
    window.location.href = "/login.html";
    return;
  }

  const payBtn = document.getElementById("payBtn");

  payBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      // ✅ handle expired session
      if (res.status === 401) {
        alert("session expired. please login again");
        localStorage.removeItem("token");
        window.location.href = "/login.html";
        return;
      }

      const data = await res.json();
      console.log("create order response:", data);

      if (!data.orderId) {
        alert("order creation failed");
        return;
      }

      const options = {
        key: "rzp_live_S5ENHkfaDlx45Q", // ✅ (we will improve this later)
        amount: data.amount,
        currency: "INR",
        order_id: data.orderId,
        name: "Growble",
        description: "Pro Plan",

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

              if (planData?.user?.plan === "pro") {
                alert("pro activated 🎉");
                window.location.href = "/dashboard.html";
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

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error(err);
      alert("something went wrong");
    }
  });
});
