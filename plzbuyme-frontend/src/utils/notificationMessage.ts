const MESSAGE_SPLIT = '\n\n'

/** Splits API messages that append a wallet disclaimer after a blank line. */
export function splitNotificationMessage(message: string): { primary: string; disclaimer?: string } {
  const idx = message.indexOf(MESSAGE_SPLIT)
  if (idx === -1) return { primary: message }
  return {
    primary: message.slice(0, idx),
    disclaimer: message.slice(idx + MESSAGE_SPLIT.length),
  }
}
