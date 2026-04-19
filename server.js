require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


// ========== HARD FILTER (RULE-BASED) ==========
function hardFilter(text) {
    const lower = text.toLowerCase();

    // 1. UNSAFE (ưu tiên cao nhất)
    const unsafeWords = [
        "địt","dm","dmm","lồn","cặc","đụ","duma","dit me",
        "loz","lon","đĩ","đéo","fuck","shit","chịch","sex","dâm"
    ];
    if (unsafeWords.some(w => lower.includes(w))) {
        return "UNSAFE";
    }

    // 2. REVIEW (tiêu cực rõ ràng)
    const negativeWords = [
        "ngu","dốt","chán","tệ","ghét","kém","xấu","lười"
    ];
    if (negativeWords.some(w => lower.includes(w))) {
        return "REVIEW";
    }

    // 3. Không rõ → để AI xử lý
    return null;
}


// ========== AI CLASSIFY ==========
async function checkWithAI(text) {
    try {
        const prompt = `
You are a strict classifier.

Classify Vietnamese text into ONE label:
SAFE, REVIEW, UNSAFE

RULES:

1. UNSAFE:
- profanity, insults, vulgar, sexual

2. REVIEW:
- ONLY if there is clear negative opinion or criticism

3. SAFE:
- everything else
- questions about someone are ALWAYS SAFE

IMPORTANT:
- do NOT infer hidden meaning
- if unsure → SAFE

OUTPUT: ONLY one word

TEXT:
"${text}"
`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [
                    { role: "system", content: "You are a classifier." },
                    { role: "user", content: prompt }
                ],
                temperature: 0
            })
        });

        const data = await res.json();

        let result = data.choices[0].message.content
            .trim()
            .toUpperCase()
            .replace(/[^A-Z]/g, ""); // làm sạch

        // ✅ so sánh CHÍNH XÁC
        if (result === "SAFE") return "SAFE";
        if (result === "UNSAFE") return "UNSAFE";
        if (result === "REVIEW") return "REVIEW";

        // fallback an toàn
        return "SAFE";

    } catch (error) {
        console.error("AI Error:", error);
        return "SAFE"; // fallback an toàn
    }
}


// ========== MAIN API ==========
app.post("/moderate", async (req, res) => {
    const text = req.body.content || "";

    // 1. HARD FILTER trước
    const hardResult = hardFilter(text);
    if (hardResult) {
        return res.json({
            result: hardResult,
            source: "hard_filter"
        });
    }

    // 2. AI xử lý phần khó
    const aiResult = await checkWithAI(text);

    res.json({
        result: aiResult,
        source: "ai"
    });
});


// ========== TEST ==========
app.get("/", (req, res) => {
    res.send("Server OK ✅");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại port ${PORT}`);
});
