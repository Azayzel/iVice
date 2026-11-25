import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';

const ReducedMotion = createContext(true);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionProvider({ children }: { children: React.ReactNode }) {
    const [reduced, setReduced] = useState(true);
    useEffect(() => {
        let active = true;
        let changed = false;
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
            changed = true;
            setReduced(value);
        });
        void AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (active && !changed) setReduced(value);
        }).catch(() => { });
        return () => { active = false; subscription.remove(); };
    }, []);
    return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}

export function useReducedMotion() {
    return useContext(ReducedMotion);
}

export function MotionPressable({ style, onPressIn, onPressOut, disabled, ...props }: PressableProps) {
    const reduced = useReducedMotion();
    const scale = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (reduced || disabled) {
            scale.stopAnimation();
            scale.setValue(1);
        }
        return () => scale.stopAnimation();
    }, [reduced, disabled, scale]);
    function animate(toValue: number) {
        if (reduced || disabled) return;
        scale.stopAnimation();
        Animated.spring(scale, { toValue, speed: 36, bounciness: 4, useNativeDriver: true, isInteraction: false }).start();
    }
    const animatedStyle = { transform: [{ scale }] };
    return <AnimatedPressable
        {...props}
        disabled={disabled}
        style={typeof style === 'function' ? (state: PressableStateCallbackType) => [style(state), animatedStyle] : [style, animatedStyle]}
        onPressIn={event => { animate(0.97); onPressIn?.(event); }}
        onPressOut={event => { animate(1); onPressOut?.(event); }}
    />;
}

export function ScreenTransition({ navigationKey, children }: { navigationKey: string; children: React.ReactNode }) {
    const reduced = useReducedMotion();
    const progress = useRef(new Animated.Value(1)).current;
    useLayoutEffect(() => {
        progress.stopAnimation();
        if (reduced) {
            progress.setValue(1);
            return;
        }
        progress.setValue(0);
        const animation = Animated.timing(progress, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
            isInteraction: false
        });
        animation.start();
        return () => animation.stop();
    }, [navigationKey, reduced, progress]);
    return <Animated.View style={{
        flex: 1,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }]
    }}>{children}</Animated.View>;
}