/**
 * DOBHA DOBHA — Edit Profile Modal (React Native)
 * Pure Green (#00A651) & Pure White (#FFFFFF) Theme
 * Update Name, Avatar, Location Hub, Role, Phone & Street Bio
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';
import UserStore from '../services/userStore';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'
];

const TRADE_LOCATIONS = [
  'Braamfontein Safe Trade Hub',
  'Bree Taxi Rank Concourse (Joburg CBD)',
  'Carlton Centre Mall Precinct',
  'Maboneng Arts District',
  'Newtown Junction',
  'Rosebank Safe Hub',
  'Soweto / Maponya Mall'
];

export default function EditProfileModal({ visible, onClose, onSave }) {
  const current = UserStore.getProfile();

  const [fullName, setFullName] = useState(current.fullName || '');
  const [displayName, setDisplayName] = useState(current.displayName || '');
  const [phone, setPhone] = useState(current.phone || '');
  const [email, setEmail] = useState(current.email || '');
  const [locationHub, setLocationHub] = useState(current.locationHub || TRADE_LOCATIONS[0]);
  const [role, setRole] = useState(current.role || 'both');
  const [bio, setBio] = useState(current.bio || '');
  const [avatar, setAvatar] = useState(current.avatar || PRESET_AVATARS[0]);

  useEffect(() => {
    if (visible) {
      const p = UserStore.getProfile();
      setFullName(p.fullName || '');
      setDisplayName(p.displayName || '');
      setPhone(p.phone || '');
      setEmail(p.email || '');
      setLocationHub(p.locationHub || TRADE_LOCATIONS[0]);
      setRole(p.role || 'both');
      setBio(p.bio || '');
      setAvatar(p.avatar || PRESET_AVATARS[0]);
    }
  }, [visible]);

  const handleSave = () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Legal Name.');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Required Field', 'Please enter your Display Name / Trader Tag.');
      return;
    }

    const updated = UserStore.updateProfile({
      fullName: fullName.trim(),
      displayName: displayName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      location: locationHub.split(' ')[0],
      locationHub,
      role,
      bio: bio.trim(),
      avatar
    });

    Alert.alert(
      'Profile Updated!',
      'Your profile changes have been saved across the Dobha Dobha network.',
      [
        {
          text: 'Done',
          onPress: () => {
            if (onSave) onSave(updated);
            if (onClose) onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Sheet Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.badgeRow}>
                <View style={styles.pureBadge}>
                  <FontAwesome5 name="user-edit" size={11} color="#FFFFFF" />
                  <Text style={styles.pureBadgeText}>PROFILE SETTINGS</Text>
                </View>
              </View>
              <Text style={styles.headerTitle}>Update Street Profile</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <FontAwesome5 name="times" size={14} color={Colors.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Avatar Selector */}
            <View style={styles.avatarSection}>
              <View style={styles.mainAvatarContainer}>
                <Image source={{ uri: avatar }} style={styles.mainAvatar} />
                <View style={styles.avatarPencil}>
                  <FontAwesome5 name="camera" size={11} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.avatarLabel}>Choose Your Trader Avatar</Text>
              <View style={styles.avatarPresetsRow}>
                {PRESET_AVATARS.map((url, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.presetThumbBox, avatar === url && styles.presetThumbBoxActive]}
                    onPress={() => setAvatar(url)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: url }} style={styles.presetThumb} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Verification Status Card */}
            <View style={styles.kycStatusCard}>
              <FontAwesome5 name="shield-alt" size={16} color={Colors.pureGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kycStatusTitle}>SA Identity Status: Verified</Text>
                <Text style={styles.kycStatusSub}>
                  Smart ID ending in ***084 verified with Home Affairs via Smile ID.
                </Text>
              </View>
              <View style={styles.activeCheck}>
                <FontAwesome5 name="check" size={10} color="#FFFFFF" />
              </View>
            </View>

            {/* Inputs Section */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Full Legal Name</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Thabo Sipho Mokoena"
                placeholderTextColor={Colors.textDim}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Display Name / Street Tag</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Thabo M. (Vintage Drops)"
                placeholderTextColor={Colors.textDim}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>South African Mobile (WhatsApp)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.flagBox}>
                  <FontAwesome5 name="globe-africa" size={13} color={Colors.pureGreen} style={{ marginRight: 2 }} />
                  <Text style={styles.codeText}>+27</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  value={phone.replace(/^\+27\s?/, '')}
                  onChangeText={(val) => setPhone(`+27 ${val.replace(/^\+27\s?/, '')}`)}
                  placeholder="82 123 4567"
                  placeholderTextColor={Colors.textDim}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.co.za"
                placeholderTextColor={Colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Safe Trade Hub / Location */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Primary Safe Trade Hub (Johannesburg)</Text>
              <View style={styles.locationsList}>
                {TRADE_LOCATIONS.map((loc) => {
                  const isSelected = locationHub === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      style={[styles.locationChip, isSelected && styles.locationChipActive]}
                      onPress={() => setLocationHub(loc)}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5
                        name="map-marker-alt"
                        size={11}
                        color={isSelected ? '#FFFFFF' : Colors.pureGreen}
                      />
                      <Text
                        style={[styles.locationChipText, isSelected && styles.locationChipTextActive]}
                      >
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Role Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Trading Role</Text>
              <View style={styles.rolesRow}>
                {[
                  { id: 'buyer', label: 'Buyer Only', icon: 'shopping-bag' },
                  { id: 'seller', label: 'Street Seller', icon: 'store' },
                  { id: 'both', label: 'Both', icon: 'handshake' }
                ].map((r) => {
                  const isSelected = role === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.roleCard, isSelected && styles.roleCardActive]}
                      onPress={() => setRole(r.id)}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5
                        name={r.icon}
                        size={14}
                        color={isSelected ? '#FFFFFF' : Colors.pureGreen}
                      />
                      <Text style={[styles.roleLabel, isSelected && styles.roleLabelActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bio / Description */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Street Bio & Collection Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Describe the items you thrift, trading terms, or meetup preferences..."
                placeholderTextColor={Colors.textDim}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} activeOpacity={0.85}>
              <FontAwesome5 name="check" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnSaveText}>Update Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGlass
  },
  badgeRow: {
    marginBottom: 4
  },
  pureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  pureBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16
  },
  mainAvatarContainer: {
    position: 'relative',
    marginBottom: 8
  },
  mainAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: Colors.pureGreen
  },
  avatarPencil: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.pureGreen,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8
  },
  avatarPresetsRow: {
    flexDirection: 'row',
    gap: 8
  },
  presetThumbBox: {
    padding: 2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  presetThumbBoxActive: {
    borderColor: Colors.pureGreen
  },
  presetThumb: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  kycStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    marginBottom: 16
  },
  kycStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  kycStatusSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2
  },
  activeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.pureGreen,
    justifyContent: 'center',
    alignItems: 'center'
  },
  formGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600'
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
    paddingTop: 10
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  flagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  codeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  locationsList: {
    gap: 6
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  locationChipActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMain
  },
  locationChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 8
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.borderGlass,
    paddingVertical: 10,
    borderRadius: 10
  },
  roleCardActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain
  },
  roleLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnCancelText: {
    color: Colors.textMain,
    fontSize: 13,
    fontWeight: '700'
  },
  btnSave: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});
