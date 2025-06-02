export interface TweetSummary {
    account: string;
    tweetCount: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    keyTopics: string[];
    timestamp: Date;
}

export interface CommunityStats {
    totalTweets: number;
    sentimentScore: number;
    trendingTopics: string[];
    influencerActivity: string[];
}

// Core interfaces (Provider)
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