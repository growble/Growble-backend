const express=
require("express");

const router=
express.Router();

const multer=
require("multer");

const fs=
require("fs");

const pdfParse = require("pdf-parse");

const User =
require("../models/User");

const auth =
require("../middleware/authMiddleware");

const storage=

multer.diskStorage({

destination:

(req,file,cb)=>{

cb(
null,
"uploads/"
);

},

filename:

(req,file,cb)=>{

cb(

null,

Date.now()
+
"-"
+
file.originalname

);

}

});

const upload=

multer({
storage
});

router.post(
"/",
auth,
upload.single("pdf"),
async(req,res)=>{

try{


const filePath=
req.file.path;

const buffer=

fs.readFileSync(
filePath
);

const pdfData =
await pdfParse(buffer);

const text=

pdfData.text;


await User.updateOne(
{
  _id:req.user._id
},
{
$set:{
knowledgeBase:text
}
}
);

const updatedUser = await User.findById(req.user._id);

console.log(
"Knowledge Base Saved:",
updatedUser.knowledgeBase
);

const learned=

text
.split("\n")
.filter(
x=>x.trim()
)
.length;

fs.unlinkSync(
filePath
);


res.json({

success:true,

learned

});

}catch(error){

console.log(error);

res.status(500).json({

success:false

});

}

}

);

module.exports=
router;