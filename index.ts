// Configure themes before Expo Router imports any screen stylesheets.
import './src/theme/unistyles';

// Keep the router last so startup configuration runs before route discovery.
import 'expo-router/entry';
