import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [animation] = useState(new Animated.Value(0));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Treat null as connected so we don't show the banner unnecessarily
      const connected = state.isConnected ?? true;

      setIsConnected(connected);

      Animated.timing(animation, {
        toValue: connected ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => unsubscribe();
  }, [animation]);

  if (isConnected === null || isConnected === true) {
    return null;
  }

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 20) },
        { transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444', // Tailwind red-500
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  text: {
    color: '#050505',
    fontWeight: '600',
    fontSize: 14,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
});
