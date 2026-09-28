/**
 * DOBHA DOBHA — WishlistScreen (React Native)
 * Saved items & wholesale bales
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function WishlistScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const handleRemove = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
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
          <Text style={styles.headerTitle}>Saved Items & Drops</Text>
        </View>
        <View style={styles.badgeCount}>
          <Text style={styles.countText}>{items.length} Items</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="heart-broken" size={36} color={Colors.textDim} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No saved items yet</Text>
          <Text style={styles.emptySub}>Explore reels or the catalog to bookmark items for later.</Text>
          <TouchableOpacity
            style={styles.btnExploreWishlist}
            onPress={() => navigation?.navigate?.('Catalog')}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="shopping-bag" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.btnExploreWishlistText}>Explore Street Catalog</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardImageWrap}>
                <Image source={{ uri: item.img }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{item.tag}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.priceText}>R{item.price.toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => handleRemove(item.id)} style={{ padding: 4 }}>
                    <FontAwesome5 name="trash-alt" size={13} color={Colors.brandRed} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain
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
  badgeCount: {
    backgroundColor: Colors.pureGreen,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRadius: 12
  },
  countText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.pureWhite
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16
  },
  btnExploreWishlist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12
  },
  btnExploreWishlistText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14
  },
  card: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardImageWrap: {
    width: '100%',
    height: 155,
    backgroundColor: '#F8FAFC',
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  tagBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.pureGreen,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6
  },
  tagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.pureGreen
  },
  cardBody: {
    padding: 12
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
    marginBottom: 6
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.pureGreen
  }
});
