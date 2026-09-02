import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { BankLogo } from '../../components/BankLogo';

export default function PayoutSettingsScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [existingBank, setExistingBank] = useState<any>(null);
  const [isChangingBank, setIsChangingBank] = useState(false);

  // Verification flow state
  const [step, setStep] = useState<'select' | 'account' | 'verifying' | 'confirmed'>('select');

  const [banks, setBanks] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<any>(null);

  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExisting = useCallback(async () => {
    setLoading(true);
    try {
      const { account } = await api.get('/api/seller/setup-account');
      if (account) {
        setExistingBank(account);
      } else {
        setIsChangingBank(true);
      }
    } catch (e) {
      console.error(e);
      setIsChangingBank(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    try {
      const data = await api.get('/api/paystack/banks');
      if (data.status) {
        setBanks(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const getBankName = useCallback(
    (code: string) => {
      if (!code) return '';
      const bank = banks.find((b) => b.code === code);
      return bank ? bank.name : code;
    },
    [banks]
  );

  useEffect(() => {
    fetchExisting();
    fetchBanks();
  }, [fetchExisting, fetchBanks]);

  const resolveBank = async (bankCode: string, acctNum: string) => {
    setStep('verifying');
    setResolvedName('');
    try {
      const data = await api.post('/api/paystack/resolve-account', {
        accountNumber: acctNum,
        bankCode,
      });
      if (data.success) {
        setResolvedName(data.accountName);
        setTimeout(() => setStep('confirmed'), 1000);
      } else {
        setStep('account');
        Alert.alert('Verification Failed', 'Could not verify this account number.');
      }
    } catch (e: any) {
      setStep('account');
      Alert.alert(
        'Verification Failed',
        e.message || 'An error occurred while verifying the account.'
      );
    }
  };

  const handleAcctChange = (val: string) => {
    const num = val.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(num);
    if (step === 'confirmed') setStep('account');
    if (num.length === 10 && selectedBank) {
      resolveBank(selectedBank.code, num);
    }
  };

  const handleSave = async () => {
    if (!selectedBank || !accountNumber || !resolvedName) return;
    setSaving(true);
    try {
      await api.post('/api/seller/setup-account', {
        account_number: accountNumber,
        bank_code: selectedBank.code,
        bank_name: selectedBank.name,
        account_name: resolvedName,
      });
      Alert.alert('Success', 'Bank account saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.G} />
        </View>
      </SafeAreaView>
    );
  }

  if (existingBank && !isChangingBank) {
    return (
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerTitle}>Payout Settings</Text>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          <View style={s.activeBankCard}>
            <View style={s.activeBankHeader}>
              <View style={s.activeBankIcon}>
                <BankLogo
                  code={existingBank.bankCode}
                  name={getBankName(existingBank.bankCode)}
                  size={44}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.activeBankName}>{getBankName(existingBank.bankCode)}</Text>
                <Text style={s.activeBankNum}>{existingBank.accountNumber}</Text>
              </View>
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeTxt}>ACTIVE</Text>
              </View>
            </View>
            <Text style={s.activeBankHolder}>{existingBank.accountName}</Text>
            {existingBank.isVerified && (
              <View style={s.verifiedRow}>
                <Feather name="check-circle" size={14} color={theme.colors.G} />
                <Text style={s.verifiedTxt}>Verified by Paystack</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.saveFinalBtn} onPress={() => setIsChangingBank(true)}>
            <Text style={s.saveFinalBtnTxt}>Change Bank Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (step !== 'select') {
              setStep('select');
              setAccountNumber('');
              setResolvedName('');
            } else {
              if (existingBank) setIsChangingBank(false);
              else router.back();
            }
          }}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>{step === 'select' ? 'Select Bank' : 'Verify Account'}</Text>
          {step !== 'select' && selectedBank && (
            <Text style={s.headerSub}>{selectedBank.name}</Text>
          )}
        </View>
      </View>

      {step === 'select' && (
        <View style={{ flex: 1 }}>
          <View style={s.searchBox}>
            <Feather name="search" size={16} color={theme.colors.LABEL} />
            <TextInput
              style={s.searchInput}
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder="Search banks…"
              placeholderTextColor={theme.colors.LABEL}
            />
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            style={s.bankListWrap}
            contentContainerStyle={s.bankListContainer}
            renderItem={({ item, index }) => {
              return (
                <View>
                  <TouchableOpacity
                    style={s.bankListItem}
                    onPress={() => {
                      setSelectedBank(item);
                      setStep('account');
                      setAccountNumber('');
                      setResolvedName('');
                    }}
                  >
                    <View style={s.bankIconBox}>
                      <BankLogo code={item.code} name={item.name} size={36} />
                    </View>
                    <Text style={s.bankListName}>{item.name}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={theme.colors.LABEL}
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                  {index < filteredBanks.length - 1 && <View style={s.bankListDivider} />}
                </View>
              );
            }}
          />
        </View>
      )}

      {(step === 'account' || step === 'verifying' || step === 'confirmed') && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.acctLabel}>10-DIGIT ACCOUNT NUMBER (NUBAN)</Text>
            <View
              style={[
                s.acctInputBox,
                step === 'confirmed' && { borderColor: 'rgba(130,219,126,0.4)' },
              ]}
            >
              <Feather name="hash" size={18} color={theme.colors.LABEL} />
              <TextInput
                style={s.acctInput}
                value={accountNumber}
                onChangeText={handleAcctChange}
                placeholder="0000000000"
                placeholderTextColor={theme.colors.LABEL}
                keyboardType="number-pad"
                maxLength={10}
              />
              {step === 'verifying' && <ActivityIndicator size="small" color={theme.colors.G} />}
              {step === 'confirmed' && <Feather name="check" size={20} color={theme.colors.G} />}
            </View>
            <Text style={s.acctCount}>{accountNumber.length}/10 digits</Text>

            {step === 'verifying' && (
              <View style={s.verifyingBox}>
                <Text style={s.verifyingTxt}>Verifying account with Paystack…</Text>
              </View>
            )}

            {step === 'confirmed' && (
              <View style={s.confirmedBox}>
                <View style={s.confirmedIconBox}>
                  <Feather name="check" size={18} color={theme.colors.G} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={s.confirmedLabel}>ACCOUNT HOLDER</Text>
                  <Text style={s.confirmedName} numberOfLines={1} ellipsizeMode="tail">
                    {resolvedName}
                  </Text>
                  <Text style={s.confirmedSub}>Verified by Paystack ✓</Text>
                </View>
              </View>
            )}

            {step === 'confirmed' && (
              <View style={s.footerBtnWrap}>
                <TouchableOpacity style={s.saveFinalBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={s.saveFinalBtnTxt}>Save Bank Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  headerSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },

  activeBankCard: {
    padding: 20,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 24,
    marginBottom: 16,
  },
  activeBankHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  activeBankIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(130,219,126,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBankName: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
  activeBankNum: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
  },
  activeBadgeTxt: { fontFamily: 'Outfit-Bold', fontSize: 11, color: theme.colors.G },
  activeBankHolder: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.MUTED },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  verifiedTxt: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },

  changeBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
  },
  changeBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
  removeBtnTxt: { fontFamily: 'Inter', fontSize: 13, color: '#ef4444', textAlign: 'center' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    height: '100%',
  },

  bankListWrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 32 },
  bankListContainer: {
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 22,
    overflow: 'hidden',
  },
  bankListItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bankIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankListName: { fontFamily: 'Inter', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
  bankListDivider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginLeft: 72 },

  acctLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 8,
    letterSpacing: 1,
  },
  acctInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 58,
    borderRadius: 18,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  acctInput: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    letterSpacing: 2,
  },
  acctCount: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginTop: 6,
    marginLeft: 4,
  },

  verifyingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(100,181,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(100,181,246,0.2)',
    borderRadius: 14,
    marginTop: 20,
  },
  verifyingTxt: { fontFamily: 'Inter', fontSize: 13, color: '#64B5F6' },

  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(130,219,126,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    borderRadius: 18,
    marginTop: 20,
  },
  confirmedIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedLabel: { fontFamily: 'Inter', fontSize: 11, color: theme.colors.LABEL, marginBottom: 2 },
  confirmedName: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  confirmedSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.G, marginTop: 2 },

  footerBtnWrap: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
    paddingTop: 14,
  },
  saveFinalBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    alignItems: 'center',
  },
  saveFinalBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
}));
