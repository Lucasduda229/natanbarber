const supabaseUrl = 'https://ttecccbrigcckurnezhl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZWNjY2JyaWdjY2t1cm5lemhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjczNjcsImV4cCI6MjA4MDcwMzM2N30.JXFV319Y51Wz2Vs1voq2sbk6GC6c35XH0dURo6INCHA';

async function fetchSupabase(endpoint, queryParams = '') {
  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}?${queryParams}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  return response.json();
}

async function run() {
  try {
    console.log("Searching for Gustavo...");
    const profiles = await fetchSupabase('profiles', 'select=*');
      
    if (!profiles || profiles.length === 0) {
      console.log("No users found.");
      return;
    }
    
    let user = profiles.find(p => p.full_name && p.full_name.toLowerCase().includes('gustavo'));
    
    if (!user) {
      console.log("No Gustavo found. List of all users:");
      profiles.forEach(p => console.log(p.full_name));
      return;
    }
    
    console.log(`Found user: ${user.full_name} (ID: ${user.id})`);
    
    const subs = await fetchSupabase('subscription_progress', `select=*&user_id=eq.${user.id}&is_active=eq.true`);
      
    if (subs && subs.length > 0) {
      console.log("\nActive Subscription:");
      console.log(`- Package: ${subs[0].package_name}`);
      console.log(`- Limit: ${subs[0].monthly_cuts_limit} cuts`);
      console.log(`- Start Date: ${subs[0].subscription_start_date}`);
      console.log(`- Reset Date: ${subs[0].usage_reset_date}`);
    } else {
      console.log("\nNo Active Subscription Found (Maybe it expired?). Fetching inactive ones...");
      const inactiveSubs = await fetchSupabase('subscription_progress', `select=*&user_id=eq.${user.id}&order=created_at.desc&limit=1`);
      if (inactiveSubs && inactiveSubs.length > 0) {
        console.log(`- Last Package: ${inactiveSubs[0].package_name}`);
        console.log(`- Limit: ${inactiveSubs[0].monthly_cuts_limit} cuts`);
        console.log(`- Start Date: ${inactiveSubs[0].subscription_start_date}`);
        console.log(`- Reset Date: ${inactiveSubs[0].usage_reset_date}`);
        console.log(`- Status: is_active = ${inactiveSubs[0].is_active}`);
      }
    }
    
    console.log("\nAppointments:");
    const appointments = await fetchSupabase('appointments', `select=*&user_id=eq.${user.id}&order=appointment_date.asc`);
      
    if (appointments && appointments.length > 0) {
      appointments.forEach((apt, index) => {
        console.log(`${index + 1}. Date: ${apt.appointment_date} | Time: ${apt.appointment_time} | Status: ${apt.status} | Created at: ${apt.created_at} | Payment: ${apt.payment_method}`);
      });
    } else {
      console.log("No appointments found.");
    }
    
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
