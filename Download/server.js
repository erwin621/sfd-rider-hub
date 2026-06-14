const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── Supabase credentials ──────────────────────────────────
const supabaseUrl = 'https://fynfezrougykaeffwght.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bmZlenJvdWd5a2FlZmZ3Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjQyODgsImV4cCI6MjA5NTIwMDI4OH0.ja28sG94aO9aOpzKA06QgHWBFDcT4sW4f9-IJfF0dXo';
const supabase   = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════
// 1. RIDER LOGIN / REGISTRATION
// ══════════════════════════════════════════════════════════
app.post('/api/rider-login', async (req, res) => {
    const { riderId, riderName } = req.body;

    if (!riderId) {
        return res.status(400).json({ error: 'Rider ID is required.' });
    }

    try {
        // Check if Rider ID already exists
        let { data: rider, error } = await supabase
            .from('riders')
            .select('*')
            .eq('rider_id', riderId)
            .single();

        // Check if rider is banned
        if (rider && rider.is_banned === true) {
            return res.status(403).json({ error: 'Your account has been banned due to a policy violation.' });
        }

        // Register as new rider if not found
        if (!rider) {
            const { data: newRider, error: insertError } = await supabase
                .from('riders')
                .insert([{
                    rider_id:  riderId,
                    name:      riderName || 'Anonymous Rider',
                    credits:   3,
                    is_banned: false
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Insert error:', insertError);
                return res.status(500).json({ error: 'Failed to register new rider. Please try again.' });
            }
            rider = newRider;
        }

        res.status(200).json(rider);

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});


// ══════════════════════════════════════════════════════════
// 2. ENCODE LOCATION (+2 Credits, with anti-spam)
// ══════════════════════════════════════════════════════════
app.post('/api/save-location', async (req, res) => {
    const { seller, lat, lng, riderId } = req.body;

    if (!seller || !lat || !lng || !riderId) {
        return res.status(400).json({ error: 'Missing required information.' });
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
            const lastEncode     = new Date(currentRider.last_encode_time).getTime();
            const now            = Date.now();
            const timeDiffMinutes = (now - lastEncode) / (1000 * 60);

            if (timeDiffMinutes < 2) {
                const timeRemaining = Math.ceil(2 - timeDiffMinutes);
                return res.status(429).json({
                    error: `Please wait! You can encode again in ${timeRemaining} minute(s).`
                });
            }
        }

        // Anti-spam: check if seller name already exists
        const { data: existingSeller } = await supabase
            .from('sellers')
            .select('id')
            .ilike('seller_name', seller)
            .limit(1);

        if (existingSeller && existingSeller.length > 0) {
            return res.status(400).json({ error: 'This seller has already been encoded by another rider.' });
        }

        // Insert new seller
        const { error: sellerError } = await supabase
            .from('sellers')
            .insert([{ seller_name: seller, latitude: lat, longitude: lng, encoded_by: riderId }]);

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

        res.status(200).json({ message: 'Success!', addedCredits: 2, totalCredits: newCredits });

    } catch (err) {
        console.error('Save location error:', err);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});


// ══════════════════════════════════════════════════════════
// 3. SEARCH SELLER (-1 Credit)
// ══════════════════════════════════════════════════════════
app.get('/api/search-seller', async (req, res) => {
    const { name, riderId } = req.query;

    if (!name || !riderId) {
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
            .select('seller_name');

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
// START SERVER
// ── process.env.PORT is required for Render deployment ──
// ══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ SFD Rider Hub server running on port ${PORT}`);
});
