import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ttecccbrigcckurnezhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZWNjY2JyaWdjY2t1cm5lemhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjczNjcsImV4cCI6MjA4MDcwMzM2N30.JXFV319Y51Wz2Vs1voq2sbk6GC6c35XH0dURo6INCHA'
);

async function run() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  console.log('Total profiles:', count);
  if (error) console.error(error);
}

run();
