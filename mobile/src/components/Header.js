/**
 * DOBHA DOBHA — App Header Component (React Native)
 * Pure Green & Pure White Theme
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function Header({
  navigation,
  onSearchPress,
  onNotifPress,
  canGoBack = false,
  onBackPress,
  currentTab,
  walletBalance = '450.00'
}) {
  const isSubScreen = canGoBack && !['Catalog', 'Reels'].includes(currentTab);

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          {isSubScreen ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onBackPress || (() => navigation?.goBack?.())}
              activeOpacity={0.7}
              accessibilityLabel="Go back"
            >
              <FontAwesome5 name="arrow-left" size={14} color={Colors.pureGreen} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation?.openDrawer ? navigation.openDrawer() : null}
              activeOpacity={0.7}
              accessibilityLabel="Open menu"
            >
              <FontAwesome5 name="bars" size={15} color={Colors.pureGreen} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.brandRow}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate?.('Catalog')}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.brandTitle}>DOBHA DOBHA</Text>
                <View style={styles.brandTag}>
                  <Text style={styles.brandTagText}>LOCAL TRADE</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress} activeOpacity={0.7}>
            <FontAwesome5 name="search" size={14} color={Colors.pureGreen} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={onNotifPress} activeOpacity={0.7}>
            <FontAwesome5 name="bell" size={14} color={Colors.pureGreen} />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub-bar: Location & Live Stalls */}
      <View style={styles.subBar}>
        <View style={styles.locationTag}>
          <FontAwesome5 name="map-pin" size={12} color={Colors.pureGreen} />
          <Text style={styles.locationText}>Joburg CBD (Bree / Park)</Text>
        </View>
        <View style={styles.liveTag}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveTagText}>38 Bales Live</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#F8FBF8',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1
  },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5
  },
  brandTag: {
    backgroundColor: Colors.pureGreen,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5
  },
  brandTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.brandRed
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  walletText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  locationText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandRed
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C'
  }
});
