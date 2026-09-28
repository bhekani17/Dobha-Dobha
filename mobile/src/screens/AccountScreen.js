/**
 * DOBHA DOBHA — AccountScreen (React Native)
 * User Profile, Profile Update Modal, SA Bank Payout Details, and Account Navigation
 * Pure Green (#00A651) & Pure White (#FFFFFF) Theme
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';
import UserStore from '../services/userStore';
import ApiService, { resolveImageUrl, DEFAULT_ITEM_IMAGE } from '../services/api';
import EditProfileModal from '../components/EditProfileModal';

const BANKS = ['Capitec Bank', 'FNB (First National Bank)', 'Standard Bank', 'Nedbank', 'TymeBank'];

export default function AccountScreen({ navigation }) {
  const [profile, setProfile] = useState(UserStore.getProfile() || {});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedBank, setSelectedBank] = useState(profile?.selectedBank || 'Capitec Bank');
  const [accNum, setAccNum] = useState(profile?.accountNumber || '');
  const [myItems, setMyItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchMyItems = async (sellerId) => {
    if (!sellerId) return;
    try {
      setLoadingItems(true);
      const res = await ApiService.getUserItems(sellerId);
      if (res && res.success && Array.isArray(res.items)) {
        setMyItems(res.items);
      } else {
        setMyItems([]);
      }
    } catch (err) {
      console.warn('Could not fetch user items:', err);
      setMyItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    const unsub = UserStore.subscribe((updated) => {
      setProfile(updated || {});
      if (updated?.selectedBank) setSelectedBank(updated.selectedBank);
      if (updated?.accountNumber) setAccNum(updated.accountNumber);
      if (updated?.id) fetchMyItems(updated.id);
    });

    if (profile?.id) {
      fetchMyItems(profile.id);
    }

    const unsubItem = UserStore.subscribeItemUploaded(() => {
      const p = UserStore.getProfile();
      if (p?.id) fetchMyItems(p.id);
    });

    return () => {
      unsub();
      unsubItem();
    };
  }, []);

  const handleSaveBank = () => {
    if (!accNum.trim()) {
      Alert.alert('Account Number Required', 'Please enter your South African bank account number.');
      return;
    }
    UserStore.updateProfile({ selectedBank, accountNumber: accNum.trim() });
    Alert.alert(
      'Payout Account Saved',
      `Escrow funds from QR scans will transfer directly to your ${selectedBank} account (${accNum.trim()}).`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Hero Card */}
      <View style={styles.profileHero}>
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: profile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' }}
            style={styles.avatar}
          />
          <TouchableOpacity
            style={styles.avatarPencilBtn}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="pen" size={10} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileDetails}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{profile.displayName || profile.fullName}</Text>
            <TouchableOpacity
              style={styles.btnEditProfile}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="user-edit" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.btnEditProfileText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.userLocation}>
            <FontAwesome5 name="map-marker-alt" size={10} color={Colors.pureGreen} /> {profile.locationHub || profile.location || 'Braamfontein'}
          </Text>

          {profile.phone ? (
            <Text style={styles.userPhone}>
              <FontAwesome5 name="phone-alt" size={9} color={Colors.textMuted} /> {profile.phone}
            </Text>
          ) : null}

          <View style={styles.badgesRow}>
            {profile.isKycVerified ? (
              <View style={styles.kycBadge}>
                <FontAwesome5 name="check-circle" solid size={10} color="#FFFFFF" />
                <Text style={styles.kycText}>SA ID Verified</Text>
              </View>
            ) : null}
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {profile.role === 'both' ? 'Buyer & Seller' : profile.role === 'seller' ? 'Street Trader' : 'Buyer'}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <FontAwesome5 name="star" solid size={9} color="#B45309" style={{ marginRight: 3 }} />
              <Text style={styles.ratingText}>{profile.rating || '5.0'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Trader Bio Box */}
      {profile.bio ? (
        <View style={styles.bioCard}>
          <View style={styles.bioHeader}>
            <FontAwesome5 name="quote-left" size={10} color={Colors.pureGreen} />
            <Text style={styles.bioTitle}>Trader Bio & Street Rules</Text>
          </View>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* My Active Listings & Uploads */}
      <View style={styles.card}>
        <View style={styles.listingsHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome5 name="tags" size={15} color={Colors.pureGreen} />
            <Text style={styles.cardTitle}>My Uploaded Pieces</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{myItems.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.btnDropPieceSmall}
            onPress={() => navigation?.navigate('Sell')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="plus" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.btnDropPieceSmallText}>Drop Piece</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSub}>
          Live garments & wholesale bales you uploaded to Dobha Dobha.
        </Text>

        {loadingItems ? (
          <ActivityIndicator size="small" color={Colors.pureGreen} style={{ marginVertical: 18 }} />
        ) : myItems.length > 0 ? (
          <View style={styles.myItemsGrid}>
            {myItems.map((item) => (
              <View key={item.id} style={styles.myItemCard}>
                <Image
                  source={{ uri: resolveImageUrl(item.images?.[0] || item.img, DEFAULT_ITEM_IMAGE) }}
                  style={styles.myItemImage}
                  resizeMode="cover"
                />
                <View style={styles.myItemContent}>
                  <Text style={styles.myItemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.myItemMeta}>
                    <Text style={styles.myItemPrice}>R{Number(item.price).toFixed(2)}</Text>
                    <View style={styles.livePill}>
                      <View style={styles.greenDot} />
                      <Text style={styles.livePillText}>{item.status === 'active' ? 'Live' : item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.myItemLocation} numberOfLines={1}>
                    <FontAwesome5 name="map-marker-alt" size={9} color={Colors.textDim} /> {item.location || 'Joburg CBD'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyListingsBox}>
            <FontAwesome5 name="tshirt" size={28} color={Colors.textDim} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyListingsTitle}>No pieces listed yet</Text>
            <Text style={styles.emptyListingsSub}>
              Snap clothes, sneakers, or wholesale bales to start selling with cashless escrow PINs.
            </Text>
            <TouchableOpacity
              style={styles.btnStartDrop}
              onPress={() => navigation?.navigate('Sell')}
              activeOpacity={0.85}
            >
              <FontAwesome5 name="camera" size={12} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnStartDropText}>Drop Your First Piece</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Seller Payout Settings */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FontAwesome5 name="university" size={14} color={Colors.pureGreen} />
          <Text style={styles.cardTitle}>Seller Payout Bank Details</Text>
        </View>
        <Text style={styles.cardSub}>Funds released upon QR scan are transferred here automatically.</Text>

        <Text style={styles.fieldLabel}>Select Bank</Text>
        <View style={styles.bankPillsRow}>
          {BANKS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.bankPill, selectedBank === b && styles.bankPillActive]}
              onPress={() => setSelectedBank(b)}
              activeOpacity={0.8}
            >
              <Text style={[styles.bankPillText, selectedBank === b && styles.bankPillTextActive]}>
                {b.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Account Number</Text>
        <TextInput
          style={styles.input}
          value={accNum}
          onChangeText={setAccNum}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.btnSave} onPress={handleSaveBank} activeOpacity={0.85}>
          <FontAwesome5 name="save" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.btnSaveText}>Save Payout Account</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Navigation Menu */}
      <View style={styles.menuList}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setEditModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.menuIconBox}>
            <FontAwesome5 name="user-cog" size={16} color={Colors.pureGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Update Profile & Safe Hub</Text>
            <Text style={styles.menuSub}>Change display name, avatar, phone & bio</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textDim} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation?.navigate('Kyc')}
          activeOpacity={0.8}
        >
          <View style={styles.menuIconBox}>
            <FontAwesome5 name="id-card" size={16} color={Colors.pureGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>SA Identity Verification (KYC)</Text>
            <Text style={styles.menuSub}>Verify your smart ID card or passport</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textDim} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation?.navigate('Safety')}
          activeOpacity={0.8}
        >
          <View style={styles.menuIconBox}>
            <FontAwesome5 name="shield-alt" size={16} color={Colors.brandAmber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Safety & Safe Trade Hubs</Text>
            <Text style={styles.menuSub}>Joburg CBD guidelines and scam prevention</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textDim} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation?.navigate('Wishlist')}
          activeOpacity={0.8}
        >
          <View style={styles.menuIconBox}>
            <FontAwesome5 name="heart" size={16} color={Colors.brandRed} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Saved Wishlist</Text>
            <Text style={styles.menuSub}>Your bookmarked drops and pieces</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textDim} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation?.navigate('SignUp')}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <FontAwesome5 name="user-plus" size={15} color={Colors.brandAmber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Sign Up New Account / Switch</Text>
            <Text style={styles.menuSub}>Register buyer or street trader profile</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textDim} />
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={(updated) => setProfile(updated)}
      />
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
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: Colors.pureGreen
  },
  avatarPencilBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.pureGreen,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  profileDetails: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1
  },
  btnEditProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8
  },
  btnEditProfileText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800'
  },
  userLocation: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2
  },
  userPhone: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  kycText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  roleBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMain
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309'
  },
  bioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    marginBottom: 12
  },
  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  bioTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.pureGreen,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  bioText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  countBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  btnDropPieceSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  btnDropPieceSmallText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  myItemsGrid: {
    gap: 10,
    marginTop: 4
  },
  myItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12
  },
  myItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E2E8F0'
  },
  myItemContent: {
    flex: 1
  },
  myItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4
  },
  myItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  myItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.pureGreen
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.pureGreen,
    textTransform: 'capitalize'
  },
  myItemLocation: {
    fontSize: 10.5,
    color: Colors.textDim
  },
  emptyListingsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed'
  },
  emptyListingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4
  },
  emptyListingsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14
  },
  btnStartDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  btnStartDropText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  cardSub: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 17
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6
  },
  bankPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  bankPill: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  bankPillActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  bankPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155'
  },
  bankPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14
  },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800'
  },
  menuList: {
    gap: 10
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  menuIconBox: {
    width: 32,
    alignItems: 'center'
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  menuSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  }
});
