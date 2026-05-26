const express=
require("express");

const router=
express.Router();

const multer=
require("multer");

const fs=
require("fs");

const pdf=
require("pdf-parse");

const User =
require("../models/User");

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

upload.single(
"pdf"
),

async(req,res)=>{

try{

const userId=
req.body.userId;

const filePath=
req.file.path;

const buffer=

fs.readFileSync(
filePath
);

const pdfData=

await pdf(
buffer
);

const text=

pdfData.text;

const knowledge={

brochureText:
text

};

await User.updateOne(
{
_id:userId
},
{
$set:{
knowledgeBase:knowledge
}
}
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