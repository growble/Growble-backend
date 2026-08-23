const CONFIG_ID = "2153460132259021";

document.addEventListener("DOMContentLoaded", () => {

    const button = document.getElementById("connectBtn");

    if (!button) {
        console.error("Connect button not found.");
        return;
    }

    button.addEventListener("click", () => {

        button.disabled = true;
        button.innerText = "Connecting...";

        // Check Facebook SDK
        if (typeof FB === "undefined") {
            console.error("Facebook SDK not loaded.");
            alert("Facebook SDK is not loaded. Please refresh the page.");
            button.disabled = false;
            button.innerText = "Connect with Facebook";
            return;
        }

        console.log("Launching WhatsApp Embedded Signup...");
        console.log("Config ID:", CONFIG_ID);

        FB.login(
            function (response) {

                console.log("Meta Response:", response);

                if (response.authResponse) {

                    const code = response.authResponse.code;

                    console.log("Authorization code received.");

                    const token = localStorage.getItem("token");

                    fetch("/api/meta/exchange-code", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {})
                        },
                        body: JSON.stringify({
                            code: code
                        })
                    })
                    .then(async (res) => {

                        const data = await res.json();

                        console.log("Backend response:", data);

                        if (!res.ok) {
                            throw new Error(
                                data.message || "Backend connection failed."
                            );
                        }

                        return data;
                    })
                    .then(data => {

                        if (data.success) {

                            alert(
                                `✅ WhatsApp Connected!\n\n` +
                                `${data.data?.displayName || ""}\n` +
                                `${data.data?.phoneNumber || ""}`
                            );

                            window.location.href = "/dashboard";

                        } else {

                            throw new Error(
                                data.message || "WhatsApp connection failed."
                            );

                        }

                    })
                    .catch(err => {

                        console.error("WhatsApp connection error:", err);

                        alert(
                            "❌ WhatsApp connection failed.\n\n" +
                            err.message
                        );

                        button.disabled = false;
                        button.innerText = "Connect with Facebook";

                    });

                } else {

                    console.log(
                        "Meta login cancelled or no authorization response."
                    );

                    button.disabled = false;
                    button.innerText = "Connect with Facebook";
                }

            },

            {
                config_id: CONFIG_ID,

                response_type: "code",

                override_default_response_type: true,

                extras: {
                    feature: "whatsapp_embedded_signup",
                    sessionInfoVersion: 3,
                    version: "v4"
                }
            }
        );

    });

});
