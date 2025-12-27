// Parses Nordlys Responses API stream events to AI SDK stream events
// This is a helper for the streaming implementation - actual event handling
// is done in the TransformStream in nordlys-chat-language-model.ts
import type {
  NordlysResponseCompletedEvent,
  NordlysResponseCreatedEvent,
  NordlysResponseFunctionCallArgumentsDeltaEvent,
  NordlysResponseFunctionToolCall,
  NordlysResponseOutputItemAddedEvent,
  NordlysResponseOutputMessage,
  NordlysResponseReasoningItem,
  NordlysResponseReasoningTextDeltaEvent,
  NordlysResponseTextDeltaEvent,
} from './nordlys-responses-types';

/**
 * State tracking for streaming
 */
export interface NordlysStreamState {
  // Text buffers by item_id
  textBuffers: Map<string, string>;
  // Reasoning buffers by item_id
  reasoningBuffers: Map<string, string>;
  // Tool call buffers by item_id
  toolCallBuffers: Map<
    string,
    {
      id: string;
      name: string;
      arguments: string;
    }
  >;
  // Track which items have started
  activeTextItems: Set<string>;
  activeReasoningItems: Set<string>;
  activeToolCalls: Set<string>;
}

/**
 * Creates initial stream state
 */
export function createStreamState(): NordlysStreamState {
  return {
    textBuffers: new Map(),
    reasoningBuffers: new Map(),
    toolCallBuffers: new Map(),
    activeTextItems: new Set(),
    activeReasoningItems: new Set(),
    activeToolCalls: new Set(),
  };
}

/**
 * Extracts response metadata from created event
 */
export function extractResponseMetadata(event: NordlysResponseCreatedEvent): {
  id: string;
  model: string;
  created: number;
} {
  return {
    id: event.response.id,
    model: event.response.model,
    created: event.response.created_at,
  };
}

/**
 * Handles output item added event
 * Returns information about what AI SDK events should be emitted
 */
export function handleOutputItemAdded(
  event: NordlysResponseOutputItemAddedEvent,
  state: NordlysStreamState
): {
  shouldEmitTextStart: boolean;
  textItemId?: string;
  shouldEmitReasoningStart: boolean;
  reasoningItemId?: string;
  shouldEmitToolInputStart: boolean;
  toolCallId?: string;
  toolName?: string;
} {
  const item = event.item;
  const result = {
    shouldEmitTextStart: false,
    textItemId: undefined as string | undefined,
    shouldEmitReasoningStart: false,
    reasoningItemId: undefined as string | undefined,
    shouldEmitToolInputStart: false,
    toolCallId: undefined as string | undefined,
    toolName: undefined as string | undefined,
  };

  switch (item.type) {
    case 'message': {
      const message = item as NordlysResponseOutputMessage;
      // Check if message has text content
      const hasText = message.content.some(
        (c) => c.type === 'output_text' || c.type === 'refusal'
      );
      if (hasText && !state.activeTextItems.has(message.id)) {
        state.activeTextItems.add(message.id);
        state.textBuffers.set(message.id, '');
        result.shouldEmitTextStart = true;
        result.textItemId = message.id;
      }
      break;
    }
    case 'reasoning': {
      const reasoning = item as NordlysResponseReasoningItem;
      if (!state.activeReasoningItems.has(reasoning.id)) {
        state.activeReasoningItems.add(reasoning.id);
        state.reasoningBuffers.set(reasoning.id, '');
        result.shouldEmitReasoningStart = true;
        result.reasoningItemId = reasoning.id;
      }
      break;
    }
    case 'function_call': {
      const toolCall = item as NordlysResponseFunctionToolCall;
      if (!state.activeToolCalls.has(toolCall.id)) {
        state.activeToolCalls.add(toolCall.id);
        state.toolCallBuffers.set(toolCall.id, {
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments || '',
        });
        result.shouldEmitToolInputStart = true;
        result.toolCallId = toolCall.id;
        result.toolName = toolCall.name;
      }
      break;
    }
  }

  return result;
}

/**
 * Handles text delta event
 * Returns the delta string and item ID
 */
export function handleTextDelta(
  event: NordlysResponseTextDeltaEvent,
  state: NordlysStreamState
): {
  delta: string;
  itemId: string;
} {
  const current = state.textBuffers.get(event.item_id) || '';
  const updated = current + event.delta;
  state.textBuffers.set(event.item_id, updated);

  return {
    delta: event.delta,
    itemId: event.item_id,
  };
}

/**
 * Handles reasoning delta event
 * Returns the delta string and item ID
 */
export function handleReasoningDelta(
  event: NordlysResponseReasoningTextDeltaEvent,
  state: NordlysStreamState
): {
  delta: string;
  itemId: string;
} {
  const current = state.reasoningBuffers.get(event.item_id) || '';
  const updated = current + event.delta;
  state.reasoningBuffers.set(event.item_id, updated);

  return {
    delta: event.delta,
    itemId: event.item_id,
  };
}

/**
 * Handles function call arguments delta event
 * Returns the delta string and tool call info
 */
export function handleFunctionCallArgumentsDelta(
  event: NordlysResponseFunctionCallArgumentsDeltaEvent,
  state: NordlysStreamState
): {
  delta: string;
  toolCallId: string;
  currentArguments: string;
} {
  const toolCall = state.toolCallBuffers.get(event.item_id);
  if (!toolCall) {
    // Tool call not initialized yet - this shouldn't happen but handle gracefully
    return {
      delta: event.delta,
      toolCallId: event.item_id,
      currentArguments: event.delta,
    };
  }

  toolCall.arguments += event.delta;
  state.toolCallBuffers.set(event.item_id, toolCall);

  return {
    delta: event.delta,
    toolCallId: event.item_id,
    currentArguments: toolCall.arguments,
  };
}

/**
 * Checks if a tool call is complete (has valid JSON arguments)
 */
export function isToolCallComplete(
  toolCallId: string,
  state: NordlysStreamState
): boolean {
  const toolCall = state.toolCallBuffers.get(toolCallId);
  if (!toolCall) {
    return false;
  }

  try {
    JSON.parse(toolCall.arguments);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets completed tool call info
 */
export function getCompletedToolCall(
  toolCallId: string,
  state: NordlysStreamState
): {
  toolCallId: string;
  toolName: string;
  input: string;
} | null {
  const toolCall = state.toolCallBuffers.get(toolCallId);
  if (!toolCall) {
    return null;
  }

  return {
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    input: toolCall.arguments,
  };
}

/**
 * Extracts usage from completed event
 */
export function extractUsageFromCompleted(
  event: NordlysResponseCompletedEvent
): {
  inputTokens: {
    total: number;
    cacheRead?: number;
    noCache?: number;
  };
  outputTokens: {
    total: number;
    reasoning?: number;
    text?: number;
  };
} {
  const usage = event.response.usage;
  if (!usage) {
    return {
      inputTokens: { total: 0 },
      outputTokens: { total: 0 },
    };
  }

  const cachedTokens = usage.input_tokens_details?.cached_tokens;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens;

  return {
    inputTokens: {
      total: usage.input_tokens,
      cacheRead: cachedTokens,
      noCache:
        cachedTokens != null ? usage.input_tokens - cachedTokens : undefined,
    },
    outputTokens: {
      total: usage.output_tokens,
      reasoning: reasoningTokens,
      text:
        reasoningTokens != null
          ? usage.output_tokens - reasoningTokens
          : undefined,
    },
  };
}
