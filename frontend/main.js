document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Referral Detection ---
    const initReferralDetection = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            const referralInfo = document.getElementById('referral-info');
            const referredById = document.getElementById('referred-by-id');
            if (referralInfo && referredById) {
                referralInfo.classList.remove('hidden');
                referredById.value = refId;
                // Auto-open auth modal for referred users after a slight delay
                setTimeout(() => {
                    const authModal = document.getElementById('auth-modal');
                    if (authModal && authModal.classList.contains('hidden')) {
                        // isSignUp is defined later in the scope, but openAuthModal is available
                        const initialSignupBtn = document.getElementById('initial-signup-btn');
                        if (initialSignupBtn) initialSignupBtn.click();
                    }
                }, 1500);
            }
        }
    };
    initReferralDetection();

    // --- Category Filtering UI ---
    document.querySelectorAll('.category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.category-pill').forEach(p => {
                p.classList.remove('active', 'bg-brand-pink', 'text-white', 'shadow-[0_0_20px_rgba(236,72,153,0.3)]');
                p.classList.add('bg-white', 'text-brand-gray/40', 'border', 'border-brand-border');
            });
            pill.classList.add('active', 'bg-brand-pink', 'text-white', 'shadow-[0_0_20px_rgba(236,72,153,0.3)]');
            pill.classList.remove('bg-white', 'text-brand-gray/40', 'border', 'border-brand-border');

            const category = pill.getAttribute('data-category');
            if (window.refreshProfessionals) window.refreshProfessionals(category);
        });
    });

    // --- Chat & Booking Logic ---
    const chatModal = document.getElementById('chat-modal');
    const closeChatBtn = document.getElementById('close-chat');

    // Consistently handle modal tab switching
    const switchModalTab = (target) => {
        const tabChat = document.getElementById('tab-chat');
        const tabBook = document.getElementById('tab-book');
        const chatArea = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input-area');
        const bookingArea = document.getElementById('booking-area');

        if (target === 'chat') {
            tabChat?.classList.add('border-brand-pink', 'text-text-main');
            tabChat?.classList.remove('border-transparent', 'text-brand-gray/40');
            tabBook?.classList.add('border-transparent', 'text-brand-gray/40');
            tabBook?.classList.remove('border-brand-pink', 'text-text-main');
            chatArea?.classList.remove('hidden');
            chatInput?.classList.remove('hidden');
            bookingArea?.classList.add('hidden');
        } else {
            tabBook?.classList.add('border-brand-pink', 'text-text-main');
            tabBook?.classList.remove('border-transparent', 'text-brand-gray/40');
            tabChat?.classList.add('border-transparent', 'text-brand-gray/40');
            tabChat?.classList.remove('border-brand-pink', 'text-text-main');
            chatArea?.classList.add('hidden');
            chatInput?.classList.add('hidden');
            bookingArea?.classList.remove('hidden');
            bookingArea?.classList.add('flex');

            // Initialize Scheduling if needed
            const currentProId = document.getElementById('confirm-booking-btn')?.getAttribute('data-pro-id');
            if (currentProId && window.Scheduling) {
                window.Scheduling.initAvailabilityPicker("#appointment-datetime", currentProId);
            }
        }
    };

    document.getElementById('tab-chat')?.addEventListener('click', () => switchModalTab('chat'));
    document.getElementById('tab-book')?.addEventListener('click', () => switchModalTab('book'));

    const openChatModal = async (proName, proId = null) => {
        // Require login to book
        const session = await window.supabaseClient?.auth.getSession();
        if (!session?.data?.session) {
            alert("Please log in or sign up to book an appointment with " + proName);
            if (window.openAuthModal) window.openAuthModal();
            return;
        }

        const clientId = session.data.session.user.id;
        const proNameEl = document.getElementById('chat-pro-name');
        if (proNameEl) proNameEl.innerText = proName;

        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            chatModal.classList.remove('hidden');
            chatModal.classList.add('flex');
            document.body.style.overflow = 'hidden';

            // Show chat tab by default
            document.getElementById('tab-chat')?.click();

            // Set pro details in booking area too
            const confirmBtn = document.getElementById('confirm-booking-btn');
            if (confirmBtn) {
                confirmBtn.setAttribute('data-pro-id', proId);
                confirmBtn.setAttribute('data-client-id', clientId);
            }

            // Sync with Professional's Menu
            if (proId) {
                loadBookingServices(proId);
                // Sync with Flatpickr for availability
                if (window.initBookingCalendar) {
                    window.initBookingCalendar(proId);
                }
            }
        }

        // Reset sidebar tabs using the helper
        switchModalTab('chat');

        try {
            let actualProId = proId;
            if (!actualProId) {
                const { data: pros } = await window.supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('full_name', proName)
                    .limit(1);

                if (pros && pros.length > 0) actualProId = pros[0].id;
            }

            if (actualProId) {
                // Store IDs for booking
                const confirmBtn = document.getElementById('confirm-booking-btn');
                if (confirmBtn) {
                    confirmBtn.setAttribute('data-pro-id', actualProId);
                    confirmBtn.setAttribute('data-client-id', clientId);
                }

                // Fetch and render services for this pro
                loadBookingServices(actualProId);

                // Fetch Pro details for fallback comms
                const { data: proProfile } = await window.supabaseClient
                    .from('profiles')
                    .select('whatsapp_number, phone_number, avatar_url')
                    .eq('id', actualProId)
                    .single();

                if (proProfile) {
                    const avatarImg = document.getElementById('chat-pro-avatar');
                    if (avatarImg && proProfile.avatar_url) avatarImg.src = proProfile.avatar_url;

                    const waNum = proProfile.whatsapp_number || '260971234567';
                    const phNum = proProfile.phone_number || '260971234567';

                    document.getElementById('btn-call').href = `tel:${phNum}`;
                    document.getElementById('btn-whatsapp').href = `https://wa.me/${waNum.replace(/\+/g, '')}`;
                    document.getElementById('btn-call-mobile').href = `tel:${phNum}`;
                    document.getElementById('btn-whatsapp-mobile').href = `https://wa.me/${waNum.replace(/\+/g, '')}`;
                }

                // Setup Realtime Chat Subscription
                if (window.setupRealtimeChat) window.setupRealtimeChat(clientId, actualProId);

                // Initialize Scheduling (Date Picker)
                if (window.Scheduling) {
                    window.Scheduling.initAvailabilityPicker('#appointment-datetime', actualProId);
                }
            }
        } catch (err) {
            console.error("Error setting up chat/booking modal:", err);
        }
    };

    // --- Toast System ---
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        const colorClass = type === 'success' ? 'bg-white text-text-main' : 'bg-brand-pink text-white';
        toast.className = `fixed bottom-12 right-12 z-[200] ${colorClass} px-10 py-5 rounded-luxury shadow-2xl flex items-center gap-6 transform translate-y-32 opacity-0 transition-all duration-700 font-black uppercase text-[10px] tracking-[0.3em] border border-brand-border`;

        toast.innerHTML = `
            <span class="text-lg">${type === 'success' ? '✧' : '✦'}</span>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Animate In
        setTimeout(() => {
            toast.classList.remove('translate-y-20', 'opacity-0');
        }, 100);

        // Fade Out
        setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    };

    window.showToast = showToast;

    // --- Dynamic Card Rendering ---
    const renderProCard = (pro) => {
        const avgRating = (4.5 + Math.random() * 0.5).toFixed(1);
        return `
            <div class="pro-card glass rounded-luxury overflow-hidden border border-brand-border group flex flex-col p-3 shadow-2xl relative">
                <div class="absolute inset-0 bg-brand-pink opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"></div>
                <div class="h-80 overflow-hidden relative rounded-luxury">
                    <img src="${pro.avatar_url || 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&w=800&q=80'}" 
                         class="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" />
                    <div class="absolute top-6 right-6 bg-white/40 backdrop-blur-md px-4 py-2 rounded-luxury text-[9px] font-black text-brand-pink flex items-center gap-2 border border-brand-border">
                        ⭐ ${avgRating}
                    </div>
                </div>
                <div class="p-8 flex-1 flex flex-col relative z-10">
                    <div class="flex justify-between items-start mb-6">
                        <h3 class="text-2xl font-black text-text-main uppercase tracking-tighter group-hover:text-brand-pink transition-colors">${pro.full_name}</h3>
                        <span class="text-[8px] font-black border border-brand-border text-brand-gray/40 px-3 py-1 rounded-luxury uppercase tracking-widest">${pro.category || 'Tech'}</span>
                    </div>
                    <p class="text-brand-gray/40 text-[10px] mb-10 line-clamp-2 leading-relaxed font-bold uppercase tracking-widest">${pro.bio || 'Professional beauty technician ready to make you glow.'}</p>
                    <div class="mt-auto flex justify-between items-center pt-8 border-t border-brand-border">
                        <div>
                            <p class="text-[8px] font-black text-brand-gray/20 uppercase tracking-[0.4em] mb-2">Valuation</p>
                            <p class="text-xl font-black text-text-main tracking-tighter">ZMW 350</p>
                        </div>
                        <button class="view-profile-btn bg-brand-pink text-white px-10 py-4 rounded-luxury text-[9px] font-black uppercase tracking-[0.4em] hover:bg-brand-pink/90 transition-all shadow-2xl" data-pro="${pro.full_name}" data-id="${pro.id}">Initialize</button>
                    </div>
                </div>
            </div>`;
    };

    const attachViewProfileListeners = () => {
        document.querySelectorAll('.view-profile-btn').forEach(btn => {
            btn.onclick = () => {
                const name = btn.getAttribute('data-pro');
                const id = btn.getAttribute('data-id');
                openChatModal(name, id);
            };
        });
    };

    // --- Search & Refresh ---
    const refreshProfessionals = async (category = 'all', query = '') => {
        const container = document.getElementById('featured-pros-container');
        if (!container) return;

        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-gray-400">
                <span class="animate-spin inline-block mr-2">✨</span> Loading professionals...
            </div>`;

        try {
            let supabaseQuery = window.supabaseClient.from('profiles').select('*').eq('role', 'technician');

            if (category !== 'all') {
                supabaseQuery = supabaseQuery.eq('category', category);
            }

            if (query) {
                supabaseQuery = supabaseQuery.ilike('full_name', `%${query}%`);
            }

            const { data: pros, error } = await supabaseQuery.limit(9);

            if (error) throw error;

            container.innerHTML = '';
            if (!pros || pros.length === 0) {
                container.innerHTML = '<div class="col-span-full py-12 text-center text-brand-gray/40 italic">No artists found in this category. Try another one! 💖</div>';
                return;
            }

            pros.forEach(pro => {
                container.innerHTML += renderProCard(pro);
            });

            attachViewProfileListeners();

        } catch (err) {
            console.error("Refresh failed:", err);
            showToast("Failed to load artists. Please check your connection.", "error");
        }
    };


    const loadBookingServices = async (proId) => {
        const list = document.getElementById('booking-services-list');
        if (!list) return;

        try {
            const { data: services, error } = await window.supabaseClient
                .from('services')
                .select('*')
                .eq('technician_id', proId);

            if (error) throw error;

            if (!services || services.length === 0) {
                list.innerHTML = `<p class="text-sm text-gray-500 italic py-2">No services listed yet.</p>`;
                return;
            }

            list.innerHTML = services.map(s => `
                <label class="flex items-center p-6 border border-brand-border rounded-luxury hover:bg-brand-pink-soft cursor-pointer transition-all group mb-4">
                    <input type="checkbox" class="service-checkbox w-6 h-6 text-brand-pink bg-white border-brand-border rounded-luxury focus:ring-brand-pink" 
                        value="${s.id}" data-price="${s.price}" data-title="${s.title}">
                    <div class="ml-6 flex-1">
                        <p class="text-[11px] font-black text-text-main uppercase tracking-widest">${s.title}</p>
                        <p class="text-[9px] text-brand-gray/40 font-black uppercase tracking-[0.3em] mt-1">${s.duration_minutes} MINS</p>
                    </div>
                    <span class="text-[10px] font-black text-text-main bg-brand-pink-soft px-4 py-2 rounded-luxury group-hover:bg-brand-pink group-hover:text-white transition-all">ZMW ${s.price}</span>
                </label>
            `).join('');

            // Attach listeners to update total
            list.querySelectorAll('.service-checkbox').forEach(cb => {
                cb.addEventListener('change', updateBookingTotal);
            });
            updateBookingTotal();

        } catch (err) {
            console.error("Failed to load booking services:", err);
            list.innerHTML = `<p class="text-sm text-red-400">Error loading menu.</p>`;
        }
    }

    const updateBookingTotal = () => {
        const checkboxes = document.querySelectorAll('.service-checkbox:checked');
        const totalEl = document.getElementById('booking-total');
        if (!totalEl) return;

        let total = 0;
        checkboxes.forEach(cb => {
            total += parseFloat(cb.dataset.price) || 0;
        });

        totalEl.innerText = `ZMW ${total.toLocaleString()}`;
    }

    window.openChatModal = openChatModal;


    let currentChatChannel = null;

    const setupRealtimeChat = (clientId, proId) => {
        const chatMessages = document.getElementById('chat-messages');
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const supabase = window.supabaseClient;

        // Clear previous messages except the first system message
        Array.from(chatMessages.children).forEach((child, index) => {
            if (index > 0) child.remove();
        });

        // 1. Fetch existing messages between these two users (Normally you'd filter by appointment_id too)
        const fetchMessages = async () => {
            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${clientId},receiver_id.eq.${proId}),and(sender_id.eq.${proId},receiver_id.eq.${clientId})`)
                .order('created_at', { ascending: true })
                .limit(50);

            if (messages) {
                messages.forEach(msg => appendMessage(msg, clientId));
            }
        };

        fetchMessages();

        // 2. Subscribe to new messages
        if (currentChatChannel) {
            supabase.removeChannel(currentChatChannel);
        }

        currentChatChannel = supabase.channel('custom-chat-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    // Only append if it belongs to this conversation
                    const msg = payload.new;
                    if (
                        (msg.sender_id === clientId && msg.receiver_id === proId) ||
                        (msg.sender_id === proId && msg.receiver_id === clientId)
                    ) {
                        appendMessage(msg, clientId);
                    }
                }
            )
            .subscribe();

        // 3. Handle Sending Messages
        // Clone and replace form to remove old event listeners if modal is opened multiple times
        const newForm = chatForm.cloneNode(true);
        chatForm.parentNode.replaceChild(newForm, chatForm);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content) return;

            input.value = ''; // clear immediately for UX

            try {
                const { error } = await supabase.from('messages').insert([{
                    sender_id: clientId,
                    receiver_id: proId,
                    content: content
                }]);

                if (error) throw error;
            } catch (err) {
                console.error("Error sending message:", err);
                alert("Failed to send message.");
            }
        });
    };

    // --- Hero Search Integration ---
    const heroBtn = document.getElementById('hero-search-btn');
    const heroInput = document.getElementById('hero-search');
    if (heroBtn && heroInput) {
        heroBtn.addEventListener('click', () => {
            const query = heroInput.value.trim();
            if (!query) {
                showToast("Please enter a search term! ✨", "error");
                return;
            }
            refreshProfessionals('all', query);
            document.getElementById('professionals').scrollIntoView({ behavior: 'smooth' });
            showToast(`Searching for "${query}"...`, "success");
        });

        heroInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') heroBtn.click();
        });
    }

    const appendMessage = (msg, currentUserId) => {
        const chatMessages = document.getElementById('chat-messages');
        const isMine = msg.sender_id === currentUserId;

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex w-full ${isMine ? 'justify-end' : 'justify-start'}`;

        msgDiv.innerHTML = `
            <div class="max-w-[75%] rounded-luxury px-6 py-4 text-[10px] font-black uppercase tracking-widest shadow-2xl ${isMine
                ? 'bg-brand-pink text-white shadow-[0_0_30px_rgba(236,72,153,0.3)]'
                : 'bg-white border border-brand-border text-text-main'
            }">
                ${msg.content}
            </div>
        `;

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const closeChatWindow = () => {
        chatModal.classList.add('hidden');
        chatModal.classList.remove('flex');
        document.body.style.overflow = '';
    };

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', closeChatWindow);
    }

    // Note: Tab logic consolidated above in switchModalTab helper.

    // --- Add to Cart Price Calculator ---
    const serviceCheckboxes = document.querySelectorAll('.service-checkbox');
    const bookingTotalDisplay = document.getElementById('booking-total');

    function calculateTotal() {
        let total = 0;
        serviceCheckboxes.forEach(box => {
            if (box.checked) {
                total += parseFloat(box.getAttribute('data-price') || 0);
            }
        });

        // If pricing.js is available and currency is converted globally, format it.
        // For now, basic fallback:
        const currentCurrencyDisplay = window.currentCurrency || 'ZMW';
        bookingTotalDisplay.innerText = `${currentCurrencyDisplay} ${total.toFixed(2)}`;
    }

    serviceCheckboxes.forEach(box => {
        box.addEventListener('change', calculateTotal);
    });

    // Confirm Booking Action
    const confirmBookingBtn = document.getElementById('confirm-booking-btn');
    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', async () => {
            const proId = confirmBookingBtn.getAttribute('data-pro-id');
            const clientId = confirmBookingBtn.getAttribute('data-client-id');
            const selectedDateString = document.getElementById('appointment-datetime').value;
            let total = 0;
            let selectedServices = [];

            serviceCheckboxes.forEach(box => {
                if (box.checked) {
                    total += parseFloat(box.getAttribute('data-price') || 0);
                    selectedServices.push(box.value);
                }
            });

            if (!selectedDateString) {
                alert("Please select a date and time for your appointment.");
                return;
            }
            if (selectedServices.length === 0) {
                alert("Please select at least one service.");
                return;
            }

            // UI Feedback
            confirmBookingBtn.disabled = true;
            confirmBookingBtn.innerHTML = '<span class="animate-spin mr-2">✨</span> Processing...';

            // Calculate total duration (Mock - in full app, aggregate service duration_minutes)
            const durationMinutes = 60;
            if (!proId || !clientId) {
                alert("Session error. Please close and re-open the booking window.");
                return;
            }

            // Generate DB records
            const originalText = confirmBookingBtn.innerText;
            confirmBookingBtn.innerText = "Processing...";
            confirmBookingBtn.disabled = true;

            try {
                // 1. Ensure the pro has at least one service in the DB to refer to, or find their first service
                let { data: services } = await window.supabaseClient.from('services')
                    .select('id').eq('technician_id', proId).limit(1);

                let serviceId;
                if (!services || services.length === 0) {
                    // Create a dummy service just to satisfy the FK constraint
                    const { data: newService, error: sErr } = await window.supabaseClient.from('services')
                        .insert([{ technician_id: proId, title: 'Custom Beauty Service', price: total, duration_minutes: 60 }])
                        .select();
                    if (sErr) throw sErr;
                    serviceId = newService[0].id;
                } else {
                    serviceId = services[0].id;
                }

                // 2. Insert Appointment
                // Need to parse "Y-m-d H:i" -> ISO
                const startTime = new Date(selectedDateString.replace(' ', 'T'));
                if (isNaN(startTime.getTime())) throw new Error("Invalid date format");

                const endTime = new Date(startTime);
                endTime.setHours(startTime.getHours() + 1); // Mock 1hr duration

                const { data: newAppt, error: apptError } = await window.supabaseClient.from('appointments')
                    .insert([{
                        client_id: clientId,
                        technician_id: proId,
                        service_id: serviceId,
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                        status: 'pending',
                        total_price: total,
                        currency: window.currentCurrency || 'ZMW'
                    }])
                    .select();

                if (apptError) throw apptError;

                // 3. Trigger Payment Checkout (Marketplace Logic)
                const checkoutData = await window.Payments.initiateCheckout({
                    appointmentId: newAppt[0].id,
                    clientId: clientId,
                    technicianId: proId,
                    amount: total,
                    currency: window.currentCurrency || 'ZMW',
                    serviceName: selectedServices.join(', ')
                });

                // 4. Redirect to Payment Provider
                if (checkoutData?.url) {
                    // Update: Append appointment_id to the success/cancel URLs if possible, 
                    // or rely on the metadata in the Edge function (which we updated earlier).
                    window.location.href = checkoutData.url;
                } else {
                    throw new Error("Payment initialization failed.");
                }

            } catch (err) {
                console.error("Booking/Payment failed:", err);
                alert("Booking failed: " + err.message);
                confirmBookingBtn.innerText = originalText;
                confirmBookingBtn.disabled = false;
            } finally {
                // Note: We don't reset form here because we are redirecting away
            }
        });
    }

    // Connect Profile Buttons to Chat
    const profileBtns = document.querySelectorAll('.view-profile-btn');
    profileBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const proName = btn.getAttribute('data-pro');
            openChatModal(proName);
        });
    });

    // Also connect the main "Book an Appointment" button
    const bookBtns = document.querySelectorAll('.book-btn');
    bookBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Scroll to professionals if they aren't looking at one
            const target = document.querySelector('#professionals');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Professionalism Portal Logic ---
    const proPortalModal = document.getElementById('pro-portal-modal');
    const certUploadInput = document.getElementById('cert-upload');
    const certListEl = document.getElementById('cert-list');

    const openProPortal = async () => {
        const session = await window.supabaseClient?.auth.getSession();
        if (!session?.data?.session) return;

        const userId = session.data.session.user.id;
        proPortalModal.classList.remove('hidden');
        proPortalModal.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Load certifications
        await loadCertifications(userId);

        // Load live reviews
        await loadReviews(userId);
    };

    const loadCertifications = async (userId) => {
        const certList = document.getElementById('cert-list');
        if (!certList) return;

        const { data: certs } = await window.supabaseClient
            .from('certifications')
            .select('*')
            .eq('technician_id', userId)
            .order('created_at', { ascending: false });

        certList.innerHTML = '';

        if (!certs || certs.length === 0) {
            certList.innerHTML = '<li class="text-sm text-brand-gray/40 italic">No certifications uploaded yet.</li>';
            return;
        }

        certs.forEach(cert => {
            const statusColor = cert.status === 'verified' ? 'text-green-600' : cert.status === 'rejected' ? 'text-red-600' : 'text-brand-pink';
            const statusIcon = cert.status === 'verified' ? '✧' : cert.status === 'rejected' ? '✦' : '❃';
            certList.innerHTML += `
                <li class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest border-b border-brand-border pb-4">
                    <span class="${statusColor} text-lg">${statusIcon}</span>
                    <a href="${cert.file_url}" target="_blank" class="hover:text-brand-pink transition-colors truncate">${cert.name}</a>
                    <span class="text-[8px] ${statusColor} ml-auto shrink-0 opacity-50">(${cert.status})</span>
                </li>`;
        });
    };

    const loadReviews = async (userId) => {
        const reviewsContainer = document.getElementById('portal-reviews-container');
        if (!reviewsContainer) return;

        const { data: reviews } = await window.supabaseClient
            .from('reviews')
            .select('*, profiles!reviewer_id(full_name)')
            .eq('reviewee_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        reviewsContainer.innerHTML = '';

        if (!reviews || reviews.length === 0) {
            reviewsContainer.innerHTML = '<p class="text-sm text-gray-400 italic text-center mt-4">No reviews yet. Complete appointments to start receiving reviews!</p>';
            return;
        }

        reviews.forEach(review => {
            const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            reviewsContainer.innerHTML += `
                <div class="bg-white border border-brand-border p-6 rounded-luxury shadow-lg">
                    <div class="flex justify-between items-start mb-4">
                        <span class="font-black text-[10px] text-text-main uppercase tracking-widest">${review.profiles?.full_name || 'Anonymous'}</span>
                        <span class="text-[8px] text-brand-pink font-black border border-brand-pink/20 px-3 py-1 rounded-luxury uppercase tracking-widest">Verified Session</span>
                    </div>
                    <div class="text-brand-pink text-[10px] tracking-widest mb-4">${stars}</div>
                    <p class="text-[10px] text-brand-gray/40 font-bold uppercase tracking-widest leading-relaxed">"${review.comment || ''}"</p>
                </div>`;
        });
    };

    // Handle certificate file upload
    if (certUploadInput) {
        certUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const session = await window.supabaseClient?.auth.getSession();
            if (!session?.data?.session) return;
            const userId = session.data.session.user.id;

            const uploadBtn = document.getElementById('cert-upload-area');
            const originalContent = uploadBtn ? uploadBtn.innerHTML : '';

            // Show uploading state
            const uploadArea = document.querySelector('#pro-portal-modal .border-dashed');
            if (uploadArea) uploadArea.innerHTML = '<p class="text-sm text-purple-600 font-medium animate-pulse">Uploading...</p>';

            try {
                const filePath = `${userId}/${Date.now()}_${file.name}`;
                const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
                    .from('certifications')
                    .upload(filePath, file, { upsert: false });

                if (uploadError) throw uploadError;

                // Get the public URL
                const { data: urlData } = window.supabaseClient.storage
                    .from('certifications')
                    .getPublicUrl(filePath);

                // Save record to database
                const { error: dbError } = await window.supabaseClient
                    .from('certifications')
                    .insert([{
                        technician_id: userId,
                        name: file.name,
                        file_url: urlData.publicUrl,
                        status: 'pending'
                    }]);

                if (dbError) throw dbError;

                // Refresh the list
                await loadCertifications(userId);

                if (uploadArea) uploadArea.innerHTML = `<span class="text-green-600 font-bold">✓ Uploaded! (Pending Review)</span>`;
                setTimeout(() => {
                    if (uploadArea) uploadArea.innerHTML = `<svg class="mx-auto h-10 w-10 text-purple-300 mb-2" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="text-sm font-medium text-purple-600">Upload another file</span>`;
                }, 3000);

            } catch (err) {
                console.error('Upload failed:', err);
                if (err.message && err.message.includes('Bucket not found')) {
                    alert('Storage not set up yet!\n\nTo fix this:\n1. Go to your Supabase Dashboard\n2. Click "Storage" on the left menu\n3. Click "New Bucket"\n4. Name it exactly: certifications\n5. Check "Public bucket"\n6. Click Save\n\nThen try uploading again!');
                } else {
                    alert('Upload failed: ' + err.message);
                }
                if (uploadArea) uploadArea.innerHTML = '<span class="text-red-500 text-sm">Upload failed. Try again.</span>';
            }
            certUploadInput.value = ''; // Reset input
        });
    }

    // Wire up the Pro Portal button (for when it exists in the HTML directly)
    const staticProPortalBtn = document.getElementById('open-pro-portal');
    if (staticProPortalBtn) {
        staticProPortalBtn.addEventListener('click', openProPortal);
    }

    // Also expose it globally so the dynamically injected navbar button works
    window.openProPortal = openProPortal;

    // --- Review System Logic ---
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review');
    const reviewForm = document.getElementById('review-form');
    const starBtns = document.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('review-rating');
    let currentRevieweeName = '';

    // Handle Star Clicks
    starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseInt(btn.getAttribute('data-rating'));
            ratingInput.value = rating;

            // Update UI
            starBtns.forEach(sb => {
                if (parseInt(sb.getAttribute('data-rating')) <= rating) {
                    sb.classList.remove('text-gray-300');
                    sb.classList.add('text-yellow-400');
                } else {
                    sb.classList.remove('text-yellow-400');
                    sb.classList.add('text-gray-300');
                }
            });
        });
    });

    const closeReviewModal = () => {
        reviewModal.classList.add('hidden');
        reviewModal.classList.remove('flex');
        document.body.style.overflow = '';
        reviewForm.reset();
        ratingInput.value = 0;
        document.getElementById('review-appointment-id').value = '';
        starBtns.forEach(sb => {
            sb.classList.remove('text-yellow-400');
            sb.classList.add('text-gray-300');
        });
    };

    if (closeReviewBtn) closeReviewBtn.addEventListener('click', closeReviewModal);

    // Attach to Leave Review buttons (Dynamic)
    window.openReviewModal = (apptId, proName) => {
        document.getElementById('review-appointment-id').value = apptId;
        document.getElementById('review-pro-name').innerText = proName;
        reviewModal.classList.remove('hidden');
        reviewModal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    };

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = parseInt(ratingInput.value);
            const comment = document.getElementById('review-comment').value;

            if (rating === 0) {
                alert("Please select a star rating!");
                return;
            }

            const submitBtn = document.getElementById('review-submit-btn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="animate-pulse">Submitting...</span>';
            submitBtn.disabled = true;

            try {
                const session = await window.supabaseClient.auth.getSession();
                const reviewerId = session.data.session.user.id;

                // 1. Find the professional's ID by their name (since our UI just has names right now)
                const { data: pros, error: proError } = await window.supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('full_name', currentRevieweeName)
                    .limit(1);

                if (proError || !pros || pros.length === 0) {
                    throw new Error("Could not find this professional in the database. Are they registered?");
                }

                const revieweeId = pros[0].id;
                const appointmentId = document.getElementById('review-appointment-id').value;

                // 2. Insert the review
                const { error: reviewError } = await window.supabaseClient
                    .from('reviews')
                    .insert([{
                        reviewer_id: reviewerId,
                        reviewee_id: revieweeId,
                        appointment_id: appointmentId,
                        rating: rating,
                        comment: comment
                    }]);

                if (reviewError) throw reviewError;

                alert("Review submitted successfully! The professional will see this in their Portal.");
                closeReviewModal();

            } catch (err) {
                console.error("Review error:", err);
                alert("Failed to submit review: " + err.message);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Auth Modal Logic
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const roleSelection = document.getElementById('role-selection');
    const nameField = document.getElementById('name-field');

    let isSignUp = true;

    // Open Modal
    const openAuthModal = () => {
        authModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    // Close Modal
    const closeAuthModal = () => {
        authModal.classList.add('hidden');
        document.body.style.overflow = '';
        authForm.reset();
    };

    closeAuthBtn.addEventListener('click', closeAuthModal);

    // Close on click outside
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // Attach to initial Navbar buttons (Fallback while auth observer initializes)
    const initialLoginBtn = document.getElementById('initial-login-btn');
    const initialSignupBtn = document.getElementById('initial-signup-btn');

    if (initialLoginBtn) {
        initialLoginBtn.addEventListener('click', () => {
            isSignUp = false;
            updateAuthUI();
            openAuthModal();
        });
    }

    if (initialSignupBtn) {
        initialSignupBtn.addEventListener('click', () => {
            isSignUp = true;
            updateAuthUI();
            openAuthModal();
        });
    }

    // Toggle Login / Signup modes
    authToggleBtn.addEventListener('click', () => {
        isSignUp = !isSignUp;
        updateAuthUI();
    });

    const updateAuthUI = () => {
        if (isSignUp) {
            authTitle.innerText = "Sign Up";
            authSubtitle.innerText = "Join Pink Pixies today and book your next appointment.";
            authSubmitBtn.innerText = "Create Account";
            authToggleText.innerText = "Already have an account?";
            authToggleBtn.innerText = "Log in";
            roleSelection.style.display = 'flex';
            nameField.style.display = 'block';
            document.getElementById('full-name').required = true;
        } else {
            authTitle.innerText = "Welcome Back";
            authSubtitle.innerText = "Log in to manage your appointments and settings.";
            authSubmitBtn.innerText = "Log In";
            authToggleText.innerText = "Don't have an account?";
            authToggleBtn.innerText = "Sign up";
            roleSelection.style.display = 'none';
            nameField.style.display = 'none';
            document.getElementById('full-name').required = false;
        }
    };

    // Handle Role Selection Styles
    const roleBtns = roleSelection.querySelectorAll('button');
    const roleInput = document.getElementById('user-role');

    roleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = e.target.getAttribute('data-role');
            roleInput.value = role;

            // Update Active State Visuals
            roleBtns.forEach(b => {
                b.className = 'flex-1 py-4 text-[9px] font-black uppercase tracking-[0.3em] rounded-luxury transition-all text-brand-gray/40 hover:bg-brand-pink-soft border border-transparent';
            });
            e.target.className = 'flex-1 py-4 text-[10px] font-black uppercase tracking-widest bg-brand-pink text-white rounded-luxury transition-all shadow-2xl';
        });
    });

    // Handle Form Submission with Supabase
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Disable button while loading
        const originalText = authSubmitBtn.innerText;
        authSubmitBtn.innerText = "Processing...";
        authSubmitBtn.disabled = true;

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const supabase = window.supabaseClient;

        try {
            if (isSignUp) {
                const fullName = document.getElementById('full-name').value;
                const role = roleInput.value;

                // 1. Sign Up User in Auth
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) throw error;

                // 2. Create Profile Record
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([
                            {
                                id: data.user.id,
                                role: role,
                                full_name: fullName,
                                username: email.split('@')[0] + Math.floor(Math.random() * 1000) // temporary unique username
                            }
                        ]);

                    if (profileError) {
                        console.error("Profile creation error:", profileError);
                        // don't fail completely if profile fails, user is still created in auth
                    }

                    // 3. Handle Referral Linking
                    const referralCode = document.getElementById('referred-by-id')?.value;
                    if (referralCode) {
                        try {
                            // Find the referrer's UUID by their code
                            const { data: referrerProfile } = await supabase
                                .from('profiles')
                                .select('id')
                                .eq('referral_code', referralCode)
                                .single();

                            if (referrerProfile) {
                                await supabase
                                    .from('referrals')
                                    .insert([{
                                        referrer_id: referrerProfile.id,
                                        referred_id: data.user.id,
                                        status: 'pending'
                                    }]);
                                console.log("Successfully linked referral");
                            }
                        } catch (refErr) {
                            console.error("Referral linking failed:", refErr);
                        }
                    }
                }

                if (data.session) {
                    // Auto-login succeeded (Confirm Email is DISABLED in Supabase)
                    alert('Account created successfully! You are now logged in.');
                    closeAuthModal();
                } else {
                    // Auto-login failed (Confirm Email is ENABLED in Supabase)
                    alert('Account created! \\n\\nIMPORTANT: Supabase requires Email Confirmation by default.\\n\\nPlease check your email for a confirmation link before logging in.\\n\\n(Or turn OFF "Confirm Email" in your Supabase Dashboard -> Authentication -> Providers -> Email)');
                    isSignUp = false;
                    updateAuthUI();
                }

            } else {
                // Log In User
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                alert('Logged in successfully!');
                closeAuthModal();
            }
        } catch (error) {
            if (error.message.includes('Email not confirmed')) {
                alert('Error: Email not confirmed.\\n\\nYou need to click the confirmation link sent to your email.\\n\\nTo disable this requirement, go to your Supabase Dashboard -> Authentication -> Providers -> Email -> and turn OFF "Confirm email".');
            } else {
                alert(`Error: ${error.message}`);
            }
        } finally {
            authSubmitBtn.innerText = originalText;
            authSubmitBtn.disabled = false;
        }
    });

    // Initialize Global Pricing Module
    if (typeof window.PricingModule !== 'undefined') {
        window.PricingModule.initializeSmartPricing().catch(err => console.error("Pricing initialization failed:", err));
    }

    // Initialize Dynamic Professionals
    loadProfessionals();

    // Initialize Search Logic
    initSearch();

    // Auth State Observer
    // ... (rest of search/filters will go here)
});

