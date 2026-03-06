import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { audio } = req.body; // Ожидаем base64 строку без префикса (например, "data:audio/webm;base64,")
    if (!audio) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server" });
    }

    // Инициализация официальной библиотеки
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Используем flash-модель для стабильности и скорости
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Твоя задача — обработать расшифровку голосового сообщения торгового представителя после посещения торговой точки.

На вход ты получаешь текст, полученный из распознавания речи (speech-to-text). Этот текст может содержать:
- слова-паразиты
- междометия (э, ммм, ну, короче, типа)
- повторы
- заикание
- нецензурную лексику
- обрывки фраз
- шумовые фразы
- бессмысленный текст, если запись была плохой

Требования к обработке:

1. Удали:
- слова-паразиты
- повторы
- заикание
- маты
- бессмысленные фразы
- технические артефакты распознавания речи

2. Сохрани только смысловую информацию о визите.

3. Преобразуй текст в краткий структурированный отчет о визите торговой точки.

4. Не добавляй информацию, которой не было в тексте.

5. Не придумывай данные.

6. Сделай текст понятным и деловым.

7. Если в тексте нет осмысленной информации о визите (только шум, обрывки слов, либо запись пустая) — верни строго:

empty

Формат ответа:

Если есть смысловой текст:
- вернуть отредактированный структурированный текст (2–6 предложений)

Если смысла нет:
empty

Пример:

Вход:
"ээ ну короче был в магазине ммм там матрасы вроде наши стоят но продавец говорит давно не брали блин типа надо прайс новый отправить"

Ответ:
В торговой точке присутствует наша продукция (матрасы). Продавец сообщил, что последние поставки были давно. Необходимо отправить обновленный прайс-лист.`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/webm",
          data: audio.split(',')[1] || audio // Очищаем от префикса base64, если он есть
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const resultText = response.text().trim();

    res.status(200).json({ text: resultText });
  } catch (error) {
    console.error("AI Transcription Error:", error);
    // Выводим более подробную ошибку для отладки в консоль Vercel
    res.status(500).json({ error: error.message || "Failed to transcribe audio" });
  }
}