import * as WebBrowser from 'expo-web-browser';

const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://app.yrdly.ng').replace(/\/+$/, '');

export const PRIVACY_POLICY_URL = `${WEB_APP_URL}/legal/privacy`;
export const TERMS_URL = `${WEB_APP_URL}/legal/terms`;

export const openPrivacyPolicy = () => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
export const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
