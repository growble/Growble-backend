const CONFIG_ID = "2153460132259021";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("connectBtn");
    if (!button) {
        console.error("Connect button not found.");
        return;
    }

    let authorizationCode = null;
    let signupData = null;
    let submitting = false;
    let waitTimer = null;

    function resetButton() {
        button.disabled = false;
        button.innerText = "Connect with Facebook";
        authorizationCode = null;
        signupData = null;
        submitting = false;
        if (waitTimer) {
            clearTimeout(waitTimer);
            waitTimer = null;
        }
    }

    async function submitSignup() {
        if (submitting || !authorizationCode || !signupData) {
            return;
        }

        const wabaId = signupData.waba_id ||
            (Array.isArray(signupData.waba_ids) ? signupData.waba_ids[0] : "");
        const phoneNumberId = signupData.phone_number_id;

        if (!wabaId || !phoneNumberId) {
            return;
        }

        submitting = true;
        if (waitTimer) {
            clearTimeout(waitTimer);
            waitTimer = null;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/api/meta/exchange-code", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    code: authorizationCode,
                    wabaId: String(wabaId),
                    phoneNumberId: String(phoneNumberId),
                    businessId: signupData.business_id
                        ? String(signupData.business_id)
                        : ""
                })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Backend connection failed.");
            }

            alert(
                `WhatsApp connected!\n\n` +
                `${result.data?.displayName || ""}\n` +
                `${result.data?.phoneNumber || ""}`
            );
            window.location.href = "/dashboard";
        } catch (error) {
            console.error("WhatsApp connection error:", error);
            alert(`WhatsApp connection failed.\n\n${error.message}`);
            resetButton();
        }
    }

    window.addEventListener("message", (event) => {
        let host;
        try {
            host = new URL(event.origin).hostname;
        } catch (error) {
            return;
        }

        if (host !== "facebook.com" && !host.endsWith(".facebook.com")) {
            return;
        }

        let message = event.data;
        if (typeof message === "string") {
            try {
                message = JSON.parse(message);
            } catch (error) {
                return;
            }
        }

        if (message?.type !== "WA_EMBEDDED_SIGNUP" || !message.data) {
            return;
        }

        signupData = message.data;
        submitSignup();
    });

    button.addEventListener("click", () => {
        if (typeof FB === "undefined") {
            alert("Facebook SDK is not loaded. Please refresh the page.");
            return;
        }

        authorizationCode = null;
        signupData = null;
        submitting = false;
        button.disabled = true;
        button.innerText = "Connecting...";

        FB.login((response) => {
            const code = response.authResponse?.code;
            if (!code) {
                resetButton();
                return;
            }

            authorizationCode = code;
            if (!signupData) {
                waitTimer = setTimeout(() => {
                    if (!submitting) {
                        alert(
                            "Could not read the WhatsApp account details from Meta. " +
                            "Check the Embedded Signup configuration and allowed domain."
                        );
                        resetButton();
                    }
                }, 15000);
            }
            submitSignup();
        }, {
            config_id: CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: {
                feature: "whatsapp_embedded_signup",
                sessionInfoVersion: 3,
                version: "v4"
            }
        });
    });
});
