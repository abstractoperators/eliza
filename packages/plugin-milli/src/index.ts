export * from "./actions/summarizeTweets";
export * from "./actions/analyzeSentiment";
export * from "./providers/tweetRetrievalProvider";
export * from "./providers/communityStatsProvider";
export * from "./services/tweetMonitoringService";
export * from "./types";

import type { Plugin } from "@elizaos/core";
import { summarizeTweetsAction } from "./actions/summarizeTweets";
import { analyzeSentimentAction } from "./actions/analyzeSentiment";
import { tweetRetrievalProvider } from "./providers/tweetRetrievalProvider";
import { communityStatsProvider } from "./providers/communityStatsProvider";
import { tweetDataProvider } from "./providers/tweetDataProvider";
//import { TweetMonitoringService } from "./services/tweetMonitoringService";
import { tweetDataEvaluator } from "./evaluators/tweetDataEvaluator";

export const milliPlugin: Plugin = {
    name: "milli",
    description: "Community sentiment tracking and tweet analysis for crypto ecosystems",
    actions: [],
    providers: [tweetDataProvider],
    evaluators: [tweetDataEvaluator]
};

export default milliPlugin;