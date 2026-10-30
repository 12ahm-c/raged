import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { palette } from '../../components/ui/States';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const TILE = 256;
const MAX_ZOOM = 16;
const MIN_ZOOM = 3;
const PADDING = 26;

/** إسقاط Web Mercator: يحوّل الإحداثيات الجغرافية إلى بكسل الخريطة عند مستوى تكبير z. */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

interface MapLayout {
  topLeftX: number;
  topLeftY: number;
  zoom: number;
  pixels: { x: number; y: number }[];
  tiles: { key: string; uri: string; left: number; top: number }[];
  segments: { key: string; left: number; top: number; width: number; angle: number }[];
}

function buildLayout(route: GeoPoint[], width: number, height: number): MapLayout | null {
  if (width < 80 || height < 80 || route.length === 0) return null;

  // اختيار أكبر مستوى تكبير يتسع للمسار كاملًا داخل الإطار مع هامش.
  let zoom = MIN_ZOOM;
  let points = route.map((point) => project(point.lat, point.lng, zoom));
  for (let tryZoom = MAX_ZOOM; tryZoom >= MIN_ZOOM; tryZoom -= 1) {
    const candidate = route.map((point) => project(point.lat, point.lng, tryZoom));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pixel of candidate) {
      if (pixel.x < minX) minX = pixel.x;
      if (pixel.x > maxX) maxX = pixel.x;
      if (pixel.y < minY) minY = pixel.y;
      if (pixel.y > maxY) maxY = pixel.y;
    }
    if (maxX - minX <= width - 2 * PADDING && maxY - minY <= height - 2 * PADDING) {
      zoom = tryZoom;
      points = candidate;
      break;
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pixel of points) {
    if (pixel.x < minX) minX = pixel.x;
    if (pixel.x > maxX) maxX = pixel.x;
    if (pixel.y < minY) minY = pixel.y;
    if (pixel.y > maxY) maxY = pixel.y;
  }
  const topLeftX = (minX + maxX) / 2 - width / 2;
  const topLeftY = (minY + maxY) / 2 - height / 2;

  const pixels = points.map((pixel) => ({
    x: pixel.x - topLeftX,
    y: pixel.y - topLeftY,
  }));

  const tiles: MapLayout['tiles'] = [];
  const tileCount = 2 ** zoom;
  const firstTx = Math.floor(topLeftX / TILE);
  const lastTx = Math.floor((topLeftX + width) / TILE);
  const firstTy = Math.floor(topLeftY / TILE);
  const lastTy = Math.floor((topLeftY + height) / TILE);
  for (let tx = firstTx; tx <= lastTx; tx += 1) {
    for (let ty = firstTy; ty <= lastTy; ty += 1) {
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
      const wrappedY = Math.max(0, Math.min(tileCount - 1, ty));
      tiles.push({
        key: `${zoom}-${tx}-${ty}`,
        uri: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${wrappedY}.png`,
        left: tx * TILE - topLeftX,
        top: ty * TILE - topLeftY,
      });
    }
  }

  const segments: MapLayout['segments'] = [];
  for (let index = 1; index < pixels.length; index += 1) {
    const a = pixels[index - 1];
    const b = pixels[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) continue;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push({
      key: `seg-${index}`,
      left: (a.x + b.x) / 2 - length / 2,
      top: (a.y + b.y) / 2 - 1.5,
      width: length,
      angle,
    });
  }

  return { topLeftX, topLeftY, zoom, pixels, tiles, segments };
}

/**
 * خريطة مفتوحة (OpenStreetMap) تعرض المسار كخط أحمر على الطريق الذي مررت به،
 * مع علامة خضراء لنقطة البداية وعلامة حمراء لنقطة النهاية.
 */
export function RouteMap({ route, height = 260 }: { route: GeoPoint[]; height?: number }) {
  const [size, setSize] = useState({ width: 0, height });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height: layoutHeight } = event.nativeEvent.layout;
    setSize({ width, height: layoutHeight });
  }

  const layout = useMemo(
    () => buildLayout(route, size.width, size.height),
    [route, size.width, size.height]
  );

  const start = layout?.pixels[0];
  const end = layout && layout.pixels.length > 1 ? layout.pixels[layout.pixels.length - 1] : null;

  return (
    <View onLayout={onLayout} style={[styles.map, { height }]}>
      {layout ? (
        <>
          {layout.tiles.map((tile) => (
            <Image key={tile.key} source={{ uri: tile.uri }} style={[styles.tile, { left: tile.left, top: tile.top }]} />
          ))}
          {layout.segments.map((segment) => (
            <View
              key={segment.key}
              style={[
                styles.routeLine,
                { left: segment.left, top: segment.top, width: segment.width },
                { transform: [{ rotate: `${segment.angle}deg` }] },
              ]}
            />
          ))}
          {start ? <View style={[styles.startDot, { left: start.x - 7, top: start.y - 7 }]} /> : null}
          {end ? <View style={[styles.endDot, { left: end.x - 7, top: end.y - 7 }]} /> : null}
        </>
      ) : (
        <Text style={styles.empty}>لا يوجد مسار بعد — ابدأ الرياضة ليظهر الطريق على الخريطة.</Text>
      )}
      <Text style={styles.attribution}>© مساهمو OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#DDE7E1',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tile: {
    position: 'absolute',
    width: TILE,
    height: TILE,
  },
  routeLine: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E11D1D',
  },
  startDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  endDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7F1D1D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  empty: {
    textAlign: 'center',
    color: palette.muted,
    paddingHorizontal: 16,
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    fontSize: 10,
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
