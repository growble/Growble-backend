const fields=[

"businessName",

"businessType",

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

const knowledgeDocuments=
document.getElementById("knowledgeDocuments");
const knowledgeDocumentUsage=
document.getElementById("knowledgeDocumentUsage");
const uploadStatus=
document.getElementById("uploadStatus");
const token=
localStorage.getItem("token");

async function loadKnowledgeDocuments(){
  try{
    const res=await fetch("/api/knowledge-documents",{
      headers:{Authorization:`Bearer ${token}`}
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||"Could not load documents.");

    knowledgeDocumentUsage.textContent=
      `Knowledge documents: ${data.used}/${data.limit === null ? "Unlimited" : data.limit}`;
    knowledgeDocuments.replaceChildren();
    data.documents.forEach(document=>{
      const row=document.createElement("div");
      row.style.cssText="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:8px;padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:8px";
      const name=document.createElement("span");
      name.textContent=document.name;
      const remove=document.createElement("button");
      remove.type="button";
      remove.textContent="Remove";
      remove.onclick=async()=>{
        try{
          const deleteRes=await fetch(`/api/knowledge-documents/${encodeURIComponent(document._id)}`,{
            method:"DELETE",
            headers:{Authorization:`Bearer ${token}`}
          });
          const deleteData=await deleteRes.json();
          if(!deleteRes.ok) throw new Error(deleteData.message||"Could not remove document.");
          uploadStatus.textContent=deleteData.message;
          await loadKnowledgeDocuments();
        }catch(error){
          uploadStatus.textContent=error.message;
        }
      };
      row.append(name,remove);
      knowledgeDocuments.append(row);
    });
  }catch(error){
    knowledgeDocumentUsage.textContent=error.message;
  }
}

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

status.textContent=

"Uploading brochure...";

const formData=

new FormData();

formData.append(
"pdf",
file
);


try{

const res=

await fetch(
"/api/knowledge-documents",
{
  method:"POST",
  headers:{
    Authorization:
      `Bearer ${localStorage.getItem("token")}`
  },
  body:formData
}
);

const data=await res.json();
if(!res.ok) throw new Error(data.message||"Upload failed.");

status.textContent=`✅ ${data.document.name} added to shared AI knowledge.`;
pdfUpload.value="";
await loadKnowledgeDocuments();

}catch(error){

status.textContent=error.message||"Server error";

}

}

);

loadKnowledgeDocuments();

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

const res =

await fetch(

"/api/user/setup",

{

method:"POST",

headers:{

"Content-Type":
"application/json",

Authorization:
`Bearer ${localStorage.getItem("token")}`

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
"/index.html";

},1000);

}

);

updatePreview();