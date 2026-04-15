require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ========== FILTER CỨNG ==========
function hardFilter(text) {
    const lowerText = text.toLowerCase();
    
    // Từ an toàn -> SAFE
    const safeWords = ["chào", "hello", "xin chào", "cảm ơn", "cám ơn", "tôi khỏe", "giúp tôi", "bài tập", "học bài", "làm bài"];
    for (let word of safeWords) {
        if (lowerText.includes(word)) {
            return "SAFE";
        }
    }
    
    // Từ thô tục -> UNSAFE
    const unsafeWords = ["địt", "dm", "lồn", "cc", "cặc", "đụ", "duma", "dit me", "loz", "lon", "đĩ", "đéo"];
    for (let word of unsafeWords) {
        if (lowerText.includes(word)) {
            return "UNSAFE";
        }
    }
    
    return null; // Không xác định, cần gọi AI
}

// ========== GỌI GROQ AI ==========
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
Phân loại nội dung sau thành 1 trong 3: SAFE, REVIEW, UNSAFE.

- SAFE: nội dung bình thường, lịch sự, khen ai đó, nói những từ ngữ bình thường, ..., nội dung mà bạn cảm thấy bình thường.
- REVIEW: nội dung có đánh giá không tốt về ai đó, nhận xét không tốt về người hoặc sự việc nào đó mà bạn cảm thấy không hay.
- UNSAFE: chửi tục, thô tục, 18+,...

Chỉ trả về 1 từ duy nhất.

Nội dung: "${text}"
`
                    }
                ]
            })
        });

        const data = await res.json();
        const result = data.choices[0].message.content.trim().toUpperCase();
        
        // Chuẩn hóa kết quả
        if (result.includes("SAFE")) return "SAFE";
        if (result.includes("UNSAFE")) return "UNSAFE";
        return "REVIEW";
        
    } catch (error) {
        console.error("AI Error:", error);
        return "REVIEW";
    }
}

// ========== API MODERATE ==========
app.post("/moderate", async (req, res) => {
    const text = req.body.content || "";
    
    // 1. Filter cứng trước
    const hardResult = hardFilter(text);
    if (hardResult) {
        return res.json({ result: hardResult, source: "hard_filter" });
    }
    
    // 2. Gọi AI nếu filter không xác định
    const aiResult = await checkWithAI(text);
    res.json({ result: aiResult, source: "ai" });
});

// ========== TEST SERVER ==========
app.get("/", (req, res) => {
    res.send("Server OK ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại port ${PORT}`);
});
