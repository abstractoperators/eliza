import { registerOTel } from "@vercel/otel";

export function register() {
    try {
        console.log("Registering OpenTelemetry...");
        registerOTel("Eliza");
        console.log("OpenTelemetry registration successful");
    } catch (error) {
        console.error("Failed to register OpenTelemetry:", error);
        throw error;
    }
}