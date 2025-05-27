import { Action, IAgentRuntime, Memory, HandlerCallback, State, elizaLogger } from "@elizaos/core";
import { Scraper } from "agent-twitter-client";
import { summarizeExamples } from "../examples";
import { summarizeContent } from "../utils/tweetUtils";

export const summarizeTweetsAction: Action = {
    name: "SUMMARIZE_TWEETS",
    description: "Fetches recent tweets from key Sei community accounts and generates a sentiment-aware summary highlighting trends, engagement, and top topics across the ecosystem.",
    similes: [
        "GET_TWEETS",
        "ANALYZE_TWEETS",
        "TWEET_SUMMARY",
        "COMMUNITY_UPDATE",
        "COMMUNITY_SENTIMENT",
        "SEI_INSIGHT",
        "SOCIAL_LISTENING",
        "TWEET_ANALYTICS",
        "X_FEED_DIGEST",
        "SENTIMENT_ANALYSIS",
        "SEI_COMMUNITY_REPORT",
        "DAILY_COMMUNITY_RECAP"
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            elizaLogger.info("Starting tweet summarization for Milli agent");

            // Get monitored accounts from settings
            const monitoredAccounts = runtime.getSetting("TWEET_ACCOUNTS_TO_MONITOR")?.split(",") ||
                                    ["MilliCoinSei", "pebloescobarSEI", "bandosei", "Ryuzaki_SEI", "SeiNetwork", "YakaFinance"];

            const maxTweets = parseInt(runtime.getSetting("MAX_TWEETS_PER_ACCOUNT") || "10");

            // Initialize Twitter client using agent-twitter-client
            const scraper = new Scraper();

            // Check if we have Twitter credentials
            const twitterUsername = runtime.getSetting("TWITTER_USERNAME");
            const twitterPassword = runtime.getSetting("TWITTER_PASSWORD");

            if (!twitterUsername || !twitterPassword) {
                elizaLogger.warn("Twitter credentials not configured, using public access only");
            } else {
                try {
                    await scraper.login(twitterUsername, twitterPassword);
                    elizaLogger.info("Successfully logged into Twitter");
                } catch (error) {
                    elizaLogger.warn("Failed to login to Twitter, using public access:", error);
                }
            }

            for (const account of monitoredAccounts) {
                try {
                    elizaLogger.info(`Fetching tweets from @${account.trim()}`);

                    // Fetch real tweets from the account
                    const accountTweets = await fetchAccountTweets(scraper, account.trim(), maxTweets);

                    if (accountTweets.length > 0) {
                        const summarizedContent = await summarizeContent(accountTweets);
                        callback({ text: summarizedContent }, []);
                    }
                } catch (error) {
                    elizaLogger.error(`Error fetching tweets from @${account}:`, error);
                }
            }
        } catch (error) {
            elizaLogger.error("Error in summarizeTweetsAction:", error);
            callback({
                text: "I encountered an error while fetching community updates. Please try again later."
            }, []);
        }
    },
    examples: summarizeExamples
};


// Helper functions
async function fetchAccountTweets(scraper: Scraper, username: string, maxTweets: number): Promise<any[]> {
    try {
        elizaLogger.info(`Fetching ${maxTweets} tweets from @${username}`);

        // Get user profile to get user ID
        const profile = await scraper.getProfile(username);
        if (!profile || !profile.userId) {
            elizaLogger.warn(`Could not find profile for @${username}`);
            return [];
        }

        // Fetch tweets from the user
        const tweets = [];
        for await (const tweet of scraper.getTweets(username, maxTweets)) {
            tweets.push({
                id: tweet.id,
                text: tweet.text,
                username: tweet.username,
                timestamp: new Date(tweet.timestamp),
                likes: tweet.likes || 0,
                retweets: tweet.retweets || 0,
                replies: tweet.replies || 0,
                hashtags: tweet.hashtags || [],
                mentions: tweet.mentions || [],
                urls: tweet.urls || []
            });

            if (tweets.length >= maxTweets) break;
        }

        elizaLogger.info(`Successfully fetched ${tweets.length} tweets from @${username}`);
        return tweets;

    } catch (error) {
        elizaLogger.error(`Error fetching tweets from @${username}:`, error);
        return [];
    }
}