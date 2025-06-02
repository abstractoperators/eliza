// src/actions/getCachedTweets.ts
import { Action, IAgentRuntime, Memory, elizaLogger } from "@elizaos/core";

export const getCachedTweetsAction: Action = {
    name: "GET_CACHED_TWEETS",
    similes: ["CACHED_TWEETS"],
    description: "Retrieves and displays tweets from the cache",
    
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        return true;
    },

    handler: async (runtime: IAgentRuntime, message: Memory, callback: any) => {
        try {
            // Get all cached tweet keys
            const cachedTweets = [];
            const keys = await runtime.cacheManager.keys("twitter/tweets/");
            
            for (const key of keys) {
                const tweetString = await runtime.cacheManager.get(key);
                if (tweetString) {
                    cachedTweets.push(JSON.parse(tweetString));
                }
            }

            // Format the response
            const response = cachedTweets.length > 0 
                ? `Found ${cachedTweets.length} cached tweets:\n${cachedTweets.map(t => `- @${t.username}: ${t.content}`).join('\n')}`
                : "No cached tweets found";

            callback({ text: response }, []);
        } catch (error) {
            elizaLogger.error("Error retrieving cached tweets:", error);
            callback({ text: "Error retrieving cached tweets" }, []);
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Show me the cached tweets" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `Found 5 cached tweets:
    - @SeiNetwork: Excited to announce our new partnership with @YakaFinance! 🚀
    - @MilliCoinSei: Just dropped some fresh memes about the Sei ecosystem 😎
    - @bandosei: Testnet performance looking strong with 10k TPS achieved
    - @YakaFinance: Airdrop snapshot coming soon! Stay tuned 👀
    - @Ryuzaki_SEI: Bullish on Sei's DeFi growth potential`
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "What tweets do we have stored?" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `Found 3 cached tweets:
    - @SeiNetwork: New developer documentation is live! Check it out 📚
    - @MilliCoinSei: Community is growing fast! Welcome new members 🎉
    - @YakaFinance: Liquidity mining rewards increased by 50% 🤑`
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "List all cached tweets" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: `Found 2 cached tweets:
    - @bandosei: Infrastructure upgrades complete, performance improved
    - @Ryuzaki_SEI: Analysis of recent market trends and opportunities`
                },
            },
        ]
    ]
};