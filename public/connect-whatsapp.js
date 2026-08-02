const CONFIG_ID = "2153460132259021";

document.getElementById("connectBtn").addEventListener("click", () => {
const button = document.getElementById("connectBtn");

button.disabled = true;
button.innerText = "Connecting...";

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

                const token = localStorage.getItem("token");

fetch("/api/meta/exchange-code", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
        code: response.authResponse.code
    })
})
                .then(r => r.json())
                .then(data => {
                    console.log(data);

                    if (data.success) {
                        alert(
    `✅ Connected!\n\n${data.data.displayName}\n${data.data.phoneNumber}`
);
                        window.location.href = "/dashboard";
                   } else {

    button.disabled = false;
    button.innerText = "Connect WhatsApp";

    alert(data.message || "Connection failed.");

}
                })
                .catch(err => {

    console.error(err);

    button.disabled = false;
    button.innerText = "Connect WhatsApp";

    alert("Unable to connect WhatsApp.");

});

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
