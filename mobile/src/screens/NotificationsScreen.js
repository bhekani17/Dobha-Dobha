/**
 * DOBHA DOBHA — NotificationsScreen (React Native)
 * Trade and escrow alerts feed
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtnSmall}
              accessibilityLabel="Back"
            >
              <FontAwesome5 name="arrow-left" size={13} color={Colors.pureGreen} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Trade Notifications</Text>
        </View>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markReadText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <FontAwesome5 name="bell" size={24} color={Colors.textDim} />
            <Text style={styles.emptyStateTitle}>No notifications yet</Text>
            <Text style={styles.emptyStateText}>Trade and escrow updates will appear here.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.notifCard, item.unread && styles.notifCardUnread]}>
            <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
              <FontAwesome5 name={item.icon} size={15} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
              <Text style={styles.notifMessage}>{item.message}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: 28
  },
  emptyStateTitle: {
    color: Colors.textMain,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12
  },
  emptyStateText: {
    color: Colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A'
  },
  backBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  listContent: {
    padding: 14,
    gap: 12
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  notifCardUnread: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.pureGreen
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  notifTime: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  notifMessage: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18
  }
});
