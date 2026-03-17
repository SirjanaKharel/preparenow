export const DISASTER_TYPES = {
  FLOOD: 'flood',
  FIRE: 'fire',
  STORM: 'storm',
  EARTHQUAKE: 'earthquake',
  EVACUATION: 'evacuation',
  TORNADO: 'tornado',
  HURRICANE: 'hurricane',
  TSUNAMI: 'tsunami',
};

export const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const DISASTER_CONFIG = {
  [DISASTER_TYPES.FLOOD]: {
    name: 'Flood',
    icon: '🌊',
    color: '#3B82F6',
    safetySteps: [
      'Move to higher ground immediately.',
      'Avoid walking or driving through flood waters.',
      'Listen to emergency broadcasts for updates.',
      'Turn off utilities if instructed to do so.',
      'Follow evacuation orders from authorities.'
    ],
  },
  [DISASTER_TYPES.FIRE]: {
    name: 'Fire',
    icon: '🔥',
    color: '#EF4444',
    safetySteps: [
      'Evacuate the area immediately if instructed.',
      'Stay low to avoid smoke inhalation.',
      'Do not return to the area until authorities declare it safe.',
      'Call emergency services if you are trapped.'
    ],
  },
  [DISASTER_TYPES.STORM]: {
    name: 'Storm',
    icon: '⛈️',
    color: '#6366F1',
    safetySteps: [
      'Stay indoors and away from windows.',
      'Unplug electrical appliances.',
      'Avoid using landline phones during lightning.',
      'Monitor weather updates.'
    ],
  },
  [DISASTER_TYPES.EARTHQUAKE]: {
    name: 'Earthquake',
    icon: '🏚️',
    color: '#78716C',
    safetySteps: [
      'Drop, cover, and hold on until shaking stops.',
      'Stay away from windows and heavy objects.',
      'If outside, move to an open area away from buildings.',
      'Be prepared for aftershocks.'
    ],
  },
  [DISASTER_TYPES.EVACUATION]: {
    name: 'Evacuation',
    icon: '🚨',
    color: '#DC2626',
    safetySteps: [
      'Follow official evacuation routes.',
      'Take your emergency kit with you.',
      'Check on neighbors who may need assistance.',
      'Do not return until authorities say it is safe.'
    ],
  },
  [DISASTER_TYPES.TORNADO]: {
    name: 'Tornado',
    icon: '🌪️',
    color: '#64748B',
    safetySteps: [
      'Seek shelter in a basement or interior room.',
      'Stay away from windows and doors.',
      'Protect your head and neck.',
      'Wait for official all-clear before leaving shelter.'
    ],
  },
  [DISASTER_TYPES.HURRICANE]: {
    name: 'Hurricane',
    icon: '🌀',
    color: '#0EA5E9',
    safetySteps: [
      'Evacuate if instructed by authorities.',
      'Stay indoors, away from windows.',
      'Have emergency supplies ready.',
      'Monitor official updates.'
    ],
  },
  [DISASTER_TYPES.TSUNAMI]: {
    name: 'Tsunami',
    icon: '🌊',
    color: '#06B6D4',
    safetySteps: [
      'Move to higher ground immediately.',
      'Stay away from the coast and rivers.',
      'Wait for official all-clear before returning.',
      'Monitor emergency broadcasts.'
    ],
  },
};