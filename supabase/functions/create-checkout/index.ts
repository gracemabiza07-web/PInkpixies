// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { appointmentId, clientId, technicianId, currency, amount, serviceName } = await req.json()

    if (!appointmentId || !clientId || !technicianId || !currency || !amount) {
      throw new Error('Missing required checkout parameters.')
    }

    // Initialize Supabase Client with Service Role Key to fetch user email safely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch user email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(clientId)
    const userEmail = userData?.user?.email || "customer@pinkpixies.com"

    // Commission logic: 10% platform fee
    const platformFee = Math.round(amount * 0.10 * 100)

    // Determine the region based on the currency
    const africanCurrencies = ['ZMW', 'NGN', 'ZAR', 'KES', 'GHS']
    const isAfrica = africanCurrencies.includes(currency.toUpperCase())

    let checkoutUrl = ""
    let provider = ""

    // 1. Paystack Logic (Africa)
    if (isAfrica) {
      provider = "paystack"
      
      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          currency: currency.toUpperCase(),
          reference: `appt_${appointmentId}_${Date.now()}`,
          metadata: {
            appointment_id: appointmentId,
            technician_id: technicianId,
            client_id: clientId,
            amount: amount,
            platform_fee: platformFee
          },
          // Dynamic callback URL based on request origin
          callback_url: `${req.headers.get('origin') || 'http://localhost:5173'}/success.html?appointment_id=${appointmentId}`
        })
      })

      const paystackData = await paystackResponse.json()
      if (!paystackData.status) {
        throw new Error(paystackData.message || 'Failed to initialize Paystack checkout')
      }
      checkoutUrl = paystackData.data.authorization_url
    } 
    
    // 2. Stripe Logic (International)
    else {
      provider = "stripe"
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: serviceName || 'Pink Pixies Service',
              },
              unit_amount: Math.round(amount * 100), // Stripe uses cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        // Dynamic success and cancel URLs
        success_url: `${req.headers.get('origin') || 'http://localhost:5173'}/success.html?session_id={CHECKOUT_SESSION_ID}&appointment_id=${appointmentId}`,
        cancel_url: `${req.headers.get('origin') || 'http://localhost:5173'}/cancel.html`,
        metadata: {
          appointment_id: appointmentId,
          technician_id: technicianId,
          client_id: clientId,
          amount: amount.toString(),
          platform_fee: platformFee.toString()
        }
      })

      if (!session.url) {
        throw new Error('Failed to create Stripe checkout session')
      }
      checkoutUrl = session.url
    }

    return new Response(
      JSON.stringify({ url: checkoutUrl, provider }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
