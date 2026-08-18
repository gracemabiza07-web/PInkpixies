# Pink Pixies - Authentication & Splash Screen Setup

## Overview
This setup includes a beautiful 3D heart-shaped loading animation on the splash screen, followed by a login/signup page for user authentication.

## File Structure
```
frontend/
├── splash.html          # Loading screen with 3D heart animation (0-100%)
├── login.html           # Login & Sign Up page
├── auth-check.js        # Authentication check script (auto-redirect logic)
├── index.html           # Main landing page (protected)
└── ...other files
```

## User Flow

1. **First Visit or Session Start**
   - User lands on `splash.html`
   - 3D red heart fills from 0-100% over 3 seconds
   - Brand name "Pink Pixies" displayed at bottom
   - After loading completes → redirects to `login.html`

2. **Login/Sign Up Page**
   - Users can toggle between **Login** and **Sign Up** forms
   - **Login**: Email + Password
   - **Sign Up**: Full Name + Email + Password + Confirm Password
   - Form includes validation and error messages
   - On success → redirects to `index.html` (landing page)

3. **Protected Landing Page**
   - `auth-check.js` verifies user authentication
   - If not logged in → redirects back to `splash.html`
   - User data stored in `localStorage`

## Customization

### Modify Loading Duration
Edit `splash.html` - change the `duration` value (in milliseconds):
```javascript
const duration = 3000; // 3 seconds - change this value
```

### Change Heart Color
Edit `splash.html` - modify the gradient in the SVG:
```html
<stop offset="0%" style="stop-color:#EC4899;stop-opacity:1" /> <!-- Light pink -->
<stop offset="100%" style="stop-color:#BE185D;stop-opacity:1" /> <!-- Dark pink -->
```

### Enable Supabase Integration
Edit `login.html` and replace:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';
```

With your actual Supabase credentials. The authentication will then use Supabase instead of localStorage.

### Add Logout Button
Add this button to your header/navbar:
```html
<button onclick="logout()" class="btn-logout">Logout</button>
```

## Features

✅ 3D Heart Loading Animation  
✅ Progressive Fill Animation (0-100%)  
✅ Beautiful Gradient Design  
✅ Login/Sign Up Toggle  
✅ Email Validation  
✅ Password Confirmation  
✅ Local Storage Authentication  
✅ Supabase Integration Ready  
✅ Responsive Design  
✅ Error Messages  
✅ Loading States  

## Starting Point

To start your application, users should:
1. Navigate to `splash.html` (it will load automatically via `auth-check.js`)
2. Wait for the 3D heart to load
3. Login or create a new account
4. Access the landing page

## Database Setup (Optional)

If using Supabase, create a `users` table with:
- `id` (UUID, Primary Key)
- `email` (Text, Unique)
- `full_name` (Text)
- `password_hash` (Text - use Supabase Auth instead)
- `created_at` (Timestamp)

## Notes

- **Local Demo**: Uses `localStorage` for authentication (suitable for development/demo)
- **Production**: Replace with Supabase or your backend authentication
- **Security**: Passwords are stored in plain text in localStorage - use proper backend for production
- **Session**: Loading screen shows once per browser session using `sessionStorage`

## Testing

### Test Login
1. Signup with any email/password
2. Logout and try logging in with the same credentials
3. Try invalid credentials - should show error

### Test Responsive Design
- Heart animation scales on mobile devices
- Forms are fully responsive
- Touch-friendly buttons and inputs

---

**Pink Pixies Team** 💕
