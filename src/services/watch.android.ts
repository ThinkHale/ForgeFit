import { WatchMessage, WatchWorkoutUpdate } from '../types';

// Android has no Apple Watch counterpart. This is a no-op stub mirroring the
// iOS watchService API (watch.ios.ts) so call sites work unchanged and the
// iOS-only react-native-watch-connectivity native module is never loaded.
type WorkoutUpdateHandler = (update: WatchWorkoutUpdate) => void;
type MessageHandler = (message: WatchMessage) => void;

class WatchService {
  async initialize(): Promise<void> {}

  onWorkoutUpdate(_handler: WorkoutUpdateHandler): () => void {
    return () => {};
  }

  onMessage(_handler: MessageHandler): () => void {
    return () => {};
  }

  async sendWorkoutStart(_params: {
    workoutName: string;
    exercises: Array<{ name: string; sets: number; reps: number }>;
    estimatedMinutes: number;
  }): Promise<void> {}

  async sendNextExercise(_exercise: {
    name: string;
    sets: number;
    reps: number;
    weight?: number;
    restSeconds: number;
  }): Promise<void> {}

  async sendWorkoutEnd(_summary: {
    durationMinutes: number;
    caloriesBurned: number;
    completedSets: number;
  }): Promise<void> {}

  async updateApplicationContext(_context: Record<string, unknown>): Promise<void> {}

  get reachable(): boolean {
    return false;
  }
}

export const watchService = new WatchService();
