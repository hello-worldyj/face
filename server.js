<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI 얼굴 평가</title>

<style>
:root{
  --teal:#14b8a6;
  --teal-dark:#0f766e;
  --bg:#f0fdfa;
  --card:#ffffff;
  --text:#0f172a;
}

*{ box-sizing:border-box; }

body{
  margin:0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:linear-gradient(180deg,#ecfeff,#f0fdfa);
  color:var(--text);
  min-height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
}

.app{
  width:100%;
  max-width:420px;
  padding:20px;
}

.card{
  background:var(--card);
  border-radius:20px;
  padding:24px;
  box-shadow:0 20px 40px rgba(0,0,0,0.08);
  text-align:center;
}

h1{
  margin:0 0 20px;
  font-size:24px;
  font-weight:700;
}

.upload-box{
  border:2px dashed var(--teal);
  border-radius:16px;
  padding:20px;
  cursor:pointer;
  transition:.2s;
}

.upload-box:hover{
  background:#ecfeff;
}

.upload-box input{
  display:none;
}

.preview{
  margin-top:16px;
}

.preview img{
  width:100%;
  border-radius:16px;
  object-fit:cover;
}

button{
  margin-top:20px;
  width:100%;
  padding:14px;
  border:none;
  border-radius:14px;
  background:linear-gradient(135deg,var(--teal),var(--teal-dark));
  color:white;
  font-size:16px;
  font-weight:600;
  cursor:pointer;
}

button:disabled{
  opacity:.6;
}

#status{
  margin-top:16px;
  font-size:14px;
}
</style>
</head>

<body>
<div class="app">
  <div class="card">
    <h1>AI 얼굴 평가</h1>

    <label class="upload-box">
      사진 선택
      <input type="file" id="photo" accept="image/*" />
    </label>

    <div class="preview" id="preview"></div>

    <button id="submit" disabled>평가하기</button>

    <div id="status"></div>
  </div>
</div>

<script>
const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submit");
const statusEl = document.getElementById("status");

let file = null;

photoInput.addEventListener("change", () => {
  file = photoInput.files[0];
  if(!file) return;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  preview.innerHTML = "";
  preview.appendChild(img);

  submitBtn.disabled = false;
});

submitBtn.addEventListener("click", async () => {
  if(!file) return;

  submitBtn.disabled = true;
  statusEl.textContent = "분석 중...";

  const formData = new FormData();
  formData.append("photo", file);

  try{
    const res = await fetch("/upload", {
      method:"POST",
      body:formData
    });

    const data = await res.json();
    statusEl.textContent =
      data.ai === "success"
        ? "분석 완료"
        : "분석 실패";
  }catch{
    statusEl.textContent = "오류 발생";
  }

  submitBtn.disabled = false;
});
</script>
</body>
</html>
