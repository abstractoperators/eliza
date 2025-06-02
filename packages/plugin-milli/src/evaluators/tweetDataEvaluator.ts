import { 
    Evaluator, 
    IAgentRuntime, 
    Memory, 
    State, 
    elizaLogger,
    ActionExample
} from "@elizaos/core";

import {
    TwitterDataManager,
    DateUtils
} from "../utils/tweetDataUtils";

// Evaluator Implementation
export const tweetDataEvaluator: Evaluator = {
    name: "TWEET_DATA_EVALUATOR",
    similes: [
        "ASSESS_TWITTER_CACHE",
        "CHECK_NEWSLETTER_DATA",
        "VALIDATE_SOCIAL_CONTENT",
        "REVIEW_TWEET_STATUS",
        "EXAMINE_WEEKLY_DATA"
    ],
    description: "Intelligently evaluates Twitter data completeness and determines when fresh collection is needed",
    
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const manager = new TwitterDataManager(runtime);
            const targetAccounts = await manager.getTargetAccounts();
            
            if (targetAccounts.length === 0) {
                elizaLogger.warn("No Twitter accounts configured for evaluation");
                return false;
            }

            // Check message context for newsletter relevance
            const messageText = (message.content.text || '').toLowerCase();
            const newsletterKeywords = [
                'newsletter', 'tweets', 'twitter', 'social', 'weekly',
                'summary', 'content', 'update', 'report', 'digest'
            ];
            
            const isNewsletterContext = newsletterKeywords.some(keyword => 
                messageText.includes(keyword)
            );

            // Check data freshness
            let accountsNeedingFresh = 0;
            for (const username of targetAccounts) {
                if (await manager.needsFetch(username)) {
                    accountsNeedingFresh++;
                }
            }

            // Check data completeness efficiently
            const dataAssessment = await manager.assessDataCompleteness(targetAccounts);

            // Validate if:
            // 1. Message explicitly mentions newsletter topics, OR
            // 2. Multiple accounts need fresh data, OR
            // 3. We lack minimal weekly data
            const shouldValidate = isNewsletterContext || 
                                 accountsNeedingFresh >= Math.ceil(targetAccounts.length / 2) || 
                                 !dataAssessment.hasMinimalData;

            elizaLogger.log(
                `Tweet evaluator: newsletter_context=${isNewsletterContext}, ` +
                `fresh_needed=${accountsNeedingFresh}/${targetAccounts.length}, ` +
                `has_data=${dataAssessment.hasMinimalData}, validate=${shouldValidate}`
            );

            return shouldValidate;

        } catch (error) {
            elizaLogger.error("Tweet evaluator validation error:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> => {
        try {
            const manager = new TwitterDataManager(runtime);
            const targetAccounts = await manager.getTargetAccounts();
            const { start: weekStart, end: weekEnd } = DateUtils.getWeekBounds();

            elizaLogger.log("Tweet evaluator: Performing comprehensive data assessment");

            // Assess cache status for each account
            const cacheStatus: Record<string, { 
                needsFetch: boolean; 
                lastFetchKey: string;
            }> = {};

            for (const username of targetAccounts) {
                const needsFetch = await manager.needsFetch(username);
                cacheStatus[username] = {
                    needsFetch,
                    lastFetchKey: DateUtils.getTodayCacheKey(username)
                };
            }

            // Get data completeness assessment
            const dataAssessment = await manager.assessDataCompleteness(targetAccounts);

            // Build comprehensive assessment
            const assessment = {
                timestamp: Date.now(),
                period: {
                    start: weekStart,
                    end: weekEnd,
                    label: DateUtils.formatDateRange(weekStart, weekEnd)
                },
                accounts: {
                    total: targetAccounts.length,
                    needingFresh: Object.values(cacheStatus).filter(status => status.needsFetch).length,
                    withData: dataAssessment.accountsWithData
                },
                dataQuality: {
                    hasMinimalData: dataAssessment.hasMinimalData,
                    estimatedTweets: dataAssessment.estimatedTweetCount,
                    averageTweetsPerAccount: dataAssessment.estimatedTweetCount / Math.max(targetAccounts.length, 1)
                },
                recommendations: {
                    fetchRequired: Object.values(cacheStatus).some(status => status.needsFetch),
                    dataQualityGood: dataAssessment.hasMinimalData,
                    freshDataAvailable: Object.values(cacheStatus).filter(status => status.needsFetch).length < targetAccounts.length / 2
                },
                details: {
                    cacheStatus,
                    dataAssessment
                }
            };

            // Log comprehensive assessment
            elizaLogger.log("=== Tweet Data Assessment ===");
            elizaLogger.log(`Period: ${assessment.period.label}`);
            elizaLogger.log(`Accounts: ${assessment.accounts.withData}/${assessment.accounts.total} have data`);
            elizaLogger.log(`Fresh data needed: ${assessment.accounts.needingFresh} accounts`);
            elizaLogger.log(`Data quality: ~${assessment.dataQuality.estimatedTweets} tweets, avg ${assessment.dataQuality.averageTweetsPerAccount.toFixed(1)} per account`);
            elizaLogger.log(`Recommendations: fetch=${assessment.recommendations.fetchRequired}, quality=${assessment.recommendations.dataQualityGood}`);

            return assessment;

        } catch (error) {
            elizaLogger.error("Tweet evaluator handler error:", error);
            return {
                error: error.message,
                timestamp: Date.now()
            };
        }
    },

    examples: [
        {
            context: "User requests weekly newsletter with fresh Twitter data",
            messages: [
                {
                    user: "user",
                    content: { text: "Generate this week's Twitter newsletter with the latest updates" }
                } as ActionExample
            ],
            outcome: "Evaluator validates true due to newsletter context and assesses data freshness requirements"
        },
        {
            context: "System performs daily data quality check",
            messages: [
                {
                    user: "system",
                    content: { text: "Daily Twitter data status assessment" }
                } as ActionExample
            ],
            outcome: "Evaluator validates based on cache status and data completeness, not message content"
        },
        {
            context: "General conversation unrelated to newsletters",
            messages: [
                {
                    user: "user",
                    content: { text: "How's the weather today?" }
                } as ActionExample
            ],
            outcome: "Evaluator validates false unless significant data gaps exist"
        }
    ]
};