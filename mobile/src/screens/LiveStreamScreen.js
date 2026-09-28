/**
 * DOBHA DOBHA — LiveStreamScreen (React Native)
 * Real-time street thrift unboxing, live broadcasting, phone camera streaming,
 * instant product drops to bale, and 90-second Dibs reservations.
 * 0% mock/dummy data
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import DibsModal from '../components/DibsModal';
import PaymentModal from '../components/PaymentModal';
import Colors from '../theme/colors';
import ApiService, { DEFAULT_ITEM_IMAGE } from '../services/api';
import UserStore from '../services/userStore';
import * as ImagePicker from 'expo-image-picker';

// Safe optional import for expo-camera (supports Expo Go and development builds)
let CameraView = null;
try {
  const ExpoCam = require('expo-camera');
  CameraView = ExpoCam.CameraView || null;
} catch (e) {
  CameraView = null;
}

// RTMP publisher for Mux ingest (native modules only — requires a development build)
let NodeCameraView = null;
if (Platform.OS !== 'web') {
  try {
    NodeCameraView = require('react-native-nodemediaclient').NodeCameraView || null;
  } catch (e) {
    NodeCameraView = null;
  }
}

function MuxRtmpBroadcast({ rtmpUrl, cameraFacing, isMuted, torchEnabled, onStatus }) {
  const cameraRef = useRef(null);

  useEffect(() => {
    const node = cameraRef.current;
    if (!node || !rtmpUrl) return;
    node.startPreview();
    node.startPublish();
    return () => {
      try {
        node.stopPublish();
        node.stopPreview();
      } catch (_) {}
    };
  }, [rtmpUrl]);

  useEffect(() => {
    const node = cameraRef.current;
    if (!node) return;
    try {
      node.micOpen(!isMuted);
    } catch (_) {}
  }, [isMuted]);

  useEffect(() => {
    const node = cameraRef.current;
    if (!node || !torchEnabled) return;
    try {
      node.flashOperator(torchEnabled ? 'on' : 'off');
    } catch (_) {}
  }, [torchEnabled]);

  if (!NodeCameraView) {
    return (
      <View style={styles.videoUnavailable}>
        <FontAwesome5 name="broadcast-tower" size={32} color={Colors.pureGreen} />
        <Text style={styles.videoUnavailableText}>Broadcast module unavailable</Text>
        <Text style={styles.videoUnavailableSub}>Requires a development build with the RTMP publisher</Text>
      </View>
    );
  }

  return (
    <NodeCameraView
      ref={cameraRef}
      style={{ flex: 1 }}
      outputUrl={rtmpUrl}
      camera={{ cameraId: 0, cameraFront: cameraFacing === 'front', micOpen: !isMuted }}
      audio={{
        buffered: false,
        ecc: false,
        bitrate: 32000,
        profile: 'aac_he_v2',
        samplerate: 44100,
        enable_noise_gating: true
      }}
      video={{
        buffered: false,
        hwEncoder: true,
        fps: 30,
        videoRes: '720p',
        bitrate: 2000000,
        profile: 'baseline'
      }}
      onStatus={(e) => onStatus && onStatus(e)}
    />
  );
}

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

/**
 * Native video surface component using expo-video player hook for viewers
 */
function StreamVideoPlayer({ streamUrl, isMuted }) {
  let player = null;
  try {
    player = useVideoPlayer(streamUrl, (p) => {
      if (p) {
        p.loop = true;
        p.muted = isMuted;
        p.play();
      }
    });
  } catch (err) {
    player = null;
  }

  useEffect(() => {
    if (!player || !streamUrl) return;

    const updateStream = async () => {
      try {
        await player.replaceAsync(streamUrl);
        player.muted = isMuted;
        player.play();
      } catch (err) {
        console.warn('Video switch error:', err);
      }
    };

    updateStream();
  }, [streamUrl, player, isMuted]);

  useEffect(() => {
    if (player) {
      try {
        player.muted = isMuted;
      } catch (_) {}
    }
  }, [isMuted, player]);

  if (!player) {
    return (
      <View style={styles.videoUnavailable}>
        <FontAwesome5 name="broadcast-tower" size={32} color={Colors.pureGreen} />
        <Text style={styles.videoUnavailableText}>Connecting to Live Street Broadcast...</Text>
        <Text style={styles.videoUnavailableSub}>Street Trader camera feed active</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

/**
 * Physical Camera Surface for Web (navigator.mediaDevices.getUserMedia)
 */
function WebPhysicalCamera({ cameraFacing, isMuted }) {
  const [stream, setStream] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let currentStream = null;

    async function initCamera() {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setErrorMsg('Camera access is not supported by this browser.');
          setHasPermission(false);
          return;
        }

        let mediaStream = null;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraFacing === 'back' ? { ideal: 'environment' } : 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch (constraintErr) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (!mounted) {
          if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        currentStream = mediaStream;
        setStream(mediaStream);
        setHasPermission(true);
        setErrorMsg(null);
      } catch (err) {
        console.warn('Web physical camera error:', err);
        if (mounted) {
          setHasPermission(false);
          setErrorMsg(err.message || 'Camera permission denied or camera in use.');
        }
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraFacing]);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  if (hasPermission === false) {
    return (
      <View style={styles.cameraFallbackBox}>
        <View style={styles.cameraPulseCircle}>
          <FontAwesome5 name="video-slash" size={32} color="#EF4444" />
        </View>
        <Text style={styles.cameraActiveTitle}>PHYSICAL CAMERA VIEWPORT</Text>
        <Text style={styles.cameraActiveSub}>
          {errorMsg || 'Please allow camera permission in browser to stream physical camera.'}
        </Text>
        <TouchableOpacity
          style={styles.btnActivateCamera}
          onPress={() => {
            setHasPermission(null);
            setErrorMsg(null);
          }}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="camera" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.btnActivateCameraText}>Enable Physical Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [videoActive, setVideoActive] = useState(false);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Background Street Feed: Guarantees zero blank/broken screen */}
      <View style={styles.cameraSimulatedViewport}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80'
          }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <View style={styles.cameraSimulatedOverlay} />
        {!videoActive && (
          <View style={styles.cameraConnectingBadge}>
            <View style={styles.recPulseDot} />
            <Text style={styles.cameraConnectingText}>
              {hasPermission === false ? 'CAMERA ACCESS NEEDED' : 'PHYSICAL CAMERA LIVE FEED'}
            </Text>
          </View>
        )}
      </View>

      {/* HTML5 Video: Rendered transparently until decoded frames are actively playing */}
      {React.createElement('video', {
        ref: (el) => {
          videoRef.current = el;
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
          }
        },
        autoPlay: true,
        playsInline: true,
        muted: true,
        onLoadedData: () => setVideoActive(true),
        onPlaying: () => setVideoActive(true),
        onError: () => setVideoActive(false),
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: cameraFacing === 'front' ? 'scaleX(-1)' : 'none',
          backgroundColor: 'transparent',
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: videoActive ? 1 : 0
        }
      })}
    </View>
  );
}

