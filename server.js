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
Bạn là AI kiểm duyệt nội dung cho một diễn đàn học sinh.

Nhiệm vụ: Phân loại nội dung thành 1 trong 3 nhãn sau:

1. SAFE:
- Nội dung bình thường, lịch sự, không gây hại
- Câu hỏi đời sống, học tập, bạn bè, trường lớp
- Hỏi thông tin cá nhân đơn giản (ví dụ: có người yêu chưa, học giỏi không, ở lớp nào)
- Nội dung vui vẻ, trend, không mang ý xúc phạm

2. REVIEW:
- Nhận xét, đánh giá không tốt về một người hoặc sự việc
- Có thể gây hiểu lầm, tiêu cực nhẹ
- Ví dụ: chê bai, nói xấu nhẹ, đánh giá không tích cực

3. UNSAFE:
- Chửi tục, xúc phạm, thô tục
- Nội dung 18+, nhạy cảm
- Công kích cá nhân, bắt nạt

⚠️ QUY TẮC QUAN TRỌNG:
- Câu hỏi bình thường về một người (ví dụ: "có người yêu chưa") luôn là SAFE nếu không có ý xúc phạm
- Không tự suy diễn ý xấu nếu nội dung không chứa từ tiêu cực
- Chỉ gán REVIEW khi có yếu tố tiêu cực rõ ràng
- Chỉ gán UNSAFE khi có từ ngữ thô tục hoặc vi phạm nghiêm trọng

Chỉ trả về đúng 1 từ: SAFE, REVIEW hoặc UNSAFE
Không giải thích.

Ví dụ:
- "anh A B7 có người yêu chưa" → SAFE
- "bạn A học ngu vãi" → UNSAFE
- "thầy B dạy chán quá" → REVIEW
- "lớp này vui ghê" → SAFE

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
