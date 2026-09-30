import React, { useState, useMemo } from 'react';
import {
  BellRing,
  AlertOctagon,
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  Send,
  ChevronDown,
  ChevronUp,
  Printer,
  FileWarning,
  X,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import {
  Student,
  AttendanceRecord,
  Holiday,
  SchoolProfile,
  WaLog,
  EwsAlert,
  StudentEwsIndicator,
} from '../types';
import {
  formatPhoneForWaLink,
  getStudentParentPhone,
  buildClosedLoop0715Message,
  buildClickToChatWaUrl,
} from '../utils/ewsAndWaService';

interface TeacherAlertCenterProps {
  students: Student[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  school: SchoolProfile;
  selectedClass: string;
  waLogs: WaLog[];
  ewsAlerts: EwsAlert[];
  ewsIndicatorsMap: Map<string, StudentEwsIndicator>;
  onTriggerCron0715: () => Promise<void>;
  onIncomingWaReply: (student: Student, replyText: string) => Promise<void>;
  onMarkLatePresent: (studentNisn: string, alertId?: string) => void;
  onResolveEwsAlert: (alertId: string) => void;
  onSendEwsWaNotification: (indicator: StudentEwsIndicator, reasonText: string) => void;
  onOpenManualWaChat?: (student: Student) => void;
  bkLetterTarget: StudentEwsIndicator | null;
  onSelectBkLetterTarget: (indicator: StudentEwsIndicator | null) => void;
}

export const TeacherAlertCenter: React.FC<TeacherAlertCenterProps> = ({
  students,
  records,
  school,
  selectedClass,
  waLogs,
  ewsAlerts,
  ewsIndicatorsMap,
  onTriggerCron0715,
  onIncomingWaReply,
  onMarkLatePresent,
  onResolveEwsAlert,
  onSendEwsWaNotification,
  onOpenManualWaChat,
  bkLetterTarget,
  onSelectBkLetterTarget,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'students' | 'walogs'>('students');
  const [isRunningCron, setIsRunningCron] = useState<boolean>(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, []);

  // 1. Filter Red Alerts ("WA_CLOSED_LOOP_4" / "BUTUH TINDAK LANJUT") yang masih aktif
  const activeClosedLoopRedAlerts = useMemo(() => {
    return ewsAlerts.filter(
      (a) => a.alert_type === 'WA_CLOSED_LOOP_4' && a.status_action === 'BUTUH TINDAK LANJUT'
    );
  }, [ewsAlerts]);

  // 2. Kumpulkan indikator EWS seluruh siswa yang memicu alert
  const allIndicators = useMemo(() => {
    const list: StudentEwsIndicator[] = [];
    const seen = new Set<string>();
    students.forEach((s) => {
      const ind = ewsIndicatorsMap.get(s.nisn);
      if (ind && ind.badges.length > 0 && !seen.has(s.nisn)) {
        seen.add(s.nisn);
        list.push(ind);
      }
    });
    return list;
  }, [students, ewsIndicatorsMap]);

  const yellowConsecutiveCount = useMemo(
    () => allIndicators.filter((i) => i.consecutiveAlpa >= 2).length,
    [allIndicators]
  );
  const redWeeklyCount = useMemo(
    () => allIndicators.filter((i) => i.absentCountWeek >= 3).length,
    [allIndicators]
  );
  const criticalBkMonthlyCount = useMemo(
    () => allIndicators.filter((i) => i.absentCountMonth >= 5).length,
    [allIndicators]
  );
  const info1xAlpaCount = useMemo(
    () => allIndicators.filter((i) => i.alpaCountMonth >= 1 && i.consecutiveAlpa < 2).length,
    [allIndicators]
  );

  // Daftar siswa yang perlu dikirimkan WA atau ditindaklanjuti:
  // Prioritaskan siswa yang terdeteksi EWS atau belum tercatat hadir hari ini di kelas terpilih
  const actionableStudents = useMemo(() => {
    const classList = students.filter((s) => s.classGrade === selectedClass);
    return [...classList].sort((a, b) => {
      const indA = ewsIndicatorsMap.get(a.nisn);
      const indB = ewsIndicatorsMap.get(b.nisn);
      const hasEwsA = indA && indA.badges.length > 0 ? 1 : 0;
      const hasEwsB = indB && indB.badges.length > 0 ? 1 : 0;
      if (hasEwsA !== hasEwsB) return hasEwsB - hasEwsA;

      const recA = records.find((r) => r.studentId === a.nisn && r.date === todayStr);
      const recB = records.find((r) => r.studentId === b.nisn && r.date === todayStr);
      const unrecA = !recA ? 1 : 0;
      const unrecB = !recB ? 1 : 0;
      if (unrecA !== unrecB) return unrecB - unrecA;

      return a.name.localeCompare(b.name);
    });
  }, [students, selectedClass, ewsIndicatorsMap, records, todayStr]);

  const handleRunCron = async () => {
    setIsRunningCron(true);
    try {
      await onTriggerCron0715();
      setViewMode('walogs');
      setIsExpanded(true);
    } finally {
      setIsRunningCron(false);
    }
  };

  const handlePrintBkLetter = () => {
    window.print();
  };

  // Helper merender 5 Tombol Aksi Cepat Dua Arah (Manual Input):
  // [Hadir], [Sakit], [Izin], [Terlambat], [Sudah Berangkat]
  const renderQuickTwoWayButtons = (
    targetStudent: Student | undefined,
    fallbackNisn: string,
    fallbackName?: string,
    fallbackClass?: string,
    fallbackPhone?: string
  ) => {
    const std: Student = targetStudent || {
      id: fallbackNisn,
      nisn: fallbackNisn,
      name: fallbackName || fallbackNisn,
      classGrade: fallbackClass || selectedClass,
      parentPhone: fallbackPhone,
    };

    const todayRec = records.find((r) => r.studentId === std.nisn && r.date === todayStr);
    const currentStatus = todayRec?.status;

    return (
      <div className="inline-flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onIncomingWaReply(std, 'Hadir')}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
            currentStatus === 'Hadir'
              ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white opacity-90 hover:opacity-100'
          }`}
          title="Update sipena_presensi & wa_logs menjadi Hadir, serta reset ews_alerts"
        >
          {currentStatus === 'Hadir' ? '✓ Hadir' : 'Hadir'}
        </button>
        <button
          type="button"
          onClick={() => onIncomingWaReply(std, 'Sakit')}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
            currentStatus === 'Sakit'
              ? 'bg-amber-600 text-white ring-2 ring-amber-300'
              : 'bg-amber-500 hover:bg-amber-600 text-white opacity-90 hover:opacity-100'
          }`}
          title="Update sipena_presensi & wa_logs menjadi Sakit, serta reset ews_alerts"
        >
          {currentStatus === 'Sakit' ? '✓ Sakit' : 'Sakit'}
        </button>
        <button
          type="button"
          onClick={() => onIncomingWaReply(std, 'Izin')}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
            currentStatus === 'Izin'
              ? 'bg-sky-600 text-white ring-2 ring-sky-300'
              : 'bg-sky-500 hover:bg-sky-600 text-white opacity-90 hover:opacity-100'
          }`}
          title="Update sipena_presensi & wa_logs menjadi Izin, serta reset ews_alerts"
        >
          {currentStatus === 'Izin' ? '✓ Izin' : 'Izin'}
        </button>
        <button
          type="button"
          onClick={() => onIncomingWaReply(std, 'Terlambat')}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
            currentStatus === 'Terlambat'
              ? 'bg-orange-700 text-white ring-2 ring-orange-300'
              : 'bg-orange-600 hover:bg-orange-700 text-white opacity-90 hover:opacity-100'
          }`}
          title="Update sipena_presensi & wa_logs menjadi Terlambat, serta reset ews_alerts"
        >
          {currentStatus === 'Terlambat' ? '✓ Terlambat' : 'Terlambat'}
        </button>
        <button
          type="button"
          onClick={() => onIncomingWaReply(std, 'Sudah Berangkat')}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
            currentStatus === 'Butuh Tindak Lanjut'
              ? 'bg-rose-700 text-white ring-2 ring-rose-300'
              : 'bg-rose-600 hover:bg-rose-700 text-white opacity-90 hover:opacity-100'
          }`}
          title="Orang tua menyatakan anak Sudah Berangkat namun belum tercatat -> Picu Alert Merah"
        >
          {currentStatus === 'Butuh Tindak Lanjut' ? '⚠ Sudah Berangkat' : 'Sudah Berangkat'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3 mb-4">
      {/* =====================================================================
          KARTU ALERT MERAH DARURAT (HANYA TAMPIL JIKA ADA STATUS "SUDAH BERANGKAT")
          ===================================================================== */}
      {activeClosedLoopRedAlerts.map((alert) => {
        const matchedStudent = students.find((s) => s.nisn === alert.siswa_id);
        const studentName = alert.student_name || matchedStudent?.name || alert.siswa_id;
        const classGrade = alert.class_grade || matchedStudent?.classGrade || selectedClass;
        const parentPhone =
          alert.parent_phone ||
          (matchedStudent ? getStudentParentPhone(matchedStudent) : '081234567890');
        const waFollowUpMsg = encodeURIComponent(
          `Yth. Bapak/Ibu Orang Tua/Wali dari ${studentName} (Kelas ${classGrade}), kami dari Wali Kelas ${school.schoolName} menindaklanjuti konfirmasi Bapak/Ibu bahwa Ananda sudah berangkat, namun hingga saat ini belum tercatat di kelas. Mohon informasi rute keberangkatan Ananda.`
        );
        const waUrl = `https://wa.me/${formatPhoneForWaLink(parentPhone)}?text=${waFollowUpMsg}`;

        return (
          <div
            key={alert.id}
            className="bg-rose-600 text-white rounded-xl p-3.5 shadow-sm border border-rose-400 animate-in fade-in duration-200"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="w-5 h-5 text-white shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold leading-snug">
                    PERLU TINDAK LANJUT: Orang tua {studentName} (Kelas {classGrade}) menyatakan
                    anak sudah berangkat, tetapi belum tercatat di sekolah.
                  </h3>
                  <p className="text-[11px] text-rose-100 mt-0.5">
                    NISN: <span className="font-mono font-bold">{alert.siswa_id}</span> • WA Ortu:{' '}
                    <span className="font-mono font-bold">{formatPhoneForWaLink(parentPhone)}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onMarkLatePresent(alert.siswa_id, alert.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Tandai Hadir Terlambat</span>
                </button>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  <span>Hubungi Orang Tua</span>
                </a>

                <button
                  type="button"
                  onClick={() => onResolveEwsAlert(alert.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-800 hover:bg-rose-900 text-white border border-rose-400/50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Selesai Ditindaklanjuti</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* =====================================================================
          PANEL RINGKAS: PUSAT NOTIFIKASI WA & ALERT
          ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Header Bar Ringkas: Judul Singkat, Badge EWS Kecil (hanya jika > 0), Tombol Kirim WA Cek 07.15, Tombol Tutup Panel */}
        <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Pusat Notifikasi WA &amp; Alert
            </h3>

            {/* Badge indikator EWS kecil HANYA ditampilkan jika ada siswa yang memicu alert (> 0) */}
            {activeClosedLoopRedAlerts.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white">
                {activeClosedLoopRedAlerts.length} Butuh Tindak Lanjut
              </span>
            )}
            {criticalBkMonthlyCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                <FileWarning className="w-3 h-3 text-purple-700" />
                <span>{criticalBkMonthlyCount} Panggilan BK (≥5x/Bln)</span>
              </span>
            )}
            {redWeeklyCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                <AlertOctagon className="w-3 h-3 text-rose-600" />
                <span>{redWeeklyCount} Alert Wali Kelas (≥3x/Mgg)</span>
              </span>
            )}
            {yellowConsecutiveCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{yellowConsecutiveCount} Alpa Beruntun (≥2x)</span>
              </span>
            )}
            {info1xAlpaCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                {info1xAlpaCount} Siswa 1x Alpa
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRunCron}
              disabled={isRunningCron}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              title="Cek siswa yang belum hadir hari ini dan catat pengiriman WA konfirmasi 07.15"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isRunningCron ? 'Memproses...' : 'Kirim WA Cek 07.15'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <span>{isExpanded ? 'Tutup Panel' : 'Buka Panel WA & Alert'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Langsung tampilkan tabel/daftar siswa yang perlu dikirimkan WA atau ditindaklanjuti secara ringkas tepat di bawahnya */}
        {isExpanded && (
          <div className="border-t border-slate-200">
            {/* Baris Filter Ringkas (Daftar Siswa vs Riwayat Log WA) */}
            <div className="px-3.5 py-2 bg-white border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('students')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    viewMode === 'students'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Daftar Siswa Kelas {selectedClass} ({actionableStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('walogs')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    viewMode === 'walogs'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Log WA ({waLogs.length})
                </button>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Klik <strong>Buka WA</strong> untuk kirim pesan ke Ortu, lalu klik status cepat saat dibalas.
              </span>
            </div>

            {viewMode === 'students' ? (
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2 px-3">Nama Siswa &amp; Indikator EWS</th>
                      <th className="py-2 px-3">Aksi Cepat Dua Arah (Manual Input)</th>
                      <th className="py-2 px-3 text-right">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actionableStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 text-xs">
                          Belum ada siswa di Kelas {selectedClass}.
                        </td>
                      </tr>
                    ) : (
                      actionableStudents.map((std) => {
                        const ind = ewsIndicatorsMap.get(std.nisn);
                        const waUrl = buildClickToChatWaUrl(std);
                        const formattedPhone = formatPhoneForWaLink(getStudentParentPhone(std));

                        return (
                          <tr key={std.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{std.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({formattedPhone})
                                </span>
                                {ind &&
                                  ind.badges.map((b) => (
                                    <span
                                      key={b.type}
                                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                        b.severity === 'CRITICAL'
                                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                          : b.severity === 'RED'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : b.severity === 'YELLOW'
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-orange-50 text-orange-800 border border-orange-200'
                                      }`}
                                    >
                                      {b.shortLabel}
                                    </span>
                                  ))}
                                {ind && ind.absentCountMonth >= 5 && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectBkLetterTarget(ind)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] cursor-pointer"
                                    title="Cetak Surat Panggilan Orang Tua / Laporan BK"
                                  >
                                    <Printer className="w-2.5 h-2.5" />
                                    <span>Surat BK</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              {renderQuickTwoWayButtons(
                                std,
                                std.nisn,
                                std.name,
                                std.classGrade,
                                formattedPhone
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  if (onOpenManualWaChat) {
                                    onOpenManualWaChat(std);
                                  } else if (ind) {
                                    onSendEwsWaNotification(
                                      ind,
                                      ind.badges[0]?.fullTitle || 'Konfirmasi Kehadiran 07.15'
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] whitespace-nowrap"
                                title={`Buka WhatsApp Click-to-Chat ke ${formattedPhone}`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Buka WA</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64">
                {waLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Belum ada riwayat di `wa_logs`. Klik <strong>Kirim WA Cek 07.15</strong> atau{' '}
                    <strong>Buka WA</strong> pada baris siswa.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2 px-3">Siswa &amp; No. WA</th>
                        <th className="py-2 px-3">Aksi Cepat Dua Arah (Manual Input)</th>
                        <th className="py-2 px-3">Status Balasan</th>
                        <th className="py-2 px-3 text-right">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {waLogs.slice(0, 30).map((log) => {
                        const matchedStd = students.find((s) => s.nisn === log.siswa_id);
                        const stdName = log.student_name || matchedStd?.name || log.siswa_id;
                        const stdMsg = buildClosedLoop0715Message(stdName);
                        const directWa = `https://wa.me/${formatPhoneForWaLink(
                          log.phone_number
                        )}?text=${encodeURIComponent(stdMsg)}`;

                        return (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              <div>{stdName}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatPhoneForWaLink(log.phone_number)}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              {renderQuickTwoWayButtons(
                                matchedStd,
                                log.siswa_id,
                                stdName,
                                log.class_grade,
                                log.phone_number
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.status_reply.includes('BUTUH TINDAK LANJUT')
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : log.status_reply.includes('Hadir') ||
                                      log.status_reply.includes('Sakit') ||
                                      log.status_reply.includes('Izin') ||
                                      log.status_reply.includes('Terlambat')
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {log.status_reply}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <a
                                href={directWa}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold whitespace-nowrap"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Buka WA</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL SURAT PANGGILAN ORANG TUA / LAPORAN BIMBINGAN KONSELING (BK)
          (Kriteria EWS: >= 5x Ketidakhadiran dalam 1 Bulan)
          ===================================================================== */}
      {bkLetterTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-purple-200" />
                <h3 className="text-sm font-bold">
                  Surat Panggilan Orang Tua / Laporan Bimbingan Konseling (BK)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectBkLetterTarget(null)}
                className="text-purple-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-900 text-xs leading-relaxed">
              {/* Kop Surat Resmi */}
              <div className="border-b-2 border-slate-900 pb-3 text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {school.educationAgency || school.district}
                </div>
                <div className="text-base font-extrabold uppercase text-slate-900">
                  {school.schoolName}
                </div>
                <div className="text-[11px] text-slate-600">
                  {school.address} • NPSN: {school.npsn} • {school.city}
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <div>
                  <div>Nomor: 421.2 / EWS-BK / {new Date().getFullYear()}</div>
                  <div>Lampiran: 1 Lembar Rekap Presensi</div>
                  <div>
                    Perihal:{' '}
                    <strong className="underline">
                      Panggilan Orang Tua / Wali &amp; Pembinaan Kehadiran Siswa
                    </strong>
                  </div>
                </div>
                <div className="text-right">
                  {school.city},{' '}
                  {new Date().toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p>
                  Kepada Yth.
                  <br />
                  <strong>Bapak/Ibu Orang Tua / Wali dari {bkLetterTarget.studentName}</strong>
                  <br />
                  di Tempat
                </p>

                <p>Dengan hormat,</p>
                <p>
                  Berdasarkan hasil pemantauan <strong>Early Warning System (EWS)</strong> presensi
                  harian siswa pada <strong>{school.schoolName}</strong> Tahun Ajaran{' '}
                  {school.academicYear} ({school.semester}), bersama ini kami sampaikan bahwa
                  putra/putri Bapak/Ibu:
                </p>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 font-medium">
                  <div>
                    Nama Lengkap: <strong>{bkLetterTarget.studentName}</strong>
                  </div>
                  <div>
                    NISN: <strong>{bkLetterTarget.studentId}</strong>
                  </div>
                  <div>
                    Kelas: <strong>Kelas {bkLetterTarget.classGrade}</strong>
                  </div>
                  <div>
                    Akumulasi Ketidakhadiran Bulan Ini:{' '}
                    <strong className="text-rose-700">
                      {bkLetterTarget.absentCountMonth} Hari (Alpa: {bkLetterTarget.alpaCountMonth}{' '}
                      hari)
                    </strong>
                  </div>
                </div>

                <p>
                  Telah memenuhi kriteria tindak lanjut pembinaan Bimbingan Konseling (≥ 5 kali
                  ketidakhadiran dalam 1 bulan). Sehubungan dengan hal tersebut, kami mengharapkan
                  kehadiran Bapak/Ibu Orang Tua/Wali di sekolah untuk berkoordinasi bersama Wali
                  Kelas dan Guru Pembina guna mendukung kelancaran belajar Ananda.
                </p>

                <p>
                  Demikian surat panggilan dan laporan pembinaan ini kami sampaikan. Atas perhatian
                  dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 text-center">
                <div>
                  <div>Mengetahui,</div>
                  <div className="font-bold">Kepala {school.schoolName}</div>
                  <div className="h-14" />
                  <div className="font-bold underline">{school.principalName}</div>
                  <div>NIP. {school.principalNip}</div>
                </div>
                <div>
                  <div>Wali Kelas {bkLetterTarget.classGrade},</div>
                  <div className="font-bold">Guru Kelas / Pembina BK</div>
                  <div className="h-14" />
                  <div className="font-bold underline">{school.teacherName}</div>
                  <div>NIP. {school.teacherNip}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onSelectBkLetterTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrintBkLetter}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Surat Panggilan / BK</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
