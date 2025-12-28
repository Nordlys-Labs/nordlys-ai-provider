// Parses Nordlys Responses API stream events to AI SDK stream events
// This is a helper for the streaming implementation - actual event handling
// is done in the TransformStream in nordlys-chat-language-model.ts
import type {
  NordlysResponseContentPartAddedEvent,
  NordlysResponseContentPartDoneEvent,
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
      // Always emit text-start for message items (like OpenAI)
      // This ensures text-start is emitted even if message arrives with empty content
      if (!state.activeTextItems.has(message.id)) {
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
      const toolCallId = toolCall.call_id;
      // Buffer is keyed by item.id (what delta events use via item_id)
      // but we track toolCallId (call_id) separately for event emission
      const itemId = toolCall.id ?? toolCall.call_id;
      if (!state.activeToolCalls.has(toolCallId)) {
        state.activeToolCalls.add(toolCallId);
        state.toolCallBuffers.set(itemId, {
          id: toolCallId,
          name: toolCall.name,
          arguments: toolCall.arguments || '',
        });
        result.shouldEmitToolInputStart = true;
        result.toolCallId = toolCallId;
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
 * Returns the delta string
 */
export function handleFunctionCallArgumentsDelta(
  event: NordlysResponseFunctionCallArgumentsDeltaEvent,
  state: NordlysStreamState
): {
  delta: string;
} {
  const toolCall = state.toolCallBuffers.get(event.item_id);
  if (toolCall) {
    // Mutate in place - Map stores references, so no need to set() again
    toolCall.arguments += event.delta;
  }

  return {
    delta: event.delta,
  };
}

/**
 * Handles content part added event
 * Returns information about what AI SDK events should be emitted
 */
export function handleContentPartAdded(
  event: NordlysResponseContentPartAddedEvent,
  state: NordlysStreamState
): {
  shouldEmitTextStart: boolean;
  shouldEmitTextDelta: boolean;
  textDelta?: string;
  itemId?: string;
  shouldEmitReasoningDelta: boolean;
  reasoningDelta?: string;
  reasoningItemId?: string;
} {
  const result = {
    shouldEmitTextStart: false,
    shouldEmitTextDelta: false,
    textDelta: undefined as string | undefined,
    itemId: undefined as string | undefined,
    shouldEmitReasoningDelta: false,
    reasoningDelta: undefined as string | undefined,
    reasoningItemId: undefined as string | undefined,
  };

  // Safely check if part exists
  if (!event.part) {
    return result;
  }

  const part = event.part;
  const itemId = event.item_id;

  switch (part.type) {
    case 'output_text': {
      // Ensure text item is active
      // If not active, emit text-start first (defensive check for race conditions)
      const wasNotActive = !state.activeTextItems.has(itemId);
      if (wasNotActive) {
        state.activeTextItems.add(itemId);
        state.textBuffers.set(itemId, '');
        result.shouldEmitTextStart = true;
      }

      // Update buffer and emit delta
      const current = state.textBuffers.get(itemId) || '';
      const updated = current + part.text;
      state.textBuffers.set(itemId, updated);

      result.shouldEmitTextDelta = true;
      result.textDelta = part.text;
      result.itemId = itemId;
      break;
    }
    case 'reasoning_text': {
      // Ensure reasoning item is active
      if (!state.activeReasoningItems.has(itemId)) {
        state.activeReasoningItems.add(itemId);
        state.reasoningBuffers.set(itemId, '');
      }

      // Update buffer and emit delta
      const current = state.reasoningBuffers.get(itemId) || '';
      const updated = current + part.text;
      state.reasoningBuffers.set(itemId, updated);

      result.shouldEmitReasoningDelta = true;
      result.reasoningDelta = part.text;
      result.reasoningItemId = itemId;
      break;
    }
    case 'refusal': {
      // Handle refusal as text content
      // Ensure text item is active
      // If not active, emit text-start first (defensive check for race conditions)
      const wasNotActive = !state.activeTextItems.has(itemId);
      if (wasNotActive) {
        state.activeTextItems.add(itemId);
        state.textBuffers.set(itemId, '');
        result.shouldEmitTextStart = true;
      }

      // Update buffer and emit delta
      const current = state.textBuffers.get(itemId) || '';
      const updated = current + part.refusal;
      state.textBuffers.set(itemId, updated);

      result.shouldEmitTextDelta = true;
      result.textDelta = part.refusal;
      result.itemId = itemId;
      break;
    }
  }

  return result;
}

/**
 * Handles content part done event
 * Returns information about what AI SDK events should be emitted
 */
export function handleContentPartDone(
  event: NordlysResponseContentPartDoneEvent,
  state: NordlysStreamState
): {
  shouldEmitTextEnd: boolean;
  itemId?: string;
  shouldEmitReasoningEnd: boolean;
  reasoningItemId?: string;
} {
  const result = {
    shouldEmitTextEnd: false,
    itemId: undefined as string | undefined,
    shouldEmitReasoningEnd: false,
    reasoningItemId: undefined as string | undefined,
  };

  // Safely check if part exists
  if (!event.part) {
    return result;
  }

  const part = event.part;
  const itemId = event.item_id;

  switch (part.type) {
    case 'output_text': {
      // Update buffer with final text if needed
      if (part.text) {
        const current = state.textBuffers.get(itemId) || '';
        const updated = current + part.text;
        state.textBuffers.set(itemId, updated);
      }

      // Don't emit text-end here - it should be emitted by output_item.done
      // We just update the buffer and let output_item.done handle the text-end emission
      break;
    }
    case 'reasoning_text': {
      // Update buffer with final text if needed
      if (part.text) {
        const current = state.reasoningBuffers.get(itemId) || '';
        const updated = current + part.text;
        state.reasoningBuffers.set(itemId, updated);
      }

      // Mark reasoning item as done
      if (state.activeReasoningItems.has(itemId)) {
        result.shouldEmitReasoningEnd = true;
        result.reasoningItemId = itemId;
      }
      break;
    }
    case 'refusal': {
      // Handle refusal as text content
      if (part.refusal) {
        const current = state.textBuffers.get(itemId) || '';
        const updated = current + part.refusal;
        state.textBuffers.set(itemId, updated);
      }

      // Don't emit text-end here - it should be emitted by output_item.done
      // We just update the buffer and let output_item.done handle the text-end emission
      break;
    }
  }

  return result;
}
