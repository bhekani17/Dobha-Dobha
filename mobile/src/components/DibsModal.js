/**
 * DOBHA DOBHA — 90-Second Dibs Countdown Modal (React Native)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function DibsModal({ visible, item, onProceed, onCancel }) {
  const [secondsLeft, setSecondsLeft] = useState(90);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(90);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onCancel) onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  if (!visible || !item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <FontAwesome5 name="bolt" size={12} color={Colors.brandRed} />
              <Text style={styles.badgeText}>LIVE ITEM RESERVED</Text>
            </View>
          </View>

          <View style={styles.circle}>
            <Text style={styles.circleText}>{secondsLeft}s</Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>R{Number(item.price || 0).toFixed(2)}</Text>

          <Text style={styles.desc}>
            This piece is held exclusively for you. Lock your payment into the Escrow Vault before the timer expires or it returns to the live street bale.
          </Text>

          <TouchableOpacity style={styles.btnLock} onPress={onProceed} activeOpacity={0.85}>
            <FontAwesome5 name="lock" size={15} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnLockText}>Lock In Escrow Checkout</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
            <Text style={styles.btnCancelText}>Release to next buyer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  badgeRow: {
    marginBottom: 12
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  badgeText: {
    color: Colors.brandRed,
    fontSize: 11,
    fontWeight: '800'
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.brandRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.06)'
  },
  circleText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.brandRed
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4
  },
  price: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.brandEmerald,
    marginBottom: 10
  },
  desc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  btnLock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandRed,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.brandRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnLockText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  btnCancel: {
    marginTop: 12,
    padding: 8
  },
  btnCancelText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700'
  }
});
