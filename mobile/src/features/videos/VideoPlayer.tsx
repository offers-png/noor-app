import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { allowPlayerNavigation, playerHtml } from '../../services/videos/StoryVideos';

/** In-app player. Leaving to the YouTube app or website is blocked, which also keeps Kids Mode locked. */
export function VideoPlayer({ id, baseUrl }: { id: string; baseUrl: string }) {
  const origin = new URL(baseUrl).origin + '/';
  return <View style={styles.box}>
    <WebView source={{ html: playerHtml(id), baseUrl: origin }} originWhitelist={['*']} allowsFullscreenVideo mediaPlaybackRequiresUserAction={false}
      setSupportMultipleWindows={false} javaScriptEnabled domStorageEnabled incognito
      onShouldStartLoadWithRequest={request => allowPlayerNavigation(request, origin)} style={StyleSheet.absoluteFill} />
  </View>;
}
const styles = StyleSheet.create({ box: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' } });
