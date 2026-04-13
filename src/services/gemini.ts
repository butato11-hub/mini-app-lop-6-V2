import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateQuizFromMarkdown(subject: Subject, markdown: string, count: number = 10): Promise<Question[]> {
  const batchSize = 20;
  const numBatches = Math.ceil(count / batchSize);
  let allQuestions: Question[] = [];

  for (let i = 0; i < numBatches; i++) {
    const currentBatchCount = Math.min(batchSize, count - allQuestions.length);
    const prompt = `
      Dựa trên nội dung đề cương ôn tập môn ${subject} dưới đây, hãy tạo ra ${currentBatchCount} câu hỏi trắc nghiệm khách quan mới (không trùng lặp với các câu đã có).
      Mỗi câu hỏi phải có 4 lựa chọn (A, B, C, D) và chỉ có 1 đáp án đúng duy nhất.
      Hãy cung cấp thêm phần giải thích ngắn gọn cho mỗi câu hỏi.
      
      Nội dung đề cương:
      ${markdown}

      ${allQuestions.length > 0 ? `Các câu hỏi đã có (để tránh trùng lặp nội dung): ${allQuestions.map(q => q.question).join('; ')}` : ''}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.INTEGER, description: "Index of correct option (0-3)" },
                explanation: { type: Type.STRING }
              },
              required: ["id", "question", "options", "correctAnswer"]
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        const batchQuestions: Question[] = JSON.parse(text);
        allQuestions = [...allQuestions, ...batchQuestions];
      }
    } catch (error) {
      console.error(`Lỗi khi tạo câu hỏi đợt ${i + 1}:`, error);
      if (allQuestions.length === 0) throw error;
      break; // Trả về những gì đã có
    }
  }

  return allQuestions;
}
