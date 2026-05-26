import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active subscriptions with package duration info
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscription_progress')
      .select('id, user_id, monthly_cuts_limit, weekly_credits_available, cuts_used_this_month, credits_expired_this_month, current_week_start, subscription_start_date, package_id')
      .eq('is_active', true)

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`)
    }

    const now = new Date()
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - now.getDay()) // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0)

    let updatedCount = 0
    let expiredCount = 0
    const results: { userId: string; expired?: number; newWeeklyCredits?: number; action: string }[] = []

    for (const sub of subscriptions || []) {
      // CHECK IF SUBSCRIPTION PERIOD HAS EXPIRED (30 days from start)
      const startDate = sub.subscription_start_date ? new Date(sub.subscription_start_date) : null

      if (startDate) {
        // Get package duration (default 30 days)
        let durationDays = 30
        if (sub.package_id) {
          const { data: pkg } = await supabase
            .from('packages')
            .select('duration_days')
            .eq('id', sub.package_id)
            .maybeSingle()
          if (pkg?.duration_days) {
            durationDays = pkg.duration_days
          }
        }

        const expirationDate = new Date(startDate)
        expirationDate.setDate(expirationDate.getDate() + durationDays)

        if (now > expirationDate) {
          // Subscription has expired — deactivate it
          const { error: deactivateError } = await supabase
            .from('subscription_progress')
            .update({
              is_active: false,
              weekly_credits_available: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id)

          if (deactivateError) {
            console.error(`Error deactivating subscription ${sub.id}:`, deactivateError)
            continue
          }

          results.push({
            userId: sub.user_id,
            action: 'expired_deactivated'
          })
          expiredCount++
          continue // Skip credit reset for expired subscriptions
        }
      }

      // Subscription is still valid — proceed with weekly credit reset
      const subWeekStart = sub.current_week_start ? new Date(sub.current_week_start) : null
      
      // Check if we need to process this subscription (new week)
      const needsReset = !subWeekStart || 
        subWeekStart.getTime() < currentWeekStart.getTime()

      if (needsReset) {
        // Calculate unused weekly credits that will expire
        const expiredCredits = sub.weekly_credits_available || 0
        
        // Calculate new weekly credits (1/4 of monthly, rounded up)
        const weeklyCreditsPerWeek = Math.ceil(sub.monthly_cuts_limit / 4)
        
        // Only count as an "expired week" (which consumes 1 of each benefit)
        // when the client made ZERO bookings during the week (full credits remained).
        // Partial-use weeks already had their bookings counted via real appointments.
        const noBookingsThisWeek = expiredCredits >= weeklyCreditsPerWeek
        const expiredWeeksIncrement = noBookingsThisWeek ? 1 : 0

        // Update subscription
        const { error: updateError } = await supabase
          .from('subscription_progress')
          .update({
            weekly_credits_available: weeklyCreditsPerWeek,
            current_week_start: currentWeekStart.toISOString().split('T')[0],
            credits_expired_this_month: (sub.credits_expired_this_month || 0) + expiredCredits,
            expired_weeks_this_period: ((sub as any).expired_weeks_this_period || 0) + expiredWeeksIncrement,
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id)

        if (updateError) {
          console.error(`Error updating subscription ${sub.id}:`, updateError)
          continue
        }

        results.push({
          userId: sub.user_id,
          expired: expiredCredits,
          newWeeklyCredits: weeklyCreditsPerWeek,
          action: 'credits_reset'
        })
        updatedCount++
      }
    }

    console.log(`Weekly credits reset completed. Updated ${updatedCount}, expired ${expiredCount}.`, results)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${updatedCount} subscriptions, expired ${expiredCount}`,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in weekly credits reset:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
