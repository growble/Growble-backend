document
.getElementById("saveBtn")
.addEventListener(
"click",
async ()=>{

const userId=
localStorage
.getItem("userId");

const whatsappPhoneId=
document
.getElementById("phoneId")
.value;

const whatsappToken=
document
.getElementById("token")
.value;

const verifyToken=
document
.getElementById("verify")
.value;

const res=
await fetch(
"/api/user/connect-whatsapp",
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:JSON.stringify({

userId,

whatsappPhoneId,

whatsappToken,

verifyToken

})

}

);

const data=
await res.json();

alert(data.message);

window.location.href="/index.html";

});