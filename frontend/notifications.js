window.Notifications = {
    init() {
        if (!window.supabaseClient) return;

        console.log("🔔 Initializing Real-time Notifications...");
        this.setupRealtimeListener();
        this.loadExisting();
        this.setupDropdownToggle();
    },

    async setupRealtimeListener() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        window.supabaseClient
            .channel('realtime-notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload) => {
                    console.log("New Notification received:", payload.new);
                    this.showToast(payload.new);
                    this.loadExisting(); // Refresh list and badge
                }
            )
            .subscribe();
    },

    async loadExisting() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        const { data: notifications, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error("Error loading notifications:", error);
            return;
        }

        this.renderList(notifications);
        const unreadCount = notifications.filter(n => !n.is_read).length;
        this.updateBadge(unreadCount > 0, unreadCount);
    },

    renderList(notifications) {
        const list = document.getElementById('notif-list');
        if (!list) return;

        if (!notifications || notifications.length === 0) {
            list.innerHTML = '<div class="p-8 text-center text-gray-400 text-xs italic">No notifications yet. ✨</div>';
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="px-6 py-5 border-b border-brand-border hover:bg-brand-pink-soft transition-all cursor-pointer group ${n.is_read ? 'opacity-40' : 'bg-white'}" 
                 onclick="window.Notifications.markAsRead('${n.id}', '${n.link}')">
                <div class="flex gap-4">
                    <div class="bg-brand-pink-soft p-2.5 rounded-luxury text-brand-pink h-fit border border-brand-border">
                        ${this.getTypeIcon(n.type)}
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h4 class="font-bold text-xs text-gray-900">${n.title}</h4>
                            <span class="text-[9px] text-gray-400">${new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <p class="text-[11px] text-gray-600 mt-1 line-clamp-2">${n.content}</p>
                    </div>
                </div>
            </div>
        `).join('');
    },

    getTypeIcon(type) {
        switch (type) {
            case 'booking': return '📅';
            case 'payment': return '💰';
            case 'review': return '⭐';
            default: return '🔔';
        }
    },

    setupDropdownToggle() {
        const btn = document.getElementById('notif-bell-btn');
        const dropdown = document.getElementById('notif-dropdown');
        const markAllBtn = document.getElementById('mark-all-read');

        if (btn && dropdown) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                if (!dropdown.classList.contains('hidden')) {
                    this.loadExisting();
                }
            });

            // Close when clicking outside
            document.addEventListener('click', () => dropdown.classList.add('hidden'));
            dropdown.addEventListener('click', (e) => e.stopPropagation());
        }

        if (markAllBtn) {
            markAllBtn.addEventListener('click', async () => {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (!session) return;

                await window.supabaseClient
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', session.user.id);

                this.loadExisting();
            });
        }
    },

    async markAsRead(id, link) {
        await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (link) {
            if (link.startsWith('/')) {
                // Internal routing mock
                if (link === '/#bookings') {
                    document.getElementById('my-bookings-btn')?.click();
                } else if (link === '/#portal') {
                    window.openProPortal?.();
                }
            } else {
                window.location.href = link;
            }
        } else {
            this.loadExisting();
        }
    },

    showToast(notif) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-10 right-10 z-[200] glass p-6 rounded-luxury border border-brand-border border-l-brand-pink border-l-4 shadow-2xl animate-fade-in-up max-w-sm cursor-pointer';
        toast.onclick = () => {
            this.markAsRead(notif.id, notif.link);
            toast.remove();
        };
        toast.innerHTML = `
            <div class="flex gap-4">
                <div class="bg-brand-pink-soft p-2.5 rounded-luxury h-fit text-brand-pink border border-brand-border">${this.getTypeIcon(notif.type)}</div>
                <div class="flex-1">
                    <h4 class="font-black text-[11px] text-text-main uppercase tracking-widest">${notif.title}</h4>
                    <p class="text-[10px] text-brand-gray/40 font-black uppercase tracking-widest mt-1 line-clamp-2">${notif.content}</p>
                    <p class="text-[8px] text-brand-pink font-black uppercase tracking-[0.3em] mt-3">Synchronize &rarr;</p>
                </div>
                <button onclick="event.stopPropagation(); this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600 self-start">×</button>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 6000);
    },

    updateBadge(show, count = 0) {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;

        if (show && count > 0) {
            badge.classList.remove('hidden');
            badge.innerText = count > 9 ? '9+' : count;
        } else {
            badge.classList.add('hidden');
        }
    },

    /** Trigger Helpers **/
    async sendInAppNotification(userId, title, content, type = 'booking', link = '') {
        try {
            const { error } = await window.supabaseClient.from('notifications').insert([{
                user_id: userId,
                title,
                content,
                type,
                link,
                is_read: false
            }]);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to send in-app notification:", err);
        }
    },

    async triggerWhatsAppBooking(bookingDetails) {
        console.log("Triggering WhatsApp Confirmation for:", bookingDetails.clientPhone);

        // This would typically call a Supabase Edge Function that uses Twilio/WhatsApp API
        try {
            const { data, error } = await window.supabaseClient.functions.invoke('trigger-whatsapp', {
                body: bookingDetails
            });

            if (error) throw error;
            console.log("WhatsApp trigger successful:", data);
        } catch (err) {
            console.warn("WhatsApp trigger failed (Edge function might be missing):", err.message);
            // Fallback: we could open a wa.me link directly for the user if needed, 
            // but for "automated" it should be server-side.
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.Notifications.init();
});
