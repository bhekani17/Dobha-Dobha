/**
 * DOBHA DOBHA — SignUpScreen (React Native)
 * South Africa's Authenticated Street Marketplace Sign Up & Authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';
import UserStore from '../services/userStore';
import ApiService from '../services/api';
import GoogleAuthService from '../services/googleAuth';

const SA_LOCATIONS = [
  'Joburg CBD (Bree Taxi Rank)',
  'Joburg CBD (Park Station)',
  'Braamfontein (Juta Street)',
  'Maboneng Precinct',
  'Soweto (Vilakazi / Bara)',
  'Pretoria CBD (Church Square)',
  'Durban Central (Workshop)',
  'Cape Town CBD (Long Street)'
];

export default function SignUpScreen({ navigation, onAuthSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [role, setRole] = useState('buyer'); // 'buyer' | 'seller'
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(SA_LOCATIONS[0]);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [loading, setLoading] = useState(false);

  // Quick SA ID toggle
  const [saIdNumber, setSaIdNumber] = useState('');

  const calculatePasswordStrength = () => {
    if (!password) return { label: 'Empty', color: Colors.textDim, width: '0%' };
    if (password.length < 6) return { label: 'Weak', color: Colors.brandRed, width: '30%' };
    if (password.length < 9) return { label: 'Medium', color: Colors.brandAmber, width: '65%' };
    return { label: 'Strong', color: Colors.brandEmerald, width: '100%' };
  };

  const strength = calculatePasswordStrength();

  const handleAuth = async () => {
    if (isLoginMode) {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Missing Fields', 'Please enter your email and password to sign in.');
        return;
      }
    } else {
      if (!fullName.trim() || !email.trim() || !password.trim()) {
        Alert.alert('Missing Fields', 'Please fill in your name, email, and a password.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
        return;
      }
      if (!agreedTerms) {
        Alert.alert('Terms Required', 'Please accept the DOBHA DOBHA Escrow & Marketplace Terms to continue.');
        return;
      }
    }

    setLoading(true);

    try {
      let result;
      if (isLoginMode) {
        result = await ApiService.login({
          email: email.trim(),
          password
        });
      } else {
        result = await ApiService.register({
          email: email.trim(),
          password,
          name: fullName.trim(),
          role,
          phone: phone ? phone.trim() : null,
          location: selectedLocation,
          sa_id: saIdNumber.trim()
        });
      }

      setLoading(false);

      if (!result || !result.success) {
        Alert.alert(
          'Authentication Failed',
          result?.message || 'Could not connect to DOBHA DOBHA server. Please verify your connection.'
        );
        return;
      }

      // Save real user session
      const userProfile = UserStore.setAuth(result.user, result.token);

      Alert.alert(
        isLoginMode ? 'Welcome Back!' : 'Account Created!',
        isLoginMode
          ? `Signed in as ${userProfile.name}. Welcome back to the street market!`
          : `Welcome to DOBHA DOBHA, ${userProfile.name}! Your ${role === 'seller' ? 'Seller Trader' : 'Buyer'} account is active.`,
        [
          {
            text: 'Start Exploring',
            onPress: () => {
              if (onAuthSuccess) onAuthSuccess(userProfile);
              if (navigation?.navigate) {
                navigation.navigate(role === 'seller' ? 'Sell' : 'Catalog');
              }
            }
          }
        ]
      );
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await GoogleAuthService.signInWithGoogle();

      if (result && result.success) {
        // Save user session from Google auth
        const userProfile = UserStore.setAuth(result.user, result.token);

        Alert.alert(
          'Google Sign-In Successful!',
          `Welcome to DOBHA DOBHA, ${userProfile.name}!`,
          [
            {
              text: 'Start Exploring',
              onPress: () => {
                if (onAuthSuccess) onAuthSuccess(userProfile);
                if (navigation?.navigate) {
                  navigation.navigate('Catalog');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Google Sign-In Failed', result?.message || 'Could not authenticate with Google. Please try again.');
      }
    } catch (error) {
      Alert.alert('Google Sign-In Error', error.message || 'An error occurred during Google authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar for Back / Skip to Market */}
      <View style={styles.topBackRow}>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtnPill}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <FontAwesome5 name="arrow-left" size={12} color={Colors.pureGreen} style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : <View />}

        <TouchableOpacity
          onPress={() => navigation?.navigate?.('Catalog')}
          style={styles.guestLink}
          activeOpacity={0.8}
        >
          <Text style={styles.guestLinkText}>Browse Market</Text>
          <FontAwesome5 name="arrow-right" size={11} color={Colors.pureGreen} style={{ marginLeft: 5 }} />
        </TouchableOpacity>
      </View>

      {/* Brand Header Banner */}
      <View style={styles.headerBox}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandTitle}>DOBHA DOBHA</Text>
        <Text style={styles.brandSubtitle}>
          {isLoginMode ? 'Sign in to your street trade account' : "South Africa's authentic street thrifting network"}
        </Text>

        {/* Tab Switcher: Sign Up vs Sign In */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, !isLoginMode && styles.switchTabActive]}
            onPress={() => setIsLoginMode(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.switchTabText, !isLoginMode && styles.switchTabTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.switchTab, isLoginMode && styles.switchTabActive]}
            onPress={() => setIsLoginMode(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.switchTabText, isLoginMode && styles.switchTabTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Card */}
      <View style={styles.card}>
        {!isLoginMode && (
          <>
            {/* Role Selection Pill */}
            <Text style={styles.fieldLabel}>I WANT TO:</Text>
            <View style={styles.roleGrid}>
              <TouchableOpacity
                style={[styles.roleCard, role === 'buyer' && styles.roleCardActive]}
                onPress={() => setRole('buyer')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="shopping-bag"
                  size={16}
                  color={role === 'buyer' ? '#FFFFFF' : Colors.textMuted}
                />
                <Text style={[styles.roleTitle, role === 'buyer' && styles.roleTitleActive]}>
                  Buy / Thrift
                </Text>
                <Text style={[styles.roleSub, role === 'buyer' && styles.roleSubActive]}>
                  Claim Dibs & Safe Escrow Pickup
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, role === 'seller' && styles.roleCardActive]}
                onPress={() => setRole('seller')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="store"
                  size={16}
                  color={role === 'seller' ? '#FFFFFF' : Colors.textMuted}
                />
                <Text style={[styles.roleTitle, role === 'seller' && styles.roleTitleActive]}>
                  Sell / Trader
                </Text>
                <Text style={[styles.roleSub, role === 'seller' && styles.roleSubActive]}>
                  Live Streams & Instant Payouts
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Name */}
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <View style={styles.inputWrap}>
              <FontAwesome5 name="user" size={14} color={Colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Sipho Khumalo"
                placeholderTextColor={Colors.textDim}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Phone Number with SA flag */}
            <Text style={styles.fieldLabel}>SOUTH AFRICAN PHONE (WHATSAPP)</Text>
            <View style={styles.inputWrap}>
              <View style={styles.saPrefix}>
                <FontAwesome5 name="globe-africa" size={13} color={Colors.pureGreen} style={{ marginRight: 3 }} />
                <Text style={styles.saPrefixText}>+27</Text>
              </View>
              <TextInput
                style={[styles.textInput, { paddingLeft: 8 }]}
                placeholder="078 123 4567"
                placeholderTextColor={Colors.textDim}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </>
        )}

        {/* Email Address */}
        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
        <View style={styles.inputWrap}>
          <FontAwesome5 name="envelope" size={14} color={Colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            placeholder="e.g. sipho@example.co.za"
            placeholderTextColor={Colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {/* Password */}
        <Text style={styles.fieldLabel}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <FontAwesome5 name="lock" size={14} color={Colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            placeholder={isLoginMode ? 'Enter your password' : 'Create strong password (min 6 chars)'}
            placeholderTextColor={Colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={14} color={Colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Password Strength indicator (for sign up) */}
        {!isLoginMode && password.length > 0 && (
          <View style={styles.strengthBox}>
            <View style={styles.strengthBarBg}>
              <View style={[styles.strengthBarFill, { width: strength.width, backgroundColor: strength.color }]} />
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
          </View>
        )}

        {!isLoginMode && (
          <>
            {/* Primary Trade Location */}
            <Text style={styles.fieldLabel}>PRIMARY SAFE TRADE HUB / LOCATION</Text>
            <TouchableOpacity
              style={styles.locationSelector}
              onPress={() => setLocationPickerOpen(!locationPickerOpen)}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="map-marker-alt" size={13} color={Colors.brandEmerald} />
              <Text style={styles.locationSelectorText}>{selectedLocation}</Text>
              <FontAwesome5 name={locationPickerOpen ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textDim} />
            </TouchableOpacity>

            {locationPickerOpen && (
              <View style={styles.locationDropdown}>
                {SA_LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.locationOption, selectedLocation === loc && styles.locationOptionActive]}
                    onPress={() => {
                      setSelectedLocation(loc);
                      setLocationPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.locationOptionText, selectedLocation === loc && styles.locationOptionTextActive]}>
                      {loc}
                    </Text>
                    {selectedLocation === loc && (
                      <FontAwesome5 name="check" size={11} color={Colors.brandEmerald} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Optional Fast KYC ID Verification */}
            <View style={styles.kycSection}>
              <View style={styles.kycHeader}>
                <FontAwesome5 name="id-card" size={14} color={Colors.brandEmerald} />
                <Text style={styles.kycTitle}>Optional: SA Smart ID Verification</Text>
              </View>
              <Text style={styles.kycDesc}>
                Earn an instant green badge so buyers & sellers trust you on cash-free Escrow trades.
              </Text>
              <TextInput
                style={styles.kycInput}
                placeholder="Enter 13-digit SA ID Number"
                placeholderTextColor={Colors.textDim}
                value={saIdNumber}
                onChangeText={setSaIdNumber}
                keyboardType="number-pad"
                maxLength={13}
              />
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreedTerms(!agreedTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedTerms && styles.checkboxActive]}>
                {agreedTerms && <FontAwesome5 name="check" size={10} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={{ color: Colors.brandEmerald }}>Escrow Protection Rules</Text> and South African Marketplace Safety Guidelines.
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.btnSubmit, loading && styles.btnDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.btnRow}>
              <FontAwesome5 name={isLoginMode ? 'sign-in-alt' : 'user-plus'} size={15} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnSubmitText}>
                {isLoginMode ? 'Sign In to DOBHA DOBHA' : 'Create My Account'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick Social Buttons */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="google" size={15} color="#ea4335" />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => {
              Alert.alert('Apple Sign In', 'Connecting to Apple ID...');
            }}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="apple" size={17} color="#fff" />
            <Text style={styles.socialBtnText}>Apple ID</Text>
          </TouchableOpacity>
        </View>

        {/* Switch Mode Footer */}
        <View style={styles.switchModeFooter}>
          <Text style={styles.switchModePrompt}>
            {isLoginMode ? "Don't have an account yet?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
            <Text style={styles.switchModeLink}>
              {isLoginMode ? 'Sign Up here' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue as Guest option */}
        <View style={styles.guestSection}>
          <View style={styles.guestDivider}>
            <View style={styles.guestLine} />
            <Text style={styles.guestDividerText}>OR</Text>
            <View style={styles.guestLine} />
          </View>
          <TouchableOpacity
            style={styles.btnGuest}
            onPress={() => navigation?.navigate?.('Catalog')}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="shopping-bag" size={13} color={Colors.pureGreen} style={{ marginRight: 8 }} />
            <Text style={styles.btnGuestText}>Explore Street Market as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  topBackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.pureGreen
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  guestLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  guestSection: {
    marginTop: 18,
    alignItems: 'center'
  },
  guestDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12
  },
  guestLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  guestDividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    marginHorizontal: 10
  },
  btnGuest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  btnGuestText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  headerBox: {
    alignItems: 'center',
    marginVertical: 16
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 18,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: Colors.borderGlass
  },
  switchTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  switchTabActive: {
    backgroundColor: Colors.pureGreen
  },
  switchTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted
  },
  switchTabTextActive: {
    color: '#FFFFFF'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: Colors.borderGlass,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  roleCardActive: {
    borderColor: Colors.pureGreen,
    backgroundColor: Colors.pureGreen
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 6
  },
  roleTitleActive: {
    color: '#FFFFFF'
  },
  roleSub: {
    fontSize: 10,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: 2
  },
  roleSubActive: {
    color: '#FFFFFF',
    opacity: 0.95
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14
  },
  inputIcon: {
    marginRight: 10
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600'
  },
  saPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1'
  },
  saPrefixText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  eyeBtn: {
    padding: 8
  },
  strengthBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.borderGlass,
    borderRadius: 2,
    overflow: 'hidden'
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2
  },
  strengthText: {
    fontSize: 10,
    fontWeight: '800'
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13
  },
  locationSelectorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
    marginLeft: 8
  },
  locationDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGlass
  },
  locationOptionActive: {
    backgroundColor: Colors.pureGreen
  },
  locationOptionText: {
    fontSize: 12,
    color: Colors.textMuted
  },
  locationOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  kycSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    padding: 12,
    marginTop: 14
  },
  kycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  kycTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  kycDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    marginBottom: 8
  },
  kycInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.textMain,
    fontSize: 12
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2
  },
  checkboxActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  termsText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textDim,
    lineHeight: 16
  },
  btnSubmit: {
    backgroundColor: Colors.pureGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnDisabled: {
    opacity: 0.65
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderGlass
  },
  dividerText: {
    fontSize: 11,
    color: Colors.textDim,
    marginHorizontal: 12
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 12,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain
  },
  switchModeFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18
  },
  switchModePrompt: {
    fontSize: 12,
    color: Colors.textDim
  },
  switchModeLink: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen
  }
});
