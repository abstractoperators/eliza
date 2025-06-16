import { Tweet } from "agent-twitter-client";
import {
    composeContext,
    getEmbeddingZeroVector,
    IAgentRuntime,
    stringToUuid,
    UUID,
    ModelClass,
    generateMessageResponse,
    truncateToCompleteSentence,
} from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { postActionResponseFooter } from "@elizaos/core";
import { DEFAULT_MAX_TWEET_LENGTH } from "./environment.ts";
import { fetchAccountTweets, summarizeContent } from "./utils.ts";


const twitterPostTemplate = `
# News about Sei ecosystem.

# Task: Generate a post that summarize what the Sei community is talking about lately?`;

export const twitterActionTemplate =
    `
# INSTRUCTIONS: Determine actions for {{agentName}} (@{{twitterUserName}}) based on:
{{bio}}
{{postDirections}}

Guidelines:
- ONLY engage with content that DIRECTLY relates to character's core interests
- Direct mentions are priority IF they are on-topic
- Skip ALL content that is:
  - Off-topic or tangentially related
  - From high-profile accounts unless explicitly relevant
  - Generic/viral content without specific relevance
  - Political/controversial unless central to character
  - Promotional/marketing unless directly relevant

Actions (respond only with tags):
[LIKE] - Perfect topic match AND aligns with character (9.8/10)
[RETWEET] - Exceptional content that embodies character's expertise (9.5/10)
[QUOTE] - Can add substantial domain expertise (9.5/10)
[REPLY] - Can contribute meaningful, expert-level insight (9.5/10)

Tweet:
{{currentTweet}}

# Respond with qualifying action tags only. Default to NO action unless extremely confident of relevance.` +
    postActionResponseFooter;

