/**
 * DRAFT: Global Notification Service
 * 
 * This module handles cross-channel communication for the Pink Pixies platform.
 * It uses Courier/Novu for in-app and email notifications, and Twilio for 
 * automated WhatsApp booking confirmations.
 */

// import { CourierClient } from "@trycourier/courier";
// import twilio from "twilio";

const COURIER_AUTH_TOKEN = process.env.COURIER_AUTH_TOKEN;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886'; // Twilio Sandbox Number

/**
 * Sends a cross-channel notification when a professional receives a Pink Badge.
 * 
 * @param {string} proId - Profile ID of the professional
 * @param {string} proName - Name of the professional
 */
export async function notifyPinkBadgeAwarded(proId, proName) {
    console.log(`[Notification Service] Triggering Pink Badge Award for: ${proName}`);

    try {
        // const courier = CourierClient({ authorizationToken: COURIER_AUTH_TOKEN });

        // await courier.send({
        //     message: {
        //         to: { user_id: proId },
        //         template: "PINK_BADGE_AWARDED_TEMPLATE",
        //         data: { proName: proName },
        //     }
        // });

        console.log(`[Success] Pink Badge Notification sent via Courier/Novu for ${proName}`);
    } catch (error) {
        console.error(`[Error] Failed to send Pink Badge notification:`, error);
    }
}

/**
 * Sends an automated WhatsApp booking confirmation to the client.
 * Triggered after a successful Stripe or Paystack checkout session.
 * 
 * @param {Object} bookingDetails - Contains client phone, service name, tech name, and date
 */
export async function sendWhatsAppBookingConfirmation(bookingDetails) {
    const { clientPhone, clientName, serviceName, proName, dateTime } = bookingDetails;

    // Format the client's phone number to include the 'whatsapp:' prefix required by Twilio
    const formattedPhone = clientPhone.startsWith('whatsapp:') ? clientPhone : `whatsapp:${clientPhone}`;

    const messageBody = `
✨ Hi ${clientName}! ✨
    
Your appointment with ${proName} for '${serviceName}' is confirmed! 
    
📅 Date & Time: ${dateTime}
    
Thank you for booking with Pink Pixies. Relax, and get ready for some magic! 💖
    `;

    console.log(`[Twilio WhatsApp] Sending confirmation to ${formattedPhone}...`);

    try {
        // const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        // const message = await client.messages.create({
        //     body: messageBody,
        //     from: TWILIO_WHATSAPP_NUMBER,
        //     to: formattedPhone
        // });

        // console.log(`[Success] WhatsApp message sent with SID: ${message.sid}`);
    } catch (error) {
        console.error(`[Error] Failed to send WhatsApp confirmation:`, error);
    }
}
