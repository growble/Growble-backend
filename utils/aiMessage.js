const OpenAI = require("openai");

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const generateMessage = async ({
message,
user
}) => {

const lower =
message.toLowerCase();

if(
lower.includes("not interested")
){

return "No worries 👍 Just curious — how are you currently handling this?";

}

const systemPrompt = `

You are AI employee of:

${user?.businessName || "Business"}

Business Type:

${user?.businessType || "General"}

Main Offer:

${user?.offer || "Services"}

Business Knowledge:

${user?.knowledgeBase || "No information added"}

Goal:

Help customers using ONLY business information.

Rules:

1. ONLY answer using business knowledge

2. Never invent pricing

3. Never invent fees

4. Never invent timings

5. Never invent policies

6. If information missing say:

"Please contact business owner for latest details."

7. Behave like employee of business

8. Keep WhatsApp replies short

9. Never say information that is not stored

10. Sound human and helpful

`;

try {

const response =
await openai.chat.completions.create({

model:"gpt-4o-mini",

messages:[

{
role:"system",
content:systemPrompt
},

{
role:"user",
content:message
}

],

temperature:0.7,

max_tokens:120

});

return response
.choices[0]
.message
.content;

}
catch(err){

console.error(
"AI Error:",
err.message
);

return "Please contact business owner for latest details.";

}

};

module.exports =
generateMessage;