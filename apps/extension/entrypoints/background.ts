export default defineBackground(() => {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith('task:')) return

    await chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: '/icon/128.png',
      title: 'Task reminder',
      message: 'You have a task due soon.',
    })
  })
})
