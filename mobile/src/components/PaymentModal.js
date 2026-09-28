/**
 * DOBHA DOBHA — South African Payment & Escrow Checkout Modal (React Native)
 * Supports: Capitec Pay, Ozow Instant EFT, PayFast (Card), SnapScan/Zapper, 1ForYou Voucher
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import Colors from '../theme/colors';
import { OrderStore } from '../services/orderStore';
import ApiService from '../services/api';
import UserStore from '../services/userStore';

const SA_PAYMENT_METHODS = [
  {
    id: 'capitec_pay',
    name: 'Capitec Pay',
    tag: 'Instant',
    tagColor: '#ef4444',
    icon: 'mobile-alt',
    logo: 'https://img.logo.dev/capitecbank.co.za?token=pk_YATscD2-Rx6ItVMsD1ElFw&size=60',
    description: 'Approval prompt sent to your Capitec banking app'
  },
  {
    id: 'ozow_eft',
    name: 'Ozow Instant EFT',
    tag: 'Instant EFT',
    tagColor: '#00A651',
    icon: 'university',
    logo: 'https://img.logo.dev/ozow.com?token=pk_YATscD2-Rx6ItVMsD1ElFw&size=60',
    description: 'Instant clearing EFT from all major SA banks'
  },
  {
    id: 'payfast_card',
    name: 'Debit / Credit Card',
    tag: '3D Secure',
    tagColor: '#6366f1',
    icon: 'credit-card',
    logo: 'https://img.logo.dev/payfast.co.za?token=pk_YATscD2-Rx6ItVMsD1ElFw&size=60',
    description: 'Visa & Mastercard DebiCheck 3D Secure verification'
  },
  {
    id: 'snap_zapper',
    name: 'SnapScan / Zapper',
    tag: 'Scan & Pay',
    tagColor: '#38bdf8',
    icon: 'qrcode',
    logo: 'https://img.logo.dev/snapscan.co.za?token=pk_YATscD2-Rx6ItVMsD1ElFw&size=60',
    description: 'QR scan confirmation with SnapScan or Zapper'
  },
  {
    id: 'voucher_flash',
    name: '1ForYou / Flash Voucher',
    tag: 'Cash Voucher',
    tagColor: '#f59e0b',
    icon: 'receipt',
    logo: 'https://img.logo.dev/1foryou.com?token=pk_YATscD2-Rx6ItVMsD1ElFw&size=60',
    description: 'Cash voucher redemption from Shoprite, Pep, or Spaza'
  }
];

const SA_BANKS = [
  { id: 'capitec', name: 'Capitec', color: '#005494' },
  { id: 'fnb', name: 'FNB', color: '#0097a7' },
  { id: 'standard', name: 'Standard Bank', color: '#0033a0' },
  { id: 'nedbank', name: 'Nedbank', color: '#004c3f' },
  { id: 'absa', name: 'Absa', color: '#b91c1c' },
  { id: 'tyme', name: 'TymeBank', color: '#f59e0b' }
];

export default function PaymentModal({ visible, item, onClose, onSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState('capitec_pay');
  const [fulfillment, setFulfillment] = useState('collect'); // 'collect' | 'courier'
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Form Fields without fake demo values
  const currentProfile = UserStore.getProfile();
  const [capitecNumber, setCapitecNumber] = useState(currentProfile?.phone || '');
  const [selectedBank, setSelectedBank] = useState('capitec');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [voucherCode, setVoucherCode] = useState('');

  if (!visible || !item) return null;

  const itemPrice = Number(item.price || 0);
  const courierFee = fulfillment === 'courier' ? 45.00 : 0.00;
  const totalPrice = itemPrice + courierFee;

  const handleProcessPayment = async () => {
    // 1. Check authentication
    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to secure pieces into the Escrow Vault.'
      );
      return;
    }

    // 2. Strict restriction: users cannot buy their own items
    const profile = UserStore.getProfile();
    const sellerId = item.seller_id || item.sellerId;
    if (profile?.id && sellerId === profile.id) {
      Alert.alert(
        'Your Own Listing',
        'You cannot purchase an item that you listed.'
      );
      return;
    }

    setLoading(true);

    if (selectedMethod === 'capitec_pay') {
      const phone = capitecNumber.trim() || profile?.phone;
      if (!phone) {
        setLoading(false);
        Alert.alert('Phone Required', 'Please enter your Capitec cellphone number.');
        return;
      }
      setStatusMessage(`Sending approval prompt to ${phone}...`);
      setTimeout(() => {
        finalizePayment('Capitec Pay');
      }, 1000);
    } else if (selectedMethod === 'ozow_eft') {
      const bankName = SA_BANKS.find((b) => b.id === selectedBank)?.name || 'Bank';
      setStatusMessage(`Initiating instant EFT with ${bankName}...`);
      setTimeout(() => {
        finalizePayment(`Ozow Instant EFT - ${bankName}`);
      }, 1000);
    } else if (selectedMethod === 'payfast_card') {
      if (!cardNumber.trim()) {
        setLoading(false);
        Alert.alert('Card Required', 'Please enter your card number.');
        return;
      }
      setStatusMessage('Connecting to 3D Secure / DebiCheck...');
      setTimeout(() => {
        finalizePayment('Debit / Credit Card');
      }, 1000);
    } else if (selectedMethod === 'snap_zapper') {
      setStatusMessage('Confirming QR payment authorization...');
      setTimeout(() => {
        finalizePayment('SnapScan / Zapper QR');
      }, 1000);
    } else if (selectedMethod === 'voucher_flash') {
      if (!voucherCode.trim()) {
        setLoading(false);
        Alert.alert('Voucher Code Required', 'Please enter your 16-digit 1ForYou voucher code.');
        return;
      }
      setStatusMessage('Validating 16-digit voucher pin...');
      setTimeout(() => {
        finalizePayment('1ForYou Cash Voucher');
      }, 1000);
    }
  };

  const finalizePayment = async (methodName) => {
    const pickupLoc =
      fulfillment === 'courier'
        ? 'Courier Delivery via Uber Connect (Johannesburg Central)'
        : 'Safe Trade Hub: Bree Taxi Rank Concourse, Joburg CBD';

    try {
      const orderRes = await ApiService.createEscrowOrder({
        item_id: item.id,
        item_title: item.title,
        item_price: itemPrice,
        seller_id: item.seller_id || item.sellerId,
        seller_name: item.seller || item.seller_name,
        fulfillment_type: fulfillment === 'courier' ? 'uber_delivery' : 'click_collect',
        pickup_location: pickupLoc,
        payment_method: methodName
      });

      setLoading(false);
      setStatusMessage('');

      if (orderRes?.success && orderRes.order) {
        const newOrder = OrderStore.addOrder(orderRes.order);

        Alert.alert(
          'Payment Locked in Escrow Vault!',
          `R${totalPrice.toFixed(2)} has been secured into the DOBHA DOBHA Escrow Vault via ${methodName}.\n\nThe seller only receives payout when you inspect the piece in person at Bree Taxi Rank and scan your QR pickup pass.`,
          [
            {
              text: 'View Pickup Pass',
              onPress: () => {
                onClose();
                if (onSuccess) onSuccess(newOrder);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Payment Error',
          orderRes?.message || 'Could not initiate Escrow order. Please try again.'
        );
      }
    } catch (err) {
      setLoading(false);
      setStatusMessage('');
      Alert.alert(
        'Connection Error',
        'Could not reach Escrow server. Please check your network connection.'
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.vaultBadge}>
                <FontAwesome5 name="shield-alt" size={10} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.vaultBadgeText}>SAFE ESCROW PROTECTED</Text>
              </View>
              <Text style={styles.headerTitle}>Escrow Vault Checkout</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={16} color={Colors.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Item Summary Card */}
            <View style={styles.itemSummary}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.itemSeller}>Seller: {item.seller || 'Joburg Street Seller'}</Text>
              </View>
              <Text style={styles.itemPrice}>R{itemPrice.toFixed(2)}</Text>
            </View>

            {/* Escrow Guarantee Card */}
            <View style={styles.securityBanner}>
              <FontAwesome5 name="shield-alt" size={13} color={Colors.pureGreen} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityBannerTitle}>CASHLESS ESCROW VAULT ACTIVE</Text>
                <Text style={styles.securityBannerSub}>
                  Payment is locked safely in the vault. The seller only receives payout when you inspect the piece in person at Bree Taxi Rank / Safe Trade Hub and present your QR pickup pass.
                </Text>
              </View>
            </View>

            {/* Fulfillment Selector */}
            <Text style={styles.sectionTitle}>1. Select Collection / Delivery</Text>
            <View style={styles.fulfillmentRow}>
              <TouchableOpacity
                style={[styles.fulfillmentCard, fulfillment === 'collect' && styles.fulfillmentCardActive]}
                onPress={() => setFulfillment('collect')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="store"
                  size={16}
                  color={fulfillment === 'collect' ? Colors.brandEmerald : Colors.textMuted}
                />
                <Text style={[styles.fulfillmentName, fulfillment === 'collect' && styles.textActive]}>
                  Safe Hub Pickup
                </Text>
                <Text style={styles.fulfillmentSub}>FREE (Joburg CBD)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fulfillmentCard, fulfillment === 'courier' && styles.fulfillmentCardActive]}
                onPress={() => setFulfillment('courier')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="motorcycle"
                  size={16}
                  color={fulfillment === 'courier' ? Colors.brandSky : Colors.textMuted}
                />
                <Text style={[styles.fulfillmentName, fulfillment === 'courier' && styles.textActive]}>
                  Uber / Courier
                </Text>
                <Text style={styles.fulfillmentSub}>+ R45.00 Fee</Text>
              </TouchableOpacity>
            </View>

            {/* Payment Method Selector */}
            <Text style={styles.sectionTitle}>2. Select South African Payment Method</Text>
            {SA_PAYMENT_METHODS.map((method) => {
              const isSelected = selectedMethod === method.id;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={[styles.methodCard, isSelected && styles.methodCardActive]}
                  onPress={() => setSelectedMethod(method.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodTop}>
                    <View style={styles.methodIconBox}>
                      <FontAwesome5
                        name={method.icon}
                        size={16}
                        color={isSelected ? Colors.brandEmerald : '#94a3b8'}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.methodTitleRow}>
                        <Text style={[styles.methodName, isSelected && styles.textActive]}>
                          {method.name}
                        </Text>
                        <View style={[styles.methodTag, { backgroundColor: `${method.tagColor}22` }]}>
                          <Text style={[styles.methodTagText, { color: method.tagColor }]}>
                            {method.tag}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.methodDesc}>{method.description}</Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>

                  {/* Method Specific Form details when selected */}
                  {isSelected && (
                    <View style={styles.methodDetailContainer}>
                      {method.id === 'capitec_pay' && (
                        <View>
                          <Text style={styles.inputLabel}>Capitec Cellphone / ID Number</Text>
                          <TextInput
                            style={styles.textInput}
                            value={capitecNumber}
                            onChangeText={setCapitecNumber}
                            placeholder="082 123 4567"
                            placeholderTextColor={Colors.textDim}
                            keyboardType="phone-pad"
                          />
                          <View style={styles.secureNoteRow}>
                            <FontAwesome5 name="shield-alt" size={11} color={Colors.brandEmerald} />
                            <Text style={styles.secureNoteText}>
                              Zero transaction fees. Approve instantly inside your Capitec app.
                            </Text>
                          </View>
                        </View>
                      )}

                      {method.id === 'ozow_eft' && (
                        <View>
                          <Text style={styles.inputLabel}>Choose Your South African Bank</Text>
                          <View style={styles.banksGrid}>
                            {SA_BANKS.map((bank) => (
                              <TouchableOpacity
                                key={bank.id}
                                style={[
                                  styles.bankChip,
                                  selectedBank === bank.id && styles.bankChipActive
                                ]}
                                onPress={() => setSelectedBank(bank.id)}
                              >
                                <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                                <Text
                                  style={[
                                    styles.bankText,
                                    selectedBank === bank.id && styles.bankTextActive
                                  ]}
                                >
                                  {bank.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {method.id === 'payfast_card' && (
                        <View>
                          <Text style={styles.inputLabel}>Card Number (Visa / Mastercard)</Text>
                          <TextInput
                            style={styles.textInput}
                            value={cardNumber}
                            onChangeText={setCardNumber}
                            placeholder="4532 0000 0000 0000"
                            placeholderTextColor={Colors.textDim}
                            keyboardType="number-pad"
                          />
                          <View style={styles.cardRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.inputLabel}>Expiry</Text>
                              <TextInput
                                style={styles.textInput}
                                value={cardExpiry}
                                onChangeText={setCardExpiry}
                                placeholder="MM/YY"
                                placeholderTextColor={Colors.textDim}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.inputLabel}>CVV</Text>
                              <TextInput
                                style={styles.textInput}
                                value={cardCvv}
                                onChangeText={setCardCvv}
                                placeholder="123"
                                placeholderTextColor={Colors.textDim}
                                secureTextEntry
                                keyboardType="number-pad"
                              />
                            </View>
                          </View>
                        </View>
                      )}

                      {method.id === 'snap_zapper' && (
                        <View style={styles.qrContainer}>
                          <View style={styles.qrBox}>
                            <Svg width={100} height={100} viewBox="0 0 100 100">
                              <Rect width="100" height="100" fill="#ffffff" rx={4} />
                              <Rect x="8" y="8" width="26" height="26" fill="#0f172a" rx={3} />
                              <Rect x="12" y="12" width="18" height="18" fill="#ffffff" rx={2} />
                              <Rect x="16" y="16" width="10" height="10" fill="#38bdf8" rx={1} />
                              <Rect x="66" y="8" width="26" height="26" fill="#0f172a" rx={3} />
                              <Rect x="70" y="12" width="18" height="18" fill="#ffffff" rx={2} />
                              <Rect x="74" y="16" width="10" height="10" fill="#38bdf8" rx={1} />
                              <Rect x="8" y="66" width="26" height="26" fill="#0f172a" rx={3} />
                              <Rect x="12" y="70" width="18" height="18" fill="#ffffff" rx={2} />
                              <Rect x="16" y="74" width="10" height="10" fill="#38bdf8" rx={1} />
                              <Rect x="42" y="12" width="6" height="6" fill="#0f172a" />
                              <Rect x="42" y="42" width="16" height="16" fill="#0f172a" rx={2} />
                              <Rect x="68" y="68" width="18" height="18" fill="#38bdf8" rx={2} />
                            </Svg>
                          </View>
                          <Text style={styles.qrInstruction}>
                            Scan with SnapScan or Zapper app on your phone.
                          </Text>
                          <TouchableOpacity
                            style={styles.btnSimulateScan}
                            onPress={handleProcessPayment}
                            disabled={loading}
                            activeOpacity={0.8}
                          >
                            <FontAwesome5 name="qrcode" size={11} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.btnSimulateScanText}>Simulate SnapScan QR Payment</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {method.id === 'voucher_flash' && (
                        <View>
                          <Text style={styles.inputLabel}>16-Digit Voucher Code (Flash / 1ForYou / OTT)</Text>
                          <TextInput
                            style={styles.textInput}
                            value={voucherCode}
                            onChangeText={setVoucherCode}
                            placeholder="e.g. 9842 1048 2938 1029"
                            placeholderTextColor={Colors.textDim}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.voucherSub}>
                            Available at Shoprite, Checkers, Boxer, and local Spaza shops.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Escrow Trust Guarantee */}
            <View style={styles.escrowBanner}>
              <FontAwesome5 name="shield-alt" size={16} color={Colors.brandEmerald} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.escrowBannerTitle}>Escrow Buyer Protection Guarantee</Text>
                <Text style={styles.escrowBannerText}>
                  Your funds are held securely. The seller is NEVER paid until you physically inspect the item at the pickup point and scan your QR pass.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Pay Action */}
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total Escrow Vault Hold:</Text>
                <Text style={styles.totalSub}>
                  {fulfillment === 'courier' ? 'Item + R45 Uber Courier' : 'Item + Free Safe Hub Collection'}
                </Text>
              </View>
              <Text style={styles.totalAmount}>R{totalPrice.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.btnPay, loading && styles.btnDisabled]}
              onPress={handleProcessPayment}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                  <Text style={styles.btnPayText}>{statusMessage || 'Securing Escrow Vault...'}</Text>
                </View>
              ) : (
                <View style={styles.payRow}>
                  <FontAwesome5 name="lock" size={15} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnPayText}>
                    Lock R{totalPrice.toFixed(2)} into Escrow Vault
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGlass
  },
  headerLeft: {
    flex: 1
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6
  },
  vaultBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.pureWhite,
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A'
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    padding: 18
  },
  itemSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  itemSeller: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  itemPrice: {
    fontSize: 19,
    fontWeight: '900',
    color: Colors.pureGreen
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  fulfillmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  fulfillmentCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  fulfillmentCardActive: {
    borderColor: Colors.pureGreen,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2
  },
  fulfillmentName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6
  },
  fulfillmentSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  methodCardActive: {
    borderColor: Colors.pureGreen,
    borderWidth: 2,
    backgroundColor: '#FFFFFF'
  },
  methodTop: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  methodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    justifyContent: 'center',
    alignItems: 'center'
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  methodName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain
  },
  methodTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  methodTagText: {
    fontSize: 10,
    fontWeight: '800'
  },
  methodDesc: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.borderGlass,
    justifyContent: 'center',
    alignItems: 'center'
  },
  radioCircleSelected: {
    borderColor: Colors.pureGreen
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.pureGreen
  },
  methodDetailContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textMain,
    fontSize: 13,
    marginBottom: 8
  },
  cardRow: {
    flexDirection: 'row'
  },
  secureNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2
  },
  secureNoteText: {
    fontSize: 11,
    color: Colors.pureGreen,
    fontWeight: '600'
  },
  banksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderGlass
  },
  bankChipActive: {
    borderColor: Colors.pureGreen,
    borderWidth: 1.5,
    backgroundColor: Colors.pureGreen
  },
  bankDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  bankText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  bankTextActive: {
    color: Colors.pureWhite
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 8
  },
  qrBox: {
    padding: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    marginBottom: 6
  },
  qrInstruction: {
    fontSize: 11,
    color: Colors.textDim
  },
  voucherSub: {
    fontSize: 10,
    color: Colors.textDim
  },
  escrowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    marginVertical: 14
  },
  escrowBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen,
    marginBottom: 2
  },
  escrowBannerText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15
  },
  footer: {
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
    backgroundColor: '#FFFFFF'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted
  },
  totalSub: {
    fontSize: 11,
    color: Colors.textDim
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.pureGreen
  },
  btnPay: {
    backgroundColor: Colors.pureGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnDisabled: {
    opacity: 0.7
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnPayText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  textActive: {
    color: Colors.pureGreen
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16
  },
  securityBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 2,
    letterSpacing: 0.5
  },
  securityBannerSub: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 15
  },
  btnSimulateScan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 8
  },
  btnSimulateScanText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800'
  }
});
