// iPhone: scan EAN/UPC barcodes with the camera (barcode detection only, no image recognition).
import React, { useRef } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Body, Button } from './ui';
import { C } from './theme';

export const CAMERA_SCAN_AVAILABLE = true;

export function BarcodeScanner({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={{ padding: 14, borderRadius: 12, backgroundColor: C.cardAlt, gap: 10 }}>
        <Body>BeHeart needs the camera to read product barcodes.</Body>
        <Button title="Allow camera" onPress={requestPermission} />
        <Button title="Cancel" kind="ghost" onPress={onClose} />
      </View>
    );
  }
  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
      <CameraView
        style={{ width: '100%', height: 260 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return;
          done.current = true;
          onScanned(data);
        }}
      />
      <View style={{ position: 'absolute', left: 30, right: 30, top: 110, height: 40, borderWidth: 2, borderColor: C.accent, borderRadius: 8 }} />
      <View style={{ padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: C.sub, fontSize: 13 }}>Point at the barcode</Text>
        <Button title="Close" small kind="ghost" onPress={onClose} />
      </View>
    </View>
  );
}
