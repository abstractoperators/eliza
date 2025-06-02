import { Action, IAgentRuntime, Memory, HandlerCallback, State, elizaLogger } from "@elizaos/core";
import { Scraper } from "agent-twitter-client";
import { summarizeExamples } from "../examples";
import { summarizeContent } from "../utils/tweetUtils";

export const createNewsletterAction: Action = {
    name: "CREATE_NEWSLETTER",
    description: "Fetches recent tweets from key Sei community accounts and generates a sentiment-aware summary highlighting trends, engagement, and top topics across the ecosystem.",
    similes: [
        "CREATE_NEWSLETTER",
        "NEWSLETTER_DRAFT",
        "WEEKLY_DIGEST",
        "COMMUNITY_NEWSLETTER",
        "SEI_ECOSYSTEM_UPDATE",
        "CURATE_COMMUNITY_NEWS",
        "WRITE_NEWSLETTER",
        "NEWSLETTER_SUMMARY",
        "NEWSLETTER_CONTENT",
        "NEWSLETTER_EDITOR",
        "NEWSLETTER_GENERATION",
        "NEWSLETTER_REPORT"
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
                    const accountTweets = await fetchAccountTweets(runtime, scraper, account.trim(), maxTweets);

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
async function fetchAccountTweets(runtime: IAgentRuntime, scraper: Scraper, username: string, maxTweets: number): Promise<any[]> {
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
            // Check cache first
            const cachedTweet = await runtime.cacheManager.get(`twitter/tweets/${tweet.id}`);
            if (cachedTweet && typeof cachedTweet == 'string') {
                tweets.push(JSON.parse(cachedTweet));
            } else {
                const tweetData = {
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
                };
                // Cache new tweet
                await runtime.cacheManager.set(
                    `twitter/tweets/${tweet.id}`,
                    JSON.stringify(tweetData)
                );
                tweets.push(tweetData);
            }

            if (tweets.length >= maxTweets) break;
        }

        elizaLogger.info(`Successfully fetched ${tweets.length} tweets from @${username}`);
        return tweets;

    } catch (error) {
        elizaLogger.error(`Error fetching tweets from @${username}:`, error);
        return [];
    }
}