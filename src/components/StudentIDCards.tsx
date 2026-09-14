import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  IdCard,
  Printer,
  Search,
  Download,
  GraduationCap,
  Sparkles,
  QrCode,
  ShieldCheck,
  Barcode as BarcodeIcon,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Camera,
  Upload,
  FileText,
  ExternalLink,
  AlertCircle,
  X,
} from 'lucide-react';
import { Student, SchoolProfile } from '../types';
import { StudentQRCode } from './StudentQRCode';
import { StudentBarcode } from './StudentBarcode';
import { exportElementToImage, compressAndResizeImage } from '../utils/imageExport';
import { downloadStudentCardCanvas } from '../utils/idCardCanvas';
import { exportCardsPagesToPdf } from '../utils/pdfExport';

interface StudentIDCardsProps {
  students: Student[];
  school: SchoolProfile;
  selectedClass: string;
  onSelectClass: (c: string) => void;
  onOpenScannerWithNISN?: (nisn: string) => void;
  onUpdateStudent?: (student: Student) => void;
}

export const StudentIDCards: React.FC<StudentIDCardsProps> = ({
  students,
  school,
  selectedClass,
  onSelectClass,
  onOpenScannerWithNISN,
  onUpdateStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);
  const [codeType, setCodeType] = useState<'qr' | 'barcode'>('qr');
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingSingleImage, setIsExportingSingleImage] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showPrintFallbackModal, setShowPrintFallbackModal] = useState(false);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);

  const modalPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === 'all' || s.classGrade === selectedClass;
      const matchSearch =
        searchTerm === '' ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nisn.includes(searchTerm);
      return matchClass && matchSearch;
    });
  }, [students, selectedClass, searchTerm]);

  // Chunk students into pages of 8 cards each (2 columns x 4 rows per A4 sheet)
  const studentPages = useMemo(() => {
    const pages: Student[][] = [];
    for (let i = 0; i < filteredStudents.length; i += 8) {
      pages.push(filteredStudents.slice(i, i + 8));
    }
    return pages;
  }, [filteredStudents]);

  // Listen to browser print events (e.g. Ctrl + P or browser menu print)
  useEffect(() => {
    const handleBeforePrint = () => {
      document.body.classList.add('print-mode-cards');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('print-mode-cards');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-mode-cards');
    };
  }, []);

  // Handle print all cards or filtered cards (A4, 8 cards per sheet)
  const handlePrintCards = () => {
    if (filteredStudents.length === 0) return;

    // Apply print mode class to body so only #print-cards-container is shown
    document.body.classList.add('print-mode-cards');
    setPrintStatusMessage('Mempersiapkan dialog cetak lembar kartu A4...');

    const cleanup = () => {
      document.body.classList.remove('print-mode-cards');
      window.removeEventListener('afterprint', cleanup);
      setPrintStatusMessage(null);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    // Check if running inside an iframe (like AI Studio preview sandbox)
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // Brief timeout to ensure DOM painted and portal attached
    setTimeout(() => {
      try {
        window.print();

        if (inIframe) {
          // In sandboxed iframes, window.print() can be silently ignored by the browser
          setTimeout(() => {
            setPrintStatusMessage(
              'Jika dialog cetak browser tidak terbuka karena batasan pratinjau (iframe sandbox), Anda dapat menggunakan tombol "Unduh PDF (A4)" atau "Buka di Tab Baru".'
            );
          }, 800);
        }

        // Fallback cleanup if afterprint does not fire
        setTimeout(cleanup, 4000);
      } catch (err: any) {
        console.warn('window.print() error or blocked by sandbox iframe:', err);
        cleanup();
        setShowPrintFallbackModal(true);
      }
    }, 150);
  };

  // Direct multi-page A4 PDF export (100% reliable inside any browser / iframe)
  const handleExportPdf = async () => {
    if (filteredStudents.length === 0) return;
    try {
      setIsExportingPdf(true);
      const filename = `Lembar_KTS_SDN06_${
        selectedClass === 'all' ? 'Semua_Kelas' : `Kelas_${selectedClass}`
      }_A4.pdf`;
      await exportCardsPagesToPdf('print-cards-container', filename);
    } catch (err) {
      console.error('Failed to export cards to PDF:', err);
      alert('Gagal mengunduh berkas PDF lembar kartu siswa.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Opens a dedicated, self-contained printable window/tab (bypasses iframe sandbox)
  const handleOpenInNewTab = () => {
    const printEl = document.getElementById('print-cards-container');
    if (!printEl) {
      handleExportPdf();
      return;
    }

    const printContent = printEl.innerHTML;
    const printHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Cetak Lembar Kartu Tanda Siswa (KTS) - ${school.schoolName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page { size: A4 portrait; margin: 8mm 7mm; }
    body { background-color: #ffffff; color: #000000; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-card-sheet { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; margin-bottom: 24px; }
    .print-card-sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
    .card-print-box { page-break-inside: avoid; break-inside: avoid; }
    @media print {
      .print-card-sheet { margin-bottom: 0 !important; }
      .no-print-toolbar { display: none !important; }
    }
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #065f46;
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div style="font-weight: bold; font-size: 14px;">
      Lembar Cetak Kartu Siswa &bull; ${school.schoolName} (${selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`})
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        Cetak Sekarang (Ctrl + P)
      </button>
      <button onclick="window.close()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;">
        Tutup
      </button>
    </div>
  </div>
  <div style="padding: 16px; max-width: 210mm; margin: 0 auto;">
    ${printContent}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    try {
      const opened = window.open(blobUrl, '_blank');
      if (!opened) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      handleExportPdf();
    }
  };

  // Handle export Image (PNG) for all cards in sheet
  const handleExportImage = async () => {
    try {
      setIsExportingImage(true);
      const filename = `Lembar_ID_Card_SDN06_${selectedClass === 'all' ? 'Semua_Kelas' : `Kelas_${selectedClass}`}.png`;
      await exportElementToImage('print-cards-container', filename, {
        scale: 2.5,
        format: 'png',
        backgroundColor: '#ffffff',
      });
    } catch (err) {
      console.error('Failed to export cards to Image:', err);
      alert('Gagal mengunduh gambar lembar kartu siswa.');
    } finally {
      setIsExportingImage(false);
    }
  };


  // Handle export single student card as Image (PNG)
  const handleExportSingleCardImage = async (student: Student) => {
    try {
      setIsExportingSingleImage(true);
      await downloadStudentCardCanvas(student, school);
    } catch (canvasErr) {
      console.warn('Canvas direct export failed, attempting DOM export fallback:', canvasErr);
      // Fallback to element export if canvas encounters issue
      if (!selectedStudentForModal || selectedStudentForModal.id !== student.id) {
        setSelectedStudentForModal(student);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      try {
        const filename = `ID_Card_${student.nisn}_${student.name.replace(/\s+/g, '_')}.png`;
        await exportElementToImage('single-card-modal-target', filename, {
          scale: 2.5,
          format: 'png',
          backgroundColor: '#065f46',
        });
      } catch (fallbackErr) {
        console.error('Failed to export single card image:', fallbackErr);
        alert('Gagal mengunduh gambar kartu siswa ini.');
      }
    } finally {
      setIsExportingSingleImage(false);
    }
  };

  // Handle photo upload directly from card preview
  const handleModalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudentForModal) return;

    try {
      const compressed = await compressAndResizeImage(file, 360, 480, 0.85);
      const updated: Student = { ...selectedStudentForModal, photoUrl: compressed };
      setSelectedStudentForModal(updated);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
    } catch (err) {
      alert('Gagal mengunggah foto. Pastikan format berkas JPG atau PNG.');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <IdCard className="w-5 h-5 text-emerald-600" />
              Generator & Cetak Kartu Pelajar (QR Code & Barcode)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kartu Tanda Siswa resmi {school.schoolName} dilengkapi foto siswa &amp; QR Code presensi cepat, format cetak A4 dan unduh gambar ID Card.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format code switch */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCodeType('qr')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  codeType === 'qr'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                Format QR Code
              </button>
              <button
                type="button"
                onClick={() => setCodeType('barcode')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  codeType === 'barcode'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarcodeIcon className="w-3.5 h-3.5 text-slate-600" />
                Barcode 1D
              </button>
            </div>

            {/* Hidden Photo Upload Input for Modal / Direct update */}
            <input
              type="file"
              ref={modalPhotoInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleModalPhotoUpload}
            />

            {/* Download ID Card Image Button */}
            <button
              onClick={handleExportImage}
              disabled={isExportingImage || filteredStudents.length === 0}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Unduh seluruh lembar kartu siswa dalam format gambar (PNG)"
            >
              {isExportingImage ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <ImageIcon className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isExportingImage ? 'Menyiapkan Gambar...' : 'Unduh Gambar (PNG)'}</span>
            </button>

            {/* Direct A4 PDF Download Button */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || filteredStudents.length === 0}
              type="button"
              id="btn-export-pdf-cards"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-400 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Unduh langsung dokumen PDF ukuran A4 (8 kartu per halaman) siap cetak"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-800" />
              )}
              <span>{isExportingPdf ? 'Menyiapkan PDF...' : 'Unduh PDF (A4)'}</span>
              {filteredStudents.length > 0 && (
                <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                  {studentPages.length} Hlm
                </span>
              )}
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrintCards}
              disabled={filteredStudents.length === 0}
              type="button"
              id="btn-print-id-cards"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Cetak kartu dalam format lembar A4 (8 kartu per halaman)"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Lembar Kartu (A4)</span>
              {filteredStudents.length > 0 && (
                <span className="bg-emerald-800/80 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                  {studentPages.length} Hlm
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Live print feedback message / iframe helper banner */}
        {printStatusMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{printStatusMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Tab Baru
              </button>
              <button
                type="button"
                onClick={() => setPrintStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Tutup pesan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}


        {/* Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Filter Rombel Kelas
            </label>
            <select
              value={selectedClass}
              onChange={(e) => onSelectClass(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Semua Kelas (1 - 6)</option>
              <option value="1">Kelas 1</option>
              <option value="2">Kelas 2</option>
              <option value="3">Kelas 3</option>
              <option value="4">Kelas 4</option>
              <option value="5">Kelas 5</option>
              <option value="6">Kelas 6</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cari Nama atau NISN Siswa
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ketik nama atau 10 digit NISN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 pl-9"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Overview stats info */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-2">
        <div>
          Menampilkan <strong>{filteredStudents.length} kartu siswa</strong> (
          {selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`}) &bull;{' '}
          <span className="text-emerald-700 font-semibold">
            {studentPages.length} Lembar A4 (Format 8 kartu/halaman, grid 2&times;4)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Format Aktif: <strong>{codeType === 'qr' ? 'QR Code 2D' : 'Barcode 1D'}</strong></span>
        </div>
      </div>

      {/* Cards Grid on Screen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
            Tidak ada siswa yang sesuai dengan filter kelas atau pencarian.
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
            >
              {/* Card visual representation */}
              <div className="p-4 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white relative">
                {/* School header */}
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-emerald-600/60">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-emerald-800 shrink-0 font-black text-xs shadow-xs overflow-hidden p-0.5">
                    {school.logoUrl ? (
                      <img src={school.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <GraduationCap className="w-5 h-5 text-emerald-700" />
                    )}
                  </div>
                  <div className="leading-tight overflow-hidden">
                    <div className="text-[9px] uppercase tracking-wider text-emerald-200 font-semibold truncate">
                      {school.educationAgency || 'PEMERINTAH DAERAH • DINAS PENDIDIKAN'}
                    </div>
                    <div className="text-xs font-extrabold text-white tracking-wide truncate">
                      {school.schoolName.toUpperCase()}
                    </div>
                    <div className="text-[9px] text-emerald-100/90 font-medium">
                      KARTU TANDA SISWA (KTS)
                    </div>
                  </div>
                </div>

                {/* Student details & QR code */}
                <div className="pt-3 flex items-start gap-3">
                  {/* Photo / Avatar */}
                  <div className="w-12 h-16 bg-emerald-950/40 rounded-lg border-2 border-emerald-400/60 flex flex-col items-center justify-center text-center p-0.5 shrink-0 overflow-hidden shadow-inner relative mt-1">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <>
                        <span className="text-base font-black text-white/90">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                            student.gender === 'L'
                              ? 'bg-blue-500/80 text-white'
                              : 'bg-pink-500/80 text-white'
                          }`}
                        >
                          {student.gender === 'L' ? 'L' : 'P'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Biodata text */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <div className="text-[10px] text-emerald-200 uppercase font-semibold">
                        Nama Lengkap
                      </div>
                      <div className="text-xs font-bold text-white truncate" title={student.name}>
                        {student.name}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div>
                        <div className="text-[9px] text-emerald-200 uppercase font-semibold">
                          NISN
                        </div>
                        <div className="text-xs font-mono font-bold text-white">
                          {student.nisn}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-emerald-200 uppercase font-semibold">
                          Kelas
                        </div>
                        <div className="text-xs font-bold text-white">
                          Kelas {student.classGrade}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[9px] text-emerald-200 pt-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-300" />
                      <span>Thn Ajaran {school.academicYear}</span>
                    </div>
                  </div>

                  {/* QR Code container (Enlarged & high-density) */}
                  <div className="bg-white p-1.5 rounded-xl border-2 border-emerald-300 shadow-md flex flex-col items-center justify-center shrink-0 w-24">
                    <div className="w-full flex items-center justify-center bg-white rounded-lg overflow-hidden">
                      <StudentQRCode
                        value={student.qrCode || student.nisn}
                        size={84}
                        margin={0}
                        includeMargin={false}
                        className="w-20 h-20 aspect-square"
                      />
                    </div>
                    <span className="text-[8px] font-extrabold font-mono text-slate-800 mt-1 tracking-tight">
                      SCAN KTS
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer actions */}
              <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForModal(student)}
                  className="px-2.5 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                >
                  Pratinjau Satuan
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportSingleCardImage(student)}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    title="Unduh Gambar ID Card Ini (PNG)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {onOpenScannerWithNISN && (
                    <button
                      type="button"
                      onClick={() => onOpenScannerWithNISN(student.qrCode || student.nisn)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Uji pindai presensi dengan QR siswa ini"
                    >
                      <QrCode className="w-3 h-3 text-emerald-600" />
                      <span>Uji Scan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Single Student Card Modal Preview & Download */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <IdCard className="w-4 h-4 text-emerald-600" />
                Pratinjau Kartu Siswa &amp; Unduh Gambar ID Card
              </h3>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {/* Target element for Single Card Image Export */}
            <div
              id="single-card-modal-target"
              className="w-full bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-5 text-white shadow-lg border border-emerald-600/50 space-y-4"
            >
              {/* Kop Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-emerald-500/40">
                <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-emerald-800 font-black shadow-xs shrink-0">
                  <GraduationCap className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold truncate max-w-[200px]">
                    {school.educationAgency || 'PEMERINTAH DAERAH • DINAS PENDIDIKAN'}
                  </div>
                  <div className="text-sm font-extrabold text-white tracking-wide truncate max-w-[200px]">
                    {school.schoolName.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-emerald-100 font-medium">
                    KARTU TANDA SISWA (KTS)
                  </div>
                </div>
              </div>

                {/* Student info and QR */}
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Photo / Avatar */}
                <div className="col-span-3 flex flex-col items-center">
                  <div className="w-16 h-22 bg-emerald-950/40 rounded-xl border-2 border-emerald-400/60 flex flex-col items-center justify-center text-center overflow-hidden shadow-inner relative">
                    {selectedStudentForModal.photoUrl ? (
                      <img
                        src={selectedStudentForModal.photoUrl}
                        alt={selectedStudentForModal.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2">
                        <span className="text-xl font-black text-white">
                          {selectedStudentForModal.name.charAt(0).toUpperCase()}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                            selectedStudentForModal.gender === 'L'
                              ? 'bg-blue-500 text-white'
                              : 'bg-pink-500 text-white'
                          }`}
                        >
                          {selectedStudentForModal.gender === 'L' ? 'L' : 'P'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Direct upload / change photo button */}
                  <button
                    type="button"
                    onClick={() => modalPhotoInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-emerald-100 hover:text-white bg-emerald-900/70 hover:bg-emerald-900 border border-emerald-400/40 rounded-md transition-colors cursor-pointer"
                    title="Unggah atau ubah foto siswa ini"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{selectedStudentForModal.photoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                  </button>
                </div>

                {/* Details */}
                <div className="col-span-4 space-y-1.5">
                  <div>
                    <div className="text-[10px] text-emerald-200 font-semibold uppercase">
                      Nama Lengkap Siswa
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      {selectedStudentForModal.name}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-emerald-200 font-semibold uppercase">
                      NISN Siswa
                    </div>
                    <div className="text-xs font-mono font-bold text-white tracking-wider">
                      {selectedStudentForModal.nisn}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-emerald-200 font-semibold uppercase">
                      Rombel Kelas
                    </div>
                    <div className="text-xs font-bold text-white">
                      Kelas {selectedStudentForModal.classGrade}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-emerald-200 font-semibold uppercase">
                      Tahun Pelajaran
                    </div>
                    <div className="text-xs font-bold text-white">
                      {school.academicYear}
                    </div>
                  </div>
                </div>

                {/* QR Code Container (Enlarged to fill white area) */}
                <div className="col-span-5 flex flex-col items-center justify-center text-center pl-1">
                  <div className="bg-white p-2 rounded-2xl border-2 border-emerald-300 shadow-xl flex flex-col items-center justify-center w-full max-w-[170px]">
                    {codeType === 'qr' ? (
                      <div className="w-full flex items-center justify-center bg-white rounded-xl overflow-hidden">
                        <StudentQRCode
                          value={selectedStudentForModal.qrCode || selectedStudentForModal.nisn}
                          size={144}
                          margin={0}
                          includeMargin={false}
                          className="w-34 h-34 aspect-square"
                        />
                      </div>
                    ) : (
                      <StudentBarcode value={selectedStudentForModal.nisn} height={44} />
                    )}
                    <span className="text-[9px] font-extrabold font-mono text-slate-800 mt-1.5 tracking-tight">
                      SCAN PRESENSI KTS
                    </span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-emerald-100 mt-1.5 tracking-wider">
                    {selectedStudentForModal.qrCode || selectedStudentForModal.nisn}
                  </div>
                </div>
              </div>

              {/* Signature section */}
              <div className="pt-2 border-t border-emerald-600/40 flex items-end justify-between text-[9px] text-emerald-100">
                <div>
                  <div>NPSN: {school.npsn}</div>
                  <div>Berlaku selama menjadi siswa aktif</div>
                </div>
                <div className="text-right">
                  <div className="truncate max-w-[150px] ml-auto">{school.address.split(',')[0]}</div>
                  <div className="font-bold text-white">Kepala Sekolah</div>
                  <div className="font-bold text-white mt-4 underline">
                    {school.principalName}
                  </div>
                  <div>NIP. {school.principalNip}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingSingleImage}
                  onClick={() => handleExportSingleCardImage(selectedStudentForModal)}
                  className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isExportingSingleImage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>{isExportingSingleImage ? 'Mengunduh...' : 'Unduh Gambar ID Card (PNG)'}</span>
                </button>

                {onOpenScannerWithNISN && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenScannerWithNISN(
                        selectedStudentForModal.qrCode || selectedStudentForModal.nisn
                      );
                      setSelectedStudentForModal(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    Uji Scan Presensi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Fallback Cetak Jika window.print() Terhalang Sandbox Iframe */}
      {showPrintFallbackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bantuan Cetak Lembar Kartu (A4)</h3>
                <p className="text-xs text-slate-500">Dialog cetak browser dibatasi lingkungan pratinjau</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Lingkungan pratinjau web (<span className="font-mono text-slate-800">iframe sandbox</span>)
              memiliki kebijakan keamanan yang dapat memblokir perintah dialog cetak browser otomatis. Silakan pilih opsi alternatif berikut untuk mencetak dengan format 8 kartu per halaman A4:
            </p>

            <div className="space-y-2.5 mb-5">
              {/* Opsi 1: Unduh PDF A4 (Rekomendasi Utama) */}
              <button
                type="button"
                onClick={() => {
                  setShowPrintFallbackModal(false);
                  handleExportPdf();
                }}
                disabled={isExportingPdf}
                className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-between shadow-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <FileText className="w-5 h-5 text-emerald-200 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Unduh PDF Lembar Kartu (A4)</div>
                    <div className="text-[10px] text-emerald-100 font-normal">
                      Paling disarankan • 8 kartu per lembar pas ukuran A4
                    </div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-white shrink-0" />
              </button>

              {/* Opsi 2: Buka di Tab Baru */}
              <button
                type="button"
                onClick={() => {
                  setShowPrintFallbackModal(false);
                  handleOpenInNewTab();
                }}
                className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs flex items-center justify-between border border-slate-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <ExternalLink className="w-5 h-5 text-slate-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">Buka di Jendela / Tab Baru</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Membuka di luar iframe untuk langsung memanggil dialog cetak (Ctrl+P)
                    </div>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-600 shrink-0" />
              </button>

              {/* Opsi 3: Unduh Gambar PNG */}
              <button
                type="button"
                onClick={() => {
                  setShowPrintFallbackModal(false);
                  handleExportImage();
                }}
                disabled={isExportingImage}
                className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-xs flex items-center justify-between border border-slate-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">Unduh Lembar Gambar (PNG)</div>
                    <div className="text-[10px] text-slate-500">Berkas gambar resolusi tinggi</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintFallbackModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PORTALED PRINT CONTAINER: Attached directly to document.body outside .app-container */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="print-cards-container" className="bg-white">
            {studentPages.map((pageStudents, pageIdx) => (
              <div
                key={`page-${pageIdx}`}
                className="print-card-sheet bg-white mb-6 print:mb-0 print:p-0"
                style={{
                  pageBreakAfter: pageIdx < studentPages.length - 1 ? 'always' : 'auto',
                  breakAfter: pageIdx < studentPages.length - 1 ? 'page' : 'auto',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                {/* Sheet Running Header */}
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b-2 border-slate-900 text-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-emerald-800 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                      SD
                    </div>
                    <div className="leading-tight">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-900">
                        LEMBAR KARTU TANDA SISWA (KTS) &bull; {school.schoolName.toUpperCase()}
                      </div>
                      <div className="text-[8px] text-slate-600 font-medium">
                        NPSN: {school.npsn} &bull; Rombel:{' '}
                        {selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`} &bull; Thn
                        Ajaran: {school.academicYear}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[8.5px] font-bold text-slate-700">
                    Halaman {pageIdx + 1} dari {studentPages.length}
                    <div className="text-[7.5px] text-slate-500 font-normal">
                      Format 8 Kartu / Lembar A4 (Grid 2 &times; 4)
                    </div>
                  </div>
                </div>

                {/* 2-Column x 4-Row Grid for A4 Printing */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {pageStudents.map((student) => (
                    <div
                      key={student.id}
                      className="card-print-box relative bg-white border border-dashed border-slate-400 rounded-lg p-1.5 flex flex-col justify-between"
                      style={{ height: '62mm', boxSizing: 'border-box' }}
                    >
                      {/* Subtle corner crop marks for clean scissor cutting */}
                      <div className="absolute -top-[3px] -left-[3px] w-2 h-2 border-t-2 border-l-2 border-slate-600 pointer-events-none" />
                      <div className="absolute -top-[3px] -right-[3px] w-2 h-2 border-t-2 border-r-2 border-slate-600 pointer-events-none" />
                      <div className="absolute -bottom-[3px] -left-[3px] w-2 h-2 border-b-2 border-l-2 border-slate-600 pointer-events-none" />
                      <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 border-b-2 border-r-2 border-slate-600 pointer-events-none" />

                      {/* Card Surface */}
                      <div className="h-full border border-slate-300 rounded-md p-2 bg-white flex flex-col justify-between overflow-hidden shadow-2xs">
                        {/* Kop Kartu */}
                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-300">
                          <div className="w-6 h-6 rounded-full bg-emerald-800 flex items-center justify-center text-white shrink-0 font-extrabold text-[9px] overflow-hidden">
                            {school.logoUrl ? (
                              <img
                                src={school.logoUrl}
                                alt="Logo"
                                className="w-full h-full object-contain p-0.5 bg-white"
                              />
                            ) : (
                              'SD'
                            )}
                          </div>
                          <div className="leading-tight overflow-hidden flex-1 min-w-0">
                            <div className="text-[7px] uppercase tracking-wider font-semibold text-slate-500 truncate">
                              {school.educationAgency || 'PEMERINTAH DAERAH • DINAS PENDIDIKAN'}
                            </div>
                            <div className="text-[9.5px] font-black text-slate-900 truncate">
                              {school.schoolName.toUpperCase()}
                            </div>
                            <div className="text-[7px] font-bold text-emerald-800 tracking-wider">
                              KARTU TANDA SISWA (KTS)
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="grid grid-cols-12 gap-1.5 items-center my-auto py-0.5">
                          {/* Photo / Avatar */}
                          <div className="col-span-3">
                            <div className="w-14 h-18 bg-slate-100 rounded border border-slate-300 flex flex-col items-center justify-center text-center overflow-hidden mx-auto">
                              {student.photoUrl ? (
                                <img
                                  src={student.photoUrl}
                                  alt={student.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <>
                                  <span className="text-sm font-black text-slate-800">
                                    {student.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-600 mt-0.5">
                                    {student.gender === 'L' ? 'L' : 'P'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="col-span-5 space-y-0.5 text-slate-900 pr-0.5">
                            <div>
                              <div className="text-[7px] text-slate-500 uppercase font-semibold">
                                Nama Siswa
                              </div>
                              <div
                                className="text-[10px] font-extrabold truncate leading-tight text-slate-900"
                                title={student.name}
                              >
                                {student.name}
                              </div>
                            </div>
                            <div>
                              <div className="text-[7px] text-slate-500 uppercase font-semibold">
                                NISN
                              </div>
                              <div className="text-[9.5px] font-mono font-bold text-slate-800">
                                {student.nisn}
                              </div>
                            </div>
                            <div>
                              <div className="text-[7px] text-slate-500 uppercase font-semibold">
                                Kelas
                              </div>
                              <div className="text-[9px] font-bold text-emerald-900">
                                Kelas {student.classGrade}
                              </div>
                            </div>
                          </div>

                          {/* QR Code (Enlarged & High-Density) */}
                          <div className="col-span-4 flex flex-col items-center justify-center text-center">
                            <div className="p-1 bg-white border border-slate-800 rounded-md inline-flex flex-col items-center justify-center shadow-2xs">
                              {codeType === 'qr' ? (
                                <div className="w-full flex items-center justify-center bg-white overflow-hidden">
                                  <StudentQRCode
                                    value={student.qrCode || student.nisn}
                                    size={68}
                                    margin={0}
                                    includeMargin={false}
                                    className="w-16 h-16 aspect-square"
                                  />
                                </div>
                              ) : (
                                <StudentBarcode value={student.nisn} height={26} />
                              )}
                              <span className="text-[6.5px] font-extrabold font-mono text-slate-900 mt-0.5 tracking-tight">
                                SCAN KTS
                              </span>
                            </div>
                            <span className="text-[8px] font-mono font-bold text-slate-800 mt-0.5 truncate max-w-full">
                              {student.qrCode || student.nisn}
                            </span>
                          </div>
                        </div>

                        {/* Footer validation */}
                        <div className="pt-1 border-t border-slate-200 flex justify-between items-end text-[6.5px] text-slate-500 leading-tight">
                          <div className="max-w-[120px] truncate">
                            NPSN: {school.npsn} &bull; {school.address.split(',')[0]}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800">{school.principalName}</span>
                            <div>Kepala Sekolah</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

