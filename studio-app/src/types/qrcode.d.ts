// Minimal typing for the `qrcode` package (v1.5, already installed as a dependency of ConnectKit; no @types package is installed).
declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
}
