import QRCode from 'qrcode';
import { Student, SchoolProfile } from '../types';

/**
 * Draws a rounded rectangle path on canvas.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Loads an image from a URL or Base64 data URL into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar.'));
    img.src = src;
  });
}

/**
 * Generates and downloads a high-resolution, pixel-perfect PNG of a Student ID Card.
 * Runs 100% on HTML5 Canvas - works reliably in all browsers and sandboxed iframes.
 */
export async function downloadStudentCardCanvas(
  student: Student,
  school: SchoolProfile
): Promise<void> {
  const width = 1050;
  const height = 660;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia.');
  }

  // 1. Base card rounded clipping & shadow
  const cardRadius = 32;
  roundRect(ctx, 0, 0, width, height, cardRadius);
  ctx.clip();

  // 2. Background Gradient (Official SDN 06 Slemped Emerald Theme)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#064e3b'); // emerald-900
  bgGrad.addColorStop(0.5, '#065f46'); // emerald-800
  bgGrad.addColorStop(1, '#0f766e'); // teal-700
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative wavy security curves
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.bezierCurveTo(width * 0.3, height * 0.5, width * 0.6, height * 0.9, width, height * 0.65);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(245, 158, 11, 0.05)'; // Gold tint curve
  ctx.beginPath();
  ctx.moveTo(0, height * 0.85);
  ctx.bezierCurveTo(width * 0.4, height * 0.75, width * 0.7, height * 0.95, width, height * 0.8);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 3. Header Section (Kop Kartu)
  const headerHeight = 135;
  ctx.fillStyle = 'rgba(2, 44, 34, 0.55)'; // darker emerald
  ctx.fillRect(0, 0, width, headerHeight);

  // Gold accent divider line
  const goldGrad = ctx.createLinearGradient(0, 0, width, 0);
  goldGrad.addColorStop(0, '#f59e0b');
  goldGrad.addColorStop(0.5, '#fbbf24');
  goldGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, headerHeight, width, 4);

  // Logo / Emblem Circle
  const logoX = 65;
  const logoY = headerHeight / 2;
  const logoR = 42;

  if (school.logoUrl) {
    try {
      const logoImg = await loadImage(school.logoUrl);
      const imgSize = logoR * 2;
      ctx.drawImage(logoImg, logoX - logoR, logoY - logoR, imgSize, imgSize);
    } catch {
      // Fallback
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(logoX, logoY, logoR - 3, 0, Math.PI * 2);
      ctx.fillStyle = '#064e3b';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SD', logoX, logoY);
    }
  } else {
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(logoX, logoY, logoR - 3, 0, Math.PI * 2);
    ctx.fillStyle = '#064e3b';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SD', logoX, logoY);
  }

  // Header Texts
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(school.educationAgency || 'PEMERINTAH DAERAH \u2022 DINAS PENDIDIKAN', 130, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 27px sans-serif';
  ctx.fillText((school.schoolName || 'KARTU TANDA SISWA').toUpperCase(), 130, 78);

  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KARTU TANDA SISWA (KTS) DENGAN QR PRESENSI RESMI', 130, 110);

  // NPSN Badge on the right of header
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6ee7b7';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`NPSN: ${school.npsn || '20500450'}`, width - 45, 78);

  // 4. Student Photo (Left Column)
  const photoX = 45;
  const photoY = headerHeight + 60; // pushed down a bit because it's smaller
  const photoW = 160;
  const photoH = 210;
  const photoRadius = 14;

  // Photo frame border
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#34d399';
  roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
  ctx.stroke();
  ctx.clip();

  if (student.photoUrl) {
    try {
      const photoImg = await loadImage(student.photoUrl);
      ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
    } catch {
      // Fallback if photo load fails
      ctx.fillStyle = '#022c22';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2);
    }
  } else {
    // Default student avatar
    ctx.fillStyle = student.gender === 'L' ? '#1e3a8a' : '#831843';
    ctx.fillRect(photoX, photoY, photoW, photoH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(student.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 - 20);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      student.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN',
      photoX + photoW / 2,
      photoY + photoH / 2 + 50
    );
  }
  ctx.restore();

  // Gender Pill below Photo
  const genderPillY = photoY + photoH + 18;
  ctx.save();
  roundRect(ctx, photoX, genderPillY, photoW, 30, 8);
  ctx.fillStyle = student.gender === 'L' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(236, 72, 153, 0.35)';
  ctx.fill();
  ctx.strokeStyle = student.gender === 'L' ? '#60a5fa' : '#f472b6';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    student.gender === 'L' ? 'LAKI-LAKI (L)' : 'PEREMPUAN (P)',
    photoX + photoW / 2,
    genderPillY + 15
  );
  ctx.restore();

  // 5. Student Biodata (Middle Column)
  const infoX = photoX + photoW + 40;
  let currentY = headerHeight + 60;

  // Student Name
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NAMA LENGKAP SISWA', infoX, currentY);
  currentY += 34;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  // Truncate name if extremely long
  let displayName = student.name;
  if (ctx.measureText(displayName).width > 380) {
    while (ctx.measureText(displayName + '...').width > 380 && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '...';
  }
  ctx.fillText(displayName, infoX, currentY);
  currentY += 42;

  // Row NISN
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('NOMOR INDUK SISWA NASIONAL (NISN)', infoX, currentY);
  currentY += 28;

  ctx.fillStyle = '#fbbf24'; // Gold NISN
  ctx.font = 'bold 24px monospace';
  ctx.fillText(student.nisn, infoX, currentY);
  currentY += 42;

  // Row Kelas & Status
  const col1X = infoX;
  const col2X = infoX + 220;

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ROMBEL / KELAS', col1X, currentY);
  ctx.fillText('STATUS SISWA', col2X, currentY);
  currentY += 28;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Kelas ${student.classGrade}`, col1X, currentY);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Aktif Terdaftar', col2X, currentY);
  currentY += 44;

  // Row Tahun Ajaran
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('TAHUN PELAJARAN', infoX, currentY);
  currentY += 24;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${school.academicYear} \u2022 ${school.schoolName}`, infoX, currentY);

  // 6. Right Column: QR Code Box
  const qrBoxW = 260;
  const qrBoxH = 300;
  const qrBoxX = width - qrBoxW - 45;
  const qrBoxY = headerHeight + 25;

  // White Card for QR Code
  ctx.save();
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6ee7b7';
  ctx.stroke();

  // Generate QR Code data URL
  const qrData = student.qrCode || student.nisn;
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: 'M',
  });
  const qrImg = await loadImage(qrDataUrl);

  const qrSize = 220;
  const qrDrawX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrDrawY = qrBoxY + 16;
  ctx.drawImage(qrImg, qrDrawX, qrDrawY, qrSize, qrSize);

  // QR Label
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN PRESENSI', qrBoxX + qrBoxW / 2, qrDrawY + qrSize + 25);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(qrData, qrBoxX + qrBoxW / 2, qrDrawY + qrSize + 45);
  ctx.restore();

  // 7. Footer Bar
  const footerHeight = 65;
  const footerY = height - footerHeight;
  ctx.fillStyle = 'rgba(2, 44, 34, 0.85)';
  ctx.fillRect(0, footerY, width, footerHeight);

  // Thin top border of footer
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(0, footerY, width, 1.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    `${school.address} \u2022 Kartu Resmi Digunakan untuk Presensi Harian`,
    45,
    footerY + 38
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`KTS-${school.npsn}-${student.nisn}`, width - 45, footerY + 38);

  // Convert to PNG DataURL & trigger download
  const pngUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  const safeName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `ID_Card_${student.nisn}_${safeName}.png`;
  link.href = pngUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
