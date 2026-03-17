// Mock Firebase modules
jest.mock('firebase/app', () => ({
	initializeApp: jest.fn(() => ({})),
}));
jest.mock('firebase/auth', () => ({
	getAuth: jest.fn(() => ({})),
	signInWithEmailAndPassword: jest.fn(),
	createUserWithEmailAndPassword: jest.fn(),
	signInAnonymously: jest.fn(),
	updateProfile: jest.fn(),
	onAuthStateChanged: jest.fn(),
	signOut: jest.fn(),
	getReactNativePersistence: jest.fn(),
	initializeAuth: jest.fn(() => ({})),
}));
jest.mock('firebase/firestore', () => ({
	getFirestore: jest.fn(() => ({})),
	setDoc: jest.fn(),
	getDoc: jest.fn(),
	doc: jest.fn(),
	collection: jest.fn(),
	query: jest.fn(),
	where: jest.fn(),
	onSnapshot: jest.fn(),
	serverTimestamp: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
	getStorage: jest.fn(() => ({})),
}));

// Mock Expo modules
jest.mock('expo-location', () => ({
	requestForegroundPermissionsAsync: jest.fn(),
	getCurrentPositionAsync: jest.fn(),
	watchPositionAsync: jest.fn(),
}));
jest.mock('expo-task-manager', () => ({
	defineTask: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
	setNotificationHandler: jest.fn(),
	scheduleNotificationAsync: jest.fn(),
	getPermissionsAsync: jest.fn(),
	requestPermissionsAsync: jest.fn(),
	addNotificationReceivedListener: jest.fn(),
	addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('expo-modules-core', () => ({
	EventEmitter: jest.fn(),
}));
// Mock AsyncStorage for tests
jest.mock('@react-native-async-storage/async-storage', () => {
	let store = {};
	return {
		setItem: jest.fn((key, value) => {
			store[key] = value;
			return Promise.resolve();
		}),
		getItem: jest.fn((key) => Promise.resolve(store[key] || null)),
		removeItem: jest.fn((key) => {
			delete store[key];
			return Promise.resolve();
		}),
		clear: jest.fn(() => {
			store = {};
			return Promise.resolve();
		}),
	};
});
