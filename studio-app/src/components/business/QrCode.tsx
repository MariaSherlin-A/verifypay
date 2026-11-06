import { useQuery } from '@tanstack/react-query';
import { toDataURL } from 'qrcode';

/** QR code of `value`, drawn in the browser (nothing about the link is sent anywhere). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const qr = useQuery({
    queryKey: ['qr', value],
    queryFn: () => toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: 224 }),
    staleTime: Infinity,
    retry: false,
  });

  if (qr.isError) {
    return <p className="text-sm text-[var(--danger)]">Could not draw the QR code: {qr.error.message}. Use the link or the code instead.</p>;
  }
  if (!qr.data) return <div className="h-56 w-56 animate-pulse rounded-xl bg-[var(--surface-muted)]" aria-label="Drawing the QR code" />;
  return <img src={qr.data} alt={label} width={224} height={224} className="h-56 w-56 rounded-xl bg-white" />;
}
