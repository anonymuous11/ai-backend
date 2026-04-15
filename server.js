require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   🔥 LỌC NHANH (FREE)
========================= */
function quickFilter(text) {
    const badWords = ["địt", "dm", "lồn", "cc", "đm", "cặc", "đụ", "hôi lông", "hãm", "chảnh", "ngu"];

    if (badWords.some(w => text.toLowerCase().includes(w))) {
        return "UNSAFE";
    }

    return "PASS";
}

/* =========================
   🤖 GỌI GROQ AI
========================= */
async function checkWithAI(text) {
    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [
                    {
                        role: "system",
                        content: "Bạn là hệ thống kiểm duyệt confession."
                    },
                    {
                        role: "user",
                        content: `
Phân loại nội dung sau thành 1 trong 3:
- SAFE (bình thường)
- REVIEW (nhạy cảm)
- UNSAFE (toxic, chửi tục, 18+, lộ info)

Chỉ trả về đúng 1 từ.

Nội dung:
"${text}"
                        `
                    }
                ]
            })
        });

        const data = await res.json();
        console.log("🔥 AI RESPONSE:", data);

        const aiText = data?.choices?.[0]?.message?.content || "";

        return aiText.trim().toUpperCase();
    } catch (err) {
        console.error("❌ AI ERROR:", err);
        return "REVIEW"; // fallback an toàn
    }
}

/* =========================
   🚀 API MODERATE
========================= */
app.post("/moderate", async (req, res) => {
    try {
        const text = req.body.content || "";

        // 1. lọc nhanh
        const quick = quickFilter(text);
        if (quick === "UNSAFE") {
            return res.json({
                result: "UNSAFE",
                source: "filter"
            });
        }

        // 2. gọi AI
        const aiResult = await checkWithAI(text);

        // chuẩn hóa kết quả
        let finalResult = "REVIEW";

        if (aiResult.includes("SAFE")) finalResult = "SAFE";
        else if (aiResult.includes("UNSAFE")) finalResult = "UNSAFE";
        else if (aiResult.includes("REVIEW")) finalResult = "REVIEW";

        res.json({
            result: finalResult,
            raw: aiResult,
            source: "ai"
        });

    } catch (err) {
        console.error("❌ SERVER ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* =========================
   🧪 TEST SERVER
========================= */
app.get("/", (req, res) => {
    res.send("Server OK ✅");
});

/* =========================
   🚀 RUN SERVER
========================= */
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});