const OpenAI = require("openai");

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const generateMessage = async ({
message,
user
}) => {

const PLAN_LIMITS =
require("../config/PlanLimits");

const dbUser = user;

console.log("===== AI DEBUG =====");

const limit =
PLAN_LIMITS[dbUser.plan]?.aiReplies || 0;

if (!dbUser.automationUsage) {
  dbUser.automationUsage = {};
}

if (!dbUser.automationUsage.usage) {
  dbUser.automationUsage.usage = {
    aiReplies: 0,
    aiQualification: 0,
    followUps: 0
  };
}

if (
  (dbUser.automationUsage.usage.aiReplies || 0) >= limit
) {
  return "AI reply limit reached. Upgrade your plan.";
}
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

Answer customer questions using the Business Knowledge provided below.

If the answer exists in Business Knowledge,
give the answer directly.

Rules:

1. Use Business Knowledge as the source of truth.

2. If the answer exists in Business Knowledge,
answer directly.

3. If pricing exists in Business Knowledge,
share the pricing exactly.

4. If services exist in Business Knowledge,
share them.

5. Only say
"Please contact business owner for latest details."
when the requested information is NOT available in Business Knowledge.

6. Keep replies short and WhatsApp-friendly.

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

dbUser.automationUsage.usage.aiReplies =
(dbUser.automationUsage.usage.aiReplies || 0) + 1;

await dbUser.save();

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