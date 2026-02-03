import { DISASTER_TYPES } from './disasters';

export const PREPAREDNESS_TASKS = [
  {
    id: 'task_1',
    title: 'Create Emergency Kit',
    description: 'Assemble a basic emergency kit with water, food, and first aid supplies',
    points: 100,
    category: 'preparation',
    difficulty: 'beginner',
  },
  {
    id: 'task_2',
    title: 'Set Emergency Contacts',
    description: 'Add at least 3 emergency contacts to your profile',
    points: 50,
    category: 'planning',
    difficulty: 'beginner',
  },
  {
    id: 'task_3',
    title: 'Learn CPR Basics',
    description: 'Complete the CPR basics quiz',
    points: 150,
    category: 'skills',
    difficulty: 'intermediate',
  },
  {
    id: 'task_4',
    title: 'Plan Evacuation Route',
    description: 'Map out two evacuation routes from your home',
    points: 100,
    category: 'planning',
    difficulty: 'beginner',
  },
  {
    id: 'task_5',
    title: 'Test Your Smoke Alarms',
    description: 'Check all smoke alarms in your home',
    points: 50,
    category: 'preparation',
    difficulty: 'beginner',
  },
];

export const BADGES = [
  {
    id: 'badge_beginner',
    title: 'Getting Started',
    description: 'Complete your first task',
    requirement: 1,
  },
  {
    id: 'badge_prepared',
    title: 'Well Prepared',
    description: 'Complete 5 tasks',
    requirement: 5,
  },
  {
    id: 'badge_expert',
    title: 'Preparedness Expert',
    description: 'Complete all tasks',
    requirement: PREPAREDNESS_TASKS.length,
  },
  {
    id: 'badge_points_500',
    title: 'Point Master',
    description: 'Earn 500 points',
    requirement: 500,
  },
];