import {
  watchEvents,
  getReachability,
  sendMessage,
  updateApplicationContext,
} from 'react-native-watch-connectivity';
import { WatchMessage, WatchWorkoutUpdate } from '../types';

type WorkoutUpdateHandler = (update: WatchWorkoutUpdate) => void;
type MessageHandler = (message: WatchMessage) => void;

class WatchService {
  private updateHandlers: WorkoutUpdateHandler[] = [];
  private messageHandlers: MessageHandler[] = [];
  private isReachable = false;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      watchEvents.on('reachability', (reachable: boolean) => {
        this.isReachable = reachable;
      });

      watchEvents.on('message', (message: Record<string, unknown>) => {
        const watchMessage = message as unknown as WatchMessage;
        if (watchMessage.type === 'WORKOUT_UPDATE' && watchMessage.payload) {
          const update = watchMessage.payload as unknown as WatchWorkoutUpdate;
          this.updateHandlers.forEach(h => h(update));
        }
        this.messageHandlers.forEach(h => h(watchMessage));
      });

      this.isReachable = await getReachability();
    } catch (e) {
      this.initialized = false; // allow retry if init failed
      console.warn('[Watch] Init failed:', e);
    }
  }

  onWorkoutUpdate(handler: WorkoutUpdateHandler): () => void {
    this.updateHandlers.push(handler);
    return () => {
      this.updateHandlers = this.updateHandlers.filter(h => h !== handler);
    };
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  async sendWorkoutStart(params: {
    workoutName: string;
    exercises: Array<{ name: string; sets: number; reps: number }>;
    estimatedMinutes: number;
  }): Promise<void> {
    if (!this.isReachable) return;
    const msg: WatchMessage = {
      type: 'START_WORKOUT',
      payload: params,
      timestamp: new Date().toISOString(),
    };
    sendMessage(msg as unknown as Record<string, unknown>);
  }

  async sendNextExercise(exercise: {
    name: string;
    sets: number;
    reps: number;
    weight?: number;
    restSeconds: number;
  }): Promise<void> {
    if (!this.isReachable) return;
    const msg: WatchMessage = {
      type: 'NEXT_EXERCISE',
      payload: exercise,
      timestamp: new Date().toISOString(),
    };
    sendMessage(msg as unknown as Record<string, unknown>);
  }

  async sendWorkoutEnd(summary: {
    durationMinutes: number;
    caloriesBurned: number;
    completedSets: number;
  }): Promise<void> {
    if (!this.isReachable) return;
    const msg: WatchMessage = {
      type: 'END_WORKOUT',
      payload: summary,
      timestamp: new Date().toISOString(),
    };
    sendMessage(msg as unknown as Record<string, unknown>);
  }

  async updateApplicationContext(context: Record<string, unknown>): Promise<void> {
    try {
      updateApplicationContext(context);
    } catch (e) {
      console.warn('[Watch] Context update failed:', e);
    }
  }

  get reachable(): boolean {
    return this.isReachable;
  }
}

export const watchService = new WatchService();
