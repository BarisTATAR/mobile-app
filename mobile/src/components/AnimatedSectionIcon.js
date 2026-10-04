import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text } from 'react-native';

const MOTIONS = {
  float: {
    pingPong: true,
    duration: 1700,
    transform: (v) => [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
    ],
  },
  pulse: {
    pingPong: true,
    duration: 1400,
    transform: (v) => [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  },
  sway: {
    pingPong: true,
    duration: 1600,
    transform: (v) => [
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) },
    ],
  },
  bounce: {
    pingPong: true,
    duration: 900,
    easing: Easing.out(Easing.quad),
    transform: (v) => [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  },
  spin: {
    pingPong: false,
    duration: 4800,
    easing: Easing.linear,
    transform: (v) => [
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
    ],
  },
};

export default function AnimatedSectionIcon({ emoji, disabled, motion = 'float', delay = 0, style }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const spec = MOTIONS[motion] || MOTIONS.float;

  useEffect(() => {
    let mounted = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.()).then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(!!enabled);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (disabled || reduceMotion) return undefined;

    const easing = spec.easing || Easing.inOut(Easing.sin);
    const cycle = spec.pingPong
      ? Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: spec.duration,
            easing,
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: spec.duration,
            easing,
            useNativeDriver: true,
          }),
        ])
      : Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing,
          useNativeDriver: true,
        });

    let loop;
    const start = setTimeout(() => {
      loop = Animated.loop(cycle);
      loop.start();
    }, delay);

    return () => {
      clearTimeout(start);
      loop?.stop();
      progress.stopAnimation();
    };
  }, [delay, disabled, progress, reduceMotion, spec.duration, spec.easing, spec.pingPong]);

  return (
    <Animated.View style={{ transform: spec.transform(progress) }}>
      <Text style={style}>{emoji}</Text>
    </Animated.View>
  );
}