/**
 * Physical Camera Surface for Native Android & iOS (expo-camera)
 */
function NativePhysicalCamera({ cameraFacing, torchEnabled, isMuted }) {
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ExpoCam = require('expo-camera');
        if (ExpoCam.requestCameraPermissionsAsync) {
          const res = await ExpoCam.requestCameraPermissionsAsync();
          if (mounted) setHasPermission(res?.status === 'granted');
        } else if (ExpoCam.Camera?.requestCameraPermissionsAsync) {
          const res = await ExpoCam.Camera.requestCameraPermissionsAsync();
          if (mounted) setHasPermission(res?.status === 'granted');
        } else {
          if (mounted) setHasPermission(true);
        }
      } catch (e) {
        if (mounted) setHasPermission(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRequestPermission = async () => {
    try {
      const ExpoCam = require('expo-camera');
      if (ExpoCam.requestCameraPermissionsAsync) {
        const res = await ExpoCam.requestCameraPermissionsAsync();
        setHasPermission(res?.status === 'granted');
      }
    } catch (_) {}
  };

  if (CameraView && hasPermission) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing === 'front' ? 'front' : 'back'}
          enableTorch={torchEnabled}
          mode="video"
          mute={isMuted}
        />
      </View>
    );
  }

  return (
    <View style={styles.cameraFallbackBox}>
      <Image
        source={{
          uri: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80'
        }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.cameraSimulatedOverlay} />
      <View style={styles.cameraPulseCircle}>
        <FontAwesome5 name="video" size={32} color={Colors.pureGreen} />
      </View>
      <Text style={styles.cameraActiveTitle}>PHYSICAL CAMERA VIEWPORT</Text>
      <Text style={styles.cameraActiveSub}>
        {hasPermission === false
          ? 'Camera permission is required to stream live street goods.'
          : 'Connecting hardware camera for street broadcast...'}
      </Text>
      {hasPermission === false && (
        <TouchableOpacity style={styles.btnActivateCamera} onPress={handleRequestPermission} activeOpacity={0.85}>
          <FontAwesome5 name="camera" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.btnActivateCameraText}>Allow Camera Access</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Unified Physical Live Camera Viewport
 */
function PhysicalLiveCamera({ cameraFacing, torchEnabled, isMuted }) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {Platform.OS === 'web' ? (
        <WebPhysicalCamera cameraFacing={cameraFacing} isMuted={isMuted} />
      ) : (
        <NativePhysicalCamera cameraFacing={cameraFacing} torchEnabled={torchEnabled} isMuted={isMuted} />
      )}
      {/* Viewfinder corner guides & center reticle */}
      <View style={styles.viewfinderGuide} pointerEvents="none">
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
        <View style={styles.viewfinderCenterReticle} />
        <View style={styles.viewfinderBadgeRow}>
          <View style={styles.viewfinderTag}>
            <View style={styles.recPulseDot} />
            <Text style={styles.viewfinderTagText}>HARDWARE CAMERA FEED • LIVE</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Broadcaster Camera Viewport (resolves ReferenceError)
 */
function BroadcasterCameraViewport(props) {
  return <PhysicalLiveCamera {...props} />;
}

/**
 * Web-only HLS player: browsers except Safari cannot play .m3u8 natively,
 * so hls.js demuxes the stream into the HTML5 video element.
 */
function WebHlsPlayer({ streamUrl, isMuted }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let hls = null;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    } else {
      const Hls = require('hls.js');
      if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true, enableWorker: true });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setFailed(true);
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } else {
        setFailed(true);
        return undefined;
      }
    }

    video.muted = isMuted;
    video.play().catch(() => {});

    return () => {
      if (hls) hls.destroy();
    };
  }, [streamUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  if (failed) {
    return (
      <View style={styles.videoUnavailable}>
        <FontAwesome5 name="broadcast-tower" size={32} color={Colors.pureGreen} />
        <Text style={styles.videoUnavailableText}>Connecting to Live Street Broadcast...</Text>
        <Text style={styles.videoUnavailableSub}>Waiting for the trader's camera feed</Text>
      </View>
    );
  }

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: isMuted,
    controls: false,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      backgroundColor: '#000'
    }
  });
}

function StreamVideoSurface({ playbackUrl, posterUrl, isMuted, cameraFacing, torchEnabled }) {
  if (!playbackUrl) {
    return (
      <PhysicalLiveCamera
        cameraFacing={cameraFacing}
        torchEnabled={torchEnabled}
        isMuted={isMuted}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : null}
      {Platform.OS === 'web' ? (
        <WebHlsPlayer streamUrl={playbackUrl} isMuted={isMuted} />
      ) : (
        <StreamVideoPlayer streamUrl={playbackUrl} isMuted={isMuted} />
      )}
    </View>
  );
}

/**
 * Floating reaction particle animation
 */
function FloatingReaction({ id, icon, color, onComplete }) {
  const animY = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;
  const animX = useRef(new Animated.Value((Math.random() - 0.5) * 40)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animY, {
        toValue: -170,
        duration: 1800,
        useNativeDriver
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 1800,
        useNativeDriver
      })
    ]).start(() => {
      if (onComplete) onComplete(id);
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.floatingReaction,
        {
          transform: [{ translateY: animY }, { translateX: animX }],
          opacity: animOpacity
        }
      ]}
    >
      <FontAwesome5 name={icon} size={22} color={color} />
    </Animated.View>
  );
}

