/**
 * DOBHA DOBHA — KycScreen (React Native)
 * South African ID & Passport Identity Verification with real document photo upload
 * 0% mock/dummy data
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../theme/colors';
import ApiService from '../services/api';

const DOC_TYPES = ['Smart ID Card', 'Green ID Book', 'Foreign Passport'];

export default function KycScreen({ navigation }) {
  const [docType, setDocType] = useState('Smart ID Card');
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null); // { uri, base64, mimeType }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Take photo of ID
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture your ID.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedPhoto({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg'
        });
      }
    } catch (err) {
      console.warn('KYC Camera error:', err);
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  // Pick from gallery
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required to select an ID photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedPhoto({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg'
        });
      }
    } catch (err) {
      console.warn('KYC Gallery error:', err);
      Alert.alert('Gallery Error', 'Could not select photo.');
    }
  };

  const handlePhotoAction = () => {
    Alert.alert(
      'Attach ID Document Photo',
      'Take a clear photo of the front of your ID card, book, or passport.',
      [
        { text: 'Snap with Camera', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handlePickPhoto },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleSubmit = async () => {
    if (!idNumber.trim() || !fullName.trim()) {
      Alert.alert('Missing Info', 'Please enter your South African ID number and full legal name.');
      return;
    }

    if (docType !== 'Foreign Passport' && idNumber.trim().length !== 13) {
      Alert.alert('Invalid ID', 'South African ID must contain exactly 13 numeric digits.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedPhotoUrl = null;

      // 1. Upload photo if selected
      if (selectedPhoto && selectedPhoto.base64) {
        const uploadRes = await ApiService.uploadMedia({
          base64: selectedPhoto.base64,
          folder: 'documents',
          fileName: `kyc_${Date.now()}.jpg`,
          contentType: selectedPhoto.mimeType || 'image/jpeg'
        });

        if (uploadRes && uploadRes.success && uploadRes.url) {
          uploadedPhotoUrl = uploadRes.url;
        }
      }

      // 2. Submit KYC verification
      const kycRes = await ApiService.submitKyc({
        documentType: docType,
        idNumber: idNumber.trim(),
        fullName: fullName.trim(),
        photoUrl: uploadedPhotoUrl
      });

      setIsSubmitting(false);

      if (kycRes && kycRes.success) {
        Alert.alert(
          'Verification Submitted!',
          'Your identity document has been securely verified. Escrow limits and trader trust badges have been unlocked.',
          [
            {
              text: 'Return to Account',
              onPress: () => navigation?.navigate('Account')
            }
          ]
        );
      } else {
        Alert.alert('Submission Notice', kycRes?.message || 'Verification submitted for automated review.');
        navigation?.navigate('Account');
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error('KYC submit error:', err);
      Alert.alert('Submission Error', 'Failed to submit verification. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Back Row */}
      {navigation?.canGoBack?.() && (
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityLabel="Back"
        >
          <FontAwesome5 name="arrow-left" size={12} color={Colors.pureGreen} style={{ marginRight: 6 }} />
          <Text style={styles.backRowText}>Back to Account</Text>
        </TouchableOpacity>
      )}

      {/* Header Banner */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>South African ID Verification</Text>
        <Text style={styles.headerSubtitle}>
          Verified traders receive 3x more orders, higher buyer trust, and unlock instant cash payouts upon QR scan.
        </Text>
      </View>

      {/* Doc Type Selector */}
      <View style={styles.sectionCard}>
        <Text style={styles.fieldLabel}>Select Document Type</Text>
        <View style={styles.docTypesRow}>
          {DOC_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt}
              style={[styles.docPill, docType === dt && styles.docPillActive]}
              onPress={() => setDocType(dt)}
            >
              <Text style={[styles.docPillText, docType === dt && styles.docPillTextActive]}>
                {dt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inputs */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>South African ID Number (13 Digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9608155021084"
            placeholderTextColor={Colors.textDim}
            maxLength={13}
            keyboardType="numeric"
            value={idNumber}
            onChangeText={setIdNumber}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Full Legal Name (as printed on ID)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Thabo Sipho Mokoena"
            placeholderTextColor={Colors.textDim}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Front Photo Dropzone */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Front Photo of ID Document</Text>
          {selectedPhoto ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.previewImage} resizeMode="cover" />
              <View style={styles.previewOverlay}>
                <TouchableOpacity style={styles.btnChangePhoto} onPress={handlePhotoAction}>
                  <FontAwesome5 name="sync-alt" size={12} color="#fff" />
                  <Text style={styles.btnActionText}>Change Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnRemovePhoto} onPress={() => setSelectedPhoto(null)}>
                  <FontAwesome5 name="trash-alt" size={12} color="#fff" />
                  <Text style={styles.btnActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoDropzone} onPress={handlePhotoAction} activeOpacity={0.8}>
              <FontAwesome5 name="id-badge" size={26} color={Colors.brandEmerald} />
              <Text style={styles.dropzoneTitle}>Tap to snap or select ID photo</Text>
              <Text style={styles.dropzoneSub}>256-bit encrypted and verified via Smile ID</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.btnSubmit, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
        ) : (
          <FontAwesome5 name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
        )}
        <Text style={styles.btnSubmitText}>
          {isSubmitting ? 'Uploading & Verifying...' : 'Submit for Automated Verification'}
        </Text>
      </TouchableOpacity>
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
  headerCard: {
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
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  sectionCard: {
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8
  },
  docTypesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14
  },
  docPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center'
  },
  docPillActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  docPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  docPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  formGroup: {
    marginBottom: 14
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  photoDropzone: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.pureGreen,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  dropzoneTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 4
  },
  dropzoneSub: {
    fontSize: 10,
    color: Colors.textMuted
  },
  previewContainer: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  btnChangePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  btnRemovePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  btnActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  btnSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
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
