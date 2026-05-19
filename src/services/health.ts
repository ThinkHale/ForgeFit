import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
  HealthActivityOptions,
  HealthUnit,
} from 'react-native-health';
import { HealthSnapshot } from '../types';

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

class HealthService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
        if (error) {
          console.warn('[HealthKit] Init failed:', error);
          resolve(false);
        } else {
          this.initialized = true;
          resolve(true);
        }
      });
    });
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

    return {
      date: new Date().toISOString().split('T')[0],
      steps: steps.status === 'fulfilled' ? steps.value : 0,
      activeCalories: activeCalories.status === 'fulfilled' ? activeCalories.value : 0,
      heartRateAvg: heartRate.status === 'fulfilled' ? heartRate.value : 0,
      heartRateResting: restingHR.status === 'fulfilled' ? restingHR.value : 0,
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
      const opts: HealthInputOptions = { limit: 1, ascending: false };
      AppleHealthKit.getHeartRateSamples(opts, (err, results) => {
        if (err || !Array.isArray(results) || !results.length) { resolve(0); return; }
        resolve(Math.round(results[0].value ?? 0));
      });
    });
  }

  private getRestingHeartRate(): Promise<number> {
    return new Promise((resolve) => {
      const opts: HealthInputOptions = { limit: 1, ascending: false };
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
    type: string;
    startDate: string;
    endDate: string;
    calories: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const opts: HealthActivityOptions = {
        type: AppleHealthKit.Constants.Activities.TraditionalStrengthTraining,
        startDate: params.startDate,
        endDate: params.endDate,
      };
      AppleHealthKit.saveWorkout(opts, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

}

export const healthService = new HealthService();
