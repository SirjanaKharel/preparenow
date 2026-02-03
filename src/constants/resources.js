import { DISASTER_TYPES } from './disasters';

export const EMERGENCY_CONTACTS = {
  UK: [
    { name: 'Emergency Services', number: '999', type: 'emergency' },
    { name: 'Non-Emergency Police', number: '101', type: 'police' },
    { name: 'NHS 111', number: '111', type: 'health' },
    { name: 'Environment Agency', number: '0800 807060', type: 'flood' },
  ],
};

export const SAFETY_GUIDES = [
  {
    id: 'flood_guide',
    type: DISASTER_TYPES.FLOOD,
    title: 'Flood Safety Guide',
    sections: [
      {
        title: 'Before a Flood',
        steps: [
          'Know your flood risk - check if you live in a flood-prone area',
          'Prepare a flood kit with essentials',
          'Sign up for flood warnings',
          'Know how to turn off gas, electricity and water',
        ],
      },
      {
        title: 'During a Flood',
        steps: [
          'Move valuables and important documents upstairs',
          'Turn off gas, electricity and water if safe to do so',
          'Do not walk or drive through flood water',
          'Follow evacuation orders immediately',
        ],
      },
      {
        title: 'After a Flood',
        steps: [
          'Do not return home until authorities say it is safe',
          'Take photos of damage for insurance',
          'Clean and disinfect everything that got wet',
          'Watch for structural damage',
        ],
      },
    ],
  },
  {
    id: 'fire_guide',
    type: DISASTER_TYPES.FIRE,
    title: 'Fire Safety Guide',
    sections: [
      {
        title: 'Fire Prevention',
        steps: [
          'Install smoke alarms on every floor',
          'Test alarms monthly',
          'Keep fire extinguishers accessible',
          'Plan and practice escape routes',
        ],
      },
      {
        title: 'During a Fire',
        steps: [
          'Get out immediately - don\'t stop for belongings',
          'Crawl low under smoke',
          'Feel doors before opening - if hot, use another exit',
          'Once out, stay out - never go back inside',
          'Call 999 from a safe location',
        ],
      },
    ],
  },
];

export const FIRST_AID = [
  {
    id: 'cpr',
    title: 'CPR (Cardiopulmonary Resuscitation)',
    steps: [
      'Check if person is responsive - tap shoulders and shout',
      'Call 999 and get a defibrillator if available',
      'Open airway - tilt head back, lift chin',
      'Give 2 rescue breaths',
      'Place hands in center of chest',
      'Push hard and fast - 100-120 compressions per minute',
      'Continue 30 compressions, 2 breaths until help arrives',
    ],
    warning: 'Only perform if trained. This guide is not a substitute for proper training.',
  },
  {
    id: 'bleeding',
    title: 'Severe Bleeding',
    steps: [
      'Apply direct pressure to wound with clean cloth',
      'Maintain pressure for at least 10 minutes',
      'If blood soaks through, add more cloth on top',
      'Elevate injured area above heart if possible',
      'Call 999 for severe bleeding',
    ],
  },
  {
    id: 'burns',
    title: 'Burns',
    steps: [
      'Remove from heat source immediately',
      'Cool burn under running water for 20 minutes',
      'Remove jewelry and tight clothing before swelling',
      'Cover with cling film or clean cloth',
      'Do NOT use ice, butter, or ointments',
      'Seek medical help for serious burns',
    ],
  },
];