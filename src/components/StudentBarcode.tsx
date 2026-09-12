import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface StudentBarcodeProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  lineColor?: string;
}

export const StudentBarcode: React.FC<StudentBarcodeProps> = ({
  value,
  width = 1.5,
  height = 40,
  fontSize = 11,
  displayValue = true,
  className = '',
  lineColor = '#000000',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue,
          fontSize,
          margin: 4,
          font: 'monospace',
          lineColor,
          valid: () => true,
        });
      } catch (err) {
        console.error('Error generating barcode for value:', value, err);
      }
    }
  }, [value, width, height, fontSize, displayValue, lineColor]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto" />
    </div>
  );
};
