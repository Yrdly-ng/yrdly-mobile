let activeConversationId: string | null = null;

export function setActiveConversationId(id: string | null): void {
  activeConversationId = id;
}

export function getActiveConversationId(): string | null {
  return activeConversationId;
}
