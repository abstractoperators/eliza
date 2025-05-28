import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase } from "./base.ts";
import { validateTwitterConfig, TwitterConfig } from "./environment.ts";
import { TwitterPostClient } from "./post.ts";


/**
 * A manager that orchestrates all specialized Twitter logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing Twitter Spaces (optional)
 */
class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;

    constructor(runtime: IAgentRuntime, twitterConfig: TwitterConfig) {
        // Pass twitterConfig to the base client
        this.client = new ClientBase(runtime, twitterConfig);

        // Posting logic
        this.post = new TwitterPostClient(this.client, runtime);
    }
}

export const TwitterMilliClientInterface: Client = {
    async start(runtime: IAgentRuntime) {
        const twitterConfig: TwitterConfig =
            await validateTwitterConfig(runtime);

        elizaLogger.log("Twitter milli client started");

        const manager = new TwitterManager(runtime, twitterConfig);

        // Initialize login/session
        await manager.client.init();

        // Start the posting loop
        await manager.post.start();

        return manager;
    },

    async stop(_runtime: IAgentRuntime) {
        elizaLogger.warn("Twitter client does not support stopping yet");
    },
};

export default TwitterMilliClientInterface;
