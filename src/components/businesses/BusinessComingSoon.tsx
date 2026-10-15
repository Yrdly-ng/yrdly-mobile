import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useEffect } from 'react';
import { View, Text, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export function BusinessComingSoon() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  // Animations
  const pulseScale = useSharedValue(1);
  const floatY = useSharedValue(0);
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);
  const opacity3 = useSharedValue(0);

  useEffect(() => {
    // Pulse animation for the main icon background
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Floating animation for the icon
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Staggered fade in for floating elements
    opacity1.value = withDelay(300, withTiming(1, { duration: 800 }));
    opacity2.value = withDelay(600, withTiming(1, { duration: 800 }));
    opacity3.value = withDelay(900, withTiming(1, { duration: 800 }));
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const opacity1Style = useAnimatedStyle(() => ({
    opacity: opacity1.value,
  }));
  const opacity2Style = useAnimatedStyle(() => ({
    opacity: opacity2.value,
  }));
  const opacity3Style = useAnimatedStyle(() => ({
    opacity: opacity3.value,
  }));

  return (
    <ScrollView contentContainerStyle={stylesheet.container} showsVerticalScrollIndicator={false}>
      {/* Animated Centerpiece */}
      <View style={stylesheet.iconContainer}>
        {/* Background pulse rings */}
        <Animated.View
          style={[stylesheet.pulseRing, { backgroundColor: theme.colors.G + '15' }, pulseStyle]}
        />
        <Animated.View
          style={[
            stylesheet.pulseRingInner,
            { backgroundColor: theme.colors.G + '25' },
            pulseStyle,
          ]}
        />

        {/* Main Icon */}
        <Animated.View
          style={[stylesheet.mainIconWrapper, { backgroundColor: theme.colors.G }, floatStyle]}
        >
          <Feather name="briefcase" size={38} color={theme.colors.TEXT_PRIMARY} />
        </Animated.View>

        {/* Floating Accent Icons */}
        <Animated.View
          style={[
            stylesheet.accentIcon,
            stylesheet.accent1,
            { backgroundColor: theme.colors.SURFACE, shadowColor: theme.colors.TEXT_PRIMARY },
            opacity1Style,
          ]}
        >
          <Feather name="trending-up" size={16} color={theme.colors.G} />
        </Animated.View>
        <Animated.View
          style={[
            stylesheet.accentIcon,
            stylesheet.accent2,
            { backgroundColor: theme.colors.SURFACE, shadowColor: theme.colors.TEXT_PRIMARY },
            opacity2Style,
          ]}
        >
          <Feather name="star" size={18} color="#FFC107" />
        </Animated.View>
        <Animated.View
          style={[
            stylesheet.accentIcon,
            stylesheet.accent3,
            { backgroundColor: theme.colors.SURFACE, shadowColor: theme.colors.TEXT_PRIMARY },
            opacity3Style,
          ]}
        >
          <Feather name="map-pin" size={16} color="#FF5252" />
        </Animated.View>
      </View>

      {/* Text Content */}
      <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>
        Yrdly <Text style={{ color: theme.colors.G }}>Businesses</Text>
      </Text>

      <Text style={[stylesheet.subtitle, { color: theme.colors.TEXT_SECONDARY }]}>
        We are building a vibrant new space for you to discover, connect with, and support your
        favorite local shops and services.
      </Text>

      {/* Features List */}
      <View style={stylesheet.featuresContainer}>
        <View style={stylesheet.featureItem}>
          <View style={[stylesheet.featureIcon, { backgroundColor: theme.colors.SURFACE }]}>
            <Feather name="search" size={16} color={theme.colors.G} />
          </View>
          <Text style={[stylesheet.featureText, { color: theme.colors.TEXT_PRIMARY }]}>
            Find local services near you
          </Text>
        </View>
        <View style={stylesheet.featureItem}>
          <View style={[stylesheet.featureIcon, { backgroundColor: theme.colors.SURFACE }]}>
            <Feather name="message-square" size={16} color={theme.colors.G} />
          </View>
          <Text style={[stylesheet.featureText, { color: theme.colors.TEXT_PRIMARY }]}>
            Connect directly with owners
          </Text>
        </View>
        <View style={stylesheet.featureItem}>
          <View style={[stylesheet.featureIcon, { backgroundColor: theme.colors.SURFACE }]}>
            <Feather name="star" size={16} color={theme.colors.G} />
          </View>
          <Text style={[stylesheet.featureText, { color: theme.colors.TEXT_PRIMARY }]}>
            Read and leave trusted reviews
          </Text>
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[stylesheet.notifyButton, { backgroundColor: theme.colors.G }]}
        activeOpacity={0.8}
      >
        <Feather
          name="bell"
          size={18}
          color={theme.colors.TEXT_PRIMARY}
          style={{ marginRight: 8 }}
        />
        <Text style={stylesheet.notifyButtonText}>Notify me when it's live</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  pulseRingInner: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  mainIconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ rotate: '-3deg' }],
  },
  accentIcon: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  accent1: { top: 20, left: 16 },
  accent2: { top: 40, right: 10 },
  accent3: { bottom: 20, left: 24 },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
    gap: 16,
    paddingHorizontal: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  notifyButtonText: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
