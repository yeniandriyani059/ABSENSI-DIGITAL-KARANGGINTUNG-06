import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface StudentQRCodeProps {
  value: string;
  size?: number;
  className?: string;
  includeMargin?: boolean;
  margin?: number;
}

export const StudentQRCode: React.FC<StudentQRCodeProps> = ({
  value,
  size = 128,
  className = '',
  includeMargin = false,
  margin,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!value) {
      setDataUrl('');
      return;
    }

    const calculatedMargin = margin !== undefined ? margin : (includeMargin ? 1 : 0);

    let isMounted = true;
    // Gunakan resolusi 2x (minimal 200px) agar sangat tajam dan mudah dipindai scanner/kamera jarak jauh
    const renderWidth = Math.max(size * 2, 200);

    QRCode.toDataURL(value, {
      width: renderWidth,
      margin: calculatedMargin,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating QR code for', value, err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, includeMargin, margin]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400 ${className}`}
      >
        ...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR Code: ${value}`}
      width={size}
      height={size}
      className={`block object-contain ${className}`}
      loading="lazy"
    />
  );
};

