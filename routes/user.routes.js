const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email plan planActivatedAt");
    res.json({
  success: true,
  user,
  planExpired: req.planExpired || false,
  planExpiringSoon: req.planExpiringSoon || null
});
  } catch (err) {
    res.status(500).json({ success: false, message: "server error" });
  }
});

// ✅ Save business details
router.post("/setup", async (req, res) => {
  try {
    const { userId, businessName, businessType, offer } = req.body;

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.businessName = businessName;
    user.businessType = businessType;
    user.offer = offer;

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
