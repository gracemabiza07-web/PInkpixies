import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string

// Twilio Config
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') as string
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') as string
const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886' // Twilio Sandbox default

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') // '/payment-webhook?provider=stripe'

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need admin powers to forcibly update appointment status
    )

    let appointmentId = ""
    let metadata: any = {}
    let externalRef = ""
    let currency = "ZMW"

    // 1. Process Stripe Webhook
    if (provider === 'stripe') {
      const signature = req.headers.get('Stripe-Signature')
      if (!signature) throw new Error("No Stripe signature found")

      const body = await req.text()
      const event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        appointmentId = session.metadata?.appointment_id || ''
        metadata = session.metadata || {}
        externalRef = session.id
        currency = session.currency?.toUpperCase() || "ZMW"
      } else {
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }
    } 
    
    // 2. Process Paystack Webhook
    else if (provider === 'paystack') {
      const paystackEvent = await req.json()
      if (paystackEvent.event === 'charge.success') {
        appointmentId = paystackEvent.data.metadata.appointment_id
        metadata = paystackEvent.data.metadata || {}
        externalRef = paystackEvent.data.reference
        currency = paystackEvent.data.currency || "ZMW"
      } else {
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }
    }

    if (!appointmentId) {
       throw new Error("Could not determine appointment ID from webhook")
    }

    console.log(`Payment confirmed for appointment: ${appointmentId} via ${provider}`)

    // 3. Update Appointment Status in Supabase
    const { data: appointment, error: dbError } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointmentId)
      .select(`
        id,
        start_time,
        client_id,
        technician_id,
        client:client_id (full_name),
        tech:technician_id (full_name)
      `)
      .single()

    if (dbError) throw dbError

    // 4. Record the Transaction
    const amount = parseFloat(metadata.amount || "0")
    const platformFee = parseFloat(metadata.platform_fee || "0")
    
    const { error: txError } = await supabase
      .from('transactions')
      .insert([{
        appointment_id: appointmentId,
        client_id: appointment.client_id,
        technician_id: appointment.technician_id,
        amount: amount,
        platform_fee: platformFee,
        payout_amount: amount - platformFee,
        currency: currency,
        status: 'successful',
        payment_method: provider,
        external_ref: externalRef
      }])

    if (txError && !txError.message.includes('duplicate key')) {
        console.error("Transaction log error:", txError)
    }

    // 5. Trigger Twilio WhatsApp Notification
    const clientName = appointment?.client?.full_name || "Client"
    const techName = appointment?.tech?.full_name || "Nail Tech"
    const time = new Date(appointment.start_time).toLocaleString()

    const messageBody = `*Pink Pixies*: Payment confirmed! ✨\n\nYour appointment between ${clientName} and ${techName} is confirmed for ${time}.`
    
    // Basic Twilio Fetch implementation
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

    // Client Number (Hardcoded for demo, normally pulled from profile logic/setup)
    const clientPhoneStr = 'whatsapp:+260123456789' 

    const twilioData = new URLSearchParams()
    twilioData.append('To', clientPhoneStr)
    twilioData.append('From', TWILIO_WHATSAPP_NUMBER)
    twilioData.append('Body', messageBody)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: twilioData
    })

    if (!twilioResponse.ok) {
       console.error("Twilio warning:", await twilioResponse.text())
    }

    return new Response(JSON.stringify({ success: true, appointment: appointmentId }), { status: 200 })

  } catch (error) {
    console.error(`Webhook Error [${provider}]:`, error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