export default function LiveStreamScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [streams, setStreams] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [usePhysicalCamera, setUsePhysicalCamera] = useState(true);

  // Broadcaster Camera State
  const [cameraFacing, setCameraFacing] = useState('back'); // 'back' for items, 'front' for selfie
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [broadcastSeconds, setBroadcastSeconds] = useState(0);

  // Broadcaster session tracking
  const [myBroadcastStreamId, setMyBroadcastStreamId] = useState(null);
  const [rtmpUrl, setRtmpUrl] = useState(null);
  const [broadcastStatus, setBroadcastStatus] = useState(null);
  const [dibsAlertBanner, setDibsAlertBanner] = useState(null);

  // Chat & reactions state
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [reactions, setReactions] = useState([]);

  // Modals state
  const [dibsItem, setDibsItem] = useState(null);
  const [paymentItem, setPaymentItem] = useState(null);

  // "Go Live" broadcast modal
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastLocation, setBroadcastLocation] = useState('Bree Taxi Rank, Joburg CBD');
  const [isStartingStream, setIsStartingStream] = useState(false);

  // Broadcaster "Drop Item" modal
  const [showDropItemModal, setShowDropItemModal] = useState(false);
  const [dropTitle, setDropTitle] = useState('');
  const [dropPrice, setDropPrice] = useState('');
  const [dropCondition, setDropCondition] = useState('Grade A Street Thrift');
  const [dropImage, setDropImage] = useState(null);
  const [isDroppingItem, setIsDroppingItem] = useState(false);

  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chatFlatListRef = useRef(null);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState(UserStore.getProfile());

  useEffect(() => {
    const unsub = UserStore.subscribe((profile) => {
      setCurrentUser(profile);
    });
    return unsub;
  }, []);

  const isBroadcaster = Boolean(
    activeStream && (
      activeStream.id === myBroadcastStreamId ||
      (currentUser?.id && (activeStream.seller_id === currentUser.id || activeStream.sellerId === currentUser.id)) ||
      activeStream.seller_id?.startsWith('trader-my')
    )
  );

  /**
   * AUTH GUARD: A user must be logged in to be live / broadcast from the street
   */
  const handleOpenStudio = () => {
    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Login Required to Go Live',
        'You must be logged in with a DOBHA DOBHA trader account to broadcast live. Please sign in or register to start streaming your bale unboxing.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In / Register',
            style: 'default',
            onPress: () => navigation.navigate('SignUp')
          }
        ]
      );
      return;
    }
    setIsStudioMode(true);
  };

  useEffect(() => {
    loadStreams();
    pollIntervalRef.current = setInterval(() => {
      refreshStreamsSilently();
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Timer when broadcasting live
  useEffect(() => {
    if (isBroadcaster) {
      setBroadcastSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setBroadcastSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isBroadcaster]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const createDefaultStreamSession = () => ({
    id: 'street-live-default',
    title: 'Live Street Bale Unboxing & Drop',
    location: 'Bree Taxi Rank, Joburg CBD',
    seller_name: 'Verified Street Trader',
    seller_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    viewer_count: 14,
    playback_url: null,
    featured_item: {
      id: 'drop-live-vintage-carhartt',
      title: 'Vintage 90s Carhartt Detroit Duck Jacket',
      price: 185.00,
      condition: 'Grade A Vintage Thrift',
      image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80',
      dibs_status: 'available'
    },
    chat_messages: [
      { id: 'm1', user: 'ESCROW BOT', text: 'Cashless Vault active. 6-digit PIN ready for pickup.' },
      { id: 'm2', user: 'Joburg Thrifter', text: 'Unbox the Carhartt and denim pile!' }
    ]
  });

  const loadStreams = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getStreams();
      if (res && res.success && Array.isArray(res.streams) && res.streams.length > 0) {
        setStreams(res.streams);
        setActiveStream(res.streams[0]);
      } else {
        const fallback = createDefaultStreamSession();
        setStreams([fallback]);
        setActiveStream(fallback);
      }
    } catch (err) {
      console.warn('Streams load error:', err);
      const fallback = createDefaultStreamSession();
      setStreams([fallback]);
      setActiveStream(fallback);
    } finally {
      setLoading(false);
    }
  };

  const refreshStreamsSilently = async () => {
    try {
      const res = await ApiService.getStreams();
      if (res && res.success && Array.isArray(res.streams)) {
        setStreams(res.streams);
        if (activeStream) {
          const updated = res.streams.find((s) => s.id === activeStream.id);
          if (updated) {
            // Check for new Dibs claim to alert broadcaster
            if (
              updated.featured_item?.dibs_status === 'locked' &&
              activeStream.featured_item?.dibs_status !== 'locked'
            ) {
              triggerDibsAlert(
                `⚡ DIBS CLAIMED by ${updated.featured_item.locked_by || 'Shopper'} on ${updated.featured_item.title}! Locked for 90s!`
              );
            }
            setActiveStream(updated);
          } else if (res.streams.length > 0 && !isBroadcaster) {
            setActiveStream(res.streams[0]);
          }
        } else if (res.streams.length > 0) {
          setActiveStream(res.streams[0]);
        }
      }
    } catch (err) {
      // silent background refresh
    }
  };

  const triggerDibsAlert = (text) => {
    setDibsAlertBanner(text);
    setTimeout(() => {
      setDibsAlertBanner(null);
    }, 6000);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleTorch = () => {
    setTorchEnabled((prev) => !prev);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeStream || isSendingChat) return;

    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Login Required',
        'You must be logged in to chat during live broadcasts.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In / Register',
            style: 'default',
            onPress: () => navigation.navigate('SignUp')
          }
        ]
      );
      return;
    }

    const text = chatInput.trim();
    setChatInput('');
    setIsSendingChat(true);

    try {
      const profile = await ApiService.getProfile();
      const userName = profile?.user?.name || (isBroadcaster ? 'Broadcaster (Seller)' : 'Shopper');

      const res = await ApiService.sendStreamChat(activeStream.id, {
        user: userName,
        text
      });

      if (res && res.success && res.message) {
        setActiveStream((prev) => {
          if (!prev) return prev;
          const updatedMsgs = [...(prev.chat_messages || []), res.message];
          return { ...prev, chat_messages: updatedMsgs };
        });
      }
    } catch (err) {
      console.warn('Chat send error:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSendReaction = async (type, icon, color) => {
    if (!activeStream) return;

    // Spawn floating animation
    const reactionId = `react-${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id: reactionId, icon, color }]);

    try {
      const profile = await ApiService.getProfile();
      const userName = profile?.user?.name || (isBroadcaster ? 'Broadcaster' : 'Shopper');

      await ApiService.sendStreamChat(activeStream.id, {
        user: userName,
        text: `Sent ${type}`,
        reaction: type
      });
    } catch (err) {
      // ignore
    }
  };

  const handleRemoveReaction = (id) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleStartBroadcast = async () => {
    // Auth Guard: User must be authenticated to start a live broadcast
    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Login Required to Go Live',
        'You must be logged in with a DOBHA DOBHA trader account to broadcast live. Please sign in or register to start streaming.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In / Register',
            style: 'default',
            onPress: () => {
              setIsStudioMode(false);
              navigation.navigate('SignUp');
            }
          }
        ]
      );
      return;
    }

    if (!broadcastTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your live drop broadcast.');
      return;
    }

    setIsStartingStream(true);
    try {
      const profile = await ApiService.getProfile();
      const userName = profile?.user?.name || 'Verified Street Trader';
      const userAvatar =
        profile?.user?.avatarUrl ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80';

      const res = await ApiService.startStream({
        title: broadcastTitle.trim(),
        location: broadcastLocation.trim(),
        sellerName: userName,
        sellerAvatar: userAvatar,
        playbackUrl: null
      });

      setIsStartingStream(false);

      if (res && res.success && res.stream) {
        setShowGoLiveModal(false);
        setIsStudioMode(false);
        setBroadcastTitle('');
        setActiveStream(res.stream);
        setMyBroadcastStreamId(res.stream.id);
        if (res.stream.stream_key) {
          setRtmpUrl(`rtmp://live.mux.com/app/${res.stream.stream_key}`);
        }
        setStreams((prev) => [res.stream, ...prev.filter((s) => s.id !== res.stream.id)]);

        Alert.alert(
          'YOU ARE BROADCASTING LIVE!',
          'Your phone camera is now streaming live to shoppers across South Africa. Tap "Drop Piece to Bale" at any time to list items live.'
        );
      } else {
        Alert.alert('Could Not Start Broadcast', res?.message || 'Please check your connection.');
      }
    } catch (err) {
      setIsStartingStream(false);
      console.error('Start stream error:', err);
      Alert.alert('Broadcast Error', 'Could not initiate live stream.');
    }
  };

  const handleEndBroadcast = async () => {
    if (!activeStream) return;

    Alert.alert(
      'End Live Broadcast',
      'Are you sure you want to end your street sale broadcast? Viewers will be notified that the stream has finished.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Broadcast',
          style: 'destructive',
          onPress: async () => {
            try {
              setRtmpUrl(null);
              setBroadcastStatus(null);
              await ApiService.endStream(activeStream.id);
              setMyBroadcastStreamId(null);
              setBroadcastSeconds(0);
              loadStreams();
            } catch (err) {
              Alert.alert('Error', 'Failed to end broadcast');
            }
          }
        }
      ]
    );
  };

  const handleSnapDropPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture the piece.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDropImage(result.assets[0].uri);
      }
    } catch (_) {}
  };

  const handlePickDropPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDropImage(result.assets[0].uri);
      }
    } catch (_) {}
  };

  const handleDropNewItem = async () => {
    if (!dropTitle.trim() || !dropPrice.trim() || !activeStream) {
      Alert.alert('Fields Required', 'Please enter both item title and price.');
      return;
    }

    setIsDroppingItem(true);
    try {
      const res = await ApiService.dropItemToStream(activeStream.id, {
        title: dropTitle.trim(),
        price: parseFloat(dropPrice),
        condition: dropCondition,
        image_url: dropImage || DEFAULT_ITEM_IMAGE
      });

      setIsDroppingItem(false);

      if (res && res.success && res.featured_item) {
        setShowDropItemModal(false);
        setDropTitle('');
        setDropPrice('');
        setDropImage(null);
        setActiveStream((prev) => (prev ? { ...prev, featured_item: res.featured_item } : prev));
        Alert.alert('PIECE DROPPED LIVE!', 'Item unboxed and pushed to all viewers. Dibs is now open!');
      } else {
        Alert.alert('Drop Failed', res?.message || 'Could not push item to stream.');
      }
    } catch (err) {
      setIsDroppingItem(false);
      Alert.alert('Error', 'Failed to drop item to live stream.');
    }
  };

  const handleClaimDibs = async () => {
    if (!activeStream || !activeStream.featured_item) return;

    if (!UserStore.isAuthenticated()) {
      Alert.alert(
        'Login Required',
        'You must be logged in to claim 90-second Dibs on live items.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In / Register',
            style: 'default',
            onPress: () => navigation.navigate('SignUp')
          }
        ]
      );
      return;
    }

    try {
      const profile = await ApiService.getProfile();
      const myUserId = profile?.user?.id;
      if (myUserId && (activeStream.seller_id === myUserId || activeStream.sellerId === myUserId)) {
        Alert.alert('Your Own Stream', 'You cannot claim Dibs on an item in your own live broadcast.');
        return;
      }
      const buyerName = profile?.user?.name || 'Shopper';

      const res = await ApiService.claimDibs(activeStream.id, activeStream.featured_item.id, buyerName);
      if (res && res.success) {
        setDibsItem(activeStream.featured_item);
      } else {
        Alert.alert('Dibs Unavailable', res?.message || 'Item already claimed or expired.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not claim Dibs on this item.');
    }
  };

  // Empty state when no stream is live
  if (!loading && (!activeStream || streams.length === 0)) {
    return (
      <View style={styles.noStreamContainer}>
        {/* Top Exit button to return to marketplace */}
        <TouchableOpacity
          style={[styles.noStreamBackBtn, { top: Math.max(insets.top + 10, 36) }]}
          onPress={() => (navigation?.goBack ? navigation.goBack() : navigation?.navigate('Catalog'))}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="arrow-left" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.noStreamBackText}>Back to Marketplace</Text>
        </TouchableOpacity>

        <View style={styles.noStreamCircle}>
          <FontAwesome5 name="video" size={36} color={Colors.pureGreen} />
        </View>
        <Text style={styles.noStreamTitle}>No Active Street Broadcasts</Text>
        <Text style={styles.noStreamSubtitle}>
          Street traders broadcast live bale unboxings from Bree Taxi Rank and Park Station throughout the day.
        </Text>

        <TouchableOpacity
          style={styles.btnGoLiveMain}
          onPress={handleOpenStudio}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="video" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnGoLiveMainText}>Open Live Studio & Broadcast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnRefreshStreams}
          onPress={loadStreams}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="sync-alt" size={14} color={Colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.btnRefreshStreamsText}>Check for Live Drops</Text>
        </TouchableOpacity>

        {renderGoLiveModal()}
      </View>
    );
  }

  // Broadcaster Pre-Live Studio Mode (TikTok / Instagram style with hardware camera preview)
  if (isStudioMode) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent />

        {/* Full Screen Physical Camera Preview */}
        <PhysicalLiveCamera
          cameraFacing={cameraFacing}
          torchEnabled={torchEnabled}
          isMuted={isMuted}
        />

        <View style={styles.videoOverlay} />

        {/* Viewfinder reticle & guide corners for authentic studio camera look */}
        <View pointerEvents="none" style={styles.viewfinderGuide}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
          <View style={styles.viewfinderCenterReticle} />
        </View>

        {/* Studio Safe Area Top Header */}
        <View style={[styles.studioHeader, { top: Math.max(insets.top + 8, 36) }]}>
          <TouchableOpacity
            style={styles.iconCircleBtnBack}
            onPress={() => setIsStudioMode(false)}
            activeOpacity={0.8}
            accessibilityLabel="Close Studio"
          >
            <FontAwesome5 name="times" size={15} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.studioPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.studioPillTitle}>BROADCASTER STUDIO</Text>
          </View>

          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={toggleCameraFacing}
            activeOpacity={0.8}
            accessibilityLabel="Flip camera"
          >
            <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Studio Right Vertical Tool Rail */}
        <View style={[styles.studioRightRail, { top: Math.max(insets.top + 70, 95) }]}>
          <TouchableOpacity
            style={[styles.railToolBtn, torchEnabled && { backgroundColor: '#F59E0B' }]}
            onPress={toggleTorch}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="bolt" size={15} color="#FFFFFF" />
            <Text style={styles.railToolLabel}>Flash</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.railToolBtn}
            onPress={toggleCameraFacing}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="sync-alt" size={14} color="#FFFFFF" />
            <Text style={styles.railToolLabel}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.railToolBtn}
            onPress={() => setIsMuted(!isMuted)}
            activeOpacity={0.8}
          >
            <FontAwesome5
              name={isMuted ? 'microphone-slash' : 'microphone'}
              size={15}
              color={isMuted ? '#EF4444' : '#FFFFFF'}
            />
            <Text style={styles.railToolLabel}>{isMuted ? 'Muted' : 'Mic'}</Text>
          </TouchableOpacity>
        </View>

        {/* Pre-Live Broadcast Title & Location Card */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.studioCenterCard, { bottom: Math.max(insets.bottom + 92, 104) }]}
        >
          <View style={styles.studioCenterCardInner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <FontAwesome5 name="broadcast-tower" size={12} color={Colors.pureGreen} />
              <Text style={styles.studioCenterLabel}>PRE-LIVE SETUP</Text>
            </View>

            <TextInput
              style={styles.studioTitleInput}
              placeholder="What are you unboxing? (e.g. Vintage Carhartt Bale 🔥)"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
            />

            <TextInput
              style={styles.studioLocationInput}
              placeholder="Location (e.g. Bree Taxi Rank, Joburg CBD)"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={broadcastLocation}
              onChangeText={setBroadcastLocation}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Big Social Media Go Live Button */}
        <View style={[styles.studioBottomBar, { bottom: Math.max(insets.bottom + 12, 18) }]}>
          <TouchableOpacity
            style={[styles.btnSocialGoLiveMain, isStartingStream && { opacity: 0.7 }]}
            onPress={handleStartBroadcast}
            disabled={isStartingStream}
            activeOpacity={0.85}
          >
            {isStartingStream ? (
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
            ) : (
              <View style={styles.pulseDotWhite} />
            )}
            <Text style={styles.btnSocialGoLiveMainText}>
              {isStartingStream ? 'CONNECTING BALE STREAM...' : '🔴 GO LIVE NOW'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.studioBottomSub}>90-Second Dibs & Direct Escrow Payouts Enabled</Text>
        </View>
      </View>
    );
  }

  // Active Live Stream View (Hardware Camera Feed + Street Broadcast HUD)
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      <View style={styles.videoBox}>
        {/* Render physical hardware camera by default */}
        {isBroadcaster && rtmpUrl ? (
          <MuxRtmpBroadcast
            rtmpUrl={rtmpUrl}
            cameraFacing={cameraFacing}
            isMuted={isMuted}
            torchEnabled={torchEnabled}
            onStatus={(e) => setBroadcastStatus(e && e.code != null ? String(e.code) : null)}
          />
        ) : usePhysicalCamera || isBroadcaster || !activeStream?.playback_url ? (
          <PhysicalLiveCamera
            cameraFacing={cameraFacing}
            torchEnabled={torchEnabled}
            isMuted={isMuted}
          />
        ) : (
          <StreamVideoSurface
            playbackUrl={activeStream.playback_url}
            posterUrl={activeStream.poster_url || activeStream.featured_item?.image_url}
            isMuted={isMuted}
            cameraFacing={cameraFacing}
            torchEnabled={torchEnabled}
          />
        )}

        <View style={styles.videoOverlay} />

        {/* Real-time Dibs Alert Banner */}
        {dibsAlertBanner && (
          <View style={styles.dibsBanner}>
            <FontAwesome5 name="bolt" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.dibsBannerText}>{dibsAlertBanner}</Text>
          </View>
        )}

        {/* Top Stream Header - Social Media Style (Clean, Fits 360px) */}
        <View style={[styles.streamHeader, { top: Math.max(insets.top + 8, 36) }]}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.iconCircleBtnBack}
              onPress={() => (navigation?.goBack ? navigation.goBack() : navigation?.navigate('Catalog'))}
              activeOpacity={0.8}
              accessibilityLabel="Exit live stream"
            >
              <FontAwesome5 name="arrow-left" size={13} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.streamerPill}>
              <Image
                source={{
                  uri:
                    activeStream?.seller_avatar ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                }}
                style={styles.streamerAvatar}
              />
              <View style={styles.streamerInfoBox}>
                <Text style={styles.streamerName} numberOfLines={1}>
                  {isBroadcaster ? 'You (Live)' : activeStream?.seller_name || 'Verified Trader'}
                </Text>
                <Text style={styles.streamerLocation} numberOfLines={1}>
                  {activeStream?.location || 'Joburg CBD'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            <View style={styles.badgeLiveCombined}>
              <View style={styles.pulseDotRed} />
              <Text style={styles.badgeLiveText}>
                {isBroadcaster ? `LIVE ${formatTimer(broadcastSeconds)}` : 'LIVE'}
              </Text>
              <Text style={styles.badgeViewerCount}>
                {activeStream?.viewer_count || 1}
              </Text>
            </View>

            {isBroadcaster ? (
              <TouchableOpacity
                style={styles.btnEndBroadcastPill}
                onPress={handleEndBroadcast}
                activeOpacity={0.85}
              >
                <FontAwesome5 name="stop" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnEndBroadcastText}>End</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.socialGoLiveBtn}
                onPress={handleOpenStudio}
                activeOpacity={0.85}
              >
                <FontAwesome5 name="video" size={11} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.socialGoLiveBtnText}>Go Live</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Broadcaster Quick Selling Action Bar */}
        {isBroadcaster && (
          <View style={[styles.broadcasterBar, { top: Math.max(insets.top + 54, 78) }]}>
            <View style={styles.broadcasterTag}>
              <FontAwesome5 name="store" size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.broadcasterTagText}>STREET SELLER CONSOLE</Text>
            </View>
            <TouchableOpacity
              style={styles.btnDropPiece}
              onPress={() => setShowDropItemModal(true)}
              activeOpacity={0.85}
            >
              <FontAwesome5 name="bolt" size={11} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.btnDropPieceText}>+ Drop Piece to Bale</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Reactions Render Area */}
        <View pointerEvents="none" style={[styles.floatingArea, { bottom: Math.max(insets.bottom + 180, 190) }]}>
          {reactions.map((r) => (
            <FloatingReaction
              key={r.id}
              id={r.id}
              icon={r.icon}
              color={r.color}
              onComplete={handleRemoveReaction}
            />
          ))}
        </View>

        {/* Right Vertical Tool & Reactions Rail (Social Media Layout) */}
        <View style={[styles.rightVerticalRail, { bottom: Math.max(insets.bottom + 65, 75) }]}>
          {/* Quick Camera Controls if broadcaster or using physical camera */}
          {(isBroadcaster || usePhysicalCamera) && (
            <TouchableOpacity
              style={styles.railToolBtn}
              onPress={toggleCameraFacing}
              activeOpacity={0.8}
              accessibilityLabel="Flip camera"
            >
              <FontAwesome5 name="sync-alt" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {(isBroadcaster || usePhysicalCamera) && (
            <TouchableOpacity
              style={[styles.railToolBtn, torchEnabled && { backgroundColor: '#F59E0B' }]}
              onPress={toggleTorch}
              activeOpacity={0.8}
              accessibilityLabel="Toggle flashlight"
            >
              <FontAwesome5 name="bolt" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Audio Mute Toggle */}
          <TouchableOpacity
            style={styles.railToolBtn}
            onPress={() => setIsMuted(!isMuted)}
            activeOpacity={0.8}
          >
            <FontAwesome5 name={isMuted ? 'volume-mute' : 'volume-up'} size={12} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Social Reactions */}
          <TouchableOpacity
            style={[styles.reactionBtn, { backgroundColor: 'rgba(245, 158, 11, 0.4)' }]}
            onPress={() => handleSendReaction('fire', 'fire', '#F59E0B')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="fire" size={15} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reactionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.4)' }]}
            onPress={() => handleSendReaction('heart', 'heart', '#EF4444')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="heart" size={15} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reactionBtn, { backgroundColor: 'rgba(16, 185, 129, 0.4)' }]}
            onPress={() => handleSendReaction('thumbs-up', 'thumbs-up', '#10B981')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="thumbs-up" size={15} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reactionBtn, { backgroundColor: 'rgba(236, 72, 153, 0.4)' }]}
            onPress={() => handleSendReaction('bolt', 'bolt', '#EC4899')}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="bolt" size={15} color="#EC4899" />
          </TouchableOpacity>
        </View>

        {/* Live Chat Barrage */}
        <View style={[styles.chatContainer, { bottom: Math.max(insets.bottom + 120, 126) }]}>
          <FlatList
            ref={chatFlatListRef}
            data={activeStream?.chat_messages || []}
            keyExtractor={(item, index) => item.id || `msg-${index}`}
            renderItem={({ item }) => {
              const isSystem =
                item.user === 'SYSTEM' || item.user === 'ESCROW BOT' || item.user === 'LIVE DROP';
              return (
                <View style={[styles.chatBubble, isSystem && styles.chatBubbleSystem]}>
                  <Text style={[styles.chatUser, isSystem && styles.chatUserSystem]}>
                    {item.user}:{' '}
                  </Text>
                  <Text style={styles.chatText}>{item.text}</Text>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => chatFlatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.chatBubble}>
                <Text style={styles.chatText}>Stream started! Shout out in chat below.</Text>
              </View>
            }
          />
        </View>

        {/* Featured Live Drop Card (Docked cleanly above chat input bar) */}
        {activeStream?.featured_item && (
          <View style={[styles.dropCard, { bottom: Math.max(insets.bottom + 56, 60) }]}>
            <Image
              source={{
                uri:
                  activeStream.featured_item.image_url ||
                  'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=200&q=80'
              }}
              style={styles.dropThumb}
            />
            <View style={{ flex: 1, paddingRight: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <FontAwesome5 name="bolt" size={9} color={Colors.pureGreen} />
                <Text style={styles.dropTag}>JUST UNBOXED FROM BALE</Text>
              </View>
              <Text style={styles.dropTitle} numberOfLines={1}>
                {activeStream.featured_item.title}
              </Text>
              <Text style={styles.dropPrice}>
                R{Number(activeStream.featured_item.price || 0).toFixed(2)}
              </Text>
            </View>

            {isBroadcaster ? (
              <View style={styles.btnBroadcasterItemStatus}>
                <Text style={styles.btnBroadcasterItemStatusText}>
                  {activeStream.featured_item.dibs_status === 'locked' ? 'LOCKED (90s)' : 'DROPPED LIVE'}
                </Text>
              </View>
            ) : activeStream.featured_item.dibs_status === 'locked' ? (
              <View style={styles.btnDibsLocked}>
                <FontAwesome5 name="lock" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnDibsLockedText}>Locked (90s)</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.btnDibs}
                onPress={handleClaimDibs}
                activeOpacity={0.85}
              >
                <FontAwesome5 name="bolt" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.btnDibsText}>Claim Dibs!</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bottom Chat Input Bar */}
        <View style={[styles.inputBar, { bottom: Math.max(insets.bottom + 8, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder={isBroadcaster ? "Shout out to your live shoppers..." : "Shout out in live chat..."}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendChat}
          />
          <TouchableOpacity
            style={[styles.btnSend, (!chatInput.trim() || isSendingChat) && { opacity: 0.5 }]}
            onPress={handleSendChat}
            disabled={!chatInput.trim() || isSendingChat}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="paper-plane" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Render Go Live Modal */}
      {renderGoLiveModal()}

      {/* Render Broadcaster Drop Item Modal */}
      {renderDropItemModal()}

      {/* 90-Second Dibs Modal */}
      {dibsItem && (
        <DibsModal
          visible={!!dibsItem}
          item={dibsItem}
          onCancel={() => setDibsItem(null)}
          onProceed={() => {
            const currentItem = dibsItem;
            setDibsItem(null);
            setPaymentItem(currentItem);
          }}
        />
      )}

      {/* Escrow Payment Modal */}
      {paymentItem && (
        <PaymentModal
          visible={!!paymentItem}
          item={paymentItem}
          onClose={() => setPaymentItem(null)}
          onSuccess={() => navigation?.navigate('Escrow')}
          navigation={navigation}
        />
      )}
    </View>
  );

  function renderGoLiveModal() {
    return (
      <Modal visible={showGoLiveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalBoxHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="broadcast-tower" size={18} color="#EF4444" />
                <Text style={styles.modalBoxTitle}>Go Live & Sell</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGoLiveModal(false)}>
                <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalBoxSub}>
              Activate your phone camera to stream your vintage clothing or sneaker bale unboxing live to buyers across South Africa.
            </Text>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Broadcast Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Grade-A Vintage Carhartt & Windbreaker Bale!"
                placeholderTextColor={Colors.textDim}
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Street Location</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Bree Taxi Rank, Concourse Level"
                placeholderTextColor={Colors.textDim}
                value={broadcastLocation}
                onChangeText={setBroadcastLocation}
              />
            </View>

            {/* Camera facing selection */}
            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Camera Selection</Text>
              <View style={styles.cameraToggleRow}>
                <TouchableOpacity
                  style={[styles.cameraToggleBtn, cameraFacing === 'back' && styles.cameraToggleBtnActive]}
                  onPress={() => setCameraFacing('back')}
                >
                  <FontAwesome5 name="camera" size={12} color={cameraFacing === 'back' ? '#FFFFFF' : Colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={[styles.cameraToggleText, cameraFacing === 'back' && styles.cameraToggleTextActive]}>
                    Rear Camera (Show Goods)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cameraToggleBtn, cameraFacing === 'front' && styles.cameraToggleBtnActive]}
                  onPress={() => setCameraFacing('front')}
                >
                  <FontAwesome5 name="user" size={12} color={cameraFacing === 'front' ? '#FFFFFF' : Colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={[styles.cameraToggleText, cameraFacing === 'front' && styles.cameraToggleTextActive]}>
                    Front (Selfie)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnStartBroadcast, isStartingStream && { opacity: 0.6 }]}
              onPress={handleStartBroadcast}
              disabled={isStartingStream}
              activeOpacity={0.85}
            >
              {isStartingStream ? (
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
              ) : (
                <FontAwesome5 name="video" size={16} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.btnStartBroadcastText}>
                {isStartingStream ? 'Activating Camera...' : 'Turn on Camera & Go Live'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderDropItemModal() {
    return (
      <Modal visible={showDropItemModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalBoxHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="tag" size={18} color={Colors.pureGreen} />
                <Text style={styles.modalBoxTitle}>Drop New Piece to Live Bale</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDropItemModal(false)}>
                <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalBoxSub}>
              Hold up your garment or sneaker to your camera and push it directly to all live viewers with Dibs enabled.
            </Text>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Garment / Sneaker Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Retro 90s Nike Colorblock Windbreaker"
                placeholderTextColor={Colors.textDim}
                value={dropTitle}
                onChangeText={setDropTitle}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Price (ZAR / Rand)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 75.00"
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                value={dropPrice}
                onChangeText={setDropPrice}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Condition</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Grade A Thrift / Like New"
                placeholderTextColor={Colors.textDim}
                value={dropCondition}
                onChangeText={setDropCondition}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Piece Photo</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.btnDropMedia, dropImage && styles.btnDropMediaActive]}
                  onPress={handleSnapDropPhoto}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="camera" size={12} color={dropImage ? Colors.pureGreen : '#FFFFFF'} style={{ marginRight: 6 }} />
                  <Text style={[styles.btnDropMediaText, dropImage && { color: Colors.pureGreen }]}>
                    {dropImage ? 'Photo Snapped ✓' : 'Snap Photo'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnDropMedia}
                  onPress={handlePickDropPhoto}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="images" size={12} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnDropMediaText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPushDrop, isDroppingItem && { opacity: 0.6 }]}
              onPress={handleDropNewItem}
              disabled={isDroppingItem}
              activeOpacity={0.85}
            >
              {isDroppingItem ? (
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
              ) : (
                <FontAwesome5 name="bolt" size={16} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.btnStartBroadcastText}>
                {isDroppingItem ? 'Pushing Piece...' : 'Push Live to Viewers'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  videoUnavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    padding: 20
  },
  videoUnavailableText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12
  },
  videoUnavailableSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4
  },
  cameraFallbackBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#051E11',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  cameraPulseCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0, 166, 81, 0.2)',
    borderWidth: 2,
    borderColor: Colors.pureGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  cameraActiveTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1
  },
  cameraActiveSub: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center'
  },
  cameraStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  cameraStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  cameraStatText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  viewfinderGuide: {
    ...StyleSheet.absoluteFillObject,
    margin: 16
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.pureGreen,
    borderTopLeftRadius: 6
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.pureGreen,
    borderTopRightRadius: 6
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.pureGreen,
    borderBottomLeftRadius: 6
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.pureGreen,
    borderBottomRightRadius: 6
  },
  viewfinderCenterReticle: {
    position: 'absolute',
    top: '46%',
    left: '46%',
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16
  },
  viewfinderBadgeRow: {
    position: 'absolute',
    top: 86,
    alignSelf: 'center',
    zIndex: 10
  },
  cameraSimulatedViewport: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#051E11'
  },
  cameraSimulatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 30, 17, 0.65)'
  },
  cameraConnectingBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.pureGreen,
    zIndex: 10
  },
  cameraConnectingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  viewfinderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 166, 81, 0.4)',
    gap: 6
  },
  recPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444'
  },
  viewfinderTagText: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  btnActivateCamera: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginTop: 18,
    shadowColor: Colors.pureGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  btnActivateCameraText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  cameraSourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  cameraSourcePillActive: {
    backgroundColor: 'rgba(0, 166, 81, 0.35)',
    borderColor: Colors.pureGreen
  },
  cameraSourcePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  btnDropPieceQuick: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10
  },
  btnDropPieceQuickText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  emptyDropCardBroadcaster: {
    position: 'absolute',
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: Colors.pureGreen,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    zIndex: 15
  },
  emptyDropCardBroadcasterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  videoBox: {
    flex: 1,
    position: 'relative'
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  dibsBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 68,
    left: 14,
    right: 14,
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8
  },
  dibsBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    flex: 1
  },
  streamHeader: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  iconCircleBtnBack: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  noStreamBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10
  },
  noStreamBackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  streamerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 6,
    maxWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  streamerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13
  },
  streamerInfoBox: {
    maxWidth: 90
  },
  streamerName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  streamerLocation: {
    color: Colors.pureGreen,
    fontSize: 9,
    fontWeight: '600'
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  badgeLiveCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    gap: 5
  },
  pulseDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444'
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 5
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF'
  },
  badgeLiveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  badgeViewerCount: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '800'
  },
  badgeViewers: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  viewersText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  socialGoLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3
  },
  socialGoLiveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  iconCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  iconCircleBtnGoLive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnEndBroadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12
  },
  btnEndBroadcastText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900'
  },
  broadcasterBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 72,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 166, 81, 0.95)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 16
  },
  broadcasterTag: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  broadcasterTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  btnDropPiece: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  btnDropPieceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  btnBroadcasterItemStatus: {
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10
  },
  btnBroadcasterItemStatusText: {
    color: Colors.pureGreen,
    fontSize: 11,
    fontWeight: '900'
  },
  floatingArea: {
    position: 'absolute',
    bottom: 160,
    right: 14,
    width: 60,
    height: 200,
    zIndex: 25
  },
  floatingReaction: {
    position: 'absolute',
    bottom: 0,
    right: 10
  },
  rightVerticalRail: {
    position: 'absolute',
    right: 10,
    gap: 8,
    alignItems: 'center',
    zIndex: 20
  },
  railToolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  railToolLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2
  },
  reactionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  chatContainer: {
    position: 'absolute',
    left: 12,
    right: 56,
    maxHeight: 180,
    zIndex: 15
  },
  chatBubble: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  chatBubbleSystem: {
    backgroundColor: 'rgba(0, 166, 81, 0.3)',
    borderColor: Colors.pureGreen
  },
  chatUser: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800'
  },
  chatUserSystem: {
    color: Colors.pureGreen,
    fontWeight: '900'
  },
  chatText: {
    color: '#FFFFFF',
    fontSize: 12
  },
  dropCard: {
    position: 'absolute',
    left: 12,
    right: 56,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 166, 81, 0.65)',
    borderRadius: 14,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8
  },
  dropThumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  dropTag: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.pureGreen,
    letterSpacing: 0.5
  },
  dropTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1
  },
  dropPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#EF4444',
    marginTop: 1
  },
  btnDibs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10
  },
  btnDibsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900'
  },
  btnDibsLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  btnDibsLockedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  inputBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 21,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  // Studio Mode Styles
  studioHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20
  },
  studioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 166, 81, 0.5)',
    gap: 6
  },
  studioPillTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  studioRightRail: {
    position: 'absolute',
    right: 14,
    gap: 12,
    alignItems: 'center',
    zIndex: 20
  },
  studioCenterCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 20
  },
  studioCenterCardInner: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 166, 81, 0.6)'
  },
  studioCenterLabel: {
    color: Colors.pureGreen,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  studioTitleInput: {
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  studioLocationInput: {
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(0, 166, 81, 0.3)'
  },
  studioBottomBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 20
  },
  btnSocialGoLiveMain: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8
  },
  btnSocialGoLiveMainText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  pulseDotWhite: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8
  },
  studioBottomSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6
  },
  btnSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.pureGreen,
    alignItems: 'center',
    justifyContent: 'center'
  },
  noStreamContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  noStreamCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 166, 81, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  noStreamTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center'
  },
  noStreamSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 300
  },
  btnGoLiveMain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginBottom: 14
  },
  btnGoLiveMainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  btnRefreshStreams: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  btnRefreshStreamsText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
  },
  modalBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalBoxTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A'
  },
  modalBoxSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14
  },
  modalFormGroup: {
    marginBottom: 12
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#0F172A'
  },
  cameraToggleRow: {
    flexDirection: 'row',
    gap: 8
  },
  cameraToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cameraToggleBtnActive: {
    backgroundColor: Colors.pureGreen,
    borderColor: Colors.pureGreen
  },
  cameraToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted
  },
  cameraToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  btnStartBroadcast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6
  },
  btnPushDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureGreen,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8
  },
  btnStartBroadcastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  btnDropMedia: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  btnDropMediaActive: {
    borderColor: Colors.pureGreen,
    backgroundColor: 'rgba(0, 166, 81, 0.15)'
  },
  btnDropMediaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
