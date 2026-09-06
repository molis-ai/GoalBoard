/** The selected top-level Board always wins over a nested model payload. */
export function mcpBoardPayload<T>(input: Record<string, unknown>): T {
  return { ...(input.payload as Record<string, unknown>), board_id: String(input.board_id) } as T;
}
