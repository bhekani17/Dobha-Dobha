/**
 * DOBHA DOBHA — SafetyScreen (React Native)
 * Joburg CBD Street Safety & Scam Prevention Guide
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

const SAFETY_TIPS = [
  {
    icon: 'coins',
    title: 'Never Carry Cash in Public',
    desc: 'All payments are locked into Escrow through the app. You only need your phone to collect items.'
  },
  {
    icon: 'map-marker-alt',
    title: 'Designated Safe-Trade Hubs',
    desc: 'Meet sellers inside well-lit security precincts: Gautrain Park Station concourse, Carlton Centre Mall security zones, or Braamfontein hub.'
  },
  {
    icon: 'qrcode',
    title: 'Inspect Before QR Handover',
    desc: 'Check the garment condition physically. Once you let the seller scan your QR code or 6-digit PIN, funds are permanently settled.'
  },
  {
    icon: 'motorcycle',
    title: 'Use Uber Direct for Long Distance',
    desc: 'If you cannot travel to the CBD, choose Uber Direct delivery during checkout for R45. The driver picks up and drops off at your door.'
  }
];

export default function SafetyScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Back Row */}
      {navigation?.canGoBack?.() && (
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="arrow-left" size={13} color={Colors.pureGreen} style={{ marginRight: 6 }} />
          <Text style={styles.backRowText}>Back</Text>
        </TouchableOpacity>
      )}

      {/* Red Alert Header */}
      <View style={styles.alertCard}>
        <View style={styles.headerRow}>
          <FontAwesome5 name="shield-alt" size={16} color="#DC2626" />
          <Text style={styles.alertTitle}>Joburg Street Safety Guide</Text>
        </View>
        <Text style={styles.alertSub}>
          How DOBHA DOBHA removes the physical safety risks of shopping in the CBD.
        </Text>
      </View>

      {/* Safety Cards List */}
      <View style={styles.cardsList}>
        {SAFETY_TIPS.map((tip, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name={tip.icon} size={16} color={Colors.brandRed} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{tip.title}</Text>
              <Text style={styles.cardDesc}>{tip.desc}</Text>
            </View>
          </View>
        ))}
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
    padding: 14,
    paddingBottom: 40
  },
  alertCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    marginBottom: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#DC2626'
  },
  alertSub: {
    fontSize: 12.5,
    color: '#991B1B',
    lineHeight: 18
  },
  cardsList: {
    gap: 12
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4
  },
  cardDesc: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  backRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.pureGreen
  }
});
