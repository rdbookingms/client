/*
 * RDbookingMS - settings for the hosted partner page (/partners/) and Admin panel (/admin/).
 * 1. RD_API_URL: the License Admin web app link (Deploy > Manage deployments > Web app URL, ends with /exec).
 *    Pre-filled from LICENSE_SERVER_URL in your Booking App Code.gs - change it only if that link changes.
 * 2. RD_ADMIN_GOOGLE_CLIENT_ID: the "Sign in with Google" client ID for the Admin panel
 *    (Google Cloud > APIs & Services > Credentials > OAuth 2.0 Client IDs; ends with .apps.googleusercontent.com).
 *    Must be the same value as ADMIN_GOOGLE_CLIENT_ID in the License Admin Code.gs.
 */
window.RD_API_URL = 'https://script.google.com/macros/s/AKfycbzMVkyYZnAd2DeUtoT3Wnif7ZBBSC-YmOFYUCo6mBkYhWOfzGKEvWGkiOh2vMTiJfF9Gw/exec';
window.RD_ADMIN_GOOGLE_CLIENT_ID = 'PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com';
