const CONFIG_ID = "1565714841620288";

document.getElementById("connectBtn").addEventListener("click", () => {

    if (typeof FB === "undefined") {
        alert("Facebook SDK not loaded.");
        return;
    }

    FB.login(
        function (response) {

            console.log("Meta Response:", response);

            if (response.authResponse) {

                console.log("Authorization Code:",
                    response.authResponse.code
                );

                fetch("/api/meta/exchange-code", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        code: response.authResponse.code
                    })
                })
                .then(r => r.json())
                .then(data => {
                    console.log(data);

                    if (data.success) {
                        alert("✅ WhatsApp connected successfully.");
                        window.location.href = "/dashboard";
                    } else {
                        alert(data.message || "Connection failed.");
                    }
                })
                .catch(console.error);

            } else {

                console.log("User cancelled.");

            }

        },
        {
            config_id: CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            extras: {
                feature: "whatsapp_embedded_signup",
                sessionInfoVersion: 3
            }
        }
    );

});