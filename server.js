require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const crypto       = require('crypto');
const rateLimit    = require('express-rate-limit');
const { WebSocketServer, WebSocket } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const twilio        = require('twilio');

const app = express();

// Render (and most hosts) sit behind a reverse proxy — this tells
// express-rate-limit to trust X-Forwarded-For so limits are keyed on
// the real client IP instead of the proxy's.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '12mb' })); // photos arrive as compressed base64 data URLs
app.use(express.static(__dirname));

// ══════════════════════════════════════════════════════════
// CONFIG — everything below comes from .env (see .env.example).
// No secrets are hard-coded in this file.
// ══════════════════════════════════════════════════════════
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('   Copy .env.example to .env and fill in your Supabase project details.');
    process.exit(1);
}

// Service Role key — this server is a trusted backend, so it talks to
// Supabase directly and bypasses RLS. NEVER send this key to the browser.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Twilio Verify ──────────────────────────────────────────
const TWILIO_ENABLED = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);
const twilioClient   = TWILIO_ENABLED ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

if (!TWILIO_ENABLED) {
    console.warn('⚠️  Twilio credentials not set in .env — falling back to local DEV-mode OTP.');
    console.warn('    Codes will be returned in the API response instead of texted.');
    console.warn('    Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID to send real SMS.');
}

// ══════════════════════════════════════════════════════════
// AUTH CONFIG
// ══════════════════════════════════════════════════════════
const OTP_COOLDOWN_SECONDS = 60;   // per-phone-number resend cooldown
const OTP_EXPIRY_MINUTES   = 5;    // only used by the DEV-mode fallback — Twilio manages its own expiry
const SESSION_DAYS         = 90;   // access-token lifetime (the "sessions" table)
const REFRESH_TOKEN_DAYS   = 365;  // refresh-token / device-trust lifetime ("trusted_devices" table)

/**
 * Sends the OTP via Twilio Verify. Twilio manages code generation,
 * storage, expiry, and attempt-limiting on its own side — this app
 * only ever sees "approved" or "not approved".
 */
async function sendOtpViaTwilio(phone) {
    return twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phone, channel: 'sms' });
}

async function checkOtpViaTwilio(phone, code) {
    return twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });
}

/**
 * Normalizes any reasonable PH mobile number format (09XXXXXXXXX,
 * 9XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX, with spaces/dashes) into
 * a canonical +63XXXXXXXXXX string. Returns null if invalid.
 */
function normalizeMobileNumber(raw) {
    if (!raw) return null;
    let digits = String(raw).trim().replace(/[^\d+]/g, '');

    if (digits.startsWith('+63'))            digits = digits.slice(3);
    else if (digits.startsWith('63') && digits.length === 12) digits = digits.slice(2);
    else if (digits.startsWith('0'))          digits = digits.slice(1);

    if (!/^9\d{9}$/.test(digits)) return null;
    return `+63${digits}`;
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString('hex');
}

/**
 * Refresh tokens are hashed before storage — same idea as a password
 * hash, except a fast hash (SHA-256) is appropriate here because the
 * input isn't a guessable password, it's a 384-bit random value.
 * Brute-forcing that via hash guesses isn't a realistic attack.
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Great-circle distance between two coordinates, in meters. */
function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ALLOWED_PHOTO_TYPES = ['storefront', 'gate', 'entrance', 'building', 'signboard'];

// Must stay in sync with the thresholds hard-coded into confirm_seller() /
// report_seller_incorrect() in the Phase 2 migration — used here only for
// recomputing status after a merge, not for the live confirm/report path.
const CONFIRM_THRESHOLD = 3;
const REPORT_THRESHOLD  = 3;

/**
 * Middleware: resolves the session token (Authorization: Bearer <token>,
 * or ?token= as a fallback for simple GETs) into req.rider.
 */
async function authenticate(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ')
        ? header.slice(7)
        : (req.query.token || (req.body && req.body.token));

    if (!token) {
        return res.status(401).json({ error: 'Not signed in.' });
    }

    try {
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('token', token)
            .single();

        if (sessionError || !session) {
            return res.status(401).json({ error: 'Session not found. Please sign in again.' });
        }

        if (new Date(session.expires_at).getTime() < Date.now()) {
            return res.status(401).json({ error: 'Session expired. Please sign in again.' });
        }

        const { data: rider, error: riderError } = await supabase
            .from('riders')
            .select('*')
            .eq('rider_id', session.rider_id)
            .single();

        if (riderError || !rider) {
            return res.status(401).json({ error: 'Account not found. Please sign in again.' });
        }

        if (rider.is_banned) {
            return res.status(403).json({ error: 'Your account has been banned due to a policy violation.' });
        }
        if (rider.is_active === false) {
            return res.status(403).json({ error: 'Your account is inactive. Please contact support.' });
        }

        req.rider = rider;
        req.sessionToken = token;

        // Best-effort touch — don't block the request on it.
        supabase.from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('token', token)
            .then(() => {}, () => {});

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(500).json({ error: 'Server error verifying session.' });
    }
}

