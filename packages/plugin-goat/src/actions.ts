import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { USDC, erc20, Token } from "@goat-sdk/plugin-erc20";
import { WalletClientBase } from "@goat-sdk/core";
import { sendETH } from "@goat-sdk/wallet-evm";

import {
    generateText,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
} from "@elizaos/core";

// https://explorer.bitquery.io/ethereum/token/0xdac17f958d2ee523a2206206994597c13d831ec7
// Contract address for USDT on Ethereum
const USDT: Token = {
    decimals: 6,
    symbol: "USDT",
    name: "Tether USD",
    chains: {
        1: {
            contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        },
    },
};

export async function getOnChainActions(wallet: WalletClientBase) {
    const actionsWithoutHandler = [
        // 1. Add your actions here
        {
            name: "GET_BALANCE",
            description: "Get the balance of a token",
            similes: [],
            validate: async () => true,
            examples: [],
        },
        {
            name: "TRANSFER",
            description: "Transfer tokens or ethereum to a provided address",
            similes: [],
            validate: async () => true, 
            examples: [],
        }
    ];

    const tools = await getOnChainTools({
        wallet: wallet,
        // 2. Configure the plugins you need to perform those actions
        plugins: [sendETH(), erc20({ tokens: [USDC, USDT] })],

    });

    
    // 3. Let GOAT handle all the actions
    return actionsWithoutHandler.map((action) => ({
        ...action,
        handler: getActionHandler(action.name, action.description, tools),
    }));
}

function getActionHandler(
    actionName: string,
    actionDescription: string,
    tools
) {
    return async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options?: Record<string, unknown>,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        let currentState = state ?? (await runtime.composeState(message));
        currentState = await runtime.updateRecentMessageState(currentState);

        try {
            // 1. Call the tools needed
            const context = composeActionContext(
                actionName,
                actionDescription,
                currentState
            );
            const result = await generateText({
                runtime,
                context,
                tools,
                maxSteps: 10,
                // Uncomment to see the log each tool call when debugging
                onStepFinish: (step) => {
                    console.log(step.toolResults);
                },
                modelClass: ModelClass.LARGE,
            });

            // 2. Compose the response
            const response = composeResponseContext(result, currentState);
            const responseText = await generateResponse(runtime, response);

            callback?.({
                text: responseText,
                content: {},
            });
            return true;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            // 3. Compose the error response
            const errorResponse = composeErrorResponseContext(
                errorMessage,
                currentState
            );
            const errorResponseText = await generateResponse(
                runtime,
                errorResponse
            );

            callback?.({
                text: errorResponseText,
                content: { error: errorMessage },
            });
            return false;
        }
    };
}

function composeActionContext(
    actionName: string,
    actionDescription: string,
    state: State
): string {
    const actionTemplate = `
# Knowledge
{{knowledge}}

About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}


# Action: ${actionName}
${actionDescription}

{{recentMessages}}

Based on the action chosen and the previous messages, execute the action and respond to the user using the tools you were given.
`;
    return composeContext({ state, template: actionTemplate });
}

function composeResponseContext(result: unknown, state: State): string {
    const responseTemplate = `
    # Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

Here is the result:
${JSON.stringify(result)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
  `;
    return composeContext({ state, template: responseTemplate });
}

function composeErrorResponseContext(
    errorMessage: string,
    state: State
): string {
    const errorResponseTemplate = `
# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{actions}}

Respond to the message knowing that the action failed.
The error was:
${errorMessage}

These were the previous messages:
{{recentMessages}}
    `;
    return composeContext({ state, template: errorResponseTemplate });
}

async function generateResponse(
    runtime: IAgentRuntime,
    context: string
): Promise<string> {
    return generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });
}
