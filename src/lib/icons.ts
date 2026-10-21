import type { AccountType } from './types'

const EMOJI: Record<string, string> = {
  'shopping-cart': '🛒',
  utensils: '🍽️',
  bus: '🚌',
  home: '🏠',
  'heart-pulse': '💊',
  'gamepad-2': '🎮',
  shirt: '👕',
  wifi: '📶',
  repeat: '🔁',
  gift: '🎁',
  'graduation-cap': '🎓',
  ellipsis: '✨',
  banknote: '💵',
  briefcase: '💼',
}

export function categoryEmoji(icon: string | null | undefined): string {
  return (icon && EMOJI[icon]) || '🏷️'
}

export const ACCOUNT_TYPES: { value: AccountType; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Наличные', emoji: '💵' },
  { value: 'card', label: 'Карта', emoji: '💳' },
  { value: 'savings', label: 'Накопления', emoji: '🏦' },
  { value: 'crypto', label: 'Крипто', emoji: '🪙' },
]

export function accountEmoji(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.emoji ?? '💳'
}
