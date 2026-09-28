/**
 * DOBHA DOBHA — QuickSellScreen (React Native)
 * Frictionless garment & bale drop with real camera capture, photo picker, and PostgreSQL persistence
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../theme/colors';
import ApiService from '../services/api';
import UserStore from '../services/userStore';

const DROP_CATEGORIES = [
  { id: 'jackets', label: 'Jackets & Windbreakers' },
  { id: 'sneakers', label: 'Sneakers & Shoes' },
  { id: 'tees', label: 'Vintage Tees' },
  { id: 'denim', label: 'Denim & Pants' },
  { id: 'bales', label: 'Wholesale Bales' },
  { id: 'accessories', label: 'Caps & Accessories' }
];

export default function QuickSellScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('jackets');
  const [location, setLocation] = useState('Bree Taxi Rank, Joburg CBD');
  const [allowBarter, setAllowBarter] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null); // { uri, base64, type, mimeType }
  const [isPublishing, setIsPublishing] = useState(false);

  // Helper to guarantee base64 payload across platforms
  const processAsset = async (asset) => {
    let base64 = asset.base64;
    if (!base64 && asset.uri) {
      try {
        if (Platform.OS === 'web') {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = reader.result;
              const cleanB64 = typeof resStr === 'string' && resStr.includes(',')
                ? resStr.split(',')[1]
                : resStr;
              resolve(cleanB64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (err) {
        console.warn('Could not extract base64 from asset uri:', err);
      }
    }
    return {
      uri: asset.uri,
      base64,
      type: asset.type || 'image',
      mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
    };
  };

  // Camera capture
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to snap items.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const processed = await processAsset(result.assets[0]);
        setSelectedMedia(processed);
      }
    } catch (err) {
      console.warn('Camera error:', err);
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  // Gallery picker
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required to select photos or videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const processed = await processAsset(result.assets[0]);
        setSelectedMedia(processed);
      }
    } catch (err) {
      console.warn('Media library error:', err);
      Alert.alert('Gallery Error', 'Could not select media from gallery.');
    }
  };

  const handleMediaAction = () => {
    Alert.alert(
      'Attach Garment Photo or Video',
      'Choose camera to take a photo right now, or select from your gallery.',
      [
        { text: 'Snap with Camera', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handlePickFromGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handlePublish = async () => {
    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Trader Sign-In Required',
        'You need to sign in or create a free trader account to drop and list items on Dobha Dobha.',
        [
          { text: 'Sign In / Register', onPress: () => navigation?.navigate('SignUp') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    if (!title.trim() || !price.trim()) {
      Alert.alert('Missing Fields', 'Please enter both an item title and price.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in Rands.');
      return;
    }

    if (!selectedMedia || (!selectedMedia.base64 && !selectedMedia.uri)) {
      Alert.alert('Photo Required', 'Add a real photo or short video of the item before publishing.');
      return;
    }

    setIsPublishing(true);

    try {
      let finalMediaUrl = null;

      // 1. Upload captured media
      if (selectedMedia && selectedMedia.base64) {
        const isVideo = selectedMedia.type === 'video';
        const folder = isVideo ? 'videos' : 'images';
        const uploadRes = await ApiService.uploadMedia({
          base64: selectedMedia.base64,
          folder,
          fileName: `drop_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          contentType: selectedMedia.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg')
        });

        if (uploadRes && uploadRes.success && uploadRes.url) {
          finalMediaUrl = uploadRes.url;
        } else {
          setIsPublishing(false);
          Alert.alert('Upload Failed', uploadRes?.message || 'Could not upload media. Please try again.');
          return;
        }
      }

      // 2. Persist item to PostgreSQL database
      const itemRes = await ApiService.createItem({
        title: title.trim(),
        description: `Street thrift drop: ${title.trim()} available for pickup at ${location}.`,
        price: numericPrice,
        category: selectedCategory,
        condition: 'Grade A Thrift',
        location: location.trim(),
        images: finalMediaUrl ? [finalMediaUrl] : []
      });

      setIsPublishing(false);

      if (itemRes && itemRes.success && itemRes.item) {
        // Broadcast new item to Catalog, Reels & Account
        UserStore.notifyItemUploaded(itemRes.item);

        Alert.alert(
          'Piece Published Live!',
          `"${title}" is now active in the Dobha Dobha street market for R${numericPrice.toFixed(2)}.`,
          [
            {
              text: 'View in Market',
              onPress: () => {
                setTitle('');
                setPrice('');
                setSelectedMedia(null);
                navigation?.navigate('Catalog');
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Publishing Failed',
          itemRes?.message || 'The server could not save the piece. Please verify your connection and try again.'
        );
      }
    } catch (err) {
      setIsPublishing(false);
      console.error('Publish error:', err);
      Alert.alert('Publish Error', err.message || 'Could not complete publishing. Please check connection and try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Drop a Pile / Quick Sell</Text>
        <Text style={styles.headerSubtitle}>
          No complex SKU catalogs or barcodes. Snap your second-hand clothes, sneakers, or bales in seconds.
        </Text>
      </View>

      {/* Step 1: Camera / Photo Capture */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>STEP 1: SNAP PHOTO OR SHORT VIDEO</Text>
        
        {selectedMedia ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewOverlay}>
              <TouchableOpacity style={styles.btnChangeMedia} onPress={handleMediaAction}>
                <FontAwesome5 name="sync-alt" size={13} color="#fff" />
                <Text style={styles.btnPreviewText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnRemoveMedia} onPress={() => setSelectedMedia(null)}>
                <FontAwesome5 name="trash-alt" size={13} color="#fff" />
                <Text style={styles.btnPreviewText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraBox} onPress={handleMediaAction} activeOpacity={0.8}>
            <FontAwesome5 name="camera" size={32} color={Colors.brandEmerald} />
            <Text style={styles.cameraTitle}>Tap to snap photo or select video</Text>
            <Text style={styles.cameraSubtitle}>Camera, Gallery, tags, or label</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Details */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>STEP 2: ITEM DETAILS & CATEGORY</Text>

        {/* Category Selector Pills */}
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryPillsWrap}>
            {DROP_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, active && styles.catPillActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Garment / Drop Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 90s Carhartt Active Jacket Tan (Size L)"
            placeholderTextColor={Colors.textDim}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Price in ZAR (Rands)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 85"
            placeholderTextColor={Colors.textDim}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Street Pickup Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Bree Taxi Rank, Park Station, Braamfontein"
            placeholderTextColor={Colors.textDim}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Barter Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>Allow Barter / Item Swaps</Text>
            <Text style={styles.toggleSub}>Buyers can propose garments to trade</Text>
          </View>
          <Switch
            value={allowBarter}
            onValueChange={setAllowBarter}
            thumbColor={allowBarter ? '#FFFFFF' : '#9CA3AF'}
            trackColor={{ false: '#E5E7EB', true: Colors.pureGreen }}
          />
        </View>
      </View>

      {/* Publish Button */}
      <TouchableOpacity
        style={[styles.btnPublish, isPublishing && styles.btnPublishDisabled]}
        onPress={handlePublish}
        disabled={isPublishing}
        activeOpacity={0.85}
      >
        {isPublishing ? (
          <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
        ) : (
          <FontAwesome5 name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
        )}
        <Text style={styles.btnPublishText}>
          {isPublishing ? 'Uploading & Publishing...' : 'Publish to Dobha Dobha Feed'}
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
    fontSize: 17,
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.pureGreen,
    letterSpacing: 0.8,
    marginBottom: 12
  },
  cameraBox: {
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.pureGreen,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  cameraTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain
  },
  cameraSubtitle: {
    fontSize: 11,
    color: Colors.textMuted
  },
  previewContainer: {
    height: 190,
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
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  btnChangeMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  btnRemoveMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  btnPreviewText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  formGroup: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6
  },
  categoryPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  catPillActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  catPillTextActive: {
    color: '#FFFFFF'
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGlass,
    marginTop: 6
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.textMuted
  },
  btnPublish: {
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
  btnPublishDisabled: {
    opacity: 0.6
  },
  btnPublishText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  }
});
