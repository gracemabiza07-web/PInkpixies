import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') // WhatsApp sender number

serve(async (req) => {
  try {
    const { body } = await req.json()
    const { clientPhone, clientName, technicianName, appointmentTime, amount } = body

    if (!clientPhone || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing required info or Twilio credentials." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const messageContent = `Hey ${clientName}! Pink Pixies here. ✨ Your appointment with ${technicianName} on ${appointmentTime} is confirmed. Total: ZMW ${amount}. See you soon!`

    // Note: Twilio WhatsApp sandbox requires pre-defining templates or using specific sender
    // This is a generic implementation.
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        },
        body: new URLSearchParams({
          To: `whatsapp:${clientPhone}`,
          From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
          Body: messageContent,
        }),
      }
    )

    const data = await response.json()

    return new Response(
      JSON.stringify({ success: true, sid: data.sid }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
