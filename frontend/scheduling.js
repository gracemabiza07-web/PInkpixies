/**
 * Phase 2: scheduling.js
 * 
 * Handles real-time availability logic for Pink Pixies.
 * Connects Flatpickr to Supabase DB to ensure only valid slots are booked.
 */

window.Scheduling = {
    /**
     * Fetches availability data for a specific technician.
     * @param {string} proId - The technician's UUID.
     * @returns {Promise<Object>} - Working hours, blocked slots, and existing appointments.
     */
    async fetchAvailabilityData(proId) {
        if (!window.supabaseClient) return null;

        const { data: workingHours } = await window.supabaseClient
            .from('working_hours')
            .select('*')
            .eq('technician_id', proId);

        const { data: blockedSlots } = await window.supabaseClient
            .from('blocked_slots')
            .select('*')
            .eq('technician_id', proId);

        const { data: appointments } = await window.supabaseClient
            .from('appointments')
            .select('start_time, end_time')
            .eq('technician_id', proId)
            .in('status', ['confirmed', 'pending']);

        return {
            workingHours: workingHours || [],
            blockedSlots: blockedSlots || [],
            appointments: appointments || []
        };
    },

    /**
     * Initializes Flatpickr with availability filtering.
     * @param {string} selector - CSS selector for the input.
     * @param {string} proId - The technician's UUID.
     * @param {number} durationMinutes - Duration of the selected service.
     */
    async initAvailabilityPicker(selector, proId, durationMinutes = 60) {
        const data = await this.fetchAvailabilityData(proId);
        if (!data) return;

        return flatpickr(selector, {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            minDate: "today",
            time_24hr: true,
            minuteIncrement: 30,
            disable: [
                (date) => {
                    // Disable days outside working hours
                    const dayOfWeek = date.getDay();
                    const dayConfig = data.workingHours.find(h => h.day_of_week === dayOfWeek);
                    if (!dayConfig) return true;

                    // Disable completely blocked dates
                    const dateOnly = date.toISOString().split('T')[0];
                    return data.blockedSlots.some(slot => {
                        const sStart = slot.start_time.split('T')[0];
                        const sEnd = slot.end_time.split('T')[0];
                        return dateOnly >= sStart && dateOnly <= sEnd;
                    });
                }
            ],
            onChange: (selectedDates, dateStr, instance) => {
                const startTime = selectedDates[0];
                if (!startTime) return;

                const isAvailable = this.isSlotAvailable(startTime, durationMinutes, data);
                if (!isAvailable) {
                    alert("This slot is unavailable. Please check the technician's working hours or try another time. ✨");
                    instance.clear();
                }
            }
        });
    },

    isSlotAvailable(startTime, durationMinutes, data) {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        const dayOfWeek = startTime.getDay();

        // Convert to local time comparison strings (HH:MM:SS)
        const pad = (n) => n.toString().padStart(2, '0');
        const startTimeStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}:00`;
        const endTimeStr = `${pad(endTime.getHours())}:${pad(endTime.getMinutes())}:00`;

        // 1. Check Working Hours
        const dayConfig = data.workingHours.find(h => h.day_of_week === dayOfWeek);
        if (!dayConfig) return false;

        // Strict boundary check
        if (startTimeStr < dayConfig.start_time || endTimeStr > dayConfig.end_time) {
            return false;
        }

        // 2. Check Overlapping Appointments
        const hasApptConflict = data.appointments.some(appt => {
            const apptStart = new Date(appt.start_time);
            const apptEnd = new Date(appt.end_time);
            return startTime < apptEnd && endTime > apptStart;
        });
        if (hasApptConflict) return false;

        // 3. Check Blocked Slots
        const hasBlockedConflict = data.blockedSlots.some(slot => {
            const slotStart = new Date(slot.start_time);
            const slotEnd = new Date(slot.end_time);
            return startTime < slotEnd && endTime > slotStart;
        });
        if (hasBlockedConflict) return false;

        return true;
    }
};
