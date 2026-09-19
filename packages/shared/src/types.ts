// Shared data model for RecallAR.
// Mirrors the database tables described in the product spec (patients, people,
// memories, objects, routines, activities, activity_logs, rewards) so the
// mobile app and the web dashboard agree on shapes even before a real backend
// exists.

export interface Patient {
  id: string;
  name: string;
  preferredName: string;
  dateOfBirth: string; // ISO date
  profilePhotoUrl: string;
}

export interface Caregiver {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  email: string;
  photoUrl: string;
}

/** A family member or other important person in the patient's life. */
export interface Person {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  description: string;
  photoUrl: string;
  /** Short, verified facts only. AI features must never go beyond these. */
  facts: string[];
}

export interface MemoryPhoto {
  id: string;
  memoryId: string;
  photoUrl: string;
  caption?: string;
}

export interface Memory {
  id: string;
  patientId: string;
  title: string;
  description: string;
  date: string; // ISO date
  location?: string;
  personIds: string[];
  photos: MemoryPhoto[];
}

/** A household object usable as an AR memory-quest target. */
export interface MemoryObject {
  id: string;
  patientId: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string;
  associatedMemoryId?: string;
}

export interface RoutineStep {
  id: string;
  routineId: string;
  order: number;
  instruction: string;
  objectId?: string;
}

export interface Routine {
  id: string;
  patientId: string;
  name: string;
  steps: RoutineStep[];
}

export type ActivityType = 'ar_quest' | 'memory_question' | 'routine' | 'assistant_query';

/** An AI-generated, multiple-choice memory exercise grounded only in caregiver-provided facts. */
export interface MemoryQuestion {
  id: string;
  memoryId?: string;
  personId?: string;
  question: string;
  type: 'multiple_choice';
  options: string[];
  answer: string;
  hint: string;
}

export interface Activity {
  id: string;
  patientId: string;
  type: ActivityType;
  prompt: string;
  associatedMemoryId?: string;
  associatedObjectId?: string;
  question?: MemoryQuestion;
  pointsReward: number;
}

export interface ActivityLog {
  id: string;
  activityId: string;
  patientId: string;
  timestamp: string; // ISO datetime
  completed: boolean;
  hintsUsed: number;
  durationSeconds?: number;
  selectedAnswer?: string;
}

export type RewardType = 'sprout' | 'flower' | 'tree';

export interface Reward {
  id: string;
  patientId: string;
  rewardType: RewardType;
  earnedAt: string; // ISO datetime
}

/** Derived, display-ready state for the Memory Garden — never lets points go down. */
export interface MemoryGardenState {
  patientId: string;
  totalPoints: number;
  sprouts: number;
  flowers: number;
  trees: number;
}

export interface UpcomingEvent {
  id: string;
  patientId: string;
  title: string;
  personId?: string;
  time: string; // ISO datetime
}

export interface DailyOrientation {
  greetingName: string;
  dateLabel: string;
  upcomingEvent?: UpcomingEvent;
}

/** One caregiver-facing, descriptive (never diagnostic) daily summary. */
export interface CaregiverDailySummary {
  patientId: string;
  dateLabel: string;
  activitiesCompleted: number;
  activitiesTotal: number;
  memoryActivitiesCompleted: number;
  arQuestsCompleted: number;
  hintsUsed: number;
}
