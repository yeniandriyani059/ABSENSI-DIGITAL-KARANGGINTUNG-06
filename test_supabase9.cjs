const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://nqdopaupzxibaozlolpl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('presensi').insert([{ nisn_siswa: '124', waktu_scan: '2023-10-10T07:00:00+07:00', status: 'Hadir' }]).select();
  console.log('presensi error:', error?.message);
  console.log('presensi id type:', typeof data?.[0]?.id);
  console.log('presensi id:', data?.[0]?.id);
}
test();
