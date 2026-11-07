// Desktop: no camera scanning (barcodes are typed or come from a USB scanner).
// The iPhone build uses BarcodeScanner.native.tsx instead.

export const CAMERA_SCAN_AVAILABLE = false;

export function BarcodeScanner(_props: { onScanned: (code: string) => void; onClose: () => void }) {
  return null;
}
