const fields=[

"businessName",
"offer",
"fees",
"hours",
"services",
"refund",
"faq",
"extra"

];

const toneButtons=

document.querySelectorAll(
".toneBtn"
);

let tone=
"Professional";

toneButtons.forEach(btn=>{

btn.onclick=()=>{

toneButtons.forEach(

b=>

b.classList.remove(
"activeTone"
)

);

btn.classList.add(
"activeTone"
);

tone=
btn.innerText;

saveDraft();

};

});

function saveDraft(){

const data={

tone

};

fields.forEach(id=>{

data[id]=

document
.getElementById(id)
.value;

});

localStorage.setItem(

"growbleDraft",

JSON.stringify(data)

);

updatePreview();

}

fields.forEach(id=>{

document

.getElementById(id)

.addEventListener(
"input",
saveDraft
);

});

const draft=

JSON.parse(

localStorage.getItem(
"growbleDraft"
)

);

if(draft){

fields.forEach(id=>{

if(draft[id]){

document
.getElementById(id)
.value=

draft[id];

}

});

tone=
draft.tone||

"Professional";

}

function updatePreview(){

const fees=

document
.getElementById(
"fees"
)
.value||

"₹2000/month";

const hours=

document
.getElementById(
"hours"
)
.value;

let text=

`Our fees are ${fees}.`;

if(hours){

text+=

` Classes run ${hours}.`;

}

if(tone==="Friendly"){

text=

`Hi 👋 ${text}`;

}

if(tone==="Premium"){

text=

`Thank you for your interest. ${text}`;

}

document

.getElementById(
"previewText"
)

.innerHTML=text;

}

const uploadBtn=

document
.getElementById(
"uploadBtn"
);

const pdfUpload=

document
.getElementById(
"pdfUpload"
);

uploadBtn.onclick=()=>{

pdfUpload.click();

};

pdfUpload.addEventListener(

"change",

async()=>{

const file=

pdfUpload.files[0];

if(!file)return;

const status=

document
.getElementById(
"uploadStatus"
);

status.innerHTML=

"Uploading brochure...";

const formData=

new FormData();

formData.append(
"pdf",
file
);

formData.append(

"userId",

localStorage.getItem(
"userId"
)

);

try{

const res=

await fetch(

"/api/upload-brochure",

{

method:"POST",

body:formData

}

);

const data=

await res.json();

if(data.success){

status.innerHTML=

`✅ AI learned ${data.learned} facts`;

}else{

status.innerHTML=

"Upload failed";

}

}catch{

status.innerHTML=

"Server error";

}

}

);

document

.getElementById(
"setupForm"
)

.addEventListener(

"submit",

async(e)=>{

e.preventDefault();

const btn=

document
.querySelector(
".submit"
);

btn.disabled=true;

btn.innerHTML=

`

<span
class="loader">
</span>

Training AI...

`;

const payload={

tone

};

fields.forEach(id=>{

payload[id]=

document
.getElementById(id)
.value;

});

payload.userId=

localStorage.getItem(
"userId"
);

const res=

await fetch(

"/api/user/setup",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:

JSON.stringify(
payload
)

}

);

btn.innerHTML=

"✅ AI Ready";

setTimeout(()=>{

window.location=
"/index";

},1000);

}

);

updatePreview();