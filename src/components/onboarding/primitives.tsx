import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const { colors, radii } = ONBOARDING_THEME;

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/images/logo.png')}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      resizeMode="contain"
    />
  );
}

const LOCAL_SCENE_IMAGES: Record<string, any> = {
  '1594538756542-8c88bda491c5': require('../../../assets/images/onboarding/splash.jpg'),
  '1752622176337-5d9315e2df6e': require('../../../assets/images/onboarding/slide1.jpg'),
  '1579998120708-682dd8a5624f': require('../../../assets/images/onboarding/slide2.jpg'),
  '1673280401347-309363111070': require('../../../assets/images/onboarding/slide3.jpg'),
  '1758525225816-8dd1901ef6ec': require('../../../assets/images/onboarding/slide4.jpg'),
  '1571346746462-d4e51c41072f': require('../../../assets/images/onboarding/signup.jpg'),
  '1707011017057-e80acf66ddeb': require('../../../assets/images/onboarding/auth_bg.jpg'),
  '1768244016593-8ca75b15bc92': require('../../../assets/images/onboarding/verify_email.jpg'),
  '1654762550505-7c58277e0fac': require('../../../assets/images/onboarding/phone_bg.jpg'),
  '1764921587464-f3cdd46fb4c9': require('../../../assets/images/onboarding/profile_bg.jpg'),
};

export function SceneBg({
  photoId,
  pos = 'center',
  gradientStart = '40%',
}: {
  photoId: string;
  pos?: string;
  gradientStart?: string;
}) {
  const source = LOCAL_SCENE_IMAGES[photoId] || {
    uri: `https://images.unsplash.com/photo-${photoId}?w=800&h=900&fit=crop&auto=format&q=85`,
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,5,5,0.78)' }]} />
    </View>
  );
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function PrimaryBtn({
  label,
  onClick,
  icon,
  disabled,
  loading,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [scale] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onClick}
        disabled={disabled || loading}
        style={[
          styles.primaryBtn,
          (disabled || loading) && { backgroundColor: 'rgba(130,219,126,0.35)', boxShadow: 'none' },
        ]}
      >
        <View style={styles.btnContent}>
          {icon}
          <Text style={styles.primaryBtnText}>{loading ? 'Saving...' : label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SecondaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onClick} style={styles.secondaryBtn}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GlassInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  right,
  keyboardType,
  maxLength,
}: {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  keyboardType?: any;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.glassInputContainer, focused && styles.glassInputFocused]}>
      {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
      <TextInput
        secureTextEntry={type === 'password'}
        placeholder={placeholder}
        placeholderTextColor={colors.LABEL}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={styles.glassInputText}
      />
      {right}
    </View>
  );
}

export function PasswordStrength({ value }: { value: string }) {
  const reqs = [
    { label: '8+ characters', met: value.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(value) },
    { label: 'Number (0-9)', met: /[0-9]/.test(value) },
    { label: 'Special symbol (!@#$)', met: /[^A-Za-z0-9]/.test(value) },
  ];
  const score = reqs.filter((r) => r.met).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colorsList = ['', '#FF5C5C', '#FFB648', colors.G, colors.G];

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.strengthRow}>
        <View style={styles.barsContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.strengthBar,
                { backgroundColor: i <= score ? colorsList[score] : 'rgba(255,255,255,0.1)' },
              ]}
            />
          ))}
        </View>
        <Text
          style={[styles.strengthLabel, { color: score > 0 ? colorsList[score] : colors.LABEL }]}
        >
          {labels[score]}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {reqs.map((r) => (
          <View
            key={r.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: r.met ? 'rgba(130,219,126,0.1)' : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: r.met ? 'rgba(130,219,126,0.3)' : 'rgba(255,255,255,0.06)',
            }}
          >
            <Ionicons
              name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
              size={12}
              color={r.met ? colors.G : colors.LABEL}
            />
            <Text
              style={{ fontSize: 11, color: r.met ? colors.G : colors.LABEL, fontWeight: '500' }}
            >
              {r.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function SocialRow({
  onGooglePress,
  onApplePress,
}: {
  onGooglePress?: () => void;
  onApplePress?: () => void;
}) {
  return (
    <View style={styles.socialRow}>
      <TouchableOpacity activeOpacity={0.8} onPress={onGooglePress} style={styles.socialBtn}>
        <GoogleLogo size={18} />
        <Text style={styles.socialBtnText}>Google</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={onApplePress} style={styles.socialBtn}>
        <Ionicons name="logo-apple" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.socialBtnText}>Apple</Text>
      </TouchableOpacity>
    </View>
  );
}

export function BackBtn({ onClick, light }: { onClick: () => void; light?: boolean }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onClick} style={styles.backBtn}>
      <Ionicons
        name="chevron-back"
        size={20}
        color={light ? 'rgba(255,255,255,0.6)' : colors.LABEL}
      />
      <Text style={[styles.backBtnText, { color: light ? 'rgba(255,255,255,0.6)' : colors.LABEL }]}>
        Back
      </Text>
    </TouchableOpacity>
  );
}

export function ProgressPills({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pill,
            {
              width: i === current ? 24 : 8,
              backgroundColor: i === current ? colors.G : 'rgba(255,255,255,0.22)',
            },
          ]}
        />
      ))}
    </View>
  );
}

export function StepBar({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>
          STEP {step} OF {total}
        </Text>
        <Text style={styles.stepLabel}>{label}</Text>
      </View>
      <View style={styles.stepTrack}>
        <View style={[styles.stepFill, { width: `${(step / total) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    backgroundColor: colors.GLASS_BG,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    borderRadius: radii.glassCard,
    gap: 20,
  },
  primaryBtn: {
    height: 62,
    borderRadius: radii.button,
    backgroundColor: colors.G,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.G,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 6,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: colors.DARK,
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.MUTED,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  glassInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radii.input,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    paddingHorizontal: 16,
  },
  glassInputFocused: {
    borderColor: 'rgba(130,219,126,0.4)',
  },
  glassInputText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 8,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 99,
  },
  strengthLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    minWidth: 36,
    textAlign: 'right',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.GLASS_BORDER,
  },
  dividerText: {
    color: colors.LABEL,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    height: 3,
    borderRadius: 99,
  },
  stepContainer: {
    gap: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 12,
    color: colors.G,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.LABEL,
    fontFamily: 'Inter-Regular',
  },
  stepTrack: {
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.G,
  },
});
