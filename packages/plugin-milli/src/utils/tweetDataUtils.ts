import { 
    IAgentRuntime, 
    Memory, 
    elizaLogger,
    stringToUuid
} from "@elizaos/core";

import { Scraper } from "agent-twitter-client";

// Core interfaces
export interface TweetData {
    id: string;
    text: string;
    author: string;
    username: string;
    timestamp: number;
    url: string;
    engagement: {
        likes: number;
        retweets: number;
        replies: number;
        total: number;
    };
}

export interface AccountSummary {
    username: string;
    tweetCount: number;
    topTweets: TweetData[];
    totalEngagement: number;
    lastFetchTime?: number;
}

export interface WeeklyReport {
    period: {
        start: number;
        end: number;
        label: string;
    };
    accounts: AccountSummary[];
    totals: {
        tweets: number;
        engagement: number;
        activeAccounts: number;
    };
    metadata: {
        fetchedToday: string[];
        missingAccounts: string[];
        errors: string[];
    };
}

// Constants
export const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
export const TWEETS_PER_ACCOUNT = 15;
export const TOP_TWEETS_COUNT = 3;
export const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
export const MEMORY_TABLE = "newsletter_tweets";

// Utility functions
export class DateUtils {
    static getWeekBounds(date: Date = new Date()): { start: number; end: number } {
        const now = new Date(date);
        const dayOfWeek = now.getDay();
        
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        return {
            start: weekStart.getTime(),
            end: weekEnd.getTime()
        };
    }

    static formatDateRange(start: number, end: number): string {
        const startDate = new Date(start).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric' 
        });
        const endDate = new Date(end).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
        });
        return `${startDate} - ${endDate}`;
    }

    static getTodayCacheKey(username: string): string {
        const today = new Date().toISOString().split('T')[0];
        return `tweet_fetch_${username}_${today}`;
    }
}

export class TwitterDataManager {
    private runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async getTargetAccounts(): Promise<string[]> {
        const accounts = this.runtime.getSetting("TWITTER_TARGET_ACCOUNTS");
        if (accounts && typeof accounts === 'string') {
            return accounts
                .split(",")
                .map(account => account.trim().toLowerCase())
                .filter(account => account.length > 0);
        }
        
        // Fallback to character settings or defaults
        const characterTargets = this.runtime.character.settings?.twitterTargets;
        if (Array.isArray(characterTargets)) {
            return characterTargets.map(account => account.toLowerCase());
        }
        
        return ["elonmusk", "naval", "sama"];
    }

    async needsFetch(username: string): Promise<boolean> {
        const cacheKey = DateUtils.getTodayCacheKey(username);
        const lastFetch = await this.runtime.cacheManager.get<string>(cacheKey);
        return !lastFetch;
    }

    async markFetched(username: string): Promise<void> {
        const cacheKey = DateUtils.getTodayCacheKey(username);
        await this.runtime.cacheManager.set(cacheKey, new Date().toISOString());
    }

    async createScraper(): Promise<Scraper> {
        const scraper = new Scraper();
        
        try {
            const credentials = {
                username: this.runtime.getSetting("TWITTER_USERNAME"),
                password: this.runtime.getSetting("TWITTER_PASSWORD"),
                email: this.runtime.getSetting("TWITTER_EMAIL")
            };

            if (credentials.username && credentials.password) {
                elizaLogger.log("Authenticating Twitter scraper");
                await scraper.login(credentials.username, credentials.password, credentials.email);
                elizaLogger.log("Twitter authentication successful");
            } else {
                const cookiesJson = this.runtime.getSetting("TWITTER_COOKIES");
                if (cookiesJson) {
                    const cookies = JSON.parse(cookiesJson);
                    await scraper.setCookies(cookies);
                    elizaLogger.log("Twitter scraper loaded with cookies");
                }
            }
        } catch (error) {
            elizaLogger.warn(`Twitter authentication failed: ${error.message}`);
        }
        
        return scraper;
    }

    convertTweetData(tweet: any, username: string): TweetData {
        const likes = tweet.likes || 0;
        const retweets = tweet.retweets || 0;
        const replies = tweet.replies || 0;

        return {
            id: tweet.id || stringToUuid(`${username}-${Date.now()}`),
            text: tweet.text || '',
            author: tweet.name || username,
            username: tweet.username || username,
            timestamp: tweet.timestamp || Date.now(),
            url: tweet.permanentUrl || `https://twitter.com/${username}/status/${tweet.id}`,
            engagement: {
                likes,
                retweets,
                replies,
                total: likes + retweets + replies
            }
        };
    }

