/**
 * Phase 3: payment_logic.js
 * 
 * Handles marketplace payment logic:
 * - Commission calculations
 * - Split payment initialization
 * - Transaction tracking
 */

window.Payments = {
    PLATFORM_COMMISSION_RATE: 0.10, // 10% commission

    /**
     * Calculates the split for a specific amount.
     * @param {number} totalAmount - The total booking amount.
     * @returns {Object} { total, commission, technicianPayout }
     */
    calculateSplit(totalAmount) {
        const platformFee = totalAmount * this.PLATFORM_COMMISSION_RATE;
        const technicianPayout = totalAmount - platformFee;
        return {
            total: totalAmount,
            platformFee: parseFloat(platformFee.toFixed(2)),
            technicianPayout: parseFloat(technicianPayout.toFixed(2))
        };
    },

    /**
     * Initiates a payment checkout via Supabase Edge Function.
     * @param {Object} bookingData - { appointmentId, clientId, technicianId, amount, currency, serviceName }
     */
    async initiateCheckout(bookingData) {
        if (!window.supabaseClient) throw new Error("Supabase client not initialized.");
        if (!bookingData.appointmentId || !bookingData.clientId || !bookingData.technicianId) {
            throw new Error("Missing critical booking IDs.");
        }

        const split = this.calculateSplit(bookingData.amount);

        const { data, error } = await window.supabaseClient.functions.invoke('create-checkout', {
            body: {
                appointmentId: bookingData.appointmentId,
                clientId: bookingData.clientId,
                technicianId: bookingData.technicianId,
                amount: split.total,
                currency: bookingData.currency || 'ZMW',
                serviceName: bookingData.serviceName
            }
        });

        if (error) throw error;
        return data; // Returns { url, provider }
    }
};
