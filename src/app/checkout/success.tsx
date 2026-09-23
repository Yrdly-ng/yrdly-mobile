import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { formatPrice } from '../../lib/utils';

export default function CheckoutSuccessScreen() {
  const { theme } = useUnistyles(); const stylesheet = _stylesheet;

  const router = useRouter();
  const { transactionId, itemTitle, amount } = useLocalSearchParams<{
    transactionId: string;
    itemTitle: string;
    amount: string;
  }>();

  const amountNum = Number(amount ?? 0);
  const ref = `REF-${transactionId?.substring(0, 8).toUpperCase() ?? '84920'}`;

  const summary = [
    { l: 'Item', v: itemTitle || 'Item' },
    { l: 'Amount', v: formatPrice(amountNum) },
    { l: 'Reference', v: ref },
  ];

  return (
    <SafeAreaView style={stylesheet.container}>
      <View style={stylesheet.content}>
        <View style={stylesheet.iconContainer}>
          <Feather name="check" size={34} color={theme.colors.G} />
        </View>
        <Text style={stylesheet.title}>Order Confirmed!</Text>
        <Text style={stylesheet.subtitle}>
          Your payment is being held securely until the transaction is completed.
        </Text>

        <View style={stylesheet.summaryContainer}>
          {summary.map((r) => {
            return (
              <View key={r.l} style={stylesheet.summaryRow}>
                <Text style={stylesheet.summaryLabel}>{r.l}</Text>
                <Text style={stylesheet.summaryValue} numberOfLines={1}>
                  {r.v}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={stylesheet.footer}>
          <TouchableOpacity
            style={stylesheet.primaryBtn}
            onPress={() => router.replace(`/transactions/${transactionId}` as any)}
            activeOpacity={0.85}
          >
            <Text style={stylesheet.primaryBtnText}>View Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={stylesheet.secondaryBtn}
            onPress={() =>
              router.replace({ pathname: '/(tabs)/catalog', params: { tab: 'Marketplace' } } as any)
            }
            activeOpacity={0.7}
          >
            <Text style={stylesheet.secondaryBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const _stylesheet = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.DARK,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(130,219,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 26,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 260,
  },
  summaryContainer: {
    width: '100%',
    gap: 8,
    marginBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  summaryLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.LABEL,
  },
  summaryValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
    textAlign: 'right',
    paddingLeft: 16,
  },
  footer: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: '#000',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.LABEL,
  },
}));
