import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

app.use(express.static("."));

app.post("/upload", upload.single("photo"), async (req,res)=>{
  try{
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path));
    form.append(
      "content",
      `📊 점수: ${req.body.score}\n${req.body.text}`
    );

    await fetch(WEBHOOK,{method:"POST",body:form});
  }catch(e){
    console.error("디코 전송 실패",e);
  }

  fs.unlink(req.file.path,()=>{});
  res.json({ok:true});
});

app.listen(10000,()=>console.log("Server running"));
