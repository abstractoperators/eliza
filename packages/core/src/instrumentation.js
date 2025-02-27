import { registerOTel } from "@vercel/otel";
import { diag, DiagLogLevel, DiagConsoleLogger } from '@opentelemetry/api';

export function register() {
    // Load environment variables
    
    // Enable OpenTelemetry debug logging
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    
    try {
        console.log("Registering OpenTelemetry...");
        registerOTel("test-braintrust2");
        console.log("OpenTelemetry registration successful");
    } catch (error) {
        console.error("Failed to register OpenTelemetry:", error);
        throw error;
    }
}