/**
 * Middleware factory: only lets riders with one of the given roles
 * through. Must run after authenticate() so req.rider is set.
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.rider || !allowedRoles.includes(req.rider.role)) {
            return res.status(403).json({ error: 'You do not have permission to do this.' });
        }
        next();
    };
}

// ── Rate limiting for OTP endpoints ──────────────────────────
const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many code requests from this device. Please try again later.' }
});

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' }
});

// In-memory per-phone-number cooldown — separate from the IP-based
// limiter above. A shared/NAT'd IP (common on mobile carriers)
// shouldn't block every rider behind it, but a single number spamming
// resend should still be capped.
const otpPhoneCooldowns = new Map();

function checkPhoneCooldown(phone) {
    const last = otpPhoneCooldowns.get(phone);
    if (last && Date.now() - last < OTP_COOLDOWN_SECONDS * 1000) {
        return Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - (Date.now() - last)) / 1000);
    }
    return 0;
}

// ══════════════════════════════════════════════════════════
// REAL-TIME NOTIFICATIONS — HTTP + WebSocket server
// ── Wrapping Express in a raw http.Server lets us attach a
//    WebSocket server on the SAME port at /ws/notifications,
//    so every connected rider gets new-seller alerts instantly.
// ══════════════════════════════════════════════════════════
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws/notifications' });

wss.on('connection', (ws) => {
    console.log(`🔔 Notification client connected (${wss.clients.size} online)`);
    ws.on('close', () => {
        console.log(`🔌 Notification client disconnected (${wss.clients.size} online)`);
    });
    ws.on('error', () => { /* ignore broken pipes */ });
});

/**
 * Send a notification payload to every connected client in real time.
 */
