import * as WebBrowser from 'expo-web-browser';

export const PRIVACY_POLICY_URL = 'https://app.yrdly.ng/legal/privacy';
export const TERMS_URL = 'https://app.yrdly.ng/legal/terms';
export const openPrivacyPolicy = () => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
export const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
