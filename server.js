import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.static("."));

app.post("/upload", upload.single("photo"), async (req,res)=>{
  try{
    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path));
    form.append("content", `📊 점수: ${req.body.score}\n${req.body.text}`);

    await fetch(DISCORD_WEBHOOK_URL,{
      method:"POST",
      body: form
    });
  }catch(e){
    console.error(e);
  }

  fs.unlink(req.file.path,()=>{});
  res.json({ok:true});
});

app.listen(10000,()=>console.log("Server running"));
