import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim();
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDaniel() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .ilike('full_name', '%Daniel%');
  
  console.log('Profiles:', JSON.stringify(profiles, null, 2));

  if (profiles && profiles.length > 0) {
    const userId = profiles[0].user_id;
    
    const { data: sub } = await supabase
      .from('subscription_progress')
      .select('*')
      .eq('user_id', userId);
    console.log('Subscription:', JSON.stringify(sub, null, 2));

    const { data: apts } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .eq('payment_method', 'subscription');
    console.log('Appointments:', JSON.stringify(apts, null, 2));
  }
}

checkDaniel();
