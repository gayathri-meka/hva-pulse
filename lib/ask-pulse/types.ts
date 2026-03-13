/** Message shape the browser sends up in the request body. */
export interface UIMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Shape of a tool call returned by the LLM. */
export interface LLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON-encoded
  }
}
