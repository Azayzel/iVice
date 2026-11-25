import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LIBRARY_MEDIA, type LibraryPhoto } from './library-media.generated';
import { COMMUNITY_MEDIA } from './community-media';
import { MotionPressable as Pressable, useReducedMotion } from './motion';
import type { Palette } from './themes';

export function LibraryGallery({ entryId, title, palette, spoilers, photosOverride, aspectRatio }: { entryId: string; title: string; palette: Palette; spoilers: boolean; photosOverride?: LibraryPhoto[]; aspectRatio?: number }) {
    const community = COMMUNITY_MEDIA[entryId];
    const photos = photosOverride ?? community?.photos ?? LIBRARY_MEDIA[entryId] ?? [];
    const [index, setIndex] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [consent, setConsent] = useState(false);
    const [failed, setFailed] = useState(false);
    const reducedMotion = useReducedMotion();
    const photo = photos[index];
    if (!photo) return null;

    function changePhoto(next: number) {
        const change = () => { setIndex(next); setFailed(false); setConsent(true) };
        if (next > 0 && !spoilers && !consent) {
            Alert.alert('Additional screenshots', 'These supplied images have not been reviewed for story spoilers.', [{ text: 'Cancel', style: 'cancel' }, { text: 'View images', onPress: change }]);
        } else change();
    }

    const image = (fullScreen: boolean) => failed ? <View style={[styles.missing, { backgroundColor: palette.panel }]}><Ionicons name="image-outline" color={palette.muted} size={30} /><Text style={{ color: palette.muted }}>Image unavailable</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry image" style={styles.button} onPress={() => setFailed(false)}><Ionicons name="refresh" size={23} color={palette.text} /></Pressable></View> : <Image key={photo.source} source={photo.source} resizeMode="contain" accessibilityLabel={`${title}, image ${index + 1} of ${photos.length}`} onError={() => setFailed(true)} style={fullScreen ? styles.fullImage : styles.image} />;
    const controls = <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={index === 0} onPress={() => changePhoto(index - 1)} style={[styles.button, { opacity: index === 0 ? 0.3 : 1 }]}><Ionicons name="arrow-back" size={22} color={palette.text} /></Pressable>
        <Text accessibilityLiveRegion="polite" style={{ color: palette.muted }}>{index + 1} / {photos.length}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={index === photos.length - 1} onPress={() => changePhoto(index + 1)} style={[styles.button, { opacity: index === photos.length - 1 ? 0.3 : 1 }]}><Ionicons name="arrow-forward" size={22} color={palette.text} /></Pressable>
    </View>;

    return <View style={{ gap: 8, width: '100%' }}>
        <View style={[styles.frame, { backgroundColor: palette.panel, aspectRatio: aspectRatio ?? community?.aspectRatio ?? 16 / 9 }]}>
            {image(false)}
            {!photosOverride && community?.video ? <Pressable accessibilityRole="button" accessibilityLabel={`Play ${title} video`} onPress={() => setPlaying(true)} style={[styles.play, { backgroundColor: palette.panel }]}><Ionicons name="play" size={30} color={palette.text} /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Expand ${title} image`} onPress={() => setExpanded(true)} style={[styles.expand, photosOverride && { top: 8, bottom: undefined }, { backgroundColor: palette.panel }]}><Ionicons name="expand-outline" size={22} color={palette.text} /></Pressable>
        </View>
        {photos.length > 1 ? controls : null}
        <Text style={{ color: palette.muted, fontSize: 12 }}>{community?.credit ?? 'User-supplied screenshots'}</Text>
        {playing && community?.video ? <LocalVideo source={community.video} title={title} palette={palette} credit={community.credit} onClose={() => setPlaying(false)} /> : null}
        <Modal visible={expanded} animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setExpanded(false)}>
            <SafeAreaProvider style={{ flex: 1, backgroundColor: palette.bg }}>
                <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
                    <View style={styles.header}><Text numberOfLines={2} style={{ color: palette.text, flex: 1, fontSize: 16 }}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={() => setExpanded(false)} style={styles.button}><Ionicons name="close" size={24} color={palette.text} /></Pressable></View>
                    <ScrollView key={index} maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={{ flex: 1 }} style={{ flex: 1 }}>{image(true)}</ScrollView>
                    {photos.length > 1 ? controls : null}
                </SafeAreaView>
            </SafeAreaProvider>
        </Modal>
    </View>;
}

function LocalVideo({ source, title, palette, credit, onClose }: { source: number; title: string; palette: Palette; credit: string; onClose: () => void }) {
    const player = useVideoPlayer(source, instance => { instance.play() });
    const { status } = useEvent(player, 'statusChange', { status: player.status });
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => { if (state !== 'active') player.pause() });
        return () => subscription.remove();
    }, [player]);
    return <Modal visible animationType="none" onRequestClose={onClose}>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: palette.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
                <View style={styles.header}><Text numberOfLines={2} style={{ flex: 1, color: palette.text, fontSize: 16 }}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} style={styles.button}><Ionicons name="close" size={24} color={palette.text} /></Pressable></View>
                <View style={{ flex: 1 }}>
                    {status === 'error' ? <View style={styles.missing}><Text accessibilityRole="alert" style={{ color: palette.text }}>Video unavailable</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry video" style={styles.button} onPress={() => { void player.replaceAsync(source).then(() => player.play()).catch(() => Alert.alert('Unable to load video')) }}><Ionicons name="refresh" size={24} color={palette.text} /></Pressable></View> : <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />}
                    {status === 'loading' || status === 'idle' ? <ActivityIndicator accessibilityLabel="Loading video" pointerEvents="none" color={palette.text} style={StyleSheet.absoluteFill} /> : null}
                </View>
                <Text style={{ color: palette.muted, fontSize: 12, padding: 16 }}>{credit}</Text>
            </SafeAreaView>
        </SafeAreaProvider>
    </Modal>;
}

const styles = StyleSheet.create({
    frame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
    image: { width: '100%', height: '100%' },
    fullImage: { width: '100%', height: '100%' },
    missing: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 },
    button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    play: { position: 'absolute', left: '50%', top: '50%', marginLeft: -30, marginTop: -30, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    expand: { position: 'absolute', right: 8, bottom: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, minHeight: 44 },
    header: { minHeight: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
});