export class TwitterPostClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    twitterUsername: string;
    private stopProcessingActions: boolean = false;
    private isDryRun: boolean;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
        this.twitterUsername = this.client.twitterConfig.TWITTER_USERNAME;
        this.isDryRun = this.client.twitterConfig.TWITTER_DRY_RUN;

        const targetUsers = this.client.twitterConfig.TWITTER_TARGET_USERS;
        if (targetUsers) {
            elizaLogger.log(`- Target Users: ${targetUsers}`);
        }

        if (this.isDryRun) {
            elizaLogger.log(
                "Twitter client initialized in dry run mode - no actual tweets should be posted"
            );
        }
    }


    async start() {
        if (!this.client.profile) {
            await this.client.init();
        }

        const generateNewTweetLoop = async () => {
            const lastPost = await this.runtime.cacheManager.get<{
                timestamp: number;
            }>("twitter/" + this.twitterUsername + "/lastPost");

            const lastPostTimestamp = lastPost?.timestamp ?? 0;
            const minMinutes = this.client.twitterConfig.SUMMARY_INTERVAL_MIN;
            const maxMinutes = this.client.twitterConfig.SUMMARY_INTERVAL_MAX;
            const randomMinutes =
                Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) +
                minMinutes;
            const delay = randomMinutes * 60 * 1000;

            if (Date.now() > lastPostTimestamp + delay) {
                await this.generateNewTweet();
            }

            setTimeout(() => {
                generateNewTweetLoop(); // Set up next iteration
            }, delay);

            elizaLogger.log(`Next tweet scheduled in ${randomMinutes} minutes`);
        };


        if (this.client.twitterConfig.POST_IMMEDIATELY) {
            await this.generateNewTweet();
        }

        // Only start tweet generation loop if not in dry run mode
        generateNewTweetLoop();
        elizaLogger.log("Tweet generation loop started");
    }

    createTweetObject(
        tweetResult: any,
        client: any,
        twitterUsername: string
    ): Tweet {
        return {
            id: tweetResult.rest_id,
            name: client.profile.screenName,
            username: client.profile.username,
            text: tweetResult.legacy.full_text,
            conversationId: tweetResult.legacy.conversation_id_str,
            createdAt: tweetResult.legacy.created_at,
            timestamp: new Date(tweetResult.legacy.created_at).getTime(),
            userId: client.profile.id,
            inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
            permanentUrl: `https://twitter.com/${twitterUsername}/status/${tweetResult.rest_id}`,
            hashtags: [],
            mentions: [],
            photos: [],
            thread: [],
            urls: [],
            videos: [],
        } as Tweet;
    }

    async processAndCacheTweet(
        runtime: IAgentRuntime,
        client: ClientBase,
        tweet: Tweet,
        roomId: UUID,
        newTweetContent: string
    ) {
        // Cache the last post details
        await runtime.cacheManager.set(
            `twitter/${client.profile.username}/lastPost`,
            {
                id: tweet.id,
                timestamp: Date.now(),
            }
        );

        // Cache the tweet
        await client.cacheTweet(tweet);

        // Log the posted tweet
        elizaLogger.log(`Tweet posted:\n ${tweet.permanentUrl}`);

        // Ensure the room and participant exist
        await runtime.ensureRoomExists(roomId);
        await runtime.ensureParticipantInRoom(runtime.agentId, roomId);

        // Create a memory for the tweet
        await runtime.messageManager.createMemory({
            id: stringToUuid(tweet.id + "-" + runtime.agentId),
            userId: runtime.agentId,
            agentId: runtime.agentId,
            content: {
                text: newTweetContent.trim(),
                url: tweet.permanentUrl,
                source: "twitter",
            },
            roomId,
            embedding: getEmbeddingZeroVector(),
            createdAt: tweet.timestamp,
        });
    }

    async handleNoteTweet(
        client: ClientBase,
        content: string,
        tweetId?: string
    ) {
        try {
            const noteTweetResult = await client.requestQueue.add(
                async () =>
                    await client.twitterClient.sendNoteTweet(content, tweetId)
            );

            if (noteTweetResult.errors && noteTweetResult.errors.length > 0) {
                // Note Tweet failed due to authorization. Falling back to standard Tweet.
                const truncateContent = truncateToCompleteSentence(
                    content,
                    this.client.twitterConfig.MAX_TWEET_LENGTH
                );
                return await this.sendStandardTweet(
                    client,
                    truncateContent,
                    tweetId
                );
            } else {
                return noteTweetResult.data.notetweet_create.tweet_results
                    .result;
            }
        } catch (error) {
            throw new Error(`Note Tweet failed: ${error}`);
        }
    }

    async sendStandardTweet(
        client: ClientBase,
        content: string,
        tweetId?: string
    ) {
        try {
            const standardTweetResult = await client.requestQueue.add(
                async () =>
                    await client.twitterClient.sendTweet(content, tweetId)
            );
            const body = await standardTweetResult.json();
            if (!body?.data?.create_tweet?.tweet_results?.result) {
                console.error("Error sending tweet; Bad response:", body);
                return;
            }
            return body.data.create_tweet.tweet_results.result;
        } catch (error) {
            elizaLogger.error("Error sending standard Tweet:", error);
            throw error;
        }
    }

    async postTweet(
        runtime: IAgentRuntime,
        client: ClientBase,
        cleanedContent: string,
        roomId: UUID,
        newTweetContent: string,
        twitterUsername: string
    ) {
        try {
            elizaLogger.log(`Posting new tweet:\n`);

            let result;

            if (cleanedContent.length > DEFAULT_MAX_TWEET_LENGTH) {
                result = await this.handleNoteTweet(client, cleanedContent);
            } else {
                result = await this.sendStandardTweet(client, cleanedContent);
            }

            const tweet = this.createTweetObject(
                result,
                client,
                twitterUsername
            );

            await this.processAndCacheTweet(
                runtime,
                client,
                tweet,
                roomId,
                newTweetContent
            );
        } catch (error) {
            elizaLogger.error("Error sending tweet:", error);
        }
    }

    /**
     * Generates and posts a new tweet. If isDryRun is true, only logs what would have been posted.
     */
    async generateNewTweet() {
        elizaLogger.log("Generating new tweet");
        const roomId = stringToUuid(
                "twitter_generate_room-" + this.client.profile.username
        );
        try {

            // Could be using a template here to generate the tweet

            const monitoredAccounts = this.runtime.getSetting("TWEET_ACCOUNTS_TO_MONITOR")?.split(",") ||
                                    ["MilliCoinSei", "pebloescobarSEI", "bandosei", "Ryuzaki_SEI", "SeiNetwork", "YakaFinance"];
                                    const maxTweets = parseInt(this.runtime.getSetting("MAX_TWEETS_PER_ACCOUNT") || "10");
            let allTweetsFromAccounts: any[] = [];
            for (const account of monitoredAccounts) {
                try {
                    elizaLogger.info(`Fetching tweets from @${account.trim()}`);

                    // Fetch real tweets from the account
                    const accountTweets = await fetchAccountTweets(this.client.twitterClient, account.trim(), maxTweets);
                    allTweetsFromAccounts = allTweetsFromAccounts.concat(accountTweets);
                } catch (error) {
                    elizaLogger.error(`Error fetching tweets from @${account}:`, error);
                }
            }

            allTweetsFromAccounts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            allTweetsFromAccounts = allTweetsFromAccounts.slice(0, 20);
            console.log("Fetched tweets from accounts--------------:", allTweetsFromAccounts);
            let summarizedContent = await summarizeContent(allTweetsFromAccounts);
            summarizedContent.replace(/\*\*/g, "");
            console.log("Summarized tweets--------------:", summarizedContent);
            const threadedTweets = summarizedContent
                .split("Tweet")
                .map(str => str.trim())
                .filter(str => str.length > 0)
                .map(item => {
                    return item.replace(/^\d+[:\s]*/, '');
                })
                .map(item => item.replace(/^\([^)]*\):?\s*/, ''));

            console.log("Threaded Tweets--------------:", threadedTweets);


            try {
                let lastTweetId = null;

                for (const tweet of threadedTweets) {
                    const newTweet = await this.client.twitterClient.sendTweet(
                        tweet,
                        lastTweetId ?? undefined,
                    );
                    const tweetData = await newTweet.json();

                    lastTweetId = tweetData?.data?.create_tweet?.tweet_results?.result?.rest_id;
                    // console.log(`Posted tweet: ${newTweet.data.id}`);
                    console.log("✅ Thread posted successfully!", lastTweetId);
                }

            } catch (err) {
                console.error("❌ Error posting thread:", err);
            }

        } catch (error) {
            elizaLogger.error("Error generating new tweet:", error);
        }
    }


    async stop() {
        this.stopProcessingActions = true;
    }

}
