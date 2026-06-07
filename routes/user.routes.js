const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
.select(`
name
email
plan
planActivatedAt

businessName
businessType
offer

knowledgeBase
tone
services
faq

usage
`);
    const PLAN_LIMITS =
require("../config/planLimits");

res.json({
  success: true,

  user,

  planExpired:
    req.planExpired || false,

  planExpiringSoon:
    req.planExpiringSoon || null,

  usage: {

    aiRepliesUsed:
      user.usage?.aiReplies || 0,

    aiRepliesLimit:
      PLAN_LIMITS[user.plan].aiReplies,

    followUpsUsed:
      user.usage?.followUps || 0,

    followUpsLimit:
      PLAN_LIMITS[user.plan].followUps,

    aiQualificationUsed:
      user.usage?.aiQualification || 0,

    aiQualificationLimit:
      PLAN_LIMITS[user.plan]
      .aiQualification
  }
});

  } catch (err) {
    res.status(500).json({ success: false, message: "server error" });
  }
});

// ✅ Save business details
router.post("/setup", auth, async (req, res) => {
try {

const {

businessName,
businessType,
offer,

tone,
services,
faq,

fees,
hours,
extra

} = req.body;

    const user =
await User.findById(
req.user._id
);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.businessName = businessName;

user.businessType = businessType;

user.offer = offer;

user.tone = tone;

user.services = services;

user.faq = faq;

// AI knowledge base
user.knowledgeBase = `

Business Name:
${businessName}

Business Type:
${businessType}

Offer:
${offer}

Services:
${services}

Fees:
${fees}

Hours:
${hours}

FAQ:
${faq}

Extra:
${extra}

Tone:
${tone}

`;

user.aiSetupCompleted = true;

    await user.save();

    res.json({ message: "Business setup saved ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post(
"/connect-whatsapp",
async(req,res)=>{

try{

const {

userId,

whatsappPhoneId,

whatsappToken,

verifyToken

}=req.body;

const user=
await User.findById(
userId
);

if(!user){

return res
.status(404)
.json({
message:
"User not found"
});

}

user.whatsappPhoneId=
whatsappPhoneId;

user.whatsappToken=
whatsappToken;

user.verifyToken=
verifyToken;

await user.save();

res.json({

message:
"WhatsApp Connected 🚀"

});

}catch(err){

console.log(err);

res
.status(500)
.json({

message:
"Server Error"

});

}

});
module.exports = router;
