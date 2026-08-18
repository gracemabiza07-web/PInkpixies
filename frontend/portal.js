/**
 * Phase 3: Professionalism Portal Logic
 * 
 * Handles technician dashboard functionality:
 * - Tab switching
 * - Service Management (CRUD)
 * - Profile Updates (Bio, Location, Contacts)
 * - Certification Uploads (Supabase Storage)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the user is a technician
    initPortalStateObserver();
});

let currentProId = null;

function initPortalStateObserver() {
    if (!window.supabaseClient) return;

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile && profile.role === 'technician') {
                currentProId = session.user.id;
                initProPortal();
            }
        }
    });
}

function initProPortal() {
    setupPortalTabs();
    loadProServices();
    loadProProfile();
    loadProReviews();
    loadProStats();
    loadProSchedule();
    setupCertUpload();
    setupServiceForm();
}

window.openProPortal = () => {
    const modal = document.getElementById('pro-portal-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        if (currentProId) initProPortal();
    }
};

/** TABS LOGIC **/
function setupPortalTabs() {
    const tabs = ['dashboard', 'appointments', 'services', 'profile', 'verify', 'schedule'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        const section = document.getElementById(`portal-section-${tab}`);

        if (btn) {
            btn.addEventListener('click', () => {
                // Deactivate all
                tabs.forEach(t => {
                    document.getElementById(`tab-${t}`).className = 'flex-1 py-3 text-sm font-bold text-brand-gray/40 hover:text-brand-pink border-b-2 border-transparent transition-all';
                    document.getElementById(`portal-section-${t}`).classList.add('hidden');
                });

                // Activate clicked
                btn.className = 'flex-1 py-3 text-sm font-bold text-brand-pink border-b-2 border-brand-pink transition-all';
                section.classList.remove('hidden');
            });
        }
    });
}

