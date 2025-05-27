import { elizaLogger } from "@elizaos/core";
import { OpenAI } from 'openai';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // or your actual key for testing
});


export async function fetchTweetsFromAccounts(accounts: string[]):
Promise<any[]> {
    // Tweet fetching utility functions
    return [];
}

export const summarizeContent= async (tweets: any[]): Promise<string> => {
    if (tweets.length === 0) return "No recent tweets to summarize.";

    // Use node-summary to create a concise summary
    const tweetTexts = tweets.map(tweet => tweet.text).join("\n");

    try {
        const summaryPrompt = `
            Please summarize the following content. Include the image context (if any), the article highlights, and the main point of the text.

            Text:
            ${tweetTexts}
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are an assistant that summarizes mixed media content including images, text, and articles."
                },
                {
                    role: "user",
                    content: summaryPrompt
                }
            ],
            temperature: 0.5
        });
        return response.choices[0].message.content || "Summary could not be generated.";
    } catch (error) {
        elizaLogger.error("Error summarizing tweets:", error);
        return "Error generating summary.";
    }
}
