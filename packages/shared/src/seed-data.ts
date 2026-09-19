// Seeded demo data for RecallAR's hackathon MVP: patient John Miller and
// caregiver Sarah Miller. Every fact here is what the AI features are allowed
// to draw on — nothing else should ever be invented about John's life.

import type {
  Activity,
  ActivityLog,
  Caregiver,
  Memory,
  MemoryGardenState,
  MemoryObject,
  Patient,
  Person,
  Routine,
  UpcomingEvent,
} from './types';

export const patient: Patient = {
  id: 'patient-john',
  name: 'John Miller',
  preferredName: 'John',
  dateOfBirth: '1951-04-02',
  profilePhotoUrl: '/images/john.jpg',
};

export const caregiver: Caregiver = {
  id: 'caregiver-sarah',
  patientId: patient.id,
  name: 'Sarah Miller',
  relationship: 'Daughter',
  email: 'sarah.miller@example.com',
  photoUrl: '/images/sarah.jpg',
};

export const people: Person[] = [
  {
    id: 'person-sarah',
    patientId: patient.id,
    name: 'Sarah Miller',
    relationship: 'Daughter',
    description: 'Sarah lives in Boston and visits John frequently.',
    photoUrl: '/images/sarah.jpg',
    facts: [
      'Lives in Boston',
      'Visits every Christmas',
      'Loves hiking with John',
      'Has two children',
    ],
  },
  {
    id: 'person-michael',
    patientId: patient.id,
    name: 'Michael Miller',
    relationship: 'Son',
    description: 'Michael lives in New York and calls every weekend.',
    photoUrl: '/images/michael.jpg',
    facts: ['Lives in New York', 'Calls every Sunday', 'Married to Susan’s daughter-in-law'],
  },
  {
    id: 'person-susan',
    patientId: patient.id,
    name: 'Susan Miller',
    relationship: 'Wife',
    description: 'Susan and John have been married for over 45 years.',
    photoUrl: '/images/susan.jpg',
    facts: ['Married to John since 1978', 'Loves gardening', 'Makes Sunday breakfast together'],
  },
];

export const objects: MemoryObject[] = [
  {
    id: 'object-mug',
    patientId: patient.id,
    name: 'Blue Coffee Mug',
    description: 'John’s blue coffee mug, his favorite for morning coffee.',
    location: 'Kitchen',
    imageUrl: '/images/mug.jpg',
    associatedMemoryId: 'memory-boston-trip',
  },
  {
    id: 'object-glasses',
    patientId: patient.id,
    name: 'Reading Glasses',
    description: 'John’s reading glasses, usually left on the nightstand.',
    location: 'Bedroom nightstand',
    imageUrl: '/images/glasses.jpg',
  },
  {
    id: 'object-wedding-photo',
    patientId: patient.id,
    name: 'Wedding Photograph',
    description: 'A framed photo from Sarah’s wedding.',
    location: 'Living room',
    imageUrl: '/images/wedding-photo.jpg',
    associatedMemoryId: 'memory-sarah-wedding',
  },
];

export const memories: Memory[] = [
  {
    id: 'memory-boston-trip',
    patientId: patient.id,
    title: 'Boston Trip',
    description: 'John and Sarah spent a weekend in Boston together, where John bought his favorite blue coffee mug.',
    date: '2019-07-14',
    location: 'Boston, Massachusetts',
    personIds: ['person-sarah'],
    photos: [{ id: 'photo-boston-1', memoryId: 'memory-boston-trip', photoUrl: '/images/boston-trip.jpg' }],
  },
  {
    id: 'memory-sarah-wedding',
    patientId: patient.id,
    title: 'Sarah’s Wedding',
    description: 'Sarah married Michael at a small ceremony in Vermont.',
    date: '2018-06-16',
    location: 'Vermont',
    personIds: ['person-sarah'],
    photos: [
      { id: 'photo-wedding-1', memoryId: 'memory-sarah-wedding', photoUrl: '/images/wedding1.jpg' },
      { id: 'photo-wedding-2', memoryId: 'memory-sarah-wedding', photoUrl: '/images/wedding2.jpg' },
    ],
  },
  {
    id: 'memory-family-christmas',
    patientId: patient.id,
    title: 'Family Christmas',
    description: 'The whole family gathered at John and Susan’s house for Christmas dinner.',
    date: '2023-12-25',
    location: 'John’s house',
    personIds: ['person-sarah', 'person-michael', 'person-susan'],
    photos: [{ id: 'photo-christmas-1', memoryId: 'memory-family-christmas', photoUrl: '/images/christmas.jpg' }],
  },
];

export const routines: Routine[] = [
  {
    id: 'routine-morning',
    patientId: patient.id,
    name: 'Morning Routine',
    steps: [
      { id: 'step-1', routineId: 'routine-morning', order: 1, instruction: 'Get your glasses', objectId: 'object-glasses' },
      { id: 'step-2', routineId: 'routine-morning', order: 2, instruction: 'Go to the kitchen' },
      { id: 'step-3', routineId: 'routine-morning', order: 3, instruction: 'Find your coffee mug', objectId: 'object-mug' },
      { id: 'step-4', routineId: 'routine-morning', order: 4, instruction: 'Sit at the table' },
    ],
  },
];

