/**
 * DOBHA DOBHA — CatalogScreen (React Native)
 * 2-Column Marketplace Grid with Category Pills, Search
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BrandLogo from '../components/BrandLogo';
import ItemDetailModal from './ItemDetailModal';
import DibsModal from '../components/DibsModal';
import PaymentModal from '../components/PaymentModal';
import Colors from '../theme/colors';
import ApiService, { resolveImageUrl, DEFAULT_ITEM_IMAGE } from '../services/api';
import { CATEGORIES, CATEGORY_TERMS, CARD_STYLES, SPACING, FONT_SIZES } from '../constants/catalogConstants';

import UserStore from '../services/userStore';

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLocation} />
        <View style={styles.skeletonPrice} />
      </View>
    </View>
  );
}

export default function CatalogScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [dibsItem, setDibsItem] = useState(null);
  const [paymentItem, setPaymentItem] = useState(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getItems();
      if (res && res.success && Array.isArray(res.items) && res.items.length > 0) {
        const mapped = res.items.map((it) => {
          const rawImg = (it.images && it.images.length > 0 ? it.images[0] : null) || it.image_url || it.img;
          return {
            id: String(it.id),
            seller_id: it.seller_id || it.sellerId,
            sellerId: it.seller_id || it.sellerId,
            title: it.title,
            price: parseFloat(it.price) || 0,
            originalPrice: it.original_price ? parseFloat(it.original_price) : (it.price ? parseFloat(it.price) * 1.5 : 200),
            category: String(it.category || 'thrift').toLowerCase().trim(),
            tag: it.condition || 'Grade A Thrift',
            brandDomain: it.brand_domain || '',
            brandName: it.brand_name || '',
            seller: it.seller_name || it.seller?.name || 'Verified Seller',
            sellerAvatar: resolveImageUrl(it.seller_avatar || it.seller?.avatarUrl, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'),
            location: it.location || 'Joburg CBD',
            img: resolveImageUrl(rawImg, DEFAULT_ITEM_IMAGE),
            allowBarter: Boolean(it.allowBarter),
            description: it.description || ''
          };
        });
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.warn('Could not refresh catalog items:', err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadItems();
    const unsub = UserStore.subscribeItemUploaded(() => {
      loadItems();
    });
    return unsub;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const toggleFavorite = (itemId) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.add(itemId);
      }
      return newFavorites;
    });
  };

  const handleCategoryPress = (catId) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCat(catId);
  };

  const handleCardPress = (item) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setActiveItem(item);
  };

  const filteredItems = items.filter((item) => {
    if (selectedCat !== 'all') {
      const category = String(item.category || '').toLowerCase();
      const title = String(item.title || '').toLowerCase();
      const matchesCategory = category === selectedCat ||
        (CATEGORY_TERMS[selectedCat] || []).some((term) => category.includes(term) || title.includes(term));
      if (!matchesCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.seller?.toLowerCase().includes(q) ||
        item.brandName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => handleCardPress(item)}
    >
      <View style={styles.cardImageWrap}>
        <Image source={{ uri: item.img }} style={styles.cardImage} resizeMode="cover" />
        {item.brandDomain && (
          <View style={styles.brandBadge}>
            <BrandLogo domain={item.brandDomain} brandName={item.brandName} size={11} />
          </View>
        )}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name={favorites.has(item.id) ? 'heart' : 'heart'}
            solid={favorites.has(item.id)}
            size={14}
            color={favorites.has(item.id) ? '#EF4444' : '#FFFFFF'}
          />
        </TouchableOpacity>
        <View style={styles.tagBadge}>
          <Text style={styles.tagBadgeText}>{item.tag}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.locationRow}>
          <FontAwesome5 name="map-marker-alt" size={9} color={Colors.textDim} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.location}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.priceText}>R{item.price.toFixed(2)}</Text>
          {item.allowBarter && (
            <View style={styles.barterTag}>
              <Text style={styles.barterTagText}>Barter</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <FontAwesome5 name="search" size={14} color={Colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vintage tees, jackets, sneakers, bales..."
          placeholderTextColor={Colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <FontAwesome5 name="times-circle" size={14} color={Colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.heroCard} activeOpacity={0.9} onPress={() => setSelectedCat('all')}>
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>LIVE MARKET INVENTORY</Text>
          <Text style={styles.heroTitle}>Street thrift, picked live.</Text>
          <Text style={styles.heroMeta}>
            {items.length ? `${items.length} verified listing${items.length === 1 ? '' : 's'} available` : 'No live listings yet'}
          </Text>
        </View>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollContent}
        style={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, selectedCat === cat.id && styles.catChipActive]}
            onPress={() => handleCategoryPress(cat.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catChipText, selectedCat === cat.id && styles.catChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 2-Column Grid */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : filteredItems.length === 0 && !refreshing ? (
        <View style={styles.emptyCatalog}>
          <FontAwesome5 name="store" size={24} color={Colors.textDim} style={styles.emptyIcon} />
          <Text style={styles.emptyCatalogTitle}>No listings found</Text>
          <Text style={styles.emptyCatalogText}>New pieces will appear here when sellers publish them.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderCard}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.pureGreen]}
              tintColor={Colors.pureGreen}
            />
          }
        />
      )}

      {/* Item Detail Sheet */}
      <ItemDetailModal
        visible={!!activeItem}
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onDibs={() => {
          const itm = activeItem;
          const currentProfile = UserStore.getProfile();
          if (currentProfile?.id && (itm.seller_id === currentProfile.id || itm.sellerId === currentProfile.id)) {
            Alert.alert('Your Own Item', 'You cannot purchase or claim Dibs on an item that you listed.');
            return;
          }
          setActiveItem(null);
          setDibsItem(itm);
        }}
        onNegotiate={() => {
          const currentItem = activeItem;
          setActiveItem(null);
          if (currentItem) {
            navigation?.navigate('Chat', {
              partner: {
                id: currentItem.seller_id || currentItem.sellerId || currentItem.seller?.id,
                name: currentItem.seller || currentItem.seller_name || currentItem.seller?.name || 'Seller',
                avatar: currentItem.sellerAvatar || currentItem.avatar || currentItem.seller?.avatar_url
              },
              item: currentItem
            });
          } else {
            navigation?.navigate('Chat');
          }
        }}
      />

      {/* 90s Dibs Hold Modal */}
      <DibsModal
        visible={!!dibsItem}
        item={dibsItem}
        onProceed={() => {
          const itm = dibsItem;
          setDibsItem(null);
          setPaymentItem(itm);
        }}
        onCancel={() => setDibsItem(null)}
      />

      {/* South African Payment & Escrow Checkout Modal */}
      <PaymentModal
        visible={!!paymentItem}
        item={paymentItem}
        onClose={() => setPaymentItem(null)}
        onSuccess={() => navigation?.navigate('Escrow')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F4'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '600'
  },
  heroCard: {
    height: 138,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#DDEFE7',
    borderWidth: 1,
    borderColor: '#CDE8D8'
  },
  heroContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F5132',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F5132',
    lineHeight: 26,
    marginBottom: 4
  },
  heroMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B4332'
  },
  emptyCatalog: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32
  },
  emptyIcon: {
    alignSelf: 'center'
  },
  emptyCatalogTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10
  },
  emptyCatalogText: {
    color: Colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center'
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: 8
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center'
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  catChipActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B'
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.GRID_GAP
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12
  },
  card: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_STYLES.CARD_BORDER_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  cardImageWrap: {
    width: '100%',
    height: CARD_STYLES.IMAGE_HEIGHT,
    backgroundColor: '#F8FAFC',
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  brandBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  favoriteButton: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  tagBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: '#FFFFFF',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.pureGreen
  },
  tagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  cardBody: {
    padding: CARD_STYLES.PADDING
  },
  cardTitle: {
    fontSize: FONT_SIZES.CARD_TITLE,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
    marginBottom: 5
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8
  },
  locationText: {
    fontSize: FONT_SIZES.CARD_LOCATION,
    color: '#475569',
    fontWeight: '500'
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2
  },
  priceText: {
    fontSize: FONT_SIZES.CARD_PRICE,
    fontWeight: '900',
    color: Colors.pureGreen
  },
  barterTag: {
    backgroundColor: Colors.pureGreen,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 4
  },
  barterTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  skeletonCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14
  },
  skeletonImage: {
    width: '100%',
    height: 155,
    backgroundColor: '#F1F5F9'
  },
  skeletonBody: {
    padding: 12
  },
  skeletonTitle: {
    height: 18,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    marginBottom: 8
  },
  skeletonLocation: {
    height: 12,
    width: '60%',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    marginBottom: 8
  },
  skeletonPrice: {
    height: 16,
    width: '40%',
    backgroundColor: '#F1F5F9',
    borderRadius: 4
  }
});