/** SERVICES LOGIC **/
async function loadProServices() {
    const listContainer = document.getElementById('pro-services-list');
    if (!listContainer || !currentProId) return;

    const { data: services, error } = await window.supabaseClient
        .from('services')
        .select('*')
        .eq('technician_id', currentProId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading services:", error);
        return;
    }

    if (services.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">You haven\'t added any services yet. ✨</p>';
        return;
    }

    listContainer.innerHTML = services.map(service => `
        <div class="flex justify-between items-center p-4 bg-white border border-brand-border rounded-luxury group transition-all hover:bg-brand-pink-soft hover:shadow-2xl">
            <div>
                <h4 class="font-black text-text-main uppercase tracking-widest text-[11px]">${service.title}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[8px] bg-brand-pink-soft text-brand-pink px-2 py-0.5 rounded-luxury font-black uppercase tracking-widest">${service.category || 'Other'}</span>
                    <p class="text-[9px] text-brand-gray/40 font-black uppercase tracking-[0.2em]">${service.duration_minutes} MINS • <span class="text-brand-pink font-black">ZMW ${service.price}</span></p>
                </div>
            </div>
            <div class="flex gap-1">
                <button onclick="editService('${service.id}', '${service.title}', ${service.price}, ${service.duration_minutes}, '${service.category || ''}')" class="p-2 text-brand-gray/40 hover:text-brand-pink hover:bg-brand-pink-soft rounded-luxury transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button onclick="deleteService('${service.id}')" class="p-2 text-brand-gray/40 hover:text-brand-pink hover:bg-brand-pink-soft rounded-luxury transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function setupServiceForm() {
    const addBtn = document.getElementById('add-service-btn');
    const overlay = document.getElementById('service-form-overlay');
    const closeBtn = document.getElementById('close-service-form');
    const form = document.getElementById('service-form');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            document.getElementById('service-form-title').innerText = "Add New Service";
            document.getElementById('service-id').value = "";
            form.reset();
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('service-id').value;
        const title = document.getElementById('service-title').value;
        const price = document.getElementById('service-price').value;
        const duration = document.getElementById('service-duration').value;
        const category = document.getElementById('service-category').value;

        const serviceData = {
            technician_id: currentProId,
            title,
            price: parseFloat(price),
            duration_minutes: parseInt(duration),
            category
        };

        try {
            if (id) {
                // Update
                const { error } = await window.supabaseClient.from('services').update(serviceData).eq('id', id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await window.supabaseClient.from('services').insert([serviceData]);
                if (error) throw error;
            }

            overlay.classList.add('hidden');
            loadProServices();
        } catch (err) {
            console.error("Service sync error:", err);
            alert("Error saving service.");
        }
    });
}

window.editService = (id, title, price, duration, category) => {
    document.getElementById('service-form-title').innerText = "Edit Service";
    document.getElementById('service-id').value = id;
    document.getElementById('service-title').value = title;
    document.getElementById('service-price').value = price;
    document.getElementById('service-duration').value = duration;
    document.getElementById('service-category').value = category || 'nail';

    document.getElementById('service-form-overlay').classList.remove('hidden');
    document.getElementById('service-form-overlay').classList.add('flex');
};

window.deleteService = async (id) => {
    if (!confirm("Remove this service from your menu?")) return;
    const { error } = await window.supabaseClient.from('services').delete().eq('id', id);
    if (!error) loadProServices();
};

/** PROFILE LOGIC **/
async function loadProProfile() {
    if (!currentProId) return;
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('bio, location, whatsapp_number, specialties, is_verified')
        .eq('id', currentProId)
        .single();

    if (profile) {
        document.getElementById('pro-bio').value = profile.bio || '';
        document.getElementById('pro-location').value = profile.location || '';
        document.getElementById('pro-whatsapp').value = profile.whatsapp_number || '';
        document.getElementById('pro-specialties').value = profile.specialties?.join(', ') || '';

        // If verified, show the badge in portal header
        const verifiedBadge = document.getElementById('portal-verified-badge');
        if (verifiedBadge && profile.is_verified) {
            verifiedBadge.classList.remove('hidden');
        }
    }

    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const bio = document.getElementById('pro-bio').value;
        const location = document.getElementById('pro-location').value;
        const whatsapp = document.getElementById('pro-whatsapp').value;
        const specialties = document.getElementById('pro-specialties').value.split(',').map(s => s.trim()).filter(s => s !== '');

        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ bio, location, whatsapp_number: whatsapp, specialties })
            .eq('id', currentProId);

        if (!error) {
            alert("Profile updated successfully! ✨");
        } else {
            alert("Failed to update profile.");
        }
    });
}

/** REVIEWS LOGIC **/
async function loadProReviews() {
    const reviewContainer = document.getElementById('portal-reviews-container');
    if (!reviewContainer || !currentProId) return;

    const { data: reviews } = await window.supabaseClient
        .from('reviews')
        .select(`
            rating, 
            comment, 
            profiles:reviewer_id (full_name)
        `)
        .eq('reviewee_id', currentProId)
        .order('created_at', { ascending: false });

    if (!reviews || reviews.length === 0) {
        reviewContainer.innerHTML = '<p class="text-sm text-gray-400 italic text-center mt-4">No reviews yet.</p>';
        return;
    }

    reviewContainer.innerHTML = reviews.map(rev => `
        <div class="bg-white p-4 rounded-luxury shadow-2xl border border-brand-border">
            <div class="flex justify-between items-center mb-2">
                <span class="font-black text-[10px] text-text-main uppercase tracking-widest">${rev.profiles.full_name}</span>
                <span class="text-brand-pink text-[10px]"> ${'⭐'.repeat(rev.rating)}</span>
            </div>
            <p class="text-[10px] text-brand-gray/40 font-black uppercase tracking-[0.2em] leading-tight">"${rev.comment}"</p>
        </div>
    `).join('');
}

/** SCHEDULE LOGIC **/
async function loadProSchedule() {
    if (!currentProId) return;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grid = document.getElementById('working-hours-grid');
    if (!grid) return;

    const { data: currentHours } = await window.supabaseClient
        .from('working_hours')
        .select('*')
        .eq('technician_id', currentProId);

    grid.innerHTML = days.map((day, index) => {
        const config = currentHours?.find(h => h.day_of_week === index) || { start_time: '09:00', end_time: '17:00' };
        const isActive = !!currentHours?.find(h => h.day_of_week === index);

        return `
            <div class="flex items-center gap-4 p-4 bg-white rounded-luxury border border-brand-border shadow-2xl">
                <div class="flex items-center gap-3 w-32">
                    <input type="checkbox" class="day-active w-5 h-5 text-brand-pink bg-white border-brand-border rounded-luxury focus:ring-brand-pink" data-day="${index}" ${isActive ? 'checked' : ''}>
                    <span class="text-[10px] font-black text-text-main uppercase tracking-widest">${day}</span>
                </div>
                <div class="flex items-center gap-3 flex-1 ${!isActive ? 'opacity-30' : ''}">
                    <input type="time" class="start-time flex-1 px-3 py-2 rounded-luxury bg-brand-pink-soft text-brand-pink font-black text-[10px] uppercase tracking-widest border border-brand-border" value="${config.start_time}" ${!isActive ? 'disabled' : ''}>
                    <span class="text-brand-gray/40">-</span>
                    <input type="time" class="end-time flex-1 px-3 py-2 rounded-luxury bg-brand-pink-soft text-brand-pink font-black text-[10px] uppercase tracking-widest border border-brand-border" value="${config.end_time}" ${!isActive ? 'disabled' : ''}>
                </div>
            </div>
        `;
    }).join('');

    // Toggle day active state
    grid.querySelectorAll('.day-active').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const row = e.target.closest('div').nextElementSibling;
            row.classList.toggle('opacity-30', !e.target.checked);
            row.querySelectorAll('input').forEach(i => i.disabled = !e.target.checked);
        });
    });

    // Save Logic
    document.getElementById('save-working-hours-btn').addEventListener('click', async () => {
        const rows = grid.querySelectorAll('.flex.items-center.gap-4');
        const updates = [];

        rows.forEach(row => {
            const cb = row.querySelector('.day-active');
            if (cb.checked) {
                updates.push({
                    technician_id: currentProId,
                    day_of_week: parseInt(cb.getAttribute('data-day')),
                    start_time: row.querySelector('.start-time').value,
                    end_time: row.querySelector('.end-time').value
                });
            }
        });

        try {
            // Upsert strategy: Delete old, Insert new
            await window.supabaseClient.from('working_hours').delete().eq('technician_id', currentProId);
            const { error } = await window.supabaseClient.from('working_hours').insert(updates);
            if (error) throw error;
            alert("Working hours updated! ✨");
        } catch (err) {
            console.error("Schedule save error:", err);
            alert("Failed to save schedule.");
        }
    });

    loadBlockedSlots();
}

async function loadBlockedSlots() {
    const list = document.getElementById('blocked-slots-list');
    if (!list) return;

    const { data: slots } = await window.supabaseClient
        .from('blocked_slots')
        .select('*')
        .eq('technician_id', currentProId)
        .order('start_time', { ascending: true });

    list.innerHTML = slots?.map(slot => `
        <li class="flex justify-between items-center bg-red-50 p-2 rounded-lg text-xs">
            <span class="text-red-700 font-medium">${new Date(slot.start_time).toLocaleDateString()} - ${new Date(slot.end_time).toLocaleDateString()}</span>
            <button onclick="deleteBlockedSlot('${slot.id}')" class="text-red-400 hover:text-red-600">×</button>
        </li>
    `).join('') || '<p class="text-xs text-gray-400 italic">No dates blocked.</p>';

    // Init Blocked Date Picker
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#blocked-date-picker", {
            mode: "range",
            minDate: "today",
            dateFormat: "Y-m-d"
        });
    }

    document.getElementById('add-blocked-slot-btn').addEventListener('click', async () => {
        const picker = document.getElementById('blocked-date-picker');
        const range = picker.value.split(' to ');
        if (range.length !== 2) return;

        const { error } = await window.supabaseClient.from('blocked_slots').insert([{
            technician_id: currentProId,
            start_time: range[0] + 'T00:00:00Z',
            end_time: range[1] + 'T23:59:59Z',
            reason: 'Manual Block'
        }]);

        if (!error) {
            picker.value = '';
            loadBlockedSlots();
        }
    });
}

window.deleteBlockedSlot = async (id) => {
    await window.supabaseClient.from('blocked_slots').delete().eq('id', id);
    loadBlockedSlots();
};

/** CERTIFICATION UPLOAD LOGIC **/
function setupCertUpload() {
    const certUpload = document.getElementById('cert-upload');
    if (!certUpload) return;

    certUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentProId) return;

        const uploadLabel = certUpload.previousElementSibling;
        const originalText = uploadLabel.innerText;
        uploadLabel.innerText = "Uploading...";

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentProId}/${Date.now()}.${fileExt}`;
            const filePath = `certificates/${fileName}`;

            // Check bucket name - 'certifications' is the new standard
            const { error: uploadError } = await window.supabaseClient.storage
                .from('certifications')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = window.supabaseClient.storage
                .from('certifications')
                .getPublicUrl(filePath);

            // Record in DB
            await window.supabaseClient.from('certifications').insert([{
                technician_id: currentProId,
                title: file.name,
                file_url: urlData.publicUrl
            }]);

            alert("Certification uploaded! Admin will verify it shortly. 🛡️");
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload document.");
        } finally {
            uploadLabel.innerText = originalText;
        }
    });
}
/** STATS LOGIC **/
async function loadProStats() {
    const earningsEl = document.getElementById('portal-stat-earnings');
    const vibesEl = document.getElementById('portal-stat-vibes');
    if (!currentProId) return;

    // Show skeletons
    if (earningsEl) earningsEl.innerHTML = '<div class="h-8 w-24 skeleton rounded-md"></div>';
    if (vibesEl) vibesEl.innerHTML = '<div class="h-8 w-12 skeleton rounded-md"></div>';
    const pointsEl = document.getElementById('portal-stat-points');
    const levelEl = document.getElementById('portal-stat-level');
    if (pointsEl) pointsEl.innerHTML = '<div class="h-8 w-12 skeleton rounded-md"></div>';
    if (levelEl) levelEl.innerHTML = '<div class="h-6 w-20 skeleton rounded-md"></div>';

    try {
        // 1. Fetch Earnings (Sum of confirmed appointments)
        const { data: appts } = await window.supabaseClient
            .from('appointments')
            .select('total_price')
            .eq('technician_id', currentProId)
            .eq('status', 'confirmed');

        const totalEarnings = appts?.reduce((sum, a) => sum + (parseFloat(a.total_price) || 0), 0) || 0;
        if (earningsEl) earningsEl.innerText = `ZMW ${totalEarnings.toLocaleString()}`;

        // 2. Fetch Loyalty Points
        const { data: loyalty } = await window.supabaseClient
            .from('loyalty_profiles')
            .select('points, tier')
            .eq('user_id', currentProId)
            .single();

        const pointsEl = document.getElementById('portal-stat-points');
        const levelEl = document.getElementById('portal-stat-level');
        if (pointsEl) pointsEl.innerText = (loyalty?.points || 0).toLocaleString();
        if (levelEl) {
            levelEl.innerText = loyalty?.tier || 'Bronze';
            levelEl.className = `text-lg font-black uppercase tracking-tighter text-brand-pink`;
        }

        // 3. Fetch Vibes (From profile)
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('post_vibes')
            .eq('id', currentProId)
            .single();

        if (vibesEl) vibesEl.innerText = (profile?.post_vibes || 0).toLocaleString();

        // 4. Render Growth Chart
        if (typeof renderGrowthChart === 'function') renderGrowthChart(currentProId);

        // 5. Load Achievements
        if (typeof loadAchievements === 'function') loadAchievements(currentProId, profile?.post_vibes || 0);

    } catch (err) {
        console.error("Stats load fail:", err);
    }
}

