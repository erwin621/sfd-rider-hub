const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔴 PALITAN ITO NG IYONG MGA SUPABASE CREDENTIALS 🔴
const supabaseUrl = 'https://fynfezrougykaeffwght.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bmZlenJvdWd5a2FlZmZ3Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MjQyODgsImV4cCI6MjA5NTIwMDI4OH0.ja28sG94aO9aOpzKA06QgHWBFDcT4sW4f9-IJfF0dXo';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. RIDER LOGIN / REGISTRATION ENDPOINT
// ==========================================
app.post('/api/rider-login', async (req, res) => {
    const { riderId, riderName } = req.body;

    if (!riderId) return res.status(400).json({ error: 'Kailangan ng Rider ID.' });

    // I-tsek kung kilala na ng database ang Rider ID
    let { data: rider, error } = await supabase
        .from('riders')
        .select('*')
        .eq('rider_id', riderId)
        .single();

    // Kung nakarehistro na, i-check kung siya ay naka-BAN
    if (rider && rider.is_banned === true) {
        return res.status(403).json({ error: '⛔ Naka-ban ang iyong account dahil sa paglabag sa patakaran.' });
    }

    // Kung wala pa sa database ang Rider ID, ire-rehistro natin bilang bagong user
    if (!rider) {
        const { data: newRider, error: insertError } = await supabase
            .from('riders')
            .insert([{ rider_id: riderId, name: riderName || 'Anonymous Rider', credits: 3, is_banned: false }])
            .select()
            .single();

        if (insertError) return res.status(500).json({ error: insertError.message });
        rider = newRider;
    }

    res.status(200).json(rider);
});


// ==========================================
// 2. ENCODE LOCATION WITH ANTI-SPAM (+2 Credits)
// ==========================================
app.post('/api/save-location', async (req, res) => {
    const { seller, lat, lng, riderId } = req.body;

    if (!seller || !lat || !lng || !riderId) {
        return res.status(400).json({ error: 'Kulang ang impormasyon.' });
    }

    // Kunin ang data ng rider para i-check ang oras at credits
    const { data: currentRider, error: riderError } = await supabase
        .from('riders')
        .select('credits, last_encode_time')
        .eq('rider_id', riderId)
        .single();

    if (riderError) return res.status(404).json({ error: 'Rider hindi nahanap.' });

    // [ANTI-SPAM 1] COOLDOWN TIMER (2 Minuto)
    if (currentRider.last_encode_time) {
        const lastEncode = new Date(currentRider.last_encode_time).getTime();
        const now = new Date().getTime();

        // Compute kung ilang minuto na ang lumipas
        const timeDiffMinutes = (now - lastEncode) / (1000 * 60);

        if (timeDiffMinutes < 2) {
            const timeRemaining = Math.ceil(2 - timeDiffMinutes);
            return res.status(429).json({
                error: `⏳ Antay muna! Bawal mag-spam. Pwede kang mag-encode ulit pagkalipas ng ${timeRemaining} minuto.`
            });
        }
    }

    // [ANTI-SPAM 2] I-tsek kung may kaparehong pangalan na ng seller sa database
    const { data: existingSeller } = await supabase
        .from('sellers')
        .select('id')
        .ilike('seller_name', seller)
        .limit(1);

    if (existingSeller && existingSeller.length > 0) {
        return res.status(400).json({ error: '⚠️ Ang seller na ito ay nai-encode na ng ibang rider.' });
    }

    // Ipasok ang bagong seller sa table
    const { error: sellerError } = await supabase
        .from('sellers')
        .insert([{ seller_name: seller, latitude: lat, longitude: lng, encoded_by: riderId }]);

    if (sellerError) return res.status(500).json({ error: sellerError.message });

    // [CREDIT SYSTEM] Dagdagan ng +2 credits at i-update ang oras kung kailan siya huling nag-encode
    const newCredits = (currentRider.credits || 0) + 2;
    const currentTimeISO = new Date().toISOString();

    await supabase.from('riders').update({
        credits: newCredits,
        last_encode_time: currentTimeISO
    }).eq('rider_id', riderId);

    res.status(200).json({ message: 'Success!', addedCredits: 2, totalCredits: newCredits });
});


// ==========================================
// 3. SEARCH SELLER WITH CREDIT CHECK (-1 Credit)
// ==========================================
app.get('/api/search-seller', async (req, res) => {
    const { name, riderId } = req.query;

    if (!name || !riderId) return res.status(400).json({ error: 'Kulang ang mga parameters.' });

    // Kunin ang kasalukuyang credits ng naghahanap na rider
    const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('credits')
        .eq('rider_id', riderId)
        .single();

    if (riderError || !rider) return res.status(404).json({ error: 'Hindi mahanap ang iyong Rider ID.' });

    // [CREDIT SYSTEM] Kung 0 ang credit, harangin ang paghahanap
    if (rider.credits <= 0) {
        return res.status(403).json({ error: '⚠️ Ubos na ang iyong credit! Mag-encode muna ng bagong seller para makakuha ng +2 credits.' });
    }

    // Simulan ang paghahanap sa database
    const { data: sellers, error: searchError } = await supabase
        .from('sellers')
        .select('*')
        .ilike('seller_name', `%${name}%`);

    if (searchError) return res.status(500).json({ error: searchError.message });

    // Bawasan ng -1 credit ang rider dahil matagumpay niyang nagamit ang search system
    const finalCredits = rider.credits - 1;
    await supabase.from('riders').update({ credits: finalCredits }).eq('rider_id', riderId);

    res.status(200).json({ sellers, remainingCredits: finalCredits });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ SFD Secured Backend at http://localhost:${PORT}`);
});