export const upcomingEvent: UpcomingEvent = {
  id: 'event-lunch',
  patientId: patient.id,
  title: 'Lunch with Sarah',
  personId: 'person-sarah',
  time: '2026-09-18T13:00:00-04:00',
};

export const activities: Activity[] = [
  {
    id: 'activity-mug-quest',
    patientId: patient.id,
    type: 'ar_quest',
    prompt: 'Let’s find your coffee mug.',
    associatedObjectId: 'object-mug',
    associatedMemoryId: 'memory-boston-trip',
    pointsReward: 10,
    question: {
      id: 'question-boston-companion',
      memoryId: 'memory-boston-trip',
      personId: 'person-sarah',
      question: 'Who went to Boston with you?',
      type: 'multiple_choice',
      options: ['Sarah', 'Susan', 'Michael'],
      answer: 'Sarah',
      hint: 'She’s your daughter.',
    },
  },
  {
    id: 'activity-sarah-recognition',
    patientId: patient.id,
    type: 'memory_question',
    prompt: 'Do you remember who this is?',
    associatedMemoryId: undefined,
    pointsReward: 5,
    question: {
      id: 'question-who-is-sarah',
      personId: 'person-sarah',
      question: 'Who is this?',
      type: 'multiple_choice',
      options: ['Sarah', 'Susan', 'Emily'],
      answer: 'Sarah',
      hint: 'She is your daughter.',
    },
  },
  {
    id: 'activity-wedding-location',
    patientId: patient.id,
    type: 'memory_question',
    prompt: 'Let’s remember Sarah’s wedding.',
    associatedMemoryId: 'memory-sarah-wedding',
    pointsReward: 5,
    question: {
      id: 'question-wedding-location',
      memoryId: 'memory-sarah-wedding',
      question: 'Where did Sarah get married?',
      type: 'multiple_choice',
      options: ['Vermont', 'Florida', 'Texas'],
      answer: 'Vermont',
      hint: 'It was a beautiful outdoor ceremony.',
    },
  },
  {
    id: 'activity-glasses-quest',
    patientId: patient.id,
    type: 'ar_quest',
    prompt: 'Let’s find your reading glasses.',
    associatedObjectId: 'object-glasses',
    pointsReward: 10,
  },
  {
    id: 'activity-christmas-people',
    patientId: patient.id,
    type: 'memory_question',
    prompt: 'Let’s remember Family Christmas.',
    associatedMemoryId: 'memory-family-christmas',
    pointsReward: 5,
    question: {
      id: 'question-christmas-who',
      memoryId: 'memory-family-christmas',
      question: 'Who hosted Family Christmas?',
      type: 'multiple_choice',
      options: ['John and Susan', 'Sarah', 'Michael'],
      answer: 'John and Susan',
      hint: 'It was at your own house.',
    },
  },
];

// Today's activity log, matching the demo narrative: John completed the mug
// quest and the Sarah memory activity (using one hint), then asked the
// assistant about his visitors.
export const activityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    activityId: 'activity-mug-quest',
    patientId: patient.id,
    timestamp: '2026-09-18T09:15:00-04:00',
    completed: true,
    hintsUsed: 0,
    durationSeconds: 45,
    selectedAnswer: 'Sarah',
  },
  {
    id: 'log-2',
    activityId: 'activity-wedding-location',
    patientId: patient.id,
    timestamp: '2026-09-18T09:22:00-04:00',
    completed: true,
    hintsUsed: 1,
    durationSeconds: 30,
    selectedAnswer: 'Vermont',
  },
  {
    id: 'log-3',
    activityId: 'activity-sarah-recognition',
    patientId: patient.id,
    timestamp: '2026-09-18T09:30:00-04:00',
    completed: true,
    hintsUsed: 0,
    durationSeconds: 20,
    selectedAnswer: 'Sarah',
  },
  {
    id: 'log-4',
    activityId: 'activity-glasses-quest',
    patientId: patient.id,
    timestamp: '2026-09-18T10:00:00-04:00',
    completed: true,
    hintsUsed: 1,
    durationSeconds: 60,
  },
];

export const memoryGarden: MemoryGardenState = {
  patientId: patient.id,
  totalPoints: 35,
  sprouts: 1,
  flowers: 2,
  trees: 0,
};

// "Asked 'Who is visiting today?'" from the demo narrative is an assistant
// query rather than a scored activity, so the caregiver timeline keeps it
// separate from activityLogs.
export const assistantQueries = [
  {
    id: 'query-1',
    patientId: patient.id,
    timestamp: '2026-09-18T10:05:00-04:00',
    question: 'Who is visiting today?',
    answer: 'Sarah is visiting for lunch at 1 PM today.',
  },
];
