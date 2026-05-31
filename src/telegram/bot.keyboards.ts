export function getMainMenuKeyboard(): Record<string, any> {
  return {
    keyboard: [
      [{ text: '📊 Sales Summary' }, { text: '👥 Debitors List' }],
      [{ text: '🔄 Sync Ledger' }, { text: '🩺 Service Health' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}