    async storeTweet(tweetData: TweetData): Promise<void> {
        const memory: Memory = {
            id: stringToUuid(`tweet_${tweetData.id}_${tweetData.username}`),
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            content: {
                text: tweetData.text,
                source: "twitter_fetch",
                url: tweetData.url,
                metadata: {
                    username: tweetData.username,
                    author: tweetData.author,
                    tweet_id: tweetData.id,
                    likes: tweetData.engagement.likes.toString(),
                    retweets: tweetData.engagement.retweets.toString(),
                    replies: tweetData.engagement.replies.toString(),
                    total_engagement: tweetData.engagement.total.toString(),
                    fetch_timestamp: Date.now().toString()
                }
            },
            createdAt: tweetData.timestamp
        };

        // Store the memory directly - embeddings will be handled by the database adapter if needed
        await this.runtime.databaseAdapter.createMemory(memory, MEMORY_TABLE, true);
    }

    async fetchAccountTweets(username: string, scraper: Scraper, weekStart: number): Promise<TweetData[]> {
        const tweets: TweetData[] = [];
        
        try {
            elizaLogger.log(`Fetching tweets for @${username}`);
            const tweetIterator = scraper.getTweets(username, TWEETS_PER_ACCOUNT);
            
            for await (const tweet of tweetIterator) {
                if (tweet.timestamp && tweet.timestamp >= weekStart) {
                    const tweetData = this.convertTweetData(tweet, username);
                    tweets.push(tweetData);
                    await this.storeTweet(tweetData);
                }
                
                if (tweets.length >= TWEETS_PER_ACCOUNT) break;
            }
            
            elizaLogger.log(`Stored ${tweets.length} tweets for @${username}`);
            await this.markFetched(username);
            
        } catch (error) {
            elizaLogger.error(`Failed to fetch tweets for @${username}: ${error.message}`);
            throw error;
        }
        
        return tweets;
    }

    parseTweetFromMemory(memory: Memory): TweetData | null {
        try {
            const { content } = memory;
            const metadata = content.metadata || {};
            
            return {
                id: metadata.tweet_id || memory.id?.slice(-10) || 'unknown',
                text: content.text || '',
                author: metadata.author || 'unknown',
                username: metadata.username || 'unknown',
                timestamp: memory.createdAt || Date.now(),
                url: content.url || '',
                engagement: {
                    likes: parseInt(metadata.likes || '0'),
                    retweets: parseInt(metadata.retweets || '0'),
                    replies: parseInt(metadata.replies || '0'),
                    total: parseInt(metadata.total_engagement || '0')
                }
            };
        } catch (error) {
            elizaLogger.error("Error parsing tweet from memory:", error);
            return null;
        }
    }

    async getWeeklyMemories(weekStart: number, weekEnd: number): Promise<Memory[]> {
        return await this.runtime.databaseAdapter.getMemories({
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            tableName: MEMORY_TABLE,
            count: 1000,
            start: weekStart,
            end: weekEnd
        });
    }

    // Helper method to count memories by fetching and counting locally
    async countWeeklyMemories(weekStart: number, weekEnd: number): Promise<number> {
        try {
            // Get memories in smaller batches to count them
            const memories = await this.runtime.databaseAdapter.getMemories({
                entityId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                roomId: this.runtime.agentId,
                tableName: MEMORY_TABLE,
                count: 100, // Small batch to just get a count estimate
                start: weekStart,
                end: weekEnd
            });
            
            return memories.length;
        } catch (error) {
            elizaLogger.error("Error counting weekly memories:", error);
            return 0;
        }
    }

