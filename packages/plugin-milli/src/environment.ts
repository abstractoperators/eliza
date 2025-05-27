import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const twitterEnvSchema = z.object({
    TWITTER_USERNAME: z.string().min(1, "Twitter Username is required"),
    TWITTER_PASSWORD: z.string().min(1, "Twitter Password is required"),
    TWITTER_EMAIL: z.string().min(1, "Twitter Email is required"),
});

export type twitterConfig = z.infer<typeof twitterEnvSchema>;

export async function validateTwitterConfig(
    runtime: IAgentRuntime
): Promise<twitterConfig> {
    try {
        const config = {
            TWITTER_USERNAME: runtime.getSetting("TWITTER_USERNAME"),
            TWITTER_PASSWORD: runtime.getSetting("TWITTER_PASSWORD"),
            TWITTER_EMAIL: runtime.getSetting("TWITTER_EMAIL"),
        };
        console.log('config: ', config)
        return twitterEnvSchema.parse(config);
    } catch (error) {
        console.log("error::::", error)
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Twitter configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}