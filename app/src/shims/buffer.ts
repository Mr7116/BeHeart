// Minimal Buffer stand-in for react-native-svg's remote-file helper (unused by this app).
export const Buffer = {
  from(input: string, encoding?: string): { toString(enc?: string): string } {
    const text = encoding === 'base64' ? atob(input) : input;
    return { toString: (enc?: string) => (enc === 'base64' ? btoa(text) : text) };
  },
};