    // Helper to assess data completeness without expensive counting
    async assessDataCompleteness(targetAccounts: string[]): Promise<{
        hasMinimalData: boolean;
        estimatedTweetCount: number;
        accountsWithData: number;
    }> {
        try {
            const { start: weekStart, end: weekEnd } = DateUtils.getWeekBounds();
            
            // Get a sample of recent memories to assess data quality
            const sampleMemories = await this.runtime.databaseAdapter.getMemories({
                entityId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                roomId: this.runtime.agentId,
                tableName: MEMORY_TABLE,
                count: 50, // Sample size
                start: weekStart,
                end: weekEnd
            });

            // Count unique accounts in sample
            const accountsInSample = new Set();
            for (const memory of sampleMemories) {
                const username = memory.content.metadata?.username;
                if (username && targetAccounts.includes(username.toLowerCase())) {
                    accountsInSample.add(username.toLowerCase());
                }
            }

            const accountsWithData = accountsInSample.size;
            const estimatedTweetCount = sampleMemories.length;
            
            // Consider data adequate if we have at least half the target accounts with data
            const hasMinimalData = accountsWithData >= Math.ceil(targetAccounts.length / 2) && 
                                  estimatedTweetCount >= targetAccounts.length;

            return {
                hasMinimalData,
                estimatedTweetCount,
                accountsWithData
            };
        } catch (error) {
            elizaLogger.error("Error assessing data completeness:", error);
            return {
                hasMinimalData: false,
                estimatedTweetCount: 0,
                accountsWithData: 0
            };
        }
    }
}

export class ReportGenerator {
    static generateWeeklyReport(
        targetAccounts: string[],
        tweetsByAccount: Map<string, TweetData[]>,
        weekStart: number,
        weekEnd: number,
        fetchedToday: string[],
        errors: string[]
    ): WeeklyReport {
        const accounts: AccountSummary[] = [];
        let totalTweets = 0;
        let totalEngagement = 0;

        for (const [username, tweets] of tweetsByAccount.entries()) {
            if (tweets.length === 0) continue;

            const sortedTweets = [...tweets].sort((a, b) => 
                b.engagement.total - a.engagement.total
            );

            const accountEngagement = tweets.reduce((sum, tweet) => 
                sum + tweet.engagement.total, 0
            );

            accounts.push({
                username,
                tweetCount: tweets.length,
                topTweets: sortedTweets.slice(0, TOP_TWEETS_COUNT),
                totalEngagement: accountEngagement
            });

            totalTweets += tweets.length;
            totalEngagement += accountEngagement;
        }

        accounts.sort((a, b) => b.totalEngagement - a.totalEngagement);

        const accountsWithData = accounts.map(a => a.username);
        const missingAccounts = targetAccounts.filter(account => 
            !accountsWithData.includes(account)
        );

        return {
            period: {
                start: weekStart,
                end: weekEnd,
                label: DateUtils.formatDateRange(weekStart, weekEnd)
            },
            accounts,
            totals: {
                tweets: totalTweets,
                engagement: totalEngagement,
                activeAccounts: accounts.length
            },
            metadata: {
                fetchedToday,
                missingAccounts,
                errors
            }
        };
    }

    static formatReport(report: WeeklyReport): string {
        let output = `# Weekly Twitter Newsletter\n\n`;
        output += `**Period:** ${report.period.label}\n`;
        output += `**Summary:** ${report.totals.tweets} tweets from ${report.totals.activeAccounts} accounts\n`;
        output += `**Total Engagement:** ${report.totals.engagement.toLocaleString()} interactions\n\n`;

        if (report.accounts.length === 0) {
            output += `❌ **No Data Available**\n`;
            output += `No tweets were found for the current week. This could be due to:\n`;
            output += `- Accounts haven't tweeted recently\n`;
            output += `- Authentication issues\n`;
            output += `- Private/suspended accounts\n\n`;
            return output;
        }

        for (const account of report.accounts) {
            output += `## @${account.username}\n`;
            output += `**${account.tweetCount} tweets** • `;
            output += `**${account.totalEngagement.toLocaleString()} engagement**\n\n`;
            
            if (account.topTweets.length > 0) {
                output += `**Top Performing Tweets:**\n`;
                account.topTweets.forEach((tweet, idx) => {
                    const date = new Date(tweet.timestamp).toLocaleDateString();
                    const engagement = tweet.engagement.total.toLocaleString();
                    output += `${idx + 1}. "${tweet.text.slice(0, 100)}${tweet.text.length > 100 ? '...' : ''}"\n`;
                    output += `   📊 ${engagement} total engagement • 📅 ${date}\n\n`;
                });
            }
        }

        if (report.metadata.missingAccounts.length > 0) {
            output += `⚠️ **Missing Data:** @${report.metadata.missingAccounts.join(', @')}\n\n`;
        }

        if (report.metadata.errors.length > 0) {
            output += `🔧 **Issues:** ${report.metadata.errors.length} accounts had fetch errors\n\n`;
        }

        output += `---\n`;
        output += `*Last updated: ${new Date().toLocaleString()}*\n`;
        output += `*Fresh data: @${report.metadata.fetchedToday.join(', @')}*`;

        return output;
    }
}