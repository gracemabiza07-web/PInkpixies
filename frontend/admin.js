/**
 * Phase 8: admin.js
 * 
 * Logic for the Admin Dashboard.
 * Handles technician verification and platform-wide analytics.
 */

window.AdminPortal = {
    async init() {
        if (!window.supabaseClient) return;

        const session = await window.supabaseClient.auth.getSession();
        if (!session?.data?.session) return;

        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.data.session.user.id)
            .single();

        if (profile?.role !== 'admin') {
            console.log("🚫 Admin access denied.");
            return;
        }

        console.log("🛠️ Admin Dashboard Initializing...");
        this.loadStats();
        this.loadPendingVerifications();
    },

    async loadStats() {
        // Fetch total transactions and commission
        const { data: txs } = await window.supabaseClient
            .from('transactions')
            .select('amount, platform_fee');

        if (txs) {
            const totalVolume = txs.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const totalRevenue = txs.reduce((sum, t) => sum + parseFloat(t.platform_fee), 0);

            document.getElementById('admin-total-volume').innerText = `ZMW ${totalVolume.toFixed(2)}`;
            document.getElementById('admin-platform-revenue').innerText = `ZMW ${totalRevenue.toFixed(2)}`;
        }
    },

    async loadPendingVerifications() {
        // Fetch technicians and their certifications
        const { data: pending } = await window.supabaseClient
            .from('profiles')
            .select(`
                *,
                certifications(*)
            `)
            .eq('role', 'technician')
            .eq('is_verified', false);

        const container = document.getElementById('pending-verifications-list');
        if (!container) return;

        container.innerHTML = '';
        if (!pending || pending.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 text-sm py-8 italic">All clear! No technicians awaiting verification.</p>';
            return;
        }

        pending.forEach(pro => {
            const certsHtml = pro.certifications && pro.certifications.length > 0
                ? pro.certifications.map(c => `<a href="${c.file_url}" target="_blank" class="text-[10px] text-brand-pink border border-brand-pink/20 bg-brand-pink-soft px-3 py-1 rounded-luxury hover:bg-brand-pink hover:text-white transition-all block mt-2 font-black uppercase tracking-widest text-center">📄 ${c.title || 'Certification'}</a>`).join('')
                : '<p class="text-[10px] text-brand-gray/20 mt-2 italic font-black uppercase tracking-widest">No documents uploaded</p>';

            container.innerHTML += `
                <div class="bg-white p-8 rounded-luxury border border-brand-border flex justify-between items-center group hover:shadow-2xl transition-all">
                    <div>
                        <h4 class="font-bold text-gray-900">${pro.full_name}</h4>
                        <p class="text-xs text-gray-500 mt-1">${pro.location || 'Location not set'}</p>
                        <div class="mt-4 border-t border-brand-border pt-4">
                            <span class="text-[9px] font-black text-brand-gray/20 uppercase tracking-widest">Credentials:</span>
                            ${certsHtml}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.AdminPortal.verifyPro('${pro.id}', true)" 
                                class="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-600 transition-all">
                            Approve
                        </button>
                        <button onclick="window.AdminPortal.verifyPro('${pro.id}', false)" 
                                class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                            Reject
                        </button>
                    </div>
                </div>
            `;
        });
    },

    async verifyPro(proId, approved) {
        if (!confirm(`Are you sure you want to ${approved ? 'APPROVE' : 'REJECT'} this technician?`)) return;

        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ is_verified: approved })
            .eq('id', proId);

        if (error) {
            alert("Error updating verification: " + error.message);
        } else {
            alert("Technician " + (approved ? "Approved" : "Rejected") + " successfully.");
            this.loadPendingVerifications();
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.AdminPortal.init();
});
