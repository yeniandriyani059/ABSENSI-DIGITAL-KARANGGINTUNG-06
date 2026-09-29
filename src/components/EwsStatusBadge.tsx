import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  BellRing,
  FileWarning,
  MessageCircle,
  Printer,
} from 'lucide-react';
import { StudentEwsIndicator } from '../types';
import { formatPhoneForWaLink } from '../utils/ewsAndWaService';

interface EwsStatusBadgeProps {
  indicator?: StudentEwsIndicator;
  compact?: boolean;
  onPrintBkLetter?: (indicator: StudentEwsIndicator) => void;
  onSendWaWarning?: (indicator: StudentEwsIndicator) => void;
}

export const EwsStatusBadge: React.FC<EwsStatusBadgeProps> = ({
  indicator,
  compact = false,
  onPrintBkLetter,
  onSendWaWarning,
}) => {
  if (!indicator || indicator.badges.length === 0) {
    return null;
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1 mt-0.5">
      {indicator.badges.map((b) => {
        if (b.type === 'WA_CLOSED_LOOP_4') {
          return (
            <span
              key={b.type}
              title={`${b.fullTitle} — ${b.recommendation}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white shadow-2xs animate-pulse"
            >
              <AlertOctagon className="w-3 h-3 shrink-0" />
              <span>BUTUH TINDAK LANJUT</span>
            </span>
          );
        }

        if (b.type === 'ABSENT_5X_MONTH') {
          return (
            <span
              key={b.type}
              title={`${b.fullTitle}: ${b.recommendation}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300"
            >
              <FileWarning className="w-3 h-3 text-purple-700 shrink-0" />
              <span>{compact ? `${b.count}x Absen/Bln (BK)` : b.shortLabel}</span>
              {onPrintBkLetter && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrintBkLetter(indicator);
                  }}
                  className="ml-0.5 px-1 py-0.2 bg-purple-700 hover:bg-purple-800 text-white rounded text-[9px] inline-flex items-center gap-0.5 cursor-pointer"
                  title="Cetak Surat Panggilan Orang Tua / Laporan Bimbingan Konseling (BK)"
                >
                  <Printer className="w-2.5 h-2.5" />
                  <span>Surat BK</span>
                </button>
              )}
            </span>
          );
        }

        if (b.type === 'ABSENT_3X_WEEK') {
          const waText = encodeURIComponent(
            `Yth. Orang Tua/Wali Ananda ${indicator.studentName} (Kelas ${indicator.classGrade}), sistem Early Warning System (EWS) mencatat Ananda telah tidak hadir ${b.count}x dalam 1 minggu terakhir. Mohon konfirmasi kepada Wali Kelas.`
          );
          const waUrl = `https://wa.me/${formatPhoneForWaLink(indicator.parentPhone)}?text=${waText}`;

          return (
            <span
              key={b.type}
              title={`${b.fullTitle}: ${b.recommendation}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
            >
              <AlertOctagon className="w-3 h-3 text-rose-600 shrink-0" />
              <span>{compact ? `${b.count}x Absen/Mgg` : b.shortLabel}</span>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSendWaWarning) onSendWaWarning(indicator);
                }}
                className="ml-0.5 px-1 py-0.2 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] inline-flex items-center gap-0.5"
                title="Hubungi Orang Tua via WhatsApp"
              >
                <MessageCircle className="w-2.5 h-2.5" />
                <span>WA</span>
              </a>
            </span>
          );
        }

        if (b.type === 'ALPA_2X_CONSECUTIVE') {
          return (
            <span
              key={b.type}
              title={`${b.fullTitle}: ${b.recommendation}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{compact ? `${b.count}x Alpa Beruntun` : b.shortLabel}</span>
            </span>
          );
        }

        // ALPA_1X
        const waAlpaText = encodeURIComponent(
          `Yth. Orang Tua/Wali Ananda ${indicator.studentName} (Kelas ${indicator.classGrade}), kami informasikan bahwa Ananda tercatat ${b.count}x Alpa (Tanpa Keterangan). Mohon konfirmasi dan pemantauan kehadiran Ananda.`
        );
        const waAlpaUrl = `https://wa.me/${formatPhoneForWaLink(indicator.parentPhone)}?text=${waAlpaText}`;

        return (
          <span
            key={b.type}
            title={`${b.fullTitle}: ${b.recommendation}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200"
          >
            <BellRing className="w-3 h-3 text-orange-600 shrink-0" />
            <span>{compact ? `${b.count}x Alpa` : b.shortLabel}</span>
            <a
              href={waAlpaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (onSendWaWarning) onSendWaWarning(indicator);
              }}
              className="ml-0.5 px-1 py-0.2 bg-orange-600 hover:bg-orange-700 text-white rounded text-[9px] inline-flex items-center gap-0.5"
              title="Kirim Notifikasi Peringatan 1x Alpa ke WA Orang Tua"
            >
              <MessageCircle className="w-2.5 h-2.5" />
              <span>WA</span>
            </a>
          </span>
        );
      })}
    </div>
  );
};
