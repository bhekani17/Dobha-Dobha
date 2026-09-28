/**
 * DOBHA DOBHA — ItemDetailModal (React Native)
 * Full Product Sheet for thrift pieces and bales
 */

import React from 'react';
import { View, Text, Modal, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import BrandLogo from '../components/BrandLogo';
import Colors from '../theme/colors';

import UserStore from '../services/userStore';

export default function ItemDetailModal({ visible, item, onClose, onDibs, onNegotiate }) {
  if (!visible || !item) return null;

  const currentProfile = UserStore.getProfile();
  const isOwner = Boolean(
    currentProfile?.id && (item.seller_id === currentProfile.id || item.sellerId === currentProfile.id)
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.tag || 'Grade A Thrift'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={16} color={Colors.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Gallery Image */}
            <View style={styles.imageContainer}>
              <Image source={{ uri: item.img || item.mediaUrl }} style={styles.mainImage} resizeMode="cover" />
            </View>

            {/* Title & Brand */}
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.title}</Text>
                {item.brandDomain && (
                  <BrandLogo domain={item.brandDomain} brandName={item.brandName} size={15} />
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceCurrent}>R{Number(item.price || 0).toFixed(2)}</Text>
                <Text style={styles.priceOriginal}>R{Number(item.originalPrice || item.price * 3).toFixed(2)}</Text>
              </View>
            </View>

            {/* Seller Info Box */}
            <View style={styles.sellerBox}>
              <Image
                source={{ uri: item.sellerAvatar || item.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' }}
                style={styles.sellerAvatar}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sellerName}>{item.seller}</Text>
                  {isOwner && (
                    <View style={styles.ownerChip}>
                      <Text style={styles.ownerChipText}>YOU</Text>
                    </View>
                  )}
                </View>
                <View style={styles.locationRow}>
                  <FontAwesome5 name="map-marker-alt" size={10} color={Colors.brandAmber} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>
              </View>
              <View style={styles.verifiedChip}>
                <FontAwesome5 name="check-circle" solid size={11} color={Colors.pureWhite} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.descTitle}>Item Description</Text>
            <Text style={styles.description}>
              {item.description || 'Authentic hand-picked second hand thrift piece from the Johannesburg street market. Inspected and verified in person.'}
            </Text>

            {/* South African Payments Accepted */}
            <View style={styles.saPaymentsBanner}>
              <View style={styles.saBannerTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome5 name="shield-alt" size={10} color={Colors.pureGreen} />
                  <Text style={styles.saBannerTitle}>LOCAL SA PAYMENTS ACCEPTED</Text>
                </View>
                <View style={styles.escrowChip}>
                  <FontAwesome5 name="check-circle" size={9} color={Colors.pureWhite} />
                  <Text style={styles.escrowChipText}>Escrow Held</Text>
                </View>
              </View>
              <Text style={styles.saBannerList}>
                Capitec Pay • Ozow Instant EFT • Visa / Mastercard • SnapScan / Zapper • 1ForYou / Flash Cash Voucher
              </Text>
            </View>

            {/* Action Buttons */}
            {isOwner ? (
              <View style={styles.ownerNoticeBox}>
                <FontAwesome5 name="info-circle" size={14} color={Colors.pureGreen} style={{ marginRight: 8 }} />
                <Text style={styles.ownerNoticeText}>
                  This piece was listed by you. You cannot purchase or claim Dibs on your own items.
                </Text>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.btnChat} onPress={onNegotiate} activeOpacity={0.8}>
                  <FontAwesome5 name="comments" size={14} color={Colors.textMain} style={{ marginRight: 6 }} />
                  <Text style={styles.btnChatText}>Negotiate / Offer</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnDibs} onPress={onDibs} activeOpacity={0.85}>
                  <FontAwesome5 name="bolt" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.btnDibsText}>Claim Dibs!</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  badge: {
    backgroundColor: Colors.pureGreen,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  badgeText: {
    color: Colors.pureWhite,
    fontSize: 11,
    fontWeight: '800'
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  mainImage: {
    width: '100%',
    height: '100%'
  },
  titleSection: {
    marginBottom: 12
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8
  },
  priceCurrent: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.pureGreen
  },
  priceOriginal: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'line-through'
  },
  sellerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  locationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500'
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6
  },
  verifiedText: {
    color: Colors.pureWhite,
    fontSize: 10.5,
    fontWeight: '800'
  },
  descTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  description: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 18
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  btnChat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 13,
    borderRadius: 14
  },
  btnChatText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800'
  },
  btnDibs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3
  },
  btnDibsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  saPaymentsBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    padding: 13,
    marginBottom: 16
  },
  saBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  saBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.pureGreen,
    letterSpacing: 0.4
  },
  escrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 4
  },
  escrowChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.pureWhite
  },
  saBannerList: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '500'
  },
  ownerChip: {
    backgroundColor: 'rgba(0, 166, 81, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  ownerChipText: {
    color: Colors.pureGreen,
    fontSize: 9.5,
    fontWeight: '900'
  },
  ownerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
    borderRadius: 12,
    marginTop: 4
  },
  ownerNoticeText: {
    flex: 1,
    color: '#166534',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18
  }
});
