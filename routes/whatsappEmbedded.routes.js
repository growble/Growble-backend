const express=require("express");

const router=express.Router();

router.get("/login",(req,res)=>{

const url=

`https://www.facebook.com/v23.0/dialog/oauth

?client_id=${process.env.META_APP_ID}

&redirect_uri=${process.env.META_REDIRECT_URI}

&scope=

whatsapp_business_management,

whatsapp_business_messaging,

business_management`;

res.redirect(url);

});

module.exports=router;