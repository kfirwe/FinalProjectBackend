import axios from "axios";

export const fetchAIContent = async (query: string): Promise<string> => {
  const API_KEY = process.env.OPENAI_API_KEY; // Make sure this is set in .env

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4",
      messages: [{ role: "user", content: query }],
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
};
