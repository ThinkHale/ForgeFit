import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
  HealthActivityOptions,
  HealthUnit,
} from 'react-native-health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthSnapshot, WorkoutSession } from '../types';

const HEALTH_AUTHORIZED_KEY = '@healthkit_authorized';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.BodyFatPercentage,
      AppleHealthKit.Constants.Permissions.Vo2Max,
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.AppleExerciseTime,
      AppleHealthKit.Constants.Permissions.AppleStandTime,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
    ],
  },
};

function mapWorkoutType(type: WorkoutSession['type'] | string): string {
  const normalized = type.toLowerCase();
  if (normalized === 'cardio' || normalized.includes('run')) return AppleHealthKit.Constants.Activities.Running;
  if (normalized === 'hiit' || normalized.includes('interval')) return AppleHealthKit.Constants.Activities.HighIntensityIntervalTraining;
  if (normalized === 'flexibility' || normalized.includes('yoga') || normalized.includes('stretch')) return AppleHealthKit.Constants.Activities.Flexibility;
  if (normalized === 'sport') return AppleHealthKit.Constants.Activities.CrossTraining;
  return AppleHealthKit.Constants.Activities.TraditionalStrengthTraining;
}

class HealthService {
  private initialized = false;

  get isConnected(): boolean { return this.initialized; }

  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, async (error: string) => {
        if (error) {
          console.warn('[HealthKit] Init failed:', error);
          resolve(false);
        } else {
          this.initialized = true;
          await AsyncStorage.setItem(HEALTH_AUTHORIZED_KEY, 'true');
          resolve(true);
        }
      });
    });
  }

  async autoInitialize(): Promise<void> {
    try {
      const wasAuthorized = await AsyncStorage.getItem(HEALTH_AUTHORIZED_KEY);
      if (wasAuthorized === 'true') {
        await this.initialize();
      }
    } catch {}
  }

  async getTodaySnapshot(): Promise<Partial<HealthSnapshot>> {
    if (!this.initialized) return {};
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayISO = startOfDay.toISOString();
    const nowISO = now.toISOString();

    const [steps, activeCalories, heartRate, restingHR] = await Promise.allSettled([
      this.getSteps(startOfDayISO, nowISO),
      this.getActiveCalories(startOfDayISO, nowISO),
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

  private getSteps(startDate: string, endDate: string): Promise<number> {
    return new Promise((resolve) => {
      const opts: HealthInputOptions = { startDate, endDate };
      AppleHealthKit.getStepCount(opts, (err, result) => {
        resolve(err ? 0 : (result as HealthValue).value ?? 0);
      });
    });
  }

  private getActiveCalories(startDate: string, endDate: string): Promise<number> {
    return new Promise((resolve) => {
      const opts: HealthInputOptions = { startDate, endDate };
      AppleHealthKit.getActiveEnergyBurned(opts, (err, results) => {
        if (err || !Array.isArray(results)) { resolve(0); return; }
        const total = results.reduce((sum, r) => sum + (r.value ?? 0), 0);
        resolve(Math.round(total));
      });
    });
  }

  private getLatestHeartRate(): Promise<number> {
    return new Promise((resolve) => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const opts: HealthInputOptions = {
        startDate: start.toISOString(),
        endDate:   end.toISOString(),
        limit:     5,
        ascending: false,
      };
      AppleHealthKit.getHeartRateSamples(opts, (err, results) => {
        if (err || !Array.isArray(results) || !results.length) { resolve(0); return; }
        const avg = results.reduce((s, r) => s + (r.value ?? 0), 0) / results.length;
        resolve(Math.round(avg));
      });
    });
  }

  private getRestingHeartRate(): Promise<number> {
    return new Promise((resolve) => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const opts: HealthInputOptions = { startDate: start.toISOString(), endDate: end.toISOString(), limit: 1, ascending: false };
      AppleHealthKit.getRestingHeartRate(opts, (err, result) => {
        resolve(err ? 0 : Math.round((result as HealthValue).value ?? 0));
      });
    });
  }

  async getLatestWeight(): Promise<number | null> {
    return new Promise((resolve) => {
      const opts: HealthInputOptions = { limit: 1, ascending: false, unit: HealthUnit.pound };
      AppleHealthKit.getWeightSamples(opts, (err, results) => {
        if (err || !Array.isArray(results) || !results.length) { resolve(null); return; }
        resolve(results[0].value ?? null);
      });
    });
  }

  async getWeeklyActiveCalories(): Promise<Array<{ date: string; value: number }>> {
    return new Promise((resolve) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const opts: HealthInputOptions = {
        startDate: start.toISOString(),
        endDate:   end.toISOString(),
      };
      AppleHealthKit.getActiveEnergyBurned(opts, (err, results) => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { date: d.toISOString().split('T')[0], value: 0 };
        });
        if (err || !Array.isArray(results)) { resolve(days); return; }
        const byDate: Record<string, number> = {};
        for (const r of results) {
          const date = new Date(r.startDate).toISOString().split('T')[0];
          byDate[date] = (byDate[date] ?? 0) + (r.value ?? 0);
        }
        resolve(days.map(d => ({ date: d.date, value: Math.round(byDate[d.date] ?? 0) })));
      });
    });
  }

  async getWeeklySteps(): Promise<Array<{ date: string; value: number }>> {
    return new Promise((resolve) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const opts: HealthInputOptions = {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        period: 60 * 24, // 24-hour buckets
      };
      AppleHealthKit.getDailyStepCountSamples(opts, (err, results) => {
        if (err || !Array.isArray(results)) { resolve([]); return; }
        resolve(results.map(r => ({ date: r.startDate, value: r.value ?? 0 })));
      });
    });
  }

  async logWorkout(params: {
    type: WorkoutSession['type'] | string;
    startDate: string;
    endDate: string;
    calories: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const opts: HealthActivityOptions = {
        type: mapWorkoutType(params.type),
        startDate: params.startDate,
        endDate: params.endDate,
        energyBurned: params.calories,
        energyBurnedUnit: 'calorie',
      } as HealthActivityOptions & { energyBurned: number; energyBurnedUnit: string };
      AppleHealthKit.saveWorkout(opts, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

}

export const healthService = new HealthService();
