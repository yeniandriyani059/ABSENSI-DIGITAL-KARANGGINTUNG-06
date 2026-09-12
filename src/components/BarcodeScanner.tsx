import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles,
  Search,
  Upload,
  Clock,
  UserCheck,
  RefreshCw,
  Zap,
  Trash2,
  CalendarX,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Student, AttendanceRecord, AttendanceStatus, Holiday, SchoolProfile } from '../types';
import { playSuccessBeep, playWarningBeep } from '../utils/audio';
import { StudentQRCode } from './StudentQRCode';
import { exportElementToPdf } from '../utils/pdfExport';

interface BarcodeScannerProps {
  students: Student[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  school: SchoolProfile;
  onRecordAttendance: (record: AttendanceRecord) => void;
  onDeleteRecord?: (id: string, studentId?: string, date?: string) => void;
  initialScanValue?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  students,
  records,
  holidays,
  school,
  onRecordAttendance,
  onDeleteRecord,
  initialScanValue = '',
}) => {
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const [scanDate, setScanDate] = useState<string>(getTodayStr());
  const [scanMode, setScanMode] = useState<'datang' | 'pulang'>('datang');
  const [targetStatus, setTargetStatus] = useState<AttendanceStatus>('H');
  const [notes, setNotes] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [manualInput, setManualInput] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Deletion modal state
  const [recordToDelete, setRecordToDelete] = useState<{
    id: string;
    studentName: string;
    studentId: string;
    date: string;
  } | null>(null);

  // Last scanned student result feedback
  const [lastScannedStudent, setLastScannedStudent] = useState<{
    student: Student;
    status: AttendanceStatus;
    timestamp: string;
    isDuplicate: boolean;
  } | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-interactive-reader';
  const isProcessingRef = useRef<boolean>(false);

  // Today's records
  const todayRecords = records.filter((r) => r.date === scanDate);

  // Check if scanDate is weekend or holiday (SD Negeri Karanggintung 06 menerapkan 5 hari sekolah: Senin-Jumat, Sabtu & Minggu libur)
  const holidayInfo = useMemo(() => {
    // 1. Check listed holidays
    const listed = holidays.find((h) => h.date === scanDate);
    if (listed) {
      return {
        isHoliday: true,
        reason: listed.reason || 'Hari Libur Nasional / Khusus',
        type: 'holiday',
      };
    }

    // 2. Check 5-day school week (Saturday: 6, Sunday: 0)
    const parts = scanDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0) {
        return {
          isHoliday: true,
          reason: 'Hari Minggu (Libur Akhir Pekan)',
          type: 'weekend',
        };
      }
      if (dayOfWeek === 6) {
        return {
          isHoliday: true,
          reason: 'Hari Sabtu (Libur 5 Hari Sekolah)',
          type: 'weekend',
        };
      }
    }

    return {
      isHoliday: false,
      reason: '',
      type: 'workday',
    };
  }, [scanDate, holidays]);

  // Process a scanned or typed barcode (NISN)
  const processBarcodeValue = useCallback(
    (scannedText: string) => {
      const cleanValue = scannedText.trim();
      if (!cleanValue) return;

      // Block scan if today / selected date is a holiday or weekend
      if (holidayInfo.isHoliday) {
        if (soundEnabled) playWarningBeep();
        setNotification({
          type: 'error',
          message: `HARI INI LIBUR (${holidayInfo.reason}) - Presensi dinonaktifkan!`,
        });
        return;
      }

      // Find student by QR Code, NISN, or ID
      const matchedStudent = students.find(
        (s) =>
          (s.qrCode && s.qrCode.toLowerCase() === cleanValue.toLowerCase()) ||
          s.nisn === cleanValue ||
          s.id === cleanValue ||
          s.nisn.toLowerCase() === cleanValue.toLowerCase()
      );

      const now = new Date();
      const currentHourMinute = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (!matchedStudent) {
        if (soundEnabled) playWarningBeep();
        setNotification({
          type: 'error',
          message: `Barcode/NISN "${cleanValue}" tidak terdaftar dalam basis data siswa!`,
        });
        return;
      }

      const existing = records.find(
        (r) => r.studentId === matchedStudent.id && r.date === scanDate
      );

      let finalStatus = targetStatus;

      if (scanMode === 'datang') {
        if (existing?.checkInTime) {
          if (soundEnabled) playWarningBeep();
          setNotification({
            type: 'warning',
            message: `Gagal: ${matchedStudent.name} sudah melakukan presensi datang hari ini (Ganda).`,
          });
          return;
        }

        const isLowerGrade = matchedStudent.classGrade === '1' || matchedStudent.classGrade === '2';
        const lateLimit = isLowerGrade 
          ? (school.checkInTimeLower || '07:00') 
          : (school.checkInTime || '07:00');
          
        if (currentHourMinute > lateLimit) {
          finalStatus = 'T'; // Terlambat
        }
      } else if (scanMode === 'pulang') {
        const isLowerGrade = matchedStudent.classGrade === '1' || matchedStudent.classGrade === '2';
        const outLimit = isLowerGrade 
          ? (school.checkOutTimeLower || '10:00') 
          : (school.checkOutTime || '13:00');

        if (currentHourMinute < outLimit) {
          if (soundEnabled) playWarningBeep();
          setNotification({
            type: 'error',
            message: `Terkunci: Belum waktunya pulang untuk kelas ${matchedStudent.classGrade}! Jam pulang dimulai pukul ${outLimit}.`,
          });
          return;
        }

        if (existing?.checkOutTime) {
          if (soundEnabled) playWarningBeep();
          setNotification({
            type: 'warning',
            message: `Gagal: ${matchedStudent.name} sudah melakukan presensi pulang hari ini (Ganda).`,
          });
          return;
        }
      }

      const newRecord: AttendanceRecord = {
        id: existing?.id || `att-${matchedStudent.id}-${scanDate}`,
        studentId: matchedStudent.id,
        date: scanDate,
        status: existing?.status === 'T' && scanMode === 'pulang' ? 'T' : finalStatus, // keep late status if checking out
        notes: notes.trim() ? notes.trim() : (existing?.notes || undefined),
        scannedAt: timeStr,
        checkInTime: scanMode === 'datang' ? timeStr : existing?.checkInTime,
        checkOutTime: scanMode === 'pulang' ? timeStr : existing?.checkOutTime,
      };

      onRecordAttendance(newRecord);

      if (soundEnabled) playSuccessBeep();

      setLastScannedStudent({
        student: matchedStudent,
        status: finalStatus,
        timestamp: timeStr,
        isDuplicate: false,
      });

      let successMessage = '';
      if (finalStatus === 'T' && scanMode === 'datang') {
        successMessage = 'MAAF KAMU TERLAMBAT';
      } else if (scanMode === 'datang') {
        successMessage = 'SELAMAT PRESENSI DATANG BERHASIL';
      } else {
        successMessage = 'SELAMAT PRESENSI PULANG BERHASIL';
      }

      setNotification({
        type: finalStatus === 'T' && scanMode === 'datang' ? 'warning' : 'success',
        message: successMessage,
      });

      // Clear manual input
      setManualInput('');
    },
    [students, records, scanDate, targetStatus, notes, soundEnabled, onRecordAttendance, scanMode, school, holidayInfo]
  );

  // If initialScanValue is passed, process it
  useEffect(() => {
    if (initialScanValue) {
      processBarcodeValue(initialScanValue);
    }
  }, [initialScanValue, processBarcodeValue]);

  // Stop camera immediately if date changes to a weekend/holiday
  useEffect(() => {
    if (holidayInfo.isHoliday && isScanning) {
      stopScanner();
    }
  }, [holidayInfo.isHoliday, isScanning]);

  // Start Html5Qrcode scanner
  const startScanner = async () => {
    setCameraError('');
    if (holidayInfo.isHoliday) {
      if (soundEnabled) playWarningBeep();
      setNotification({
        type: 'error',
        message: `HARI INI LIBUR (${holidayInfo.reason}) - Pemindaian barcode tidak dapat dibuka!`,
      });
      return;
    }
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      };

      await scannerRef.current.start(
        { facingMode },
        config,
        (decodedText) => {
          // Debounce rapid continuous frame detections
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;
          processBarcodeValue(decodedText);
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 1800); // 1.8 seconds cool-down before scanning next card
        },
        () => {
          // Frame read non-critical error (normal when barcode not in frame)
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Failed to start camera scanner:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCameraError(
        `Kamera tidak dapat diakses (${errMsg}). Pastikan izin kamera telah diberikan di peramban (browser), atau gunakan mode scan file / barcode gun.`
      );
      setIsScanning(false);
    }
  };

  // Stop scanner
  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  // Switch camera between front and back
  const handleToggleCamera = async () => {
    await stopScanner();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Scan from uploaded image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (holidayInfo.isHoliday) {
      if (soundEnabled) playWarningBeep();
      setNotification({
        type: 'error',
        message: `HARI INI LIBUR (${holidayInfo.reason}) - Presensi tidak dapat diproses!`,
      });
      e.target.value = '';
      return;
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }
      const result = await scannerRef.current.scanFile(file, true);
      processBarcodeValue(result);
    } catch (err) {
      if (soundEnabled) playWarningBeep();
      setNotification({
        type: 'error',
        message: 'Tidak ditemukan barcode atau QR Code yang jelas pada gambar tersebut.',
      });
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle Hardware USB/Bluetooth Barcode Scanner (Buffer key presses until Enter)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting when user is typing in notes input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.id !== 'manual-barcode-input') {
        return;
      }

      const currentTime = Date.now();
      // Hardware scanners type very rapidly (typically < 35ms between keystrokes)
      if (currentTime - lastKeyTime > 150) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          processBarcodeValue(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [processBarcodeValue]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning]);

  // Check if today is a holiday
  const activeHoliday = holidays.find((h) => h.date === scanDate);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <QrCode className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Pemindai Barcode Presensi (Barcode Scanner)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Arahkan barcode ID Card siswa ke kamera atau gunakan pemindai barcode USB/Bluetooth untuk perekaman kehadiran otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
              title={soundEnabled ? 'Suara beep aktif' : 'Suara beep nonaktif'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Suara Beep: Nyala' : 'Suara: Bisu'}</span>
            </button>
          </div>
        </div>

        {/* Scan settings: Date & Attendance Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tanggal Presensi
            </label>
            <input
              type="date"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tipe Presensi
            </label>
            <select
              value={scanMode}
              onChange={(e) => setScanMode(e.target.value as 'datang' | 'pulang')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
            >
              <option value="datang">Presensi Datang</option>
              <option value="pulang">Presensi Pulang</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Status Perekaman
            </label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as AttendanceStatus)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              disabled={scanMode === 'pulang'}
            >
              <option value="H">Hadir (H) - Terjadwal</option>
              <option value="S">Sakit (S) - Surat Sakit</option>
              <option value="I">Izin (I) - Izin Tertulis</option>
              <option value="A">Alpa (A) - Tanpa Keterangan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Keterangan opsional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Holiday notice if any (5-day school week weekend or official holiday) */}
      {holidayInfo.isHoliday && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start sm:items-center gap-3.5 text-rose-900 shadow-sm animate-in fade-in duration-300">
          <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CalendarX className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-black text-rose-700 uppercase tracking-wide">
                HARI INI LIBUR
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-800">
                {holidayInfo.reason}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-rose-200 text-rose-700">
                SD Negeri Karanggintung 06 (5 Hari Sekolah)
              </span>
            </div>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              SD Negeri Karanggintung 06 menerapkan sistem <strong>5 hari sekolah</strong> (Senin s.d. Jumat, dengan hari Sabtu dan Minggu libur). Pemindaian barcode presensi otomatis dinonaktifkan pada hari libur.
            </p>
          </div>
        </div>
      )}

      {/* Main Scanner Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder & Hardware Scanner Input */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                Pemindai Kamera Langsung
              </h3>

              {/* Camera Controls */}
              <div className="flex items-center gap-2">
                {isScanning && (
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="p-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Ganti Kamera Depan / Belakang"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}

                {!isScanning ? (
                  <button
                    type="button"
                    onClick={startScanner}
                    disabled={holidayInfo.isHoliday}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                      holidayInfo.isHoliday
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        : 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    }`}
                    title={holidayInfo.isHoliday ? `Hari Ini Libur (${holidayInfo.reason}) - Pemindaian dinonaktifkan` : 'Buka Kamera'}
                  >
                    {holidayInfo.isHoliday ? <CalendarX className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                    {holidayInfo.isHoliday ? 'Hari Ini Libur' : 'Buka Kamera'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopScanner}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    Tutup Kamera
                  </button>
                )}
              </div>
            </div>

            {cameraError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Html5Qrcode interactive reader container */}
            <div 
              className={`relative rounded-xl overflow-hidden bg-slate-900 aspect-square max-w-sm mx-auto flex items-center justify-center border-4 transition-colors duration-300 ${
                holidayInfo.isHoliday
                  ? 'border-rose-600/70 shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                  : notification?.type === 'success' 
                    ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
                    : notification?.type === 'warning'
                      ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                      : notification?.type === 'error'
                        ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                        : 'border-slate-800'
              }`}
            >
              <div id={scannerContainerId} className="w-full h-full [&>video]:object-cover" />

              {/* Floating instant popup overlay on camera */}
              {notification && (
                <div
                  className={`absolute top-3 inset-x-3 z-30 py-2 px-3 rounded-xl shadow-lg border flex items-center justify-center gap-2 text-center text-xs font-bold transition-all animate-in fade-in zoom-in-95 ${
                    notification.type === 'success'
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : notification.type === 'warning'
                      ? 'bg-amber-500 text-white border-amber-300'
                      : 'bg-rose-600 text-white border-rose-400'
                  }`}
                >
                  {notification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{notification.message}</span>
                </div>
              )}

              {/* Holiday Overlay when today / selected date is holiday or weekend */}
              {holidayInfo.isHoliday ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-white z-20">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 mb-3 shadow-inner">
                    <CalendarX className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-black text-rose-400 tracking-wider">
                    HARI INI LIBUR
                  </h4>
                  <p className="text-xs font-bold text-rose-200 mt-1">
                    {holidayInfo.reason}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed">
                    SD Negeri Karanggintung 06 menerapkan 5 hari sekolah (Senin - Jumat). Presensi barcode tidak dapat dilakukan pada hari libur.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] font-semibold rounded-full">
                    <span>Pemindaian Barcode Dinonaktifkan</span>
                  </div>
                </div>
              ) : !isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-950/80">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Kamera Pemindai Siap Digunakan</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Klik tombol <strong>&quot;Buka Kamera&quot;</strong> di atas untuk memindai kartu secara langsung, atau gunakan pemindai USB barcode gun.
                  </p>
                  <button
                    type="button"
                    onClick={startScanner}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    Mulai Pindai Kamera
                  </button>
                </div>
              )}

              {isScanning && (
                <div className="absolute top-2 right-2 pointer-events-none">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
              )}
            </div>

            {/* Additional Scan Input Options */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Scan from file */}
              <label className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg text-xs font-medium transition-colors ${
                holidayInfo.isHoliday
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
              }`}>
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>{holidayInfo.isHoliday ? 'Pindai File (Terkunci)' : 'Pindai dari Foto/File Gambar'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={holidayInfo.isHoliday}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Hardware scanner indicator */}
              <div className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg text-xs font-medium ${
                holidayInfo.isHoliday
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {holidayInfo.isHoliday ? (
                  <>
                    <CalendarX className="w-4 h-4 text-rose-600" />
                    <span>Barcode Gun Terkunci (Hari Libur)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Barcode Gun USB Otomatis Aktif</span>
                  </>
                )}
              </div>
            </div>

            {/* Manual NISN Input Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processBarcodeValue(manualInput);
              }}
              className="pt-2 border-t border-slate-100 flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  id="manual-barcode-input"
                  type="text"
                  placeholder={
                    holidayInfo.isHoliday
                      ? 'Hari Ini Libur (Presensi Dinonaktifkan)'
                      : 'Ketik atau scan 10 digit NISN...'
                  }
                  disabled={holidayInfo.isHoliday}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
              <button
                type="submit"
                disabled={holidayInfo.isHoliday}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Kirim
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scan Result Card & Feedback */}
        <div className="lg:col-span-5 space-y-4">
          {/* Notification banner */}
          {notification && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs animate-fade-in ${
                notification.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : notification.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <div className="font-bold text-sm mb-0.5">
                  {notification.type === 'success' ? 'Presensi Berhasil' : 'Pemberitahuan'}
                </div>
                {notification.message}
              </div>
            </div>
          )}

          {/* Last Scanned Student Badge */}
          {lastScannedStudent ? (
            <div className="bg-white p-5 rounded-xl border-2 border-emerald-500 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Hasil Pindaian Terakhir
                </span>
                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {lastScannedStudent.timestamp} WIB
                </span>
              </div>

              <div className="flex gap-4 items-center">
                <div
                  className={`w-14 h-16 rounded-xl flex flex-col items-center justify-center font-bold text-base shrink-0 border ${
                    lastScannedStudent.student.gender === 'L'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-pink-50 text-pink-700 border-pink-200'
                  }`}
                >
                  <span>
                    {lastScannedStudent.student.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="text-[8px] font-normal uppercase mt-0.5">
                    {lastScannedStudent.student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-base leading-tight truncate">
                    {lastScannedStudent.student.name}
                  </h4>
                  <p className="text-xs font-mono text-emerald-800 font-semibold mt-0.5">
                    NISN: {lastScannedStudent.student.nisn}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Rombel: <strong>Kelas {lastScannedStudent.student.classGrade}</strong>
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Status Kehadiran:</span>
                <span
                  className={`px-2.5 py-1 rounded-full font-bold uppercase ${
                    lastScannedStudent.status === 'H'
                      ? 'bg-emerald-100 text-emerald-800'
                      : lastScannedStudent.status === 'T'
                      ? 'bg-orange-100 text-orange-800'
                      : lastScannedStudent.status === 'S'
                      ? 'bg-amber-100 text-amber-800'
                      : lastScannedStudent.status === 'I'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {lastScannedStudent.status === 'H'
                    ? 'Hadir (Masuk)'
                    : lastScannedStudent.status === 'T'
                    ? 'Terlambat'
                    : lastScannedStudent.status === 'S'
                    ? 'Sakit'
                    : lastScannedStudent.status === 'I'
                    ? 'Izin'
                    : 'Alpa'}
                </span>
              </div>

              {/* QR Code representation */}
              <div className="pt-2 border-t border-slate-100 flex flex-col items-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                  <StudentQRCode
                    value={lastScannedStudent.student.qrCode || lastScannedStudent.student.nisn}
                    size={72}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">
                  QR: {lastScannedStudent.student.qrCode || lastScannedStudent.student.nisn}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Menunggu Pindaian QR / Barcode</p>
              <p className="text-xs text-slate-400">
                Arahkan QR Code atau Barcode pada kartu siswa ke kamera, atau gunakan barcode scanner gun.
              </p>
            </div>
          )}

          {/* Quick Stats Today */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Statistik Scan Hari Ini ({scanDate})
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="text-lg font-bold text-emerald-700">
                  {todayRecords.filter((r) => r.status === 'H' || r.status === 'T').length}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">
                  Hadir
                  {todayRecords.filter((r) => r.status === 'T').length > 0 && (
                    <span className="block text-[9px] text-orange-600 font-medium">
                      ({todayRecords.filter((r) => r.status === 'T').length} Terlambat)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                <div className="text-lg font-bold text-amber-700">
                  {todayRecords.filter((r) => r.status === 'S').length}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold">Sakit</div>
              </div>
              <div className="p-2 bg-sky-50 rounded-lg border border-sky-100">
                <div className="text-lg font-bold text-sky-700">
                  {todayRecords.filter((r) => r.status === 'I').length}
                </div>
                <div className="text-[10px] text-sky-600 font-semibold">Izin</div>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                <div className="text-lg font-bold text-rose-700">
                  {todayRecords.filter((r) => r.status === 'A').length}
                </div>
                <div className="text-[10px] text-rose-600 font-semibold">Alpa</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log of Today's Scans */}
      <div id="today-scan-log-container" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Log Riwayat Presensi Masuk ({todayRecords.length} Siswa Tercatat)
            </h3>
            <p className="text-xs text-slate-500">
              Daftar siswa yang telah melakukan presensi pada tanggal {scanDate}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={todayRecords.length === 0}
              onClick={async () => {
                try {
                  await exportElementToPdf('today-scan-log-container', `Log_Presensi_${scanDate}.pdf`, {
                    orientation: 'portrait',
                    format: 'a4',
                  });
                } catch (e) {
                  alert('Gagal mengunduh PDF log presensi.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Unduh log presensi hari ini sebagai berkas PDF"
            >
              <Upload className="w-3.5 h-3.5 rotate-180 text-emerald-600" />
              <span>Unduh PDF Log</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="p-3 text-center w-12">No</th>
                <th className="p-3 w-28 text-center">Waktu Scan</th>
                <th className="p-3 text-center w-28">NISN</th>
                <th className="p-3">Nama Siswa</th>
                <th className="p-3 text-center w-20">Kelas</th>
                <th className="p-3 text-center w-24">Status</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center w-12">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Belum ada presensi yang di-scan untuk tanggal ini.
                  </td>
                </tr>
              ) : (
                todayRecords.map((r, idx) => {
                  const student = students.find((s) => s.id === r.studentId);
                  if (!student) return null;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-3 text-center font-mono text-slate-600 font-medium">
                        {r.scannedAt || '--:--'}
                      </td>
                      <td className="p-3 text-center font-mono font-medium text-slate-700">
                        {student.nisn}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{student.name}</td>
                      <td className="p-3 text-center font-medium text-slate-600">
                        Kelas {student.classGrade}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            r.status === 'H'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'T'
                              ? 'bg-orange-100 text-orange-800'
                              : r.status === 'S'
                              ? 'bg-amber-100 text-amber-800'
                              : r.status === 'I'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status === 'H'
                            ? 'Hadir'
                            : r.status === 'T'
                            ? 'Terlambat'
                            : r.status === 'S'
                            ? 'Sakit'
                            : r.status === 'I'
                            ? 'Izin'
                            : 'Alpa'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 italic">{r.notes || '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          id={`delete-record-${r.id}`}
                          onClick={() => {
                            setRecordToDelete({
                              id: r.id,
                              studentName: student.name,
                              studentId: student.id,
                              date: r.date,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                          title={`Hapus presensi untuk ${student.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Confirmation Modal for Deleting Attendance */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-slate-900 text-base">Hapus Riwayat Presensi?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan presensi{' '}
                <strong className="text-slate-800 font-semibold">{recordToDelete.studentName}</strong> untuk tanggal{' '}
                <strong className="text-slate-800 font-semibold">{recordToDelete.date}</strong>?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteRecord) {
                    onDeleteRecord(recordToDelete.id, recordToDelete.studentId, recordToDelete.date);
                  }
                  if (lastScannedStudent?.student.id === recordToDelete.studentId) {
                    setLastScannedStudent(null);
                  }
                  setNotification({
                    type: 'success',
                    message: `Presensi ${recordToDelete.studentName} berhasil dihapus.`,
                  });
                  setRecordToDelete(null);
                }}
                className="flex-1 py-2.5 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
