import { Provider, IAgentRuntime, Memory, State, elizaLogger, ProviderResult } from "@elizaos/core";
import { TweetData, TwitterDataManager, ReportGenerator, DateUtils, RATE_LIMIT_DELAY } from "../utils/tweetDataUtils";
// Provider Implementation
export const tweetDataProvider: Provider = {
    name: "TWEET_DATA",
    description: "Provides comprehensive weekly Twitter summaries from configured accounts with intelligent caching",
    
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> => {
        const manager = new TwitterDataManager(runtime);
        const { start: weekStart, end: weekEnd } = DateUtils.getWeekBounds();
        
        try {
            elizaLogger.log("Tweet provider: Starting data collection process");
            
            const targetAccounts = await manager.getTargetAccounts();
            const accountsNeedingFetch: string[] = [];
            const errors: string[] = [];

            // Check which accounts need fresh data
            for (const username of targetAccounts) {
                if (await manager.needsFetch(username)) {
                    accountsNeedingFetch.push(username);
                }
            }

            elizaLogger.log(`Accounts needing fresh data: ${accountsNeedingFetch.length}/${targetAccounts.length}`);

            // Fetch fresh data if needed
            if (accountsNeedingFetch.length > 0) {
                const scraper = await manager.createScraper();
                
                for (const username of accountsNeedingFetch) {
                    try {
                        await manager.fetchAccountTweets(username, scraper, weekStart);
                        
                        // Rate limiting
                        if (accountsNeedingFetch.indexOf(username) < accountsNeedingFetch.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                        }
                    } catch (error) {
                        errors.push(`@${username}: ${error.message}`);
                        elizaLogger.error(`Error fetching @${username}:`, error);
                    }
                }
            }

            // Retrieve and process weekly data
            const weekMemories = await manager.getWeeklyMemories(weekStart, weekEnd);
            elizaLogger.log(`Retrieved ${weekMemories.length} memories for analysis`);

            // Organize tweets by account
            const tweetsByAccount = new Map<string, TweetData[]>();
            targetAccounts.forEach(username => tweetsByAccount.set(username, []));

            for (const memory of weekMemories) {
                const tweet = manager.parseTweetFromMemory(memory);
                if (tweet && tweetsByAccount.has(tweet.username)) {
                    tweetsByAccount.get(tweet.username)!.push(tweet);
                }
            }

            // Generate comprehensive report
            const report = ReportGenerator.generateWeeklyReport(
                targetAccounts,
                tweetsByAccount,
                weekStart,
                weekEnd,
                accountsNeedingFetch.filter(account => 
                    !errors.some(error => error.includes(`@${account}`))
                ),
                errors
            );

            const formattedReport = ReportGenerator.formatReport(report);

            elizaLogger.log(`Generated report: ${report.totals.tweets} tweets, ${report.totals.engagement} engagement`);

            return {
                text: formattedReport,
                values: {
                    weekStart: report.period.start,
                    weekEnd: report.period.end,
                    periodLabel: report.period.label,
                    totalTweets: report.totals.tweets,
                    totalEngagement: report.totals.engagement,
                    activeAccounts: report.totals.activeAccounts,
                    targetAccountsCount: targetAccounts.length,
                    hasData: report.totals.tweets > 0,
                    freshDataFetched: accountsNeedingFetch.length > 0,
                    errorCount: errors.length
                },
                data: {
                    report,
                    rawTweetsByAccount: Object.fromEntries(tweetsByAccount),
                    processingStats: {
                        memoriesProcessed: weekMemories.length,
                        accountsTargeted: targetAccounts.length,
                        accountsFetched: accountsNeedingFetch.length,
                        errors
                    }
                }
            };

        } catch (error) {
            elizaLogger.error("Critical error in tweet provider:", error);
            
            return {
                text: `Unable to generate tweet newsletter: ${error.message}. Please check Twitter credentials and network connectivity.`,
                values: {
                    hasError: true,
                    errorMessage: error.message,
                    errorTimestamp: Date.now()
                },
                data: {
                    error: {
                        message: error.message,
                        stack: error.stack,
                        timestamp: Date.now()
                    }
                }
            };
        }
    }
};