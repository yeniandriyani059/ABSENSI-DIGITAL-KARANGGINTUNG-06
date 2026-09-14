const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/const handleSaveAttendance = useCallback\(async \(newRecords: AttendanceRecord\[\]\) => \{[\s\S]*?alert\('Presensi berhasil disimpan!'\);/, `const handleSaveAttendance = useCallback(async (newRecords: AttendanceRecord[]) => {
    try {
      const inserts = [];
      const updates = [];

      for (const r of newRecords) {
        // find if we already have this record in local state 'records'
        // we can't easily access 'records' inside useCallback without adding it to deps, 
        // which might cause re-renders. Let's just do it directly.
        const payload = {
          nisn_siswa: r.studentId,
          created_at: \`\${r.date}T\${r.scannedAt || '07:00:00'}+07:00\`,
          status: r.status
        };
        // wait, we can just delete and insert to avoid missing IDs
        // but delete requires waiting.
      }
      
      // Better approach: just delete by nisn_siswa and date is hard.
      // Let's rely on fetch to update state, and just use insert.
`);
