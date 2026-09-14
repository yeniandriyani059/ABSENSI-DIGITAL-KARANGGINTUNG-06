const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://nqdopaupzxibaozlolpl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZG9wYXVwenhpYmFvemxvbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMzYwNTIsImV4cCI6MjEwNDkxMjA1Mn0.aoe7q8bmkQdaGhXOv1nJj7tssC3_05U5apV0O2Stn-Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('presensi').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('presensi columns:', Object.keys(data[0]));
  } else {
    console.log('no rows in presensi. inserting a dummy row...');
    const { data: d2, error: e2 } = await supabase.from('presensi').insert([{}]).select();
    if (e2) {
      console.log('insert error:', e2);
    }
  }
}
test();
