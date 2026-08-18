// Authentication check - redirect to index if not logged in
(function() {
    const currentUser = localStorage.getItem('currentUser');
    const hasVisitedBefore = sessionStorage.getItem('loadingScreenShown');
    
    // If no user is logged in
    if (!currentUser) {
        // Show loading screen only once per session
        if (!hasVisitedBefore) {
            sessionStorage.setItem('loadingScreenShown', 'true');
            // Keep user on index.html (splash screen will show with 3D heart animation)
            return;
        } else {
            // If user closes splash, redirect to login
            window.location.href = 'login.html';
        }
    }
})();

// Logout function
function logout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('loadingScreenShown');
    window.location.href = 'index.html';
}

// Display current user info in header (if needed)
function displayUserInfo() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userElement = document.getElementById('currentUserName');
    
    if (userElement && currentUser.name) {
        userElement.textContent = currentUser.name;
    }
}

// Call on page load
window.addEventListener('load', displayUserInfo);
