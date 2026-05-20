import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async scheduleDefaultReminders(): Promise<void> {
    await this.cancelAll();
    // Morning workout reminder — 8 AM daily
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to train 💪',
        body: "Open Forge and let's build today's workout.",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0 },
    });
    // Evening nutrition check-in — 7 PM daily
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Evening check-in 🥗',
        body: "How did your nutrition look today? Log it before it slips your mind.",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 19, minute: 0 },
    });
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationService();
