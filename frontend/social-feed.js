/**
 * Phase 3: Social Inspiration Feed Logic
 * 
 * Fetches posts from Supabase or displays mock data.
 * Handles heart likes, saves, and "Book This Look" functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
    initSocialFeed();
    initCreatePostModal();
    loadVibeLeaderboard();
});

async function initSocialFeed(category = 'all') {
    const feedContainer = document.getElementById('social-feed-container');
    if (!feedContainer) return;

    // Loading State
    feedContainer.innerHTML = `
        <div class="col-span-full py-32 text-center">
            <div class="animate-spin h-16 w-16 border-t-2 border-brand-pink mx-auto mb-10 shadow-[0_0_30px_rgba(236,72,153,0.2)]"></div>
            <p class="text-brand-gray text-[10px] font-black uppercase tracking-[0.5em]">Synchronizing Atmosphere...</p>
        </div>
    `;

    let posts = [];

    // Attempt to fetch from Supabase
    if (window.supabaseClient) {
        try {
            let query = window.supabaseClient
                .from('posts')
                .select(`
                    id, 
                    image_url, 
                    caption, 
                    likes_count, 
                    category,
                    created_at,
                    profiles:author_id (full_name, id)
                `);

            if (category !== 'all') {
                query = query.eq('category', category);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            posts = data;
        } catch (error) {
            console.warn("Failed to fetch live posts, falling back to mock data:", error);
            posts = getMockPosts().filter(p => category === 'all' || p.category === category);
        }
    } else {
        posts = getMockPosts().filter(p => category === 'all' || p.category === category);
    }

    if (!posts || posts.length === 0) {
        feedContainer.innerHTML = `
            <div class="col-span-full py-32 text-center glass rounded-luxury border border-brand-border">
                <p class="text-brand-gray/40 text-[10px] font-black uppercase tracking-[0.4em] mb-8">No visual assets identified in this sector.</p>
                <button onclick="initSocialFeed('all')" class="text-brand-pink text-[10px] font-black uppercase tracking-[0.5em] pink-glow hover:scale-105 transition-all">Reset Matrix</button>
            </div>
        `;
        return;
    }

    renderFeed(posts, feedContainer);
    setupFilters();
}

async function loadVibeLeaderboard() {
    const leaderboard = document.getElementById('vibe-leaderboard');
    if (!leaderboard || !window.supabaseClient) return;

    try {
        const { data: topPros, error } = await window.supabaseClient
            .from('profiles')
            .select('id, full_name, avatar_url, post_vibes')
            .eq('role', 'technician')
            .gt('post_vibes', 0)
            .order('post_vibes', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!topPros || topPros.length === 0) {
            leaderboard.innerHTML = '<p class="text-[10px] text-gray-400 italic">No vibe stars yet. Be the first! ✨</p>';
            return;
        }

        leaderboard.innerHTML = topPros.map((pro, index) => `
            <div class="flex-none flex items-center gap-6 glass p-6 rounded-luxury border border-brand-border min-w-[280px] hover:bg-brand-pink-soft transition-all active:scale-95 cursor-pointer group shadow-2xl relative overflow-hidden" onclick="window.location.hash='#professionals'; loadProfessionals('', '${pro.full_name}')">
                <div class="absolute inset-0 bg-brand-pink opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div class="relative z-10">
                    <img src="${pro.avatar_url || 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&w=100&q=80'}" class="w-16 h-16 rounded-luxury object-cover border border-brand-border grayscale group-hover:grayscale-0 transition-all duration-700">
                    <span class="absolute -top-2 -right-2 bg-brand-pink text-white text-[9px] font-black w-6 h-6 rounded-luxury flex items-center justify-center border border-white shadow-[0_0_15px_rgba(236,72,153,0.5)]">${index + 1}</span>
                </div>
                <div class="relative z-10 ml-2">
                    <h4 class="text-[11px] font-black uppercase tracking-widest text-text-main group-hover:text-brand-pink transition-colors">${pro.full_name}</h4>
                    <p class="text-[9px] text-brand-pink font-black flex items-center gap-2 mt-2 pink-glow">✧ ${pro.post_vibes} VIBES</p>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Leaderboard load fail:", err);
        leaderboard.innerHTML = '<p class="text-[10px] text-red-300">Error loading stars.</p>';
    }
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        // Prevent multiple listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', function () {
            const category = this.getAttribute('data-category');

            // UI Update
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active', 'bg-brand-pink', 'text-white', 'shadow-[0_0_30px_rgba(236,72,153,0.3)]');
                b.classList.add('text-brand-gray/40', 'hover:text-text-main');
            });
            this.classList.add('active', 'bg-brand-pink', 'text-white', 'shadow-[0_0_30px_rgba(236,72,153,0.3)]');
            this.classList.remove('text-brand-gray/40', 'hover:text-brand-pink');

            initSocialFeed(category);
        });
    });
}

function renderFeed(posts, container) {
    // Show skeleton while switching if needed
    if (container.id === 'social-feed-container' && posts.length === 0) {
        container.innerHTML = Array(4).fill(0).map(() => `
            <div class="glass rounded-luxury overflow-hidden shadow-2xl border border-brand-border break-inside-avoid mb-10 p-4">
                <div class="w-full h-96 skeleton-light rounded-luxury bg-brand-pink-soft"></div>
                <div class="p-8 space-y-6">
                    <div class="h-4 w-1/2 skeleton-light rounded bg-brand-pink-light"></div>
                    <div class="h-3 w-full skeleton-light rounded bg-brand-pink-light"></div>
                </div>
            </div>
        `).join('');
        return;
    }

    container.innerHTML = '';
    posts.forEach(post => {
        const authorName = post.profiles ? post.profiles.full_name : post.author_name;
        const authorId = post.profiles ? post.profiles.id : post.author_id;

        const card = document.createElement('div');
        card.className = 'glass rounded-luxury overflow-hidden border border-brand-border group flex flex-col hover:-translate-y-4 transition-all duration-700 break-inside-avoid mb-10 p-3 shadow-2xl relative';

        card.innerHTML = `
            <div class="absolute inset-0 bg-brand-pink opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
            <!-- Post Image -->
            <div class="relative w-full overflow-hidden rounded-luxury">
                <img src="${post.image_url}" alt="${post.caption}" class="w-full h-auto block grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000">
                <div class="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                    <button class="book-look-btn w-full bg-brand-pink text-white font-black py-5 rounded-luxury shadow-2xl hover:bg-brand-pink/90 transition-all transform translate-y-8 group-hover:translate-y-0 text-[10px] uppercase tracking-[0.4em]"
                        data-pro-name="${authorName}" data-pro-id="${authorId}">
                        Synchronize Session
                    </button>
                </div>
            </div>

            <!-- Post Content -->
            <div class="p-8 flex flex-col flex-1 relative z-10">
                <div class="flex justify-between items-start mb-6">
                    <h3 class="text-[11px] font-black uppercase tracking-[0.3em] text-text-main">@${authorName.replace(/\s+/g, '').toLowerCase()}</h3>
                    
                    <!-- Interactions -->
                    <div class="flex items-center gap-6">
                        <button class="like-btn text-brand-gray/20 hover:text-brand-pink transition-all flex items-center gap-3 group/btn" data-liked="false" data-post-id="${post.id}">
                            <svg class="w-5 h-5 group-hover/btn:scale-125 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                            <span class="text-[10px] font-black tracking-widest like-count">${post.likes_count || 0}</span>
                        </button>
                    </div>
                </div>
                
                <p class="text-brand-gray/40 text-[11px] leading-relaxed font-bold uppercase tracking-widest line-clamp-2">${post.caption}</p>
                <div class="mt-8 pt-8 border-t border-brand-border flex justify-between items-center">
                    <p class="text-[8px] text-brand-gray/20 uppercase tracking-[0.4em] font-black">${timeAgo(new Date(post.created_at || Date.now()))}</p>
                    <span class="text-[8px] text-brand-pink px-3 py-1 border border-brand-pink/20 rounded-luxury font-black uppercase tracking-[0.3em]">${post.category || 'Nail'}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('feed-end-message').style.display = 'block';

    // Attach Event Listeners for the cards
    attachInteractionListeners(container);
}

function attachInteractionListeners(container) {
    // Like button logic
    const likeBtns = container.querySelectorAll('.like-btn');
    likeBtns.forEach(btn => {
        btn.addEventListener('click', async function () {
            // Require login
            if (!window.supabaseClient) return;

            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (!session) {
                alert('Please sign in to Vibe with posts!');
                const authModal = document.getElementById('auth-modal');
                if (authModal) {
                    authModal.classList.remove('hidden');
                    authModal.classList.add('flex');
                }
                return;
            }

            const postId = this.getAttribute('data-post-id');
            const isLiked = this.getAttribute('data-liked') === 'true';
            const countSpan = this.querySelector('.like-count');
            const svg = this.querySelector('svg');
            let count = parseInt(countSpan.innerText);

            // Optimistic UI update
            if (isLiked) {
                this.setAttribute('data-liked', 'false');
                this.classList.remove('text-brand-pink');
                this.classList.add('text-brand-gray/20');
                svg.setAttribute('fill', 'none');
                count--;
            } else {
                this.setAttribute('data-liked', 'true');
                this.classList.remove('text-brand-gray/20');
                this.classList.add('text-brand-pink', 'pink-glow');
                svg.setAttribute('fill', 'currentColor');
                count++;

                // Pop animation
                svg.classList.add('scale-125');
                setTimeout(() => svg.classList.remove('scale-125'), 150);
            }
            countSpan.innerText = count;

            // Database RPC call
            try {
                // Determine increment value based on the new state
                const incrementVal = isLiked ? -1 : 1;

                // Call the RPC defined in schema.sql
                const { error } = await window.supabaseClient
                    .rpc('increment_vibe', { post_id: postId, increment_val: incrementVal });

                if (error) {
                    console.error("Vibe update error:", error);
                    // Revert UI? Ideally yes, but keeping it simple for MVP
                }
            } catch (error) {
                console.error("Error updating vibes:", error);
            }
        });
    });

    // Book This Look logic -> triggers chat/booking modal
    const bookBtns = container.querySelectorAll('.book-look-btn');
    bookBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const proName = e.target.getAttribute('data-pro-name');
            const proId = e.target.getAttribute('data-pro-id');
            // Using global openChatModal from main.js
            if (typeof window.openChatModal === 'function') {
                window.openChatModal(proName, proId);
            } else {
                alert(`Preparing to book this look with ${proName}!`);
            }
        });
    });
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

function getMockPosts() {
    return [
        {
            id: '1',
            image_url: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
            caption: 'Fresh chrome set for the weekend! ✨💅 #coffinnails #chrome',
            category: 'nail',
            likes_count: 342,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            author_name: 'Sarah M.',
            author_id: 'sarah-123'
        },
        {
            id: '2',
            image_url: 'https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
            caption: 'Wispy volume lashes. Obsessed with this look! 👁️💖',
            category: 'lash',
            likes_count: 890,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            author_name: 'Chloe T.',
            author_id: 'chloe-456'
        },
        {
            id: '3',
            image_url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
            caption: 'Matte black with a touch of gold leaf details 🖤✨',
            category: 'nail',
            likes_count: 215,
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            author_name: 'Amanda\'s Studio',
            author_id: 'amanda-789'
        },
        {
            id: '4',
            image_url: 'https://images.unsplash.com/photo-1516975080661-46bca38eb8bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
            caption: 'Classic French, but make it neon pink 🎀',
            category: 'nail',
            likes_count: 512,
            created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
            author_name: 'BeautyByJess',
            author_id: 'jess-012'
        },
        {
            id: '5',
            image_url: 'https://images.unsplash.com/photo-1574701201612-8558265f04d4?auto=format&fit=crop&w=600&q=80',
            caption: 'Subtle cat eye for a natural lift. 😻',
            category: 'lash',
            likes_count: 450,
            created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
            author_name: 'Chloe T.',
            author_id: 'chloe-456'
        },
        {
            id: '6',
            image_url: 'https://images.unsplash.com/photo-1512496015851-a1dc8a47814b?auto=format&fit=crop&w=500&h=650&q=80',
            caption: 'Full Volume Installation. 👸',
            category: 'lash',
            likes_count: 654,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
            author_name: 'Amanda\'s Studio',
            author_id: 'amanda-789'
        }
    ];
}

// --- Create Post Logic ---
function initCreatePostModal() {
    const modal = document.getElementById('create-post-modal');
    const openBtn = document.getElementById('open-create-post');
    const openBtnMobile = document.getElementById('open-create-post-mobile');
    const closeBtn = document.getElementById('close-post-modal');
    const form = document.getElementById('create-post-form');
    const fileInput = document.getElementById('post-image');
    const fileNameDisplay = document.getElementById('file-name-display');
    const uploadContainer = document.getElementById('image-upload-container');

    if (!modal) return;

    // Open Modal
    const openModal = () => {
        if (!window.supabaseClient) {
            alert('Supabase client not initialized.');
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (openBtnMobile) openBtnMobile.addEventListener('click', openModal);

    // Close Modal
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        form.reset();
        fileNameDisplay.textContent = 'PNG, JPG, GIF up to 5MB';
        const existingPreview = uploadContainer.querySelector('img.preview-img');
        if (existingPreview) existingPreview.remove();
        uploadContainer.querySelector('svg').style.display = 'block';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            fileNameDisplay.textContent = file.name;

            const reader = new FileReader();
            reader.onload = function (e) {
                const existingPreview = uploadContainer.querySelector('img.preview-img');
                if (existingPreview) existingPreview.remove();

                uploadContainer.querySelector('svg').style.display = 'none';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-img w-full h-48 object-cover rounded-luxury mt-4 mx-auto border border-white/10';
                uploadContainer.insertBefore(img, uploadContainer.firstChild);
            }
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = fileInput.files[0];
        const caption = document.getElementById('post-caption').value;
        const submitBtn = document.getElementById('post-submit-btn');
        const spinner = document.getElementById('post-spinner');
        const btnText = submitBtn.querySelector('span');

        if (!file) {
            alert('Please select an image to upload.');
            return;
        }

        submitBtn.disabled = true;
        btnText.textContent = 'Uploading...';
        spinner.classList.remove('hidden');

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (!session) {
                alert('You must be logged in to post. Please log in first.');
                closeModal();
                const authModal = document.getElementById('auth-modal');
                if (authModal) {
                    authModal.classList.remove('hidden');
                    authModal.classList.add('flex');
                }
                throw new Error("Not authenticated");
            }

            const userId = session.user.id;
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `gallery/${fileName}`;

            const { error: uploadError } = await window.supabaseClient.storage
                .from('inspiration_posts')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = window.supabaseClient.storage
                .from('inspiration_posts')
                .getPublicUrl(filePath);

            const categorySelect = document.getElementById('post-category');
            const category = categorySelect ? categorySelect.value : 'nail';

            const { error: insertError } = await window.supabaseClient
                .from('posts')
                .insert([
                    {
                        author_id: userId,
                        image_url: publicUrl,
                        caption: caption,
                        category: category
                    }
                ]);

            if (insertError) throw insertError;

            alert('Post shared successfully! ✨');
            closeModal();
            initSocialFeed();

        } catch (error) {
            console.error('Error sharing post:', error);
            if (error.message !== "Not authenticated") {
                alert('Failed to share post: ' + error.message);
            }
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Post to Gallery';
            spinner.classList.add('hidden');
        }
    });
}
