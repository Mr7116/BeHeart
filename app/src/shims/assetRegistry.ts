// The app draws charts with react-native-svg but never loads bundled image assets,
// so the asset registry used by its <Image> element is a no-op on desktop.
export function getAssetByID(_id: number): undefined {
  return undefined;
}
export function registerAsset(_asset: unknown): number {
  return 0;
}