function broadcastNotification(notification) {
    const payload = JSON.stringify({ type: 'new_notification', notification });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// ══════════════════════════════════════════════════════════
// 0. HEALTH CHECK (used by frontend to test server connectivity)
// ══════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ══════════════════════════════════════════════════════════
// 1. AUTH — Twilio Verify SMS OTP + persistent device-trust login
// ── OTP is only ever required for: (a) a phone number's very first
//    verification, or (b) a device whose trust was revoked/lost.
//    Every other app launch re-authenticates silently via the
//    device's refresh token — see /api/auth/device-login below.
// ══════════════════════════════════════════════════════════

// 1a. Send a code
app.post('/api/send-otp', otpSendLimiter, async (req, res) => {
    const phone = normalizeMobileNumber(req.body.phone);

    if (!phone) {
        return res.status(400).json({ error: 'Enter a valid Philippine mobile number, e.g. 09171234567.' });
    }

    const waitSeconds = checkPhoneCooldown(phone);
    if (waitSeconds > 0) {
        return res.status(429).json({ error: `Please wait ${waitSeconds}s before requesting another code.` });
    }

    try {
        if (TWILIO_ENABLED) {
            await sendOtpViaTwilio(phone);
            otpPhoneCooldowns.set(phone, Date.now());
            return res.status(200).json({ success: true, message: 'Code sent.', phone });
        }

        // ── DEV FALLBACK (Twilio not configured in .env) ──
        const code      = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        const { error: insertError } = await supabase
            .from('otp_codes')
            .insert([{ mobile_number: phone, code, expires_at: expiresAt }]);

        if (insertError) {
            console.error('OTP insert error:', insertError);
            return res.status(500).json({ error: 'Could not send code. Please try again.' });
        }

        console.log(`[DEV OTP — Twilio not configured] ${phone} → ${code}`);
        otpPhoneCooldowns.set(phone, Date.now());

        res.status(200).json({
            success: true,
            message: 'Code sent (dev mode).',
            phone,
            devOtp:  code,
            devNote: 'DEV MODE — Twilio is not configured, code shown here instead of texted.'
        });

    } catch (err) {
        console.error('Send OTP error:', err?.message || err);
        res.status(500).json({ error: 'Could not send the code. Please check the number and try again.' });
    }
});

// 1b. Verify a code → find-or-create the rider (never duplicates an
//     existing phone number), registers this device as trusted, and
//     returns both an access token (session) and a refresh token
//     (device trust, for silent re-login on future app launches).
app.post('/api/verify-otp', otpVerifyLimiter, async (req, res) => {
    const phone       = normalizeMobileNumber(req.body.phone);
    const code        = String(req.body.code || '').trim();
    const name        = String(req.body.name || '').trim();
    const deviceUuid  = String(req.body.deviceUuid || '').trim();
    const deviceModel = String(req.body.deviceModel || '').slice(0, 200);

    if (!phone || !code) {
        return res.status(400).json({ error: 'Missing phone number or code.' });
    }
    if (!deviceUuid) {
        return res.status(400).json({ error: 'Missing device identifier.' });
    }

    try {
        let approved = false;

        if (TWILIO_ENABLED) {
            const check = await checkOtpViaTwilio(phone, code);
            approved = check.status === 'approved';
        } else {
            // ── DEV FALLBACK ──
            const { data: rows } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('mobile_number', phone)
                .eq('verified', false)
                .order('created_at', { ascending: false })
                .limit(1);

            const otpRow = rows && rows[0];
            if (otpRow && new Date(otpRow.expires_at).getTime() >= Date.now() && otpRow.code === code) {
                approved = true;
                await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRow.id);
            }
        }

        if (!approved) {
            return res.status(400).json({ error: 'Incorrect or expired code. Please try again.' });
        }

        // Find or create the rider — an already-registered phone
        // number logs into its existing account, it never gets a
        // second one.
        let { data: rider } = await supabase
            .from('riders')
            .select('*')
            .eq('mobile_number', phone)
            .single();

        if (!rider) {
            const { data: newRider, error: insertError } = await supabase
                .from('riders')
                .insert([{
                    rider_id:       phone,
                    mobile_number:  phone,
                    name:           name || 'Rider',
                    credits:        3,
                    is_banned:      false,
                    role:           'rider',
                    is_active:      true,
                    phone_verified: true
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Rider create error:', insertError);
                return res.status(500).json({ error: 'Could not create your account. Please try again.' });
            }
            rider = newRider;
        } else if (!rider.phone_verified) {
            await supabase.from('riders').update({ phone_verified: true }).eq('rider_id', rider.rider_id);
            rider.phone_verified = true;
        }

        if (rider.is_banned) {
            return res.status(403).json({ error: 'Your account has been banned due to a policy violation.' });
        }
        if (rider.is_active === false) {
            return res.status(403).json({ error: 'Your account is inactive. Please contact support.' });
        }

        // Register (or re-trust) this device
        const refreshToken     = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);
        const deviceExpiresAt  = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const { error: deviceError } = await supabase
            .from('trusted_devices')
            .upsert([{
                rider_id:           rider.rider_id,
                device_uuid:        deviceUuid,
                refresh_token_hash: refreshTokenHash,
                device_model:       deviceModel || null,
                last_login:         new Date().toISOString(),
                expires_at:         deviceExpiresAt,
                revoked_at:         null
            }], { onConflict: 'rider_id,device_uuid' });

        if (deviceError) {
            console.error('Trusted device upsert error:', deviceError);
            return res.status(500).json({ error: 'Could not register this device. Please try again.' });
        }

        // Mint an access token (session) for immediate use
        const token     = generateSessionToken();
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const { error: sessionError } = await supabase
            .from('sessions')
            .insert([{ token, rider_id: rider.rider_id, expires_at: expiresAt }]);

        if (sessionError) {
            console.error('Session create error:', sessionError);
            return res.status(500).json({ error: 'Could not start your session. Please try again.' });
        }

        res.status(200).json({ token, refreshToken, deviceUuid, rider });

    } catch (err) {
        console.error('Verify OTP error:', err?.message || err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// 1c. Silent re-authentication — called on every app launch. No phone
//     number, no OTP: trades a still-trusted device's refresh token
//     for a fresh session, rotating the refresh token in the process.
app.post('/api/auth/device-login', async (req, res) => {
    const deviceUuid   = String(req.body.deviceUuid || '').trim();
    const refreshToken = String(req.body.refreshToken || '').trim();

    if (!deviceUuid || !refreshToken) {
        return res.status(400).json({ error: 'Missing device credentials.' });
    }

    try {
        const providedHash = hashToken(refreshToken);

        const { data: device, error: deviceError } = await supabase
            .from('trusted_devices')
            .select('*')
            .eq('device_uuid', deviceUuid)
            .is('revoked_at', null)
            .single();

        if (deviceError || !device || device.refresh_token_hash !== providedHash) {
            return res.status(401).json({ error: 'This device is not signed in. Please verify your phone number.' });
        }

        if (new Date(device.expires_at).getTime() < Date.now()) {
            return res.status(401).json({ error: 'This device\'s trust has expired. Please verify your phone number.' });
        }

        const { data: rider, error: riderError } = await supabase
            .from('riders')
            .select('*')
            .eq('rider_id', device.rider_id)
            .single();

        if (riderError || !rider) {
            return res.status(401).json({ error: 'Account not found. Please verify your phone number.' });
        }
        if (rider.is_banned) {
            return res.status(403).json({ error: 'Your account has been banned due to a policy violation.' });
        }
        if (rider.is_active === false) {
            return res.status(403).json({ error: 'Your account is inactive. Please contact support.' });
        }

        // Rotate the refresh token every time it's used, and slide the
        // trust expiry forward — an actively-used device effectively
        // never needs OTP again, while an abandoned one still lapses.
        const newRefreshToken     = generateRefreshToken();
        const newRefreshTokenHash = hashToken(newRefreshToken);
        const newExpiresAt        = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

        await supabase
            .from('trusted_devices')
            .update({
                refresh_token_hash: newRefreshTokenHash,
                last_login:         new Date().toISOString(),
                expires_at:         newExpiresAt
            })
            .eq('id', device.id);

        const token     = generateSessionToken();
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const { error: sessionError } = await supabase
            .from('sessions')
            .insert([{ token, rider_id: rider.rider_id, expires_at: expiresAt }]);

        if (sessionError) {
            console.error('Session create error:', sessionError);
            return res.status(500).json({ error: 'Could not start your session. Please try again.' });
        }

        res.status(200).json({ token, refreshToken: newRefreshToken, rider });

    } catch (err) {
        console.error('Device login error:', err?.message || err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// 1d. Legacy session check — kept as a fallback for any device that
//     already holds a bare session token from before the device-trust
//     upgrade. New logins go through device-login above instead.
app.get('/api/auth/session', authenticate, (req, res) => {
    res.status(200).json({ rider: req.rider });
});

// 1e. Explicit logout — revokes this device's refresh token, so the
//     NEXT launch requires phone verification again rather than a
//     silent refresh. (Per-request session deletion still happens
//     regardless, exactly as before.)
app.post('/api/auth/logout', async (req, res) => {
    const header     = req.headers['authorization'] || '';
    const token      = header.startsWith('Bearer ') ? header.slice(7) : req.body.token;
    const deviceUuid = String(req.body.deviceUuid || '').trim();

    try {
        let riderId = null;

        if (token) {
            const { data: session } = await supabase.from('sessions').select('rider_id').eq('token', token).single();
            if (session) riderId = session.rider_id;
            await supabase.from('sessions').delete().eq('token', token);
        }

        if (riderId && deviceUuid) {
            await supabase
                .from('trusted_devices')
                .update({ revoked_at: new Date().toISOString() })
                .eq('rider_id', riderId)
                .eq('device_uuid', deviceUuid);
        }
    } catch (err) {
        console.error('Logout error:', err);
    }

    res.status(200).json({ success: true });
});


// ══════════════════════════════════════════════════════════
// 2. ENCODE LOCATION (+2 Credits, with anti-spam)
// ══════════════════════════════════════════════════════════
app.post('/api/save-location', authenticate, async (req, res) => {
    const { seller, lat, lng, landmark } = req.body;
    const riderId = req.rider.rider_id;

    if (!seller || !lat || !lng) {
        return res.status(400).json({ error: 'Missing required information.' });
    }
    if (!landmark || !landmark.trim()) {
        return res.status(400).json({ error: 'A short landmark note is required (e.g. "Blue gate").' });
    }

    try {
        // Get rider's current credits and last encode time
        const { data: currentRider, error: riderError } = await supabase
            .from('riders')
            .select('credits, last_encode_time')
            .eq('rider_id', riderId)
            .single();

        if (riderError || !currentRider) {
            return res.status(404).json({ error: 'Rider not found.' });
        }

        // Anti-spam: 2-minute cooldown between encodes
        if (currentRider.last_encode_time) {
            const lastEncode      = new Date(currentRider.last_encode_time).getTime();
            const now             = Date.now();
            const timeDiffMinutes = (now - lastEncode) / (1000 * 60);

            if (timeDiffMinutes < 2) {
                const timeRemaining = Math.ceil(2 - timeDiffMinutes);
                return res.status(429).json({
                    error: `Please wait! You can encode again in ${timeRemaining} minute(s).`
                });
            }
        }

        // Safety net: block only a same-name seller that's ALSO right nearby.
        // (The client already runs a softer, wider "possible duplicate" check
        // via /api/sellers/check-duplicate before ever reaching this call —
        // this is just the last line of defense against true duplicates.)
        const { data: sameNameSellers } = await supabase
            .from('sellers')
            .select('id, latitude, longitude')
            .ilike('seller_name', seller);

        const tooClose = (sameNameSellers || []).some(s =>
            distanceMeters(parseFloat(lat), parseFloat(lng), s.latitude, s.longitude) <= 50
        );

        if (tooClose) {
            return res.status(400).json({ error: 'This seller has already been encoded nearby.' });
        }

        // Insert new seller (verification_status defaults to 'pending')
        const { data: insertedSeller, error: sellerError } = await supabase
            .from('sellers')
            .insert([{
                seller_name: seller,
                latitude:    lat,
                longitude:   lng,
                landmark:    landmark.trim(),
                encoded_by:  riderId
            }])
            .select()
            .single();

        if (sellerError) {
            console.error('Seller insert error:', sellerError);
            return res.status(500).json({ error: sellerError.message });
        }

        // Add +2 credits and update last encode time
        const newCredits = (currentRider.credits || 0) + 2;

        await supabase
            .from('riders')
            .update({ credits: newCredits, last_encode_time: new Date().toISOString() })
            .eq('rider_id', riderId);

        // ── Create + persist + broadcast a notification for this new seller ──
        const notification = {
            id:          `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title:       'New Seller Location Added',
            message:     `${seller} has been added to the database.`,
            seller_name: seller,
            created_at:  new Date().toISOString()
        };

        try {
            const { error: notifError } = await supabase
                .from('notifications')
                .insert([notification]);

            if (notifError) {
                console.error('Notification insert error:', notifError);
            }
        } catch (notifErr) {
            console.error('Notification insert error:', notifErr);
        }

        // Broadcast to every connected rider in real time (best-effort)
        broadcastNotification({
            id:        notification.id,
            title:     notification.title,
            message:   notification.message,
            seller:    notification.seller_name,
            timestamp: notification.created_at
        });

        res.status(200).json({
            message:      'Success!',
            addedCredits: 2,
            totalCredits: newCredits,
            seller:       insertedSeller,
            notification: {
                id:        notification.id,
                title:     notification.title,
                message:   notification.message,
                seller:    notification.seller_name,
                timestamp: notification.created_at
            }
        });

    } catch (err) {
        console.error('Save location error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});


// ══════════════════════════════════════════════════════════
// 3. SEARCH SELLER (-1 Credit)
// ══════════════════════════════════════════════════════════
app.get('/api/search-seller', authenticate, async (req, res) => {
    const { name } = req.query;
    const riderId  = req.rider.rider_id;

    if (!name) {
        return res.status(400).json({ error: 'Missing required parameters.' });
    }

    try {
        // Get rider's current credits
        const { data: rider, error: riderError } = await supabase
            .from('riders')
            .select('credits')
            .eq('rider_id', riderId)
            .single();

        if (riderError || !rider) {
            return res.status(404).json({ error: 'Rider ID not found.' });
        }

        // Block search if no credits
        if (rider.credits <= 0) {
            return res.status(403).json({
                error: 'You have no credits left! Encode a new seller to earn +2 credits.'
            });
        }

        // Search sellers
        const { data: sellers, error: searchError } = await supabase
            .from('sellers')
            .select('*')
            .eq('is_active', true)
            .ilike('seller_name', `%${name}%`);

        if (searchError) {
            console.error('Search error:', searchError);
            return res.status(500).json({ error: searchError.message });
        }

        // Deduct -1 credit
        const finalCredits = rider.credits - 1;
        await supabase
            .from('riders')
            .update({ credits: finalCredits })
            .eq('rider_id', riderId);

        res.status(200).json({ sellers, remainingCredits: finalCredits });

    } catch (err) {
        console.error('Search seller error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});


// ══════════════════════════════════════════════════════════
// 4. GET ALL SELLER NAMES (free, for autocomplete dropdown)
// ══════════════════════════════════════════════════════════
app.get('/api/all-seller-names', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status')
            .eq('is_active', true);

        if (error) {
            console.error('All seller names error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('All seller names error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 5. GET RECENT NOTIFICATIONS (free, for cross-device sync)
// ══════════════════════════════════════════════════════════
app.get('/api/notifications', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Fetch notifications error:', error);
            return res.status(500).json({ error: error.message });
        }

        const notifications = (data || []).map(n => ({
            id:        n.id,
            title:     n.title,
            message:   n.message,
            seller:    n.seller_name,
            timestamp: n.created_at
        }));

        res.status(200).json(notifications);

    } catch (err) {
        console.error('Fetch notifications error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 6. LIVE MAP — all sellers with verification status
// ══════════════════════════════════════════════════════════
app.get('/api/sellers/map', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status, confirmation_count, landmark')
            .eq('is_active', true);

        if (error) {
            console.error('Sellers map error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data || []);

    } catch (err) {
        console.error('Sellers map error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 7. MY CONTRIBUTIONS — sellers this rider has encoded
// ══════════════════════════════════════════════════════════
app.get('/api/my-contributions', authenticate, async (req, res) => {
    const riderId = req.rider.rider_id;

    try {
        const { count, error: countError } = await supabase
            .from('sellers')
            .select('id', { count: 'exact', head: true })
            .eq('encoded_by', riderId);

        if (countError) {
            console.error('My contributions count error:', countError);
            return res.status(500).json({ error: countError.message });
        }

        const { data: recent, error: recentError } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status, created_at')
            .eq('encoded_by', riderId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (recentError) {
            console.error('My contributions recent error:', recentError);
            return res.status(500).json({ error: recentError.message });
        }

        res.status(200).json({
            totalEncoded:        count || 0,
            creditsFromEncoding: (count || 0) * 2,
            recent:              recent || []
        });

    } catch (err) {
        console.error('My contributions error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 8. SELLER DETAIL — always-fresh data for the bottom sheet
// ══════════════════════════════════════════════════════════
app.get('/api/sellers/:id', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }

    try {
        const { data, error } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status, confirmation_count, report_count, last_verified_at, landmark, created_at, is_active, merged_into_id')
            .eq('id', sellerId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Seller not found.' });
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('Seller detail error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 9. CONFIRM / REPORT — community verification
// ── Both call an atomic Postgres RPC function so two riders
//    acting on the same seller at the same moment can't race
//    each other's counters. Each rider can confirm — and,
//    separately, report — any seller at most once (enforced
//    by a unique index; a repeat attempt surfaces as a 400).
// ══════════════════════════════════════════════════════════
app.post('/api/sellers/:id/confirm', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }

    try {
        const { data, error } = await supabase.rpc('confirm_seller', {
            p_seller_id: sellerId,
            p_rider_id:  req.rider.rider_id
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: "You've already confirmed this seller." });
            }
            console.error('Confirm seller error:', error);
            return res.status(500).json({ error: 'Could not confirm this seller. Please try again.' });
        }

        res.status(200).json({ seller: data });

    } catch (err) {
        console.error('Confirm seller error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/sellers/:id/report', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }

    try {
        const { data, error } = await supabase.rpc('report_seller_incorrect', {
            p_seller_id: sellerId,
            p_rider_id:  req.rider.rider_id
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: "You've already reported this seller." });
            }
            console.error('Report seller error:', error);
            return res.status(500).json({ error: 'Could not report this seller. Please try again.' });
        }

        res.status(200).json({ seller: data });

    } catch (err) {
        console.error('Report seller error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 10. PHOTOS / NOTES — read-only in Phase 2
// ── Tables exist since Phase 1; uploading/adding lands in
//    Phase 3. These always return an (empty, for now) list so
//    the bottom sheet's View Photos / View Notes panels are
//    already wired up correctly.
// ══════════════════════════════════════════════════════════
app.get('/api/sellers/:id/photos', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }

    try {
        const { data, error } = await supabase
            .from('seller_photos')
            .select('id, photo_url, photo_type, uploaded_by, created_at')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Seller photos error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data || []);

    } catch (err) {
        console.error('Seller photos error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.get('/api/sellers/:id/notes', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }

    try {
        const { data, error } = await supabase
            .from('seller_notes')
            .select('id, note_text, created_by, created_at')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Seller notes error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data || []);

    } catch (err) {
        console.error('Seller notes error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 11. DUPLICATE DETECTION — run before creating a new seller
// ── Wider net than the hard safety-net in /save-location: matches
//    on proximity (within 120m) OR a similar name, so the rider can
//    make an informed "use existing vs. create new" choice instead
//    of a silent server-side rejection.
// ══════════════════════════════════════════════════════════
const DUPLICATE_CHECK_RADIUS_M = 120;

app.post('/api/sellers/check-duplicate', authenticate, async (req, res) => {
    const { name, lat, lng } = req.body;

    if (!name || lat == null || lng == null) {
        return res.status(400).json({ error: 'Missing name or coordinates.' });
    }

    try {
        const nameWords = name.trim().split(/\s+/)[0]; // first word is usually enough to catch near-duplicates
        const { data: nameMatches } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status')
            .eq('is_active', true)
            .ilike('seller_name', `%${nameWords}%`);

        const { data: allSellers } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status')
            .eq('is_active', true);

        const candidateMap = new Map();
        (nameMatches || []).forEach(s => candidateMap.set(s.id, s));
        (allSellers || []).forEach(s => {
            if (distanceMeters(parseFloat(lat), parseFloat(lng), s.latitude, s.longitude) <= DUPLICATE_CHECK_RADIUS_M) {
                candidateMap.set(s.id, s);
            }
        });

        const candidates = Array.from(candidateMap.values())
            .map(s => ({ ...s, distanceMeters: Math.round(distanceMeters(parseFloat(lat), parseFloat(lng), s.latitude, s.longitude)) }))
            .sort((a, b) => a.distanceMeters - b.distanceMeters)
            .slice(0, 5);

        res.status(200).json({ candidates });

    } catch (err) {
        console.error('Check duplicate error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 12. ADD PHOTO — encode-time or ongoing community contribution
// ── Photos arrive as compressed base64 data URLs (resized
//    client-side before send) and land in Supabase Storage.
// ══════════════════════════════════════════════════════════
app.post('/api/sellers/:id/photos', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    const { photoType, dataUrl } = req.body;

    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }
    if (!ALLOWED_PHOTO_TYPES.includes(photoType)) {
        return res.status(400).json({ error: 'Invalid photo type.' });
    }
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl || '');
    if (!match) {
        return res.status(400).json({ error: 'Invalid image data.' });
    }

    try {
        const ext    = match[1] === 'jpg' ? 'jpeg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const path   = `sellers/${sellerId}/${Date.now()}_${photoType}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('seller-photos')
            .upload(path, buffer, { contentType: `image/${ext}` });

        if (uploadError) {
            console.error('Photo upload error:', uploadError);
            return res.status(500).json({ error: 'Could not upload photo. Please try again.' });
        }

        const { data: urlData } = supabase.storage.from('seller-photos').getPublicUrl(path);

        const { data: photoRow, error: insertError } = await supabase
            .from('seller_photos')
            .insert([{
                seller_id:   sellerId,
                photo_url:   urlData.publicUrl,
                photo_type:  photoType,
                uploaded_by: req.rider.rider_id
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Photo record insert error:', insertError);
            return res.status(500).json({ error: 'Photo uploaded, but could not be saved. Please try again.' });
        }

        res.status(200).json({ photo: photoRow });

    } catch (err) {
        console.error('Add photo error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 13. ADD NOTE — short landmark tips, community-contributed
// ══════════════════════════════════════════════════════════
app.post('/api/sellers/:id/notes', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    const noteText = String(req.body.noteText || '').trim();

    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }
    if (!noteText) {
        return res.status(400).json({ error: 'Note cannot be empty.' });
    }
    if (noteText.length > 60) {
        return res.status(400).json({ error: 'Keep notes short — 60 characters max (e.g. "Blue gate").' });
    }

    try {
        const { data: noteRow, error } = await supabase
            .from('seller_notes')
            .insert([{ seller_id: sellerId, note_text: noteText, created_by: req.rider.rider_id }])
            .select()
            .single();

        if (error) {
            console.error('Add note error:', error);
            return res.status(500).json({ error: 'Could not add note. Please try again.' });
        }

        res.status(200).json({ note: noteRow });

    } catch (err) {
        console.error('Add note error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 14. PROPOSE LOCATION CORRECTION — "Move Incorrect Pin"
// ── Goes to moderator review rather than applying instantly —
//    an unmoderated pin move would be an easy way to grief data.
// ══════════════════════════════════════════════════════════
app.post('/api/sellers/:id/propose-correction', authenticate, async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    const { lat, lng, reason } = req.body;

    if (!Number.isInteger(sellerId)) {
        return res.status(400).json({ error: 'Invalid seller id.' });
    }
    if (lat == null || lng == null) {
        return res.status(400).json({ error: 'Missing coordinates.' });
    }

    try {
        const { data: existing } = await supabase
            .from('seller_location_corrections')
            .select('id')
            .eq('seller_id', sellerId)
            .eq('proposed_by', req.rider.rider_id)
            .eq('status', 'pending')
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'You already have a pending correction for this seller.' });
        }

        const { data: correction, error } = await supabase
            .from('seller_location_corrections')
            .insert([{
                seller_id:    sellerId,
                proposed_lat: lat,
                proposed_lng: lng,
                reason:       reason || null,
                proposed_by:  req.rider.rider_id
            }])
            .select()
            .single();

        if (error) {
            console.error('Propose correction error:', error);
            return res.status(500).json({ error: 'Could not submit correction. Please try again.' });
        }

        res.status(200).json({ correction });

    } catch (err) {
        console.error('Propose correction error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 15. MODERATION — pending / reported seller queues
// ══════════════════════════════════════════════════════════
app.get('/api/moderation/sellers/pending', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status, confirmation_count, encoded_by, created_at')
            .eq('verification_status', 'pending')
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json(data || []);

    } catch (err) {
        console.error('Pending sellers error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.get('/api/moderation/sellers/reported', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sellers')
            .select('id, seller_name, latitude, longitude, verification_status, confirmation_count, report_count, encoded_by, created_at')
            .eq('verification_status', 'reported_incorrect')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json(data || []);

    } catch (err) {
        console.error('Reported sellers error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/moderation/sellers/:id/set-status', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    const sellerId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!Number.isInteger(sellerId)) return res.status(400).json({ error: 'Invalid seller id.' });
    if (!['pending', 'verified', 'reported_incorrect'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    try {
        const updateObj = { verification_status: status };
        if (status === 'verified') updateObj.last_verified_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('sellers')
            .update(updateObj)
            .eq('id', sellerId)
            .select()
            .single();

        if (error || !data) return res.status(404).json({ error: 'Seller not found.' });
        res.status(200).json({ seller: data });

    } catch (err) {
        console.error('Set status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 16. MODERATION — location correction review queue
// ══════════════════════════════════════════════════════════
app.get('/api/moderation/corrections', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    try {
        const { data: corrections, error } = await supabase
            .from('seller_location_corrections')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const sellerIds = [...new Set((corrections || []).map(c => c.seller_id))];
        const riderIds  = [...new Set((corrections || []).map(c => c.proposed_by))];

        const [sellersRes, ridersRes] = await Promise.all([
            sellerIds.length
                ? supabase.from('sellers').select('id, seller_name, latitude, longitude').in('id', sellerIds)
                : Promise.resolve({ data: [] }),
            riderIds.length
                ? supabase.from('riders').select('rider_id, name').in('rider_id', riderIds)
                : Promise.resolve({ data: [] })
        ]);

        const sellerMap = new Map((sellersRes.data || []).map(s => [s.id, s]));
        const riderMap  = new Map((ridersRes.data  || []).map(r => [r.rider_id, r]));

        const enriched = (corrections || []).map(c => {
            const seller = sellerMap.get(c.seller_id);
            return {
                ...c,
                seller_name:      seller ? seller.seller_name : 'Unknown seller',
                current_lat:      seller ? seller.latitude    : null,
                current_lng:      seller ? seller.longitude   : null,
                proposed_by_name: riderMap.get(c.proposed_by)?.name || c.proposed_by
            };
        });

        res.status(200).json(enriched);

    } catch (err) {
        console.error('Fetch corrections error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/moderation/corrections/:id/approve', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    const correctionId = parseInt(req.params.id, 10);
    if (!Number.isInteger(correctionId)) return res.status(400).json({ error: 'Invalid id.' });

    try {
        const { data: correction, error: fetchError } = await supabase
            .from('seller_location_corrections')
            .select('*')
            .eq('id', correctionId)
            .single();

        if (fetchError || !correction) return res.status(404).json({ error: 'Correction not found.' });
        if (correction.status !== 'pending') return res.status(400).json({ error: 'This correction was already reviewed.' });

        await supabase
            .from('sellers')
            .update({ latitude: correction.proposed_lat, longitude: correction.proposed_lng })
            .eq('id', correction.seller_id);

        const { data: updated, error: updateError } = await supabase
            .from('seller_location_corrections')
            .update({ status: 'approved', reviewed_by: req.rider.rider_id, reviewed_at: new Date().toISOString() })
            .eq('id', correctionId)
            .select()
            .single();

        if (updateError) return res.status(500).json({ error: updateError.message });
        res.status(200).json({ correction: updated });

    } catch (err) {
        console.error('Approve correction error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/moderation/corrections/:id/reject', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    const correctionId = parseInt(req.params.id, 10);
    if (!Number.isInteger(correctionId)) return res.status(400).json({ error: 'Invalid id.' });

    try {
        const { data: updated, error } = await supabase
            .from('seller_location_corrections')
            .update({ status: 'rejected', reviewed_by: req.rider.rider_id, reviewed_at: new Date().toISOString() })
            .eq('id', correctionId)
            .eq('status', 'pending')
            .select()
            .single();

        if (error || !updated) return res.status(400).json({ error: 'Could not reject — it may have already been reviewed.' });
        res.status(200).json({ correction: updated });

    } catch (err) {
        console.error('Reject correction error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 17. MODERATION — merge duplicate sellers
// ── Reassigns photos/notes outright; confirmations/reports are
//    reassigned too, except votes that would collide with one the
//    same rider already cast on the primary (those are just dropped,
//    not double-counted). Counters + status are recomputed from the
//    merged vote set afterward. The loser is deactivated, not
//    deleted, so history and any stale links to it survive.
// ══════════════════════════════════════════════════════════
app.post('/api/sellers/merge', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
    const primaryId   = parseInt(req.body.primaryId, 10);
    const duplicateId = parseInt(req.body.duplicateId, 10);

    if (!Number.isInteger(primaryId) || !Number.isInteger(duplicateId) || primaryId === duplicateId) {
        return res.status(400).json({ error: 'Pick two different sellers to merge.' });
    }

    try {
        const { data: sellers, error: fetchError } = await supabase
            .from('sellers')
            .select('id, seller_name, is_active')
            .in('id', [primaryId, duplicateId]);

        if (fetchError || !sellers || sellers.length !== 2) {
            return res.status(404).json({ error: 'Could not find both sellers.' });
        }
        const dup = sellers.find(s => s.id === duplicateId);
        if (!dup.is_active) {
            return res.status(400).json({ error: 'That seller was already merged into something else.' });
        }

        await supabase.from('seller_photos').update({ seller_id: primaryId }).eq('seller_id', duplicateId);
        await supabase.from('seller_notes').update({ seller_id: primaryId }).eq('seller_id', duplicateId);

        const { data: dupVotes }     = await supabase.from('seller_confirmations').select('*').eq('seller_id', duplicateId);
        const { data: primaryVotes } = await supabase.from('seller_confirmations').select('rider_id, action').eq('seller_id', primaryId);

        const primaryVoteKeys = new Set((primaryVotes || []).map(v => `${v.rider_id}:${v.action}`));

        for (const vote of (dupVotes || [])) {
            const key = `${vote.rider_id}:${vote.action}`;
            if (primaryVoteKeys.has(key)) {
                await supabase.from('seller_confirmations').delete().eq('id', vote.id);
            } else {
                await supabase.from('seller_confirmations').update({ seller_id: primaryId }).eq('id', vote.id);
                primaryVoteKeys.add(key);
            }
        }

        const { count: confirmCount } = await supabase
            .from('seller_confirmations')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', primaryId)
            .eq('action', 'confirm');

        const { count: reportCount } = await supabase
            .from('seller_confirmations')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', primaryId)
            .eq('action', 'report_incorrect');

        const newStatus = (reportCount || 0) >= REPORT_THRESHOLD
            ? 'reported_incorrect'
            : (confirmCount || 0) >= CONFIRM_THRESHOLD ? 'verified' : 'pending';

        await supabase
            .from('sellers')
            .update({ confirmation_count: confirmCount || 0, report_count: reportCount || 0, verification_status: newStatus })
            .eq('id', primaryId);

        await supabase
            .from('sellers')
            .update({ is_active: false, merged_into_id: primaryId })
            .eq('id', duplicateId);

        res.status(200).json({ success: true, primaryId, duplicateId });

    } catch (err) {
        console.error('Merge sellers error:', err);
        res.status(500).json({ error: 'Server error while merging.' });
    }
});


// ══════════════════════════════════════════════════════════
// 18. ADMIN — analytics dashboard
// ══════════════════════════════════════════════════════════
app.get('/api/admin/analytics', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            totalSellers, verifiedSellers, pendingSellers, reportedSellers,
            totalRiders, bannedRiders, totalPhotos, totalNotes, totalConfirmations,
            newSellersWeek, topContributors
        ] = await Promise.all([
            supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('verification_status', 'verified'),
            supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('verification_status', 'pending'),
            supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('verification_status', 'reported_incorrect'),
            supabase.from('riders').select('id', { count: 'exact', head: true }),
            supabase.from('riders').select('id', { count: 'exact', head: true }).eq('is_banned', true),
            supabase.from('seller_photos').select('id', { count: 'exact', head: true }),
            supabase.from('seller_notes').select('id', { count: 'exact', head: true }),
            supabase.from('seller_confirmations').select('id', { count: 'exact', head: true }),
            supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', sevenDaysAgo),
            supabase.rpc('get_top_contributors', { limit_count: 5 })
        ]);

        res.status(200).json({
            totalSellers:       totalSellers.count || 0,
            verifiedSellers:    verifiedSellers.count || 0,
            pendingSellers:     pendingSellers.count || 0,
            reportedSellers:    reportedSellers.count || 0,
            totalRiders:        totalRiders.count || 0,
            bannedRiders:       bannedRiders.count || 0,
            totalPhotos:        totalPhotos.count || 0,
            totalNotes:         totalNotes.count || 0,
            totalConfirmations: totalConfirmations.count || 0,
            newSellersThisWeek: newSellersWeek.count || 0,
            topContributors:    topContributors.data || [],
            thresholds:         { confirm: CONFIRM_THRESHOLD, report: REPORT_THRESHOLD }
        });

    } catch (err) {
        console.error('Admin analytics error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// 19. ADMIN — user management
// ══════════════════════════════════════════════════════════
app.get('/api/admin/riders', authenticate, requireRole('admin'), async (req, res) => {
    const search = String(req.query.search || '').trim();

    try {
        let query = supabase
            .from('riders')
            .select('rider_id, name, mobile_number, role, credits, is_banned, is_active, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

        if (search) {
            query = query.or(`name.ilike.%${search}%,mobile_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.status(200).json(data || []);

    } catch (err) {
        console.error('Admin riders list error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/admin/riders/:riderId/role', authenticate, requireRole('admin'), async (req, res) => {
    const targetRiderId = req.params.riderId;
    const { role } = req.body;

    if (!['rider', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }
    if (targetRiderId === req.rider.rider_id) {
        return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    try {
        const { data, error } = await supabase
            .from('riders')
            .update({ role })
            .eq('rider_id', targetRiderId)
            .select('rider_id, name, role')
            .single();

        if (error || !data) return res.status(404).json({ error: 'Rider not found.' });
        res.status(200).json({ rider: data });

    } catch (err) {
        console.error('Set role error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/admin/riders/:riderId/ban', authenticate, requireRole('admin'), async (req, res) => {
    const targetRiderId = req.params.riderId;
    const banned = !!req.body.banned;

    if (targetRiderId === req.rider.rider_id) {
        return res.status(400).json({ error: 'You cannot ban your own account.' });
    }

    try {
        const { data, error } = await supabase
            .from('riders')
            .update({ is_banned: banned })
            .eq('rider_id', targetRiderId)
            .select('rider_id, name, is_banned')
            .single();

        if (error || !data) return res.status(404).json({ error: 'Rider not found.' });
        res.status(200).json({ rider: data });

    } catch (err) {
        console.error('Ban rider error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});


// ══════════════════════════════════════════════════════════
// START SERVER
// ── process.env.PORT is required for Render deployment ──
// ── server.listen (not app.listen) so the WebSocket
//    upgrade handler on /ws/notifications works too.
// ══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ SFD Rider Hub server running on port ${PORT}`);
    console.log(`🔔 Notification WebSocket available at ws(s)://<host>/ws/notifications`);
    console.log(TWILIO_ENABLED
        ? `📱 Twilio Verify is ACTIVE — OTP codes are sent as real SMS.`
        : `⚠️  Twilio Verify is NOT configured — running local DEV-mode OTP (codes returned in the API response).`);
});
