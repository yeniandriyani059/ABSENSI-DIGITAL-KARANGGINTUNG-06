const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://nqdopaupzxibaozlolpl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('siswa').upsert({ id: 1, nisn: '123', nama: 'Test', kelas: '1' }, { onConflict: 'nisn' }).select();
  console.log('upsert error:', error?.message);
}
test();
