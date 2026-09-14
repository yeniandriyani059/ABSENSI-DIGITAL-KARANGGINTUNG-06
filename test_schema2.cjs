const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://nqdopaupzxibaozlolpl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('presensi').select('*');
  if (data) {
    const studentCounts = {};
    for (const r of data) {
      studentCounts[r.nisn_siswa] = (studentCounts[r.nisn_siswa] || 0) + 1;
    }
    console.log('counts:', studentCounts);
    
    // find duplicates
    const toDelete = [];
    const seen = new Set();
    for (const r of data) {
      const key = `${r.nisn_siswa}_${r.created_at.split('T')[0]}_${r.status}`;
      if (seen.has(key)) {
        toDelete.push(r.id);
      } else {
        seen.add(key);
      }
    }
    
    console.log(`Found ${toDelete.length} duplicates to delete`);
    if (toDelete.length > 0) {
      // delete them
      for (const id of toDelete) {
        await supabase.from('presensi').delete().eq('id', id);
      }
      console.log('deleted duplicates');
    }
  }
}
test();