/**
 * Phase 5: Smart Search & Filters
 */
function initSearch() {
    const heroSearch = document.getElementById('hero-search');
    const heroSearchBtn = document.getElementById('hero-search-btn');
    const mapSearch = document.getElementById('map-search');
    const searchBtn = document.getElementById('search-btn');

    const handleSearch = () => {
        const query = (heroSearch?.value || mapSearch?.value || '').trim();
        if (query) {
            // Smooth scroll to results
            document.getElementById('professionals')?.scrollIntoView({ behavior: 'smooth' });
            loadProfessionals(query);
        }
    };

    if (heroSearchBtn) heroSearchBtn.addEventListener('click', handleSearch);
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    // Enter key support
    [heroSearch, mapSearch].forEach(input => {
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    });

    // Debounced live filtering for map search
    let debounceTimer;
    mapSearch?.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadProfessionals(mapSearch.value);
        }, 500);
    });
}

/**
 * Phase 5: Dynamic Professional Discovery (Updated with Search)
 */
async function loadProfessionals(searchQuery = '') {
    const container = document.getElementById('featured-pros-container');
    if (!container) return;

    // Show skeleton/loading state
    container.innerHTML = `
        ${Array(4).fill(0).map(() => `
            <div class="glass rounded-luxury overflow-hidden border border-brand-border shadow-2xl">
                <div class="h-48 skeleton-light bg-brand-pink-soft"></div>
                <div class="p-6 space-y-3">
                    <div class="h-6 skeleton-light rounded bg-brand-pink-light w-3/4"></div>
                    <div class="space-y-2">
                        <div class="h-4 skeleton-light rounded bg-brand-pink-light w-full"></div>
                        <div class="h-4 skeleton-light rounded bg-brand-pink-light w-5/6"></div>
                    </div>
                    <div class="flex justify-between items-center pt-4">
                        <div class="h-8 skeleton-light rounded bg-brand-pink-light w-24"></div>
                        <div class="h-10 skeleton-light rounded bg-brand-pink-light w-32"></div>
                    </div>
                </div>
            </div>
        `).join('')}
    `;

    try {
        let profiles = [];
        const userLatLng = window.currentUserLocation; // Set by maps.js or browser

        if (userLatLng) {
            // Use PostGIS RPC for distance search
            const { data, error } = await window.supabaseClient.rpc('search_technicians_nearby', {
                p_latitude: userLatLng.lat,
                p_longitude: userLatLng.lng,
                p_radius_meters: 50000, // 50km default
                p_search_query: searchQuery || null
            });
            if (error) throw error;
            profiles = data;
        } else {
            // Fallback to basic text search if no location
            let query = window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('role', 'technician');

            if (searchQuery) {
                query = query.or(`full_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
            }
            const { data, error: pError } = await query.limit(10);
            if (pError) throw pError;
            profiles = data;
        }

        if (!profiles || profiles.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center glass rounded-luxury border border-brand-border">
                    <p class="text-brand-gray/40 mb-4 font-black uppercase tracking-widest">No artists found matching "${searchQuery}".</p>
                    <button onclick="window.currentUserLocation=null; loadProfessionals('')" class="text-brand-pink font-black uppercase tracking-[0.4em] hover:underline">Clear Filters</button>
                </div>
            `;
            return;
        }

        // Fetch services and reviews
        const proIds = profiles.map(p => p.id);
        const { data: services } = await window.supabaseClient.from('services').select('technician_id, base_price, base_currency').in('technician_id', proIds);
        const { data: reviews } = await window.supabaseClient.from('reviews').select('reviewee_id, rating').in('reviewee_id', proIds);

        container.innerHTML = '';
        profiles.forEach(pro => {
            // Find starting price
            const proServices = services?.filter(s => s.technician_id === pro.id) || [];
            const minPrice = proServices.length > 0 ? Math.min(...proServices.map(s => parseFloat(s.base_price))) : 350;
            const currency = proServices[0]?.base_currency || 'ZMW';

            // Find avg rating - Use RPC result if available, else derive from reviews or default
            const proReviews = reviews?.filter(r => r.reviewee_id === pro.id) || [];
            const avgRatingVal = pro.avg_rating !== undefined
                ? parseFloat(pro.avg_rating)
                : (proReviews.length > 0
                    ? (proReviews.reduce((sum, r) => sum + r.rating, 0) / proReviews.length)
                    : (4.5 + Math.random() * 0.5)); // Premium default for new pros
            const avgRating = avgRatingVal.toFixed(1);

            const isTopPerformer = avgRatingVal >= 4.8 && proReviews.length >= 2; // Low thresh for demo

            const card = document.createElement('div');
            card.className = 'pro-card glass rounded-luxury overflow-hidden border border-brand-border group shadow-2xl hover:-translate-y-2 transition-all duration-500';

            const placeholderImg = `https://images.unsplash.com/photo-${['1519014816548-bf5fe059e98b', '1512496015851-a1dc8a47814b', '1522337660859-02fbefca4702'][Math.floor(Math.random() * 3)]}?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80`;

            card.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${pro.avatar_url || placeholderImg}" alt="${pro.full_name}"
                        class="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />

                    <div class="absolute top-4 left-4 flex flex-col gap-2">
                        <div class="bg-white/40 backdrop-blur-xl px-3 py-1 rounded-luxury text-[9px] font-black text-brand-pink flex items-center gap-1 border border-white/10">
                            ⭐ ${avgRating}
                        </div>
                        ${isTopPerformer ? `
                        <div class="bg-brand-pink text-white px-3 py-1 rounded-luxury text-[9px] font-black flex items-center gap-1 shadow-2xl animate-bounce-subtle">
                            🏆 Top Performer
                        </div>` : ''}
                    </div>

                    ${pro.is_verified ? `
                    <div class="absolute bottom-4 left-4 bg-green-500 text-white p-1.5 rounded-luxury shadow-lg">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>` : ''}
                </div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-lg font-black text-text-main flex items-center gap-2 truncate max-w-[70%] uppercase tracking-tighter">
                            ${pro.full_name}
                            ${pro.is_pink_badge ? `
                            <svg class="w-4 h-4 text-brand-pink" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L14.71 4.29L18.11 3.54L18.86 6.94L22 8.66L20.29 12L22 15.34L18.86 17.06L18.11 20.46L14.71 19.71L12 22L9.29 19.71L5.89 20.46L5.14 17.06L2 15.34L3.71 12L2 8.66L5.14 6.94L5.89 3.54L9.29 4.29L12 2Z" fill="currentColor" />
                                <path d="M9 12L11 14L15 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>` : ''}
                        </h3>
                        <span class="bg-brand-pink-soft text-brand-pink text-[8px] px-2 py-1 rounded-luxury font-black uppercase tracking-widest">${pro.category || 'Beauty'}</span>
                    </div>
                    <p class="text-brand-gray/40 text-[10px] font-bold uppercase tracking-widest mb-4 line-clamp-2 min-h-[2.5rem]">${pro.bio || pro.specialties?.join(', ') || 'Professional beauty technician ready to make you glow.'}</p>
                    <div class="flex justify-between items-center border-t border-brand-border pt-4 mt-2">
                        <div>
                            <p class="text-[9px] text-brand-gray/20 uppercase font-black tracking-widest">Starts at</p>
                            <p class="font-black text-text-main text-lg tracking-tighter">ZMW ${minPrice}</p>
                            ${pro.distance_meters ? `<p class="text-[8px] text-brand-gray/40 font-black tracking-widest">📍 ${(pro.distance_meters / 1000).toFixed(1)} km away</p>` : ''}
                        </div>
                        <button class="view-profile-btn bg-brand-pink text-white px-6 py-3 rounded-luxury text-[9px] font-black uppercase tracking-[0.4em] hover:bg-brand-pink/90 transition-all shadow-2xl active:scale-95"
                                data-pro="${pro.full_name}" data-id="${pro.id}">
                            Book Now
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Re-initialize pricing module for new items
        if (window.PricingModule) window.PricingModule.initializeSmartPricing();

        // Update Map Markers
        if (window.updateMapMarkers) window.updateMapMarkers(profiles);

    } catch (err) {
        console.error("Discovery failed:", err);
    }
};
window.loadProfessionals = loadProfessionals;

// Initialize Global Currency & Pricing
const initGlobalPricing = async () => {
    if (window.PricingModule) {
        const userLoc = await window.PricingModule.detectUserCurrency();
        window.currentCurrency = userLoc.currency || 'ZMW';
        window.PricingModule.initializeSmartPricing();
    }
};
initGlobalPricing();

/** Load Pro Services into Booking Modal **/
const loadBookingServices = async (proId) => {
    const container = document.getElementById('booking-services-list');
    if (!container) return;

    container.innerHTML = '<div class="animate-pulse text-xs text-center text-gray-400 py-4">Loading menu...</div>';

    try {
        const { data: services } = await window.supabaseClient
            .from('services')
            .select('*')
            .eq('technician_id', proId)
            .order('price', { ascending: true });

        if (!services || services.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">No services listed yet.</p>';
            return;
        }

        container.innerHTML = services.map(s => `
            <label class="flex items-center justify-between p-4 rounded-luxury border border-brand-border bg-white hover:bg-brand-pink-soft transition-all cursor-pointer group shadow-sm mb-4">
                <div class="flex items-center gap-4">
                    <input type="checkbox" name="services" value="${s.id}" data-price="${s.price}" 
                           class="service-checkbox w-5 h-5 text-brand-pink bg-white border-brand-border rounded-luxury focus:ring-brand-pink">
                    <div>
                        <p class="text-[11px] font-black text-text-main uppercase tracking-widest group-hover:text-brand-pink transition-colors">${s.title}</p>
                        <p class="text-[9px] text-brand-gray/40 font-black uppercase tracking-[0.3em]">${s.duration_minutes} MINS</p>
                    </div>
                </div>
                <span class="text-[10px] font-black text-brand-pink uppercase tracking-widest bg-brand-pink-soft px-3 py-1 rounded-luxury">ZMW ${s.price}</span>
            </label>
        `).join('');

        // Re-attach listeners for price calculation
        container.querySelectorAll('.service-checkbox').forEach(box => {
            box.addEventListener('change', () => {
                // Trigger window-level calculateTotal
                if (window.calculateTotal) window.calculateTotal();
            });
        });

    } catch (err) {
        console.error("Failed to load services:", err);
        container.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Failed to load services.</p>';
    }
};

// Global accessor for total calculation
window.calculateTotal = () => {
    const boxes = document.querySelectorAll('.service-checkbox');
    const display = document.getElementById('booking-total');
    if (!display) return;

    let total = 0;
    boxes.forEach(box => {
        if (box.checked) total += parseFloat(box.getAttribute('data-price') || 0);
    });

    const currency = window.currentCurrency || 'ZMW';
    display.innerText = `${currency} ${total.toFixed(2)}`;
};

// --- Confirm Booking Logic ---
document.getElementById('confirm-booking-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const proId = btn.getAttribute('data-pro-id');
    const clientId = btn.getAttribute('data-client-id');
    const dateTimeInput = document.getElementById('appointment-datetime');
    const selectedServices = document.querySelectorAll('.service-checkbox:checked');

    if (!dateTimeInput.value) {
        alert("Please select a date and time for your magic session!");
        return;
    }

    if (selectedServices.length === 0) {
        alert("Please select at least one service!");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Processing...`;

    try {
        const startTime = new Date(dateTimeInput.value);
        let totalDuration = 0;
        let totalPrice = 0;

        selectedServices.forEach(cb => {
            totalPrice += parseFloat(cb.dataset.price);
            totalDuration += 60; // Defaulting to 60m per service for now
        });

        const endTime = new Date(startTime.getTime() + totalDuration * 60000);

        // 1. Insert Appointment
        const { data: appointment, error: apptError } = await window.supabaseClient
            .from('appointments')
            .insert([{
                client_id: clientId,
                technician_id: proId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                total_price: totalPrice,
                status: 'pending'
            }])
            .select()
            .single();

        if (apptError) throw apptError;

        // 2. Insert Appointment Services
        const apptServices = Array.from(selectedServices).map(cb => ({
            appointment_id: appointment.id,
            service_id: cb.value,
            price_at_booking: parseFloat(cb.dataset.price)
        }));

        const { error: servicesError } = await window.supabaseClient
            .from('appointment_services')
            .insert(apptServices);

        if (servicesError) throw servicesError;

        // 3. Trigger Payment Checkout (Marketplace Logic)
        if (window.Payments && window.Payments.initiateCheckout) {
            const checkoutData = await window.Payments.initiateCheckout({
                appointmentId: appointment.id,
                clientId: clientId,
                technicianId: proId,
                amount: totalPrice,
                currency: window.currentCurrency || 'ZMW',
                serviceName: Array.from(selectedServices).map(cb => cb.parentElement.querySelector('p').innerText).join(', ')
            });

            // 4. Redirect to Payment Provider
            if (checkoutData?.url) {
                window.location.href = checkoutData.url;
            } else {
                throw new Error("Payment initialization failed (no URL returned).");
            }
        } else {
            // Fallback for direct requested bookings if Payments module is missing
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#db2777', '#9333ea', '#ffffff']
                });
            }
            alert("Magic Requested! ✨ Your technician will confirm shortly.");
            document.getElementById('chat-modal').classList.add('hidden');
            document.body.style.overflow = 'auto';
            if (window.loadMyBookings) window.loadMyBookings();
        }

    } finally {
        btn.disabled = false;
        btn.innerText = "Confirm & Pay";
    }
});

const loadMyBookings = async () => {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    try {
        const session = await window.supabaseClient?.auth.getSession();
        if (!session?.data?.session) return;
        const clientId = session.data.session.user.id;

        const { data: bookings, error } = await window.supabaseClient
            .from('appointments')
            .select(`
                *,
                technician:profiles!technician_id(full_name, avatar_url)
            `)
            .eq('client_id', clientId)
            .order('start_time', { ascending: false });

        if (error) throw error;
        renderBookings(bookings, list);
        if (clientId) setupReferralLink(clientId);

    } catch (err) {
        console.error("Failed to load bookings:", err);
        list.innerHTML = `<p class="text-center text-red-500 py-8">Failed to load history.</p>`;
    }
};

const setupReferralLink = async (userId) => {
    const input = document.getElementById('referral-link-input');
    const copyBtn = document.getElementById('copy-referral-btn');
    if (!input || !copyBtn) return;

    try {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('referral_code')
            .eq('id', userId)
            .single();

        if (profile?.referral_code) {
            const url = `${window.location.origin}?ref=${profile.referral_code}`;
            input.value = url;

            copyBtn.onclick = () => {
                navigator.clipboard.writeText(url);
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "Copied! ✨";
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            };
        }
    } catch (err) {
        console.error("Referral link setup failed:", err);
    }
};

const renderBookings = (bookings, container) => {
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-400">No appointments yet. Time for a glow up?</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(b => {
        const date = new Date(b.start_time).toLocaleDateString();
        const time = new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-700',
            confirmed: 'bg-green-100 text-green-700',
            completed: 'bg-blue-100 text-blue-700',
            cancelled: 'bg-red-100 text-red-700'
        };

        return `
            <div class="glass border border-brand-border rounded-luxury p-6 flex gap-6 items-center shadow-2xl">
                <img src="${b.technician?.avatar_url || 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&w=50&q=80'}" 
                    class="w-16 h-16 rounded-luxury object-cover border border-brand-border grayscale group-hover:grayscale-0 transition-all duration-700">
                <div class="flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-black text-text-main uppercase tracking-widest text-[11px]">${b.technician?.full_name || 'Technician'}</h4>
                        <span class="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-luxury border ${statusColors[b.status] || 'border-brand-border text-brand-gray/40'}">${b.status}</span>
                    </div>
                    <p class="text-[9px] text-brand-gray/40 font-black uppercase tracking-[0.3em]">${date} AT ${time}</p>
                    <div class="flex justify-between items-center mt-4 pt-4 border-t border-brand-border">
                        <p class="text-[10px] font-black text-brand-pink uppercase tracking-widest">ZMW ${b.total_price}</p>
                        ${b.status === 'completed' ? `
                            <button onclick="window.openReviewModal('${b.id}', '${b.technician?.full_name}')" 
                                class="text-[9px] font-black text-brand-pink uppercase tracking-[0.4em] hover:underline pink-glow">
                                Initialize Review
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};


// Update Navbar Auth State
const updateNavbarAuth = async (session) => {
    const loginBtn = document.getElementById('initial-login-btn');
    const signupBtn = document.getElementById('initial-signup-btn');
    const bookingsBtn = document.getElementById('my-bookings-btn');
    const portalBtn = document.getElementById('pro-portal-btn');
    const loyaltyBadge = document.getElementById('loyalty-badge');
    const notifWrapper = document.getElementById('notif-wrapper');
    const adminBtn = document.getElementById('admin-entrance-btn');

    if (session) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (signupBtn) signupBtn.innerText = "Log Out";
        if (notifWrapper) notifWrapper.classList.remove('hidden');
        if (loyaltyBadge) {
            loyaltyBadge.classList.remove('hidden');
            loadUserLoyalty(session.user.id);
        }

        // Fetch profile to check role
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role === 'admin' && adminBtn) {
            adminBtn.classList.remove('hidden');
            adminBtn.onclick = () => {
                document.getElementById('admin-modal').classList.remove('hidden');
                document.getElementById('admin-modal').classList.add('flex');
                if (window.AdminPortal) window.AdminPortal.init();
            };
        }

        if (profile?.role === 'technician' && portalBtn) {
            portalBtn.classList.remove('hidden');
            portalBtn.onclick = () => window.openProPortal?.();
        }

        if (profile?.role === 'client' && bookingsBtn) {
            bookingsBtn.classList.remove('hidden');
            bookingsBtn.onclick = () => {
                document.getElementById('bookings-modal').classList.remove('hidden');
                document.getElementById('bookings-modal').classList.add('flex');
                document.body.style.overflow = 'hidden';
                loadMyBookings();
            };
        }

        signupBtn.onclick = async () => {
            await window.supabaseClient.auth.signOut();
            window.location.reload();
        };
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (signupBtn) {
            signupBtn.innerText = "Sign Up";
            signupBtn.onclick = null;
        }
        if (bookingsBtn) bookingsBtn.classList.add('hidden');
        if (portalBtn) portalBtn.classList.add('hidden');
        if (loyaltyBadge) loyaltyBadge.classList.add('hidden');
        if (notifWrapper) notifWrapper.classList.add('hidden');
        if (adminBtn) adminBtn.classList.add('hidden');
    }
};

const loadUserLoyalty = async (userId) => {
    const pointsEl = document.getElementById('user-points');
    const tierEl = document.getElementById('user-tier');
    if (!pointsEl) return;

    try {
        const { data: loyalty, error } = await window.supabaseClient
            .from('loyalty_profiles')
            .select('points, tier')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (loyalty) {
            pointsEl.innerText = loyalty.points.toLocaleString();
            if (tierEl) {
                tierEl.innerText = loyalty.tier || 'Bronze';
                // Color coding based on tier
                const tierColors = {
                    'Bronze': 'bg-brand-pink-soft text-brand-pink',
                    'Silver': 'bg-brand-gray-light text-brand-gray',
                    'Gold': 'bg-brand-pink text-white shadow-2xl',
                    'Platinum': 'bg-text-main text-white shadow-2xl'
                };
                tierEl.className = `ml-2 ${tierColors[loyalty.tier] || 'bg-brand-pink text-white'} px-2 py-0.5 rounded-luxury uppercase text-[8px] font-black tracking-widest border border-white/10`;
            }
        } else {
            pointsEl.innerText = '0';
            if (tierEl) tierEl.innerText = 'Bronze';
        }
    } catch (err) {
        console.error("Loyalty fetch fail:", err);
    }
};

// Duplicate logic removed. Review handling consolidated above.

// Listen for auth changes
if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        updateNavbarAuth(session);
    });

    window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateNavbarAuth(session);
    });

    // --- Dev Admin Access (Debug Tool) ---
    const initDevAdmin = () => {
        // 1. Keyboard Shortcut: Ctrl + Alt + A
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                toggleAdminModal();
            }
        });

        // 2. Floating Dev Button (only in local dev)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const devBtn = document.createElement('button');
            devBtn.id = 'dev-admin-shortcut';
            devBtn.innerHTML = '🛠️ Admin';
            devBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: #EC4899;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 50px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            cursor: pointer;
            box-shadow: 0 10px 25px -5px rgba(236, 72, 153, 0.5);
            transition: all 0.3s ease;
        `;
            devBtn.onmouseover = () => devBtn.style.transform = 'translateY(-2px)';
            devBtn.onmouseout = () => devBtn.style.transform = 'translateY(0)';
            devBtn.onclick = toggleAdminModal;
            document.body.appendChild(devBtn);
        }
    };

    const toggleAdminModal = () => {
        const adminModal = document.getElementById('admin-modal');
        if (adminModal) {
            const isHidden = adminModal.classList.contains('hidden');
            if (isHidden) {
                adminModal.classList.remove('hidden');
                adminModal.classList.add('flex');
                document.body.style.overflow = 'hidden';
                if (window.AdminPortal) window.AdminPortal.init();
            } else {
                adminModal.classList.add('hidden');
                adminModal.classList.remove('flex');
                document.body.style.overflow = '';
            }
        }
    };

    initDevAdmin();
}
});
