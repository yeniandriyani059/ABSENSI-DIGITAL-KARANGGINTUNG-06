const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/const handleSaveAttendance = useCallback\(async \(newRecords: AttendanceRecord\[\]\) => \{([\s\S]*?)alert\('Presensi berhasil disimpan!'\);/m, `const handleSaveAttendance = useCallback(async (newRecords: AttendanceRecord[]) => {
    try {
      // First, find existing records to update, otherwise insert
      const inserts = [];
      const updates = [];

      for (const r of newRecords) {
        // find if we already have this record in local state 'records'
        const existing = records.find(rec => rec.studentId === r.studentId && rec.date === r.date);
        const payload = {
          nisn_siswa: r.studentId,
          created_at: \`\${r.date}T\${r.scannedAt || '07:00:00'}+07:00\`,
          status: r.status
        };

        if (existing && typeof existing.id === 'number') {
          updates.push({ ...payload, id: existing.id });
        } else {
          inserts.push(payload);
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('presensi').insert(inserts);
        if (error) throw error;
      }

      if (updates.length > 0) {
        const { error } = await supabase.from('presensi').upsert(updates);
        if (error) throw error;
      }
      
      fetchStudentsAndRecords();
      alert('Presensi berhasil disimpan!');`);

fs.writeFileSync('src/App.tsx', content);
