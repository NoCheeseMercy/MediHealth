import { Platform } from 'react-native';

let Notifications: any = null;
let handlerRegistered = false;

async function getNotifications() {
  if (!Notifications) {
    Notifications = await import('expo-notifications').then((m) => m.default || m);
  }
  if (!handlerRegistered) {
    handlerRegistered = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return Notifications;
}

const channelId = 'medication-reminders';

export async function ensureNotificationPermissions() {
  const n = await getNotifications();
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync(channelId, {
      name: 'Medication reminders',
      importance: n.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await n.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await n.requestPermissionsAsync();
  return requested.granted;
}

function parseTime(time: string) {
  const [hours = '8', minutes = '0'] = time.split(':');
  return {
    hour: Math.max(0, Math.min(23, Number(hours) || 8)),
    minute: Math.max(0, Math.min(59, Number(minutes) || 0)),
  };
}

export async function scheduleMedicationReminder(reminder: {
  id: string;
  time: string;
  medication?: { name?: string; dosage?: string } | null;
  /** Display language — the body used to be hardcoded English, so Arabic users
   *  got "Medication reminder" in the middle of an Arabic UI. */
  language?: 'ar' | 'en';
}) {
  const n = await getNotifications();
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  await cancelMedicationReminder(reminder.id);

  const { hour, minute } = parseTime(reminder.time);
  const ar = reminder.language === 'ar';
  const fallbackName = ar ? 'دوائك' : 'your medication';
  const medication = reminder.medication?.name || fallbackName;
  const dosage = reminder.medication?.dosage ? ` (${reminder.medication.dosage})` : '';

  return n.scheduleNotificationAsync({
    identifier: `reminder:${reminder.id}`,
    content: {
      title: ar ? 'تذكير بالدواء' : 'Medication reminder',
      body: ar ? `حان وقت تناول ${medication}${dosage}` : `Time to take ${medication}${dosage}`,
      sound: 'default',
      data: { reminderId: reminder.id },
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes?.DAILY || 'daily',
      hour,
      minute,
      channelId,
    },
  });
}

export async function cancelMedicationReminder(reminderId: string) {
  const n = await getNotifications();
  await n.cancelScheduledNotificationAsync(`reminder:${reminderId}`).catch(() => undefined);
}