/** APPOINTMENTS LOGIC **/
async function loadProAppointments(filterStatus = 'pending') {
    const list = document.getElementById('portal-appointments-list');
    if (!list || !currentProId) return;

    list.innerHTML = '<div class="py-12 text-center"><div class="animate-spin h-6 w-6 border-2 border-brand-pink border-t-transparent rounded-full mx-auto mb-2"></div><p class="text-[10px] text-brand-gray/40 font-black uppercase tracking-widest">Fetching bookings...</p></div>';

    const { data: appts, error } = await window.supabaseClient
        .from('appointments')
        .select(`
            id,
            start_time,
            status,
            total_price,
            profiles:client_id (full_name),
            services:service_id (title)
        `)
        .eq('technician_id', currentProId)
        .eq('status', filterStatus)
        .order('start_time', { ascending: true });

    if (error) {
        list.innerHTML = `<p class="text-center text-red-400 text-xs py-8">Error: ${error.message}</p>`;
        return;
    }

    if (!appts || appts.length === 0) {
        list.innerHTML = `<div class="py-12 text-center glass rounded-luxury border border-brand-border">
            <p class="text-brand-gray/40 text-[10px] font-black uppercase tracking-widest italic mb-2">No ${filterStatus} bookings found.</p>
            ${filterStatus === 'pending' ? '<p class="text-[9px] text-brand-pink font-black uppercase tracking-widest">Share your profile to get more bookings! ✨</p>' : ''}
        </div>`;
        return;
    }

    list.innerHTML = appts.map(a => `
        <div class="glass p-6 rounded-luxury border border-brand-border shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-brand-pink transition-all">
            <div class="flex items-center gap-6">
                <div class="w-14 h-14 rounded-luxury bg-brand-pink-soft flex flex-col items-center justify-center text-brand-pink border border-brand-border">
                    <span class="text-[9px] font-black uppercase tracking-widest">${new Date(a.start_time).toLocaleString('en-US', { month: 'short' })}</span>
                    <span class="text-xl font-black leading-none">${new Date(a.start_time).getDate()}</span>
                </div>
                <div>
                    <h4 class="font-black text-text-main uppercase tracking-widest text-[11px]">${a.profiles.full_name}</h4>
                    <p class="text-[9px] text-brand-gray/40 font-black uppercase tracking-[0.2em] mt-1">${a.services.title} • <span class="text-brand-pink font-black">ZMW ${a.total_price}</span></p>
                    <p class="text-[8px] text-brand-gray/20 font-black uppercase tracking-widest mt-1">⏰ ${new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            
            <div class="flex gap-2 w-full md:w-auto">
                ${a.status === 'pending' ? `
                    <button onclick="updateAppointmentStatus('${a.id}', 'confirmed')" class="flex-1 md:flex-none btn-pink px-6 py-2">Confirm</button>
                    <button onclick="updateAppointmentStatus('${a.id}', 'cancelled')" class="flex-1 md:flex-none bg-white text-brand-gray/40 px-6 py-2 rounded-luxury text-[9px] font-black uppercase tracking-widest border border-brand-border hover:bg-brand-pink-soft active:scale-95 transition-all">Reject</button>
                ` : a.status === 'confirmed' ? `
                    <button onclick="updateAppointmentStatus('${a.id}', 'completed')" class="flex-1 md:flex-none btn-pink px-6 py-2">Mark Complete</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.updateAppointmentStatus = async (id, newStatus) => {
    const { error } = await window.supabaseClient
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        alert("Error updating appointment: " + error.message);
    } else {
        if (newStatus === 'completed' && typeof confetti === 'function') {
            confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#ec4899', '#ffffff', '#fbcfe8']
            });
        }
        loadProAppointments(newStatus === 'confirmed' ? 'pending' : (newStatus === 'completed' ? 'confirmed' : 'pending'));
        loadProStats(); // Refresh earnings
    }
};

