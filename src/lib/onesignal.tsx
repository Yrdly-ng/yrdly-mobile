import { LogLevel, OneSignal } from 'react-native-onesignal';

const APP_ID = '5a4addf4-b42e-478e-8225-d4ad06128381';

class OneSignalService {
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;

    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(APP_ID);

    this.isInitialized = true;
  }

  login(userId: string) {
    OneSignal.login(userId);
  }

  logout() {
    OneSignal.logout();
  }

  async requestPermission() {
    OneSignal.Notifications.requestPermission(true);
  }
}

export const oneSignalService = new OneSignalService();

