/**
 * DOBHA DOBHA — Animated Splash Screen (React Native)
 * Cinematic animated entrance with brand logo, tagline, and street thrift badges
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  StatusBar,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    // 1. Entrance animation (scale + fade logo)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver
      })
    ]).start();

    // 2. Text & badges fade in
    Animated.timing(textFadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 350,
      useNativeDriver
    }).start();

    // 3. Progress bar fill
    Animated.timing(barAnim, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false
    }).start();

    // 5. Exit smoothly after 2.1 seconds with guaranteed safety timer
    let finishedCalled = false;
    const finishSplash = () => {
      if (!finishedCalled) {
        finishedCalled = true;
        if (onFinish) onFinish();
      }
    };

    const exitTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver
      }).start(() => {
        finishSplash();
      });

      // Hard safety fallback in case animation completion callback does not trigger
      setTimeout(finishSplash, 450);
    }, 2100);

    return () => {
      clearTimeout(exitTimer);
      finishSplash();
    };
  }, []);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0D14" />

      <View style={styles.content}>
        {/* Animated Brand Logo Icon */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Brand Title & Street Tagline */}
        <Animated.View style={[styles.textBlock, { opacity: textFadeAnim }]}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>DOBHA DOBHA</Text>
            <View style={styles.badgeLiveDot} />
          </View>

          <Text style={styles.brandSubtitle}>
            MZANSI STREET THRIFT & LIVE BALES
          </Text>

          <Text style={styles.brandDescription}>
            Johannesburg CBD • Bree Rank • Park Station
          </Text>

          {/* Guarantee Badges */}
          <View style={styles.badgeRow}>
            <View style={styles.featureBadge}>
              <FontAwesome5 name="shield-alt" size={10} color={Colors.pureGreen} style={{ marginRight: 5 }} />
              <Text style={styles.featureBadgeText}>Escrow Vault</Text>
            </View>
            <View style={styles.featureBadge}>
              <FontAwesome5 name="qrcode" size={10} color={Colors.pureGreen} style={{ marginRight: 5 }} />
              <Text style={styles.featureBadgeText}>QR Pickup</Text>
            </View>
            <View style={styles.featureBadge}>
              <FontAwesome5 name="bolt" size={10} color={Colors.pureGreen} style={{ marginRight: 5 }} />
              <Text style={styles.featureBadgeText}>Live Dibs</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Loading Progress Bar */}
      <View style={styles.footer}>
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, { width: barWidth }]} />
        </View>
        <Text style={styles.loadingStatusText}>
          Connecting to Johannesburg street feed...
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    flex: 1,
    backgroundColor: '#0A0D14',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    zIndex: 999
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  logoWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26
  },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#131926',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8
  },
  logoImage: {
    width: 68,
    height: 68
  },
  textBlock: {
    alignItems: 'center'
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2
  },
  badgeLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.pureGreen,
    marginLeft: 6
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.pureGreen,
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase'
  },
  brandDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center'
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20
  },
  featureBadgeText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700'
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    alignItems: 'center'
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.pureGreen,
    borderRadius: 2
  },
  loadingStatusText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10
  }
});
