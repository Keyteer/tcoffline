import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_CREDS_KEY = 'trakcare_biometric_creds_v1';

/** Key into `t.login` that describes the available biometric method. */
export type BiometricType = 'biometricLabelFaceId' | 'biometricLabelTouchId' | 'biometricLabelFingerprint' | 'biometricLabelFacial' | 'biometricLabel';

export const biometrics = {
  async isAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const hw = await LocalAuthentication.hasHardwareAsync();
    if (!hw) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  },

  /** Returns a translation key so callers can resolve the label via i18n. */
  async getBiometricType(): Promise<BiometricType> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFacial = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    if (Platform.OS === 'ios') {
      return hasFacial ? 'biometricLabelFaceId' : 'biometricLabelTouchId';
    }
    // Android: if both are available, use a generic label so the device
    // hardware prompt lets the user choose.
    if (hasFacial && hasFingerprint) return 'biometricLabel';
    if (hasFacial) return 'biometricLabelFacial';
    if (hasFingerprint) return 'biometricLabelFingerprint';
    return 'biometricLabel';
  },

  async hasStoredCredentials(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const val = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
      return val !== null;
    } catch {
      return false;
    }
  },

  /**
   * Store credentials protected by biometric authentication.
   * Triggers a biometric prompt to confirm before saving.
   * Returns true if successfully stored.
   */
  async enableWithPrompt(username: string, password: string, promptMessage: string): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });
    if (!result.success) return false;
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDS_KEY,
      JSON.stringify({ username, password }),
    );
    return true;
  },

  async disable(): Promise<void> {
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
  },

  /**
   * Prompt biometrics and return the stored credentials on success.
   * Returns null if authentication fails or no credentials stored.
   */
  async authenticateAndLoad(
    promptMessage: string,
  ): Promise<{ username: string; password: string } | null> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });
    if (!result.success) return null;
    try {
      const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { username: string; password: string };
    } catch {
      // Stored item is invalid or was invalidated (e.g. new biometric enrolled on iOS)
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
      return null;
    }
  },
};
