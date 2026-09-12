import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { Student, SchoolProfile } from '../types';
import { StudentQRCode } from './StudentQRCode';
import { StudentBarcode } from './StudentBarcode';
import { exportElementToImage, compressAndResizeImage } from '../utils/imageExport';
import { downloadStudentCardCanvas } from '../utils/idCardCanvas';

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

  // Handle print all cards or filtered cards
  const handlePrintCards = () => {
    document.body.classList.add('print-mode-cards');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-mode-cards');
    }, 400);
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Unduh seluruh lembar kartu siswa dalam format gambar (PNG)"
            >
              {isExportingImage ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <ImageIcon className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isExportingImage ? 'Menyiapkan Gambar...' : 'Unduh Gambar ID Card'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrintCards}
              disabled={filteredStudents.length === 0}
              type="button"
              id="btn-print-id-cards"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Cetak Lembar Kartu (A4)
            </button>
          </div>
        </div>

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
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Menampilkan <strong>{filteredStudents.length} kartu siswa</strong> (
          {selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`})
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

                  {/* QR Code thumbnail */}
                  <div className="bg-white p-1.5 rounded-lg border border-emerald-300/40 shadow-xs flex flex-col items-center justify-center shrink-0">
                    <StudentQRCode value={student.qrCode || student.nisn} size={68} />
                    <span className="text-[7px] font-bold font-mono text-slate-600 mt-0.5">
                      QR SCAN
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
                <div className="col-span-5 space-y-1.5">
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

                {/* QR Code Container */}
                <div className="col-span-4 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-2 rounded-xl border border-emerald-200 shadow-md">
                    {codeType === 'qr' ? (
                      <StudentQRCode
                        value={selectedStudentForModal.qrCode || selectedStudentForModal.nisn}
                        size={104}
                      />
                    ) : (
                      <StudentBarcode value={selectedStudentForModal.nisn} height={36} />
                    )}
                  </div>
                  <div className="text-[9px] font-mono font-bold text-emerald-100 mt-1">
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

      {/* PRINT CONTAINER: Optimized A4 Sheet with Grid of Cards */}
      <div id="print-cards-container" className="hidden print:block bg-white p-4">
        <div className="text-center mb-5 pb-3 border-b-2 border-slate-900">
          <h1 className="text-lg font-extrabold uppercase text-slate-900 tracking-wide">
            LEMBAR KARTU TANDA SISWA (KTS) DENGAN QR CODE PRESENSI
          </h1>
          <p className="text-xs text-slate-600">
            {school.schoolName} &bull; NPSN: {school.npsn} &bull; Rombel:{' '}
            {selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`} &bull; Total:{' '}
            {filteredStudents.length} Siswa
          </p>
        </div>

        {/* 2-Column Grid for A4 Printing */}
        <div className="grid grid-cols-2 gap-4">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              className="border-2 border-dashed border-slate-400 p-2.5 rounded-xl bg-white page-break-inside-avoid"
            >
              <div className="border border-slate-300 rounded-lg p-3 bg-white space-y-2.5">
                {/* Kop Sekolah */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-300">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-white shrink-0 font-bold text-xs">
                    SD
                  </div>
                  <div className="leading-tight overflow-hidden">
                    <div className="text-[8px] uppercase tracking-wider font-semibold text-slate-600 truncate max-w-[150px]">
                      {school.educationAgency || 'PEMERINTAH DAERAH • DINAS PENDIDIKAN'}
                    </div>
                    <div className="text-[11px] font-extrabold text-slate-900 truncate max-w-[150px]">
                      {school.schoolName.toUpperCase()}
                    </div>
                    <div className="text-[8px] text-slate-500 font-medium">
                      KARTU TANDA SISWA (KTS)
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <div className="w-14 h-18 bg-slate-100 rounded border border-slate-300 flex flex-col items-center justify-center text-center overflow-hidden">
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <span className="text-base font-black text-slate-800">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-[8px] font-bold text-slate-600 mt-1">
                            {student.gender === 'L' ? 'L' : 'P'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="col-span-5 space-y-0.5 text-slate-900">
                    <div>
                      <div className="text-[8px] text-slate-500 uppercase">Nama Siswa</div>
                      <div className="text-[11px] font-bold truncate leading-tight">
                        {student.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500 uppercase">NISN</div>
                      <div className="text-[10px] font-mono font-bold">{student.nisn}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500 uppercase">Kelas</div>
                      <div className="text-[10px] font-bold">Kelas {student.classGrade}</div>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="col-span-4 flex flex-col items-center justify-center text-center">
                    <div className="p-1 bg-white border border-slate-300 rounded inline-block">
                      {codeType === 'qr' ? (
                        <StudentQRCode value={student.qrCode || student.nisn} size={64} />
                      ) : (
                        <StudentBarcode value={student.nisn} height={30} />
                      )}
                    </div>
                    <span className="text-[8px] font-mono font-bold text-slate-700 mt-0.5">
                      {student.qrCode || student.nisn}
                    </span>
                  </div>
                </div>

                {/* Footer validation */}
                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-end text-[7px] text-slate-500">
                  <div className="max-w-[120px] truncate">NPSN: {school.npsn} &bull; {school.address.split(',')[0]}</div>
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
    </div>
  );
};
