import {
  initialize as initHealthConnect,
  requestPermission,
  getGrantedPermissions,
  getSdkStatus,
  readRecords,
  aggregateRecord,
  insertRecords,
  SdkAvailabilityStatus,
  ExerciseType,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthSnapshot, WorkoutSession } from '../types';

// Mirrors the iOS HealthKit service (health.ios.ts) but is backed by Android
// Health Connect. The public API is identical so call sites are unchanged.
// Reuse the same storage key so autoInitialize() behaves the same on both platforms.
const HEALTH_AUTHORIZED_KEY = '@healthkit_authorized';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'write', recordType: 'Steps' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'Weight' },
  { accessType: 'write', recordType: 'ExerciseSession' },
];

const KG_TO_LB = 2.2046226218;

function mapWorkoutType(type: WorkoutSession['type'] | string): number {
  const normalized = type.toLowerCase();
  if (normalized === 'cardio' || normalized.includes('run')) return ExerciseType.RUNNING;
  if (normalized === 'hiit' || normalized.includes('interval')) return ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING;
  if (normalized === 'flexibility' || normalized.includes('yoga') || normalized.includes('stretch')) return ExerciseType.YOGA;
  if (normalized === 'sport') return ExerciseType.BOOT_CAMP;
  return ExerciseType.STRENGTH_TRAINING;
}

class HealthService {
  private initialized = false;

  get isConnected(): boolean { return this.initialized; }

  async initialize(): Promise<boolean> {
    try {
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        console.warn('[HealthConnect] SDK unavailable, status:', status);
        return false;
      }
      const ready = await initHealthConnect();
      if (!ready) return false;

      const granted = await requestPermission(PERMISSIONS);
      // Treat as connected if the user granted at least one read permission.
      const hasReadAccess = granted.some(p => 'accessType' in p && p.accessType === 'read');
      if (!hasReadAccess) return false;

      this.initialized = true;
      await AsyncStorage.setItem(HEALTH_AUTHORIZED_KEY, 'true');
      return true;
    } catch (e) {
      console.warn('[HealthConnect] Init failed:', e);
      return false;
    }
  }

  async autoInitialize(): Promise<void> {
    try {
      const wasAuthorized = await AsyncStorage.getItem(HEALTH_AUTHORIZED_KEY);
      if (wasAuthorized !== 'true') return;
      // Confirm permissions still stand without prompting the user.
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return;
      const ready = await initHealthConnect();
      if (!ready) return;
      const granted = await getGrantedPermissions();
      if (granted.some(p => 'accessType' in p && p.accessType === 'read')) {
        this.initialized = true;
      }
    } catch {}
  }

  async getTodaySnapshot(): Promise<Partial<HealthSnapshot>> {
    if (!this.initialized) return {};
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const filter = {
      operator: 'between' as const,
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    };

    const [steps, activeCalories, heartRate, restingHR] = await Promise.allSettled([
      this.aggregateSteps(filter),
      this.aggregateActiveCalories(filter),
      this.getLatestHeartRate(),
      this.getRestingHeartRate(),
    ]);

    const hr  = heartRate.status === 'fulfilled' ? heartRate.value : 0;
    const rhr = restingHR.status === 'fulfilled' ? restingHR.value : 0;
    return {
      date: new Date().toISOString().split('T')[0],
      steps: steps.status === 'fulfilled' ? steps.value : 0,
      activeCalories: activeCalories.status === 'fulfilled' ? activeCalories.value : 0,
      heartRateAvg:     hr || rhr,
      heartRateResting: rhr,
    };
  }

  private async aggregateSteps(filter: { operator: 'between'; startTime: string; endTime: string }): Promise<number> {
    try {
      const res = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: filter });
      return res.COUNT_TOTAL ?? 0;
    } catch { return 0; }
  }

  private async aggregateActiveCalories(filter: { operator: 'between'; startTime: string; endTime: string }): Promise<number> {
    try {
      const res = await aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: filter });
      return Math.round(res.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
    } catch { return 0; }
  }

  private async getLatestHeartRate(): Promise<number> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const { records } = await readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
        ascendingOrder: false,
        pageSize: 5,
      });
      const samples = records.flatMap(r => r.samples ?? []);
      if (!samples.length) return 0;
      const recent = samples.slice(-5);
      const avg = recent.reduce((s, x) => s + (x.beatsPerMinute ?? 0), 0) / recent.length;
      return Math.round(avg);
    } catch { return 0; }
  }

  private async getRestingHeartRate(): Promise<number> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { records } = await readRecords('RestingHeartRate', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
        ascendingOrder: false,
        pageSize: 1,
      });
      return records.length ? Math.round(records[0].beatsPerMinute ?? 0) : 0;
    } catch { return 0; }
  }

  async getLatestWeight(): Promise<number | null> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
      const { records } = await readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
        ascendingOrder: false,
        pageSize: 1,
      });
      if (!records.length) return null;
      const kg = records[0].weight?.inKilograms ?? null;
      return kg == null ? null : Math.round(kg * KG_TO_LB * 10) / 10;
    } catch { return null; }
  }

  async getWeeklyActiveCalories(): Promise<Array<{ date: string; value: number }>> {
    return this.weeklyByDay(async (start, end) => {
      const res = await aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: { operator: 'between', startTime: start, endTime: end },
      });
      return Math.round(res.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
    });
  }

  async getWeeklySteps(): Promise<Array<{ date: string; value: number }>> {
    return this.weeklyByDay(async (start, end) => {
      const res = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: start, endTime: end },
      });
      return res.COUNT_TOTAL ?? 0;
    });
  }

  // Health Connect has no single bucketed call that matches the iOS shape across
  // all metrics, so aggregate one day at a time. Always returns a 7-day series.
  private async weeklyByDay(
    dayValue: (startISO: string, endISO: string) => Promise<number>,
  ): Promise<Array<{ date: string; value: number }>> {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const results = await Promise.allSettled(days.map(d => {
      const start = new Date(d);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      return dayValue(start.toISOString(), end.toISOString());
    }));
    return days.map((d, i) => ({
      date: d.toISOString().split('T')[0],
      value: results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<number>).value : 0,
    }));
  }

  async logWorkout(params: {
    type: WorkoutSession['type'] | string;
    startDate: string;
    endDate: string;
    calories: number;
  }): Promise<void> {
    if (!this.initialized) return;
    await insertRecords([
      {
        recordType: 'ExerciseSession',
        startTime: params.startDate,
        endTime: params.endDate,
        exerciseType: mapWorkoutType(params.type),
      },
      {
        recordType: 'ActiveCaloriesBurned',
        startTime: params.startDate,
        endTime: params.endDate,
        energy: { value: params.calories, unit: 'kilocalories' },
      },
    ]);
  }
}

export const healthService = new HealthService();
