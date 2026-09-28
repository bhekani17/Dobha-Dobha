/**
 * DOBHA DOBHA — Brand Logo Component (Powered by Logo.dev)
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getBrandLogoUrl } from '../services/api';
import Colors from '../theme/colors';

export default function BrandLogo({ domain, brandName, size = 18 }) {
  const [hasError, setHasError] = useState(false);

  if (!domain || !brandName) return null;

  const logoUrl = getBrandLogoUrl(domain, size * 2);

  return (
    <View style={styles.container}>
      {!hasError && (
        <Image
          source={{ uri: logoUrl }}
          style={[styles.logo, { width: size, height: size }]}
          resizeMode="contain"
          onError={() => setHasError(true)}
        />
      )}
      <Text style={styles.text}>{brandName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 13, 20, 0.85)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  logo: {
    borderRadius: 2
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain
  }
});
