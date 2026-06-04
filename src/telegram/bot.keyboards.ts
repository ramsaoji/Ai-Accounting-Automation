export function getMainMenuKeyboard(): Record<string, any> {
  return {
    keyboard: [
      [{ text: '📊 Sales Summary' }, { text: '👥 Debitors List' }],
      [{ text: '🏭 Godown Stock' }, { text: '🏪 Counter Stock' }],
      [{ text: '🔄 Sync Ledger' }, { text: '🩺 Service Health' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}
