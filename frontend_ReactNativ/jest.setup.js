// Mock expo-secure-store for all tests
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

// Mock expo-speech-recognition with a controllable test harness.
// Tests can import this module and call `__triggerEvent(name, payload)` to
// simulate native events.
jest.mock('expo-speech-recognition', () => {
  const listeners = {};
  const ExpoSpeechRecognitionModule = {
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true }),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn((event, cb) => {
      if (!listeners[event]) listeners[event] = new Set();
      listeners[event].add(cb);
      return { remove: () => listeners[event]?.delete(cb) };
    }),
  };
  return {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent: () => undefined,
    __triggerEvent: (event, payload) => {
      const subs = listeners[event];
      if (!subs) return;
      subs.forEach((cb) => cb(payload));
    },
    __reset: () => {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
      ExpoSpeechRecognitionModule.start.mockClear();
      ExpoSpeechRecognitionModule.stop.mockClear();
      ExpoSpeechRecognitionModule.abort.mockClear();
      ExpoSpeechRecognitionModule.requestPermissionsAsync.mockClear();
      ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({
        granted: true,
        status: 'granted',
        canAskAgain: true,
      });
      ExpoSpeechRecognitionModule.isRecognitionAvailable.mockReturnValue(true);
    },
  };
}, { virtual: true });
