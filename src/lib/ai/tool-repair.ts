import { generateText, InvalidToolInputError, type ToolCallRepairFunction } from 'ai';
import type { AiModelSelection } from './provider';
import type { createTarotTools } from './tools';

export function createAskUserRepair(selection: AiModelSelection): ToolCallRepairFunction<ReturnType<typeof createTarotTools>> {
  return async ({ toolCall, tools, messages, instructions, error }) => {
    if (toolCall.toolName !== 'ask_user' || !InvalidToolInputError.isInstance(error)) return null;

    // One re-ask, with no execution or recursive repair. Keep the original
    // conversation/language and let SDK validation reject another bad attempt.
    try {
      const result = await generateText({
        ...selection,
        instructions,
        messages: [
          ...messages,
          {
            role: 'user',
            content: 'Your ask_user call failed input validation. Return the corrected batch in the user\'s language. ' +
              'Each question must have 2–5 non-empty plain string options, for example ["Workload", "Team relationships"]. ' +
              'Do not wrap options in objects or use empty placeholders. Preserve the intended questions.\n' +
              `Previous invalid arguments: ${toolCall.input}`,
          },
        ],
        tools: {
          ask_user: { description: tools.ask_user.description, inputSchema: tools.ask_user.inputSchema },
        },
        toolChoice: { type: 'tool', toolName: 'ask_user' },
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(15_000),
      });
      const repaired = result.toolCalls.find((call) => call.toolName === 'ask_user' && !call.invalid);
      return repaired ? { ...toolCall, input: JSON.stringify(repaired.input) } : null;
    } catch {
      return null;
    }
  };
}