window.loadProAppointments = loadProAppointments;

/** ANALYTICS & CHARTS **/
async function renderGrowthChart(proId) {
    const container = document.getElementById('growth-chart-container');
    if (!container) return;

    // Fetch last 7 days of completed appointments
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const { data: stats } = await window.supabaseClient
        .from('appointments')
        .select('start_time, total_price')
        .eq('technician_id', proId)
        .eq('status', 'completed')
        .gte('start_time', lastWeek.toISOString());

    // Aggregate by day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyData = new Array(7).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { label: days[d.getDay()], value: 0 };
    });

    stats?.forEach(s => {
        const dayLabel = days[new Date(s.start_time).getDay()];
        const entry = dailyData.find(d => d.label === dayLabel);
        if (entry) entry.value += parseFloat(s.total_price);
    });

    const maxVal = Math.max(...dailyData.map(d => d.value), 100);

    // Simple SVG Sparkline / Bar Chart
    const svgWidth = 400;
    const svgHeight = 120;
    const barWidth = 40;
    const gap = 15;

    container.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full h-full drop-shadow-sm overflow-visible">
            ${dailyData.map((d, i) => {
        const h = (d.value / maxVal) * (svgHeight - 20);
        const x = i * (barWidth + gap) + 10;
        const y = svgHeight - h - 20;
        return `
                    <g class="chart-group cursor-pointer group" onmouseover="showChartTooltip(evt, '${d.label}: ZMW ${d.value}')" onmouseout="hideChartTooltip()">
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="url(#chartGradient)" class="transition-all duration-300 hover:opacity-80">
                            <animate attributeName="height" from="0" to="${h}" dur="1s" fill="freeze" />
                            <animate attributeName="y" from="${svgHeight - 20}" to="${y}" dur="1s" fill="freeze" />
                        </rect>
                        <text x="${x + barWidth / 2}" y="${svgHeight - 4}" text-anchor="middle" class="text-[10px] fill-gray-400 font-bold">${d.label}</text>
                        ${d.value > 0 ? `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" class="text-[8px] fill-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">K${d.value}</text>` : ''}
                    </g>
                `;
    }).join('')}
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ec4899" />
                    <stop offset="100%" stop-color="#f472b6" />
                </linearGradient>
            </defs>
            <g id="chart-tooltip" visibility="hidden">
                <rect width="80" height="30" rx="4" fill="black" opacity="0.8" />
                <text x="40" y="20" font-family="sans-serif" font-size="10" fill="white" text-anchor="middle" id="tooltip-text"></text>
            </g>
        </svg>
    `;
}

window.showChartTooltip = (evt, text) => {
    const tooltip = document.getElementById('chart-tooltip');
    const tooltipText = document.getElementById('tooltip-text');
    if (!tooltip || !tooltipText) return;

    tooltipText.textContent = text;
    const CTM = evt.target.getScreenCTM();
    const x = (evt.clientX - CTM.e) / CTM.a;
    const y = (evt.clientY - CTM.f) / CTM.d;

    tooltip.setAttributeNS(null, "transform", `translate(${x - 40}, ${y - 40})`);
    tooltip.setAttributeNS(null, "visibility", "visible");
};

window.hideChartTooltip = () => {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) tooltip.setAttributeNS(null, "visibility", "hidden");
};

async function loadAchievements(proId, vibes) {
    const list = document.getElementById('portal-achievements-list');
    if (!list) return;

    // Logic: 
    // - Rising Star: >= 1 completed booking
    // - Fast Responder: Completed within 24h? (Hard to track now, so let's say 5+ bookings)
    // - Vibes Guru: >= 10 vibes

    const { count: completedCount } = await window.supabaseClient
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('technician_id', proId)
        .eq('status', 'completed');

    const achievements = [
        { id: 'rising', icon: '⭐', label: 'Rising Star', unlocked: completedCount >= 1 },
        { id: 'fast', icon: '⚡', label: 'Pro Hustler', unlocked: completedCount >= 5 },
        { id: 'guru', icon: '🔥', label: 'Vibes Guru', unlocked: vibes >= 10 },
        { id: 'certified', icon: '🛡️', label: 'Secured', unlocked: true } // Static for now as all pros entering here are at least partially verified
    ];

    list.innerHTML = achievements.map(a => `
        <div class="flex-none w-24 text-center ${a.unlocked ? 'opacity-100' : 'opacity-30 grayscale'} transition-all duration-700">
            <div class="w-14 h-14 rounded-luxury ${a.unlocked ? 'bg-brand-pink-soft text-brand-pink border border-brand-pink' : 'bg-white text-brand-gray/40 border border-brand-border'} mx-auto mb-3 flex items-center justify-center text-2xl shadow-2xl">
                ${a.icon}
            </div>
            <p class="text-[8px] font-black ${a.unlocked ? 'text-text-main' : 'text-brand-gray/40'} uppercase tracking-widest">${a.label}</p>
        </div>
    `).join('');
}
