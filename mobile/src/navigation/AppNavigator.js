/**
 * DOBHA DOBHA — Navigation Architecture (React Native)
 * Stack & Tab Navigation for Android and iOS
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/Header';
import ReelsScreen from '../screens/ReelsScreen';
import CatalogScreen from '../screens/CatalogScreen';
import LiveStreamScreen from '../screens/LiveStreamScreen';
import QuickSellScreen from '../screens/QuickSellScreen';
import EscrowScreen from '../screens/EscrowScreen';
import ChatScreen from '../screens/ChatScreen';
import AccountScreen from '../screens/AccountScreen';
import KycScreen from '../screens/KycScreen';
import SafetyScreen from '../screens/SafetyScreen';
import WishlistScreen from '../screens/WishlistScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SplashScreen from '../screens/SplashScreen';
import Colors from '../theme/colors';
import UserStore from '../services/userStore';

const DEFAULT_TAB = 'Catalog';

const ROUTE_ALIASES = {
  QuickSell: 'Sell',
  quicksell: 'Sell',
  sell: 'Sell',
  Market: 'Catalog',
  market: 'Catalog',
  catalog: 'Catalog',
  Orders: 'Escrow',
  orders: 'Escrow',
  escrow: 'Escrow',
  Profile: 'Account',
  profile: 'Account',
  account: 'Account',
  Verify: 'Kyc',
  verify: 'Kyc',
  kyc: 'Kyc',
  Inbox: 'Chat',
  inbox: 'Chat',
  chat: 'Chat',
  Streams: 'Live',
  streams: 'Live',
  live: 'Live',
  reels: 'Reels',
  wishlist: 'Wishlist',
  notifications: 'Notifications',
  notifs: 'Notifications',
  safety: 'Safety',
  signup: 'SignUp',
  login: 'SignUp'
};

const normalizeRoute = (rawName) => {
  if (!rawName) return DEFAULT_TAB;
  return ROUTE_ALIASES[rawName] || rawName;
};

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const [showSplash, setShowSplash] = useState(true);
  const [userProfile, setUserProfile] = useState(UserStore.getProfile());
  const [currentTab, setCurrentTab] = useState(DEFAULT_TAB);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [history, setHistory] = useState([DEFAULT_TAB]);
  const [screenParams, setScreenParams] = useState({});
  const [pendingScreen, setPendingScreen] = useState(null);

  const navigation = {
    navigate: (rawScreenName, params = {}) => {
      const screenName = normalizeRoute(rawScreenName);

      // Auth Guard: Require registration/login for trading, messaging, selling, wallet and KYC
      const protectedScreens = ['Sell', 'Escrow', 'Chat', 'Account', 'Kyc'];
      if (!UserStore.isAuthenticated() && protectedScreens.includes(screenName)) {
        setPendingScreen(screenName);
        if (params && Object.keys(params).length > 0) {
          setScreenParams((prev) => ({ ...prev, [screenName]: params }));
        }
        setCurrentTab('SignUp');
        setDrawerOpen(false);
        return;
      }

      if (params && Object.keys(params).length > 0) {
        setScreenParams((prev) => ({ ...prev, [screenName]: params }));
      }

      setHistory((prev) => {
        if (prev[prev.length - 1] === screenName) return prev;
        return [...prev, screenName];
      });
      setCurrentTab(screenName);
      setDrawerOpen(false);
    },

    goBack: () => {
      setHistory((prev) => {
        if (prev.length <= 1) {
          setCurrentTab(DEFAULT_TAB);
          return [DEFAULT_TAB];
        }
        const newHistory = [...prev];
        newHistory.pop();
        const prevScreen = newHistory[newHistory.length - 1] || DEFAULT_TAB;
        setCurrentTab(prevScreen);
        return newHistory;
      });
      setDrawerOpen(false);
    },

    canGoBack: () => history.length > 1 && currentTab !== DEFAULT_TAB,
    getParams: (screen = currentTab) => screenParams[screen] || {},
    currentRoute: currentTab,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false)
  };

  useEffect(() => {
    const unsub = UserStore.subscribe((updated) => {
      setUserProfile(updated);
      if (updated && currentTab === 'SignUp') {
        const dest = pendingScreen || DEFAULT_TAB;
        setPendingScreen(null);
        navigation.navigate(dest);
      }
    });
    return unsub;
  }, [currentTab, pendingScreen]);

  useEffect(() => {
    let mounted = true;
    UserStore.restoreSession()
      .then((user) => {
        if (mounted && user) setUserProfile(user);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const currentParams = screenParams[currentTab] || {};
  const routeProp = { name: currentTab, params: currentParams };
  const screenProps = { navigation, route: routeProp, params: currentParams };

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'Reels':
        return <ReelsScreen {...screenProps} />;
      case 'Catalog':
        return <CatalogScreen {...screenProps} />;
      case 'Live':
        return <LiveStreamScreen {...screenProps} />;
      case 'Sell':
        return <QuickSellScreen {...screenProps} />;
      case 'Escrow':
        return <EscrowScreen {...screenProps} />;
      case 'Chat':
        return <ChatScreen {...screenProps} />;
      case 'Account':
        return <AccountScreen {...screenProps} />;
      case 'Kyc':
        return <KycScreen {...screenProps} />;
      case 'Safety':
        return <SafetyScreen {...screenProps} />;
      case 'Wishlist':
        return <WishlistScreen {...screenProps} />;
      case 'Notifications':
        return <NotificationsScreen {...screenProps} />;
      case 'SignUp':
        return (
          <SignUpScreen
            {...screenProps}
            onAuthSuccess={() => {
              const dest = pendingScreen || DEFAULT_TAB;
              setPendingScreen(null);
              navigation.navigate(dest);
            }}
          />
        );
      default:
        return <CatalogScreen {...screenProps} />;
    }
  };

  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => {
          setShowSplash(false);
          // Seamless guest browsing: initialize to Catalog so users can explore immediately
          if (!UserStore.isAuthenticated()) {
            setCurrentTab(DEFAULT_TAB);
          }
        }}
      />
    );
  }

  const isFullScreenTab = currentTab === 'Live';

  return (
    <View style={[styles.rootWrapper, isFullScreenTab && { backgroundColor: '#000000' }]}>
      <SafeAreaView
        style={[styles.safeArea, isFullScreenTab && styles.safeAreaFullScreen]}
        edges={isFullScreenTab ? [] : ['top', 'left', 'right']}
      >
        {/* Top Header (hidden during full-screen Live) */}
        {!isFullScreenTab && (
          <Header
            navigation={navigation}
            currentTab={currentTab}
            canGoBack={navigation.canGoBack()}
            onBackPress={navigation.goBack}
            onSearchPress={() => navigation.navigate('Catalog')}
            onNotifPress={() => navigation.navigate('Notifications')}
          />
        )}

        {/* Screen Content */}
        <View style={[styles.mainContent, isFullScreenTab && styles.mainContentFullScreen]}>
          {renderActiveScreen()}
        </View>

        {/* Bottom Navigation Bar (hidden during full-screen Live) */}
        {!isFullScreenTab && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('Reels')}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="play-circle"
            size={18}
            color={currentTab === 'Reels' ? Colors.brandEmerald : Colors.textDim}
          />
          <Text
            style={[
              styles.navTabText,
              currentTab === 'Reels' && styles.navTabTextActive
            ]}
          >
            Reels
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('Catalog')}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="th-large"
            size={18}
            color={currentTab === 'Catalog' ? Colors.brandEmerald : Colors.textDim}
          />
          <Text
            style={[
              styles.navTabText,
              currentTab === 'Catalog' && styles.navTabTextActive
            ]}
          >
            Catalog
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTabSell}
          onPress={() => navigation.navigate('Sell')}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="plus" size={18} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('Live')}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="broadcast-tower"
            size={18}
            color={currentTab === 'Live' ? Colors.brandEmerald : Colors.textDim}
          />
          <Text
            style={[
              styles.navTabText,
              currentTab === 'Live' && styles.navTabTextActive
            ]}
          >
            Live
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navTab}
          onPress={() => navigation.navigate('Escrow')}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="shield-alt"
            size={18}
            color={currentTab === 'Escrow' ? Colors.brandEmerald : Colors.textDim}
          />
          <Text
            style={[
              styles.navTabText,
              currentTab === 'Escrow' && styles.navTabTextActive
            ]}
          >
            Escrow
          </Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Slide-out Mobile Navigation Drawer Modal */}
      <Modal visible={drawerOpen} transparent animationType="fade">
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setDrawerOpen(false)}
          />

          <View style={styles.drawerSheet}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              {userProfile ? (
                <TouchableOpacity
                  style={styles.userProfileBtn}
                  onPress={() => {
                    setDrawerOpen(false);
                    setCurrentTab('Account');
                  }}
                >
                  <Image
                    source={{
                      uri: userProfile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
                    }}
                    style={styles.drawerAvatar}
                  />
                  <View>
                    <Text style={styles.drawerUserName}>{userProfile.displayName || userProfile.fullName || 'Trader'}</Text>
                    {userProfile.isKycVerified ? (
                      <View style={styles.drawerKycBadge}>
                        <FontAwesome5 name="check-circle" solid size={9} color="#FFFFFF" />
                        <Text style={styles.drawerKycText}>SA ID Verified</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 10, color: Colors.brandAmber, fontWeight: '700' }}>Active Account</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.userProfileBtn}
                  onPress={() => {
                    setDrawerOpen(false);
                    setCurrentTab('SignUp');
                  }}
                >
                  <View style={[styles.drawerAvatar, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
                    <FontAwesome5 name="user-plus" size={16} color={Colors.brandEmerald} />
                  </View>
                  <View>
                    <Text style={styles.drawerUserName}>Sign In / Register</Text>
                    <Text style={{ fontSize: 10, color: Colors.textDim, fontWeight: '600' }}>Join DOBHA DOBHA</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={{ padding: 6 }}>
                <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* App Brand Logo Badge */}
            <View style={styles.drawerBrandSection}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.drawerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.drawerBrandName}>DOBHA DOBHA</Text>
                <Text style={styles.drawerBrandTag}>Local Street Trade</Text>
              </View>
            </View>

            {/* Drawer Navigation Links */}
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeader}>MARKETPLACE</Text>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Reels')}
              >
                <FontAwesome5 name="play-circle" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Dobha Reels (Short Videos)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Catalog')}
              >
                <FontAwesome5 name="th-large" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Full Catalog & Bales</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Live')}
              >
                <FontAwesome5 name="broadcast-tower" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Live Street Broadcasts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Sell')}
              >
                <FontAwesome5 name="plus-circle" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Drop a Pile (Quick Sell)</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>TRADING & ESCROW</Text>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Escrow')}
              >
                <FontAwesome5 name="shield-alt" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Escrow Passes & Pickup QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Chat')}
              >
                <FontAwesome5 name="comments" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Negotiations & Barter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Wishlist')}
              >
                <FontAwesome5 name="heart" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Saved Wishlist</Text>
              </TouchableOpacity>

              <Text style={styles.sectionHeader}>ACCOUNT & SAFETY</Text>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Account')}
              >
                <FontAwesome5 name="user-circle" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>My Account & Bank Payouts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('SignUp')}
              >
                <FontAwesome5 name="user-plus" size={16} color={Colors.brandAmber} />
                <Text style={styles.drawerItemText}>Create Account / Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Kyc')}
              >
                <FontAwesome5 name="id-card" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>SA ID / Passport KYC</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Safety')}
              >
                <FontAwesome5 name="shield-alt" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Joburg CBD Safety Guide</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => navigation.navigate('Notifications')}
              >
                <FontAwesome5 name="bell" size={16} color={Colors.brandEmerald} />
                <Text style={styles.drawerItemText}>Trade Notifications</Text>
              </TouchableOpacity>

              {userProfile ? (
                <TouchableOpacity
                  style={[styles.drawerItem, { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderGlass, paddingTop: 14 }]}
                  onPress={() => {
                    UserStore.logout();
                    setCurrentTab('SignUp');
                    setDrawerOpen(false);
                  }}
                >
                  <FontAwesome5 name="sign-out-alt" size={16} color={Colors.brandRed} />
                  <Text style={[styles.drawerItemText, { color: Colors.brandRed, fontWeight: '700' }]}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.drawerItem, { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderGlass, paddingTop: 14 }]}
                  onPress={() => {
                    setCurrentTab('SignUp');
                    setDrawerOpen(false);
                  }}
                >
                  <FontAwesome5 name="sign-in-alt" size={16} color={Colors.brandEmerald} />
                  <Text style={[styles.drawerItemText, { color: Colors.brandEmerald, fontWeight: '700' }]}>Sign In / Register</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#0F172A',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#F5F7F4'
  },
  safeAreaFullScreen: {
    backgroundColor: '#000000',
    paddingTop: 0
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F5F7F4'
  },
  mainContentFullScreen: {
    backgroundColor: '#000000',
    paddingBottom: 0
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 64,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 9
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8
  },
  navTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textDim
  },
  navTabTextActive: {
    color: Colors.pureGreen
  },
  navTabSell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.pureGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row'
  },
  drawerBackdrop: {
    flex: 1
  },
  drawerSheet: {
    width: 300,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRightWidth: 1,
    borderRightColor: Colors.borderGlass,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGlass,
    marginBottom: 12
  },
  drawerBrandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.pureGreen,
    marginBottom: 16
  },
  drawerLogo: {
    width: 32,
    height: 32,
    borderRadius: 6
  },
  drawerBrandName: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.pureGreen,
    letterSpacing: -0.3
  },
  drawerBrandTag: {
    fontSize: 10,
    color: Colors.brandAmber,
    fontWeight: '700'
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  drawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.pureGreen
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain
  },
  drawerKycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pureGreen,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 2
  },
  drawerKycText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 6
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  drawerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMain
  }
});
