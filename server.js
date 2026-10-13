// File: server.js - Multi-Platform Donation Server (Saweria, Sociabuzz, BagiBagi)
// Menggunakan Roblox Open Cloud MessagingService API - Direct Send (No Queue)

const express = require('express');
const app = express();

app.use(express.json());

// ============================================
// KONFIGURASI - SESUAIKAN DENGAN SETTING KAMU
// ============================================
const CONFIG = {
    // Roblox Open Cloud API Key (buat di https://create.roblox.com/credentials)
    // Pastikan API Key punya permission: messaging-service:publish
    ROBLOX_API_KEY: process.env.ROBLOX_API_KEY || 'kAJf95ANM0Kj42vwj4wflL8mnr2rsR4nj3ncmBG8+ZtyX7zuZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW10QlNtWTVOVUZPVFRCTGFqUXlkbmRxTkhkbWJFdzRiVzV5TW5KelVqUnVhak51WTIxQ1J6Z3JXblI1V0RkNmRTSXNJbTkzYm1WeVNXUWlPaUkwTWpZMk1EQTFORGtpTENKbGVIQWlPakUzT0RnMk5URXdNemdzSW1saGRDSTZNVGM0T0RZME56UXpPQ3dpYm1KbUlqb3hOemc0TmpRM05ETTRmUS5ndlQxWXduX013TVQyd1MzcldDLVBnQ3pZeGpNWmtRNExtNFdPVThwM3NVSUJYTzN1N2Q2MXpKQXdycW9VWndvb3dmV0ZTWjMyX3RHenhpRUtxbDIyMkVsZ21jTURiU3ZudS04OHQ0aXV1dEZvbVdKU1VKNmVCeWV6TzdmdVY4eTRHYkIyc0QyOWpLN3Z4Xy0wOHBmQUd0WEh5YXRPSDdPMU54NmNiRTdsZTIyY1EydlpocXk0VFJzYmV6dGxIZzVPYlVZbDJJOEZJb2MySVAyVGdfSWxwUW4zRGFZa2dDSTA5bWhIb25EbEExNlZVNEpkenBWTFFGYXlhRlBubmlkTEZaZm5CVFV1VGY2Si1xMjljRExyTTRXbUZESzB3SU9NU250WXhuUWJpVHQ3Vm1GZE9kaXZPMktWemhWdUswSUZmUnUwcUpwQ3JiS0VGeV91Skkwa1E=',
    
    // Universe ID dari game kamu (bukan Place ID!)
    UNIVERSE_ID: process.env.UNIVERSE_ID || '10435785736',
    
    // Topic name untuk MessagingService (harus sama dengan di Roblox script)
    MESSAGING_TOPIC: 'DonationNotif'
};

// ============================================
// ROBLOX MESSAGING SERVICE API - DIRECT SEND
// ============================================
async function sendToRoblox(donation) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/${CONFIG.MESSAGING_TOPIC}`;
    
    const payload = {
        message: JSON.stringify({
            platform: donation.platform,
            donatorName: donation.donatorName,
            amount: donation.amount,
            message: donation.message,
            timestamp: Date.now()
        })
    };
    
    console.log(`[ROBLOX] 📤 Sending to MessagingService...`);
    console.log(`[ROBLOX] URL: ${url}`);
    console.log(`[ROBLOX] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': CONFIG.ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log(`[ROBLOX] ✅ SUCCESS - Sent to Roblox:`, donation.donatorName, 'Rp', donation.amount);
            return { success: true, status: response.status };
        } else {
            const errorText = await response.text();
            console.error(`[ROBLOX] ❌ FAILED - Status:`, response.status, errorText);
            return { success: false, status: response.status, error: errorText };
        }
    } catch (error) {
        console.error(`[ROBLOX] ❌ ERROR:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// WEBHOOK: SAWERIA
// ============================================
app.post('/webhook/saweria', async (req, res) => {
    console.log('\n[SAWERIA] ========== NEW DONATION ==========');
    console.log('[SAWERIA] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName = 
        body.donator_name ||
        body.donatorName ||
        body.name ||
        (body.data && body.data.donator_name) ||
        'Donatur Anonim';
    
    const amount = 
        body.amount_raw ||
        body.amount ||
        body.gross_amount ||
        (body.data && body.data.amount) ||
        0;
    
    const message = 
        body.message ||
        body.note ||
        (body.data && body.data.message) ||
        '';
    
    console.log(`[SAWERIA] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const result = await sendToRoblox({
            platform: 'saweria',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'saweria', roblox: result });
    } else {
        console.log('[SAWERIA] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'saweria', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: SOCIABUZZ
// ============================================
app.post('/webhook/sociabuzz', async (req, res) => {
    console.log('\n[SOCIABUZZ] ========== NEW DONATION ==========');
    console.log('[SOCIABUZZ] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName =
        (typeof body.supporter === 'string' && body.supporter.trim().length > 0
            ? body.supporter.trim()
            : null) ||
        body.supporter_name ||
        body.name ||
        body.donator_name ||
        (body.user && body.user.name) ||
        'Donatur Anonim';
    
    const amount =
        body.amount_raw ||
        body.amount ||
        body.amount_settled ||
        body.total ||
        body.nominal ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.comment ||
        (body.content && body.content.title) ||
        '';
    
    console.log(`[SOCIABUZZ] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const result = await sendToRoblox({
            platform: 'sociabuzz',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'sociabuzz', roblox: result });
    } else {
        console.log('[SOCIABUZZ] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'sociabuzz', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: BAGIBAGI
// ============================================
app.post('/webhook/bagibagi', async (req, res) => {
    console.log('\n[BAGIBAGI] ========== NEW DONATION ==========');
    console.log('[BAGIBAGI] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName =
        body.donor_name ||
        body.donator_name ||
        body.name ||
        body.supporter_name ||
        'Donatur Anonim';
    
    const amount =
        body.amount ||
        body.donation_amount ||
        body.total ||
        body.nominal ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.support_message ||
        '';
    
    console.log(`[BAGIBAGI] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const result = await sendToRoblox({
            platform: 'bagibagi',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'bagibagi', roblox: result });
    } else {
        console.log('[BAGIBAGI] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'bagibagi', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: UNIVERSAL (Auto-detect platform)
// ============================================
app.post('/webhook', async (req, res) => {
    console.log('\n[UNIVERSAL] ========== NEW DONATION ==========');
    console.log('[UNIVERSAL] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    // Auto-detect platform
    let platform = 'unknown';
    if (body.donator_name || (body.data && body.data.donator_name)) {
        platform = 'saweria';
    } else if (body.supporter || body.supporter_name || body.amount_settled) {
        platform = 'sociabuzz';
    } else if (body.donor_name || body.support_message) {
        platform = 'bagibagi';
    }
    
    // Parse universal
    const donatorName =
        body.supporter ||
        body.supporter_name ||
        body.donator_name ||
        body.donor_name ||
        body.name ||
        (body.user && body.user.name) ||
        (body.data && body.data.donator_name) ||
        'Donatur Anonim';
    
    const amount =
        body.amount_raw ||
        body.amount ||
        body.amount_settled ||
        body.gross_amount ||
        body.donation_amount ||
        body.total ||
        body.nominal ||
        (body.data && body.data.amount) ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.comment ||
        body.support_message ||
        (body.content && body.content.title) ||
        (body.data && body.data.message) ||
        '';
    
    console.log(`[UNIVERSAL] Detected: ${platform} - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const result = await sendToRoblox({
            platform,
            donatorName: String(donatorName).trim(),
            amount: Number(amount),
            message: String(message)
        });
        
        res.json({ success: true, platform, roblox: result });
    } else {
        console.log('[UNIVERSAL] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform, error: 'Invalid amount' });
    }
});

// ============================================
// TEST ENDPOINT - Untuk testing manual
// ============================================
app.post('/test', async (req, res) => {
    console.log('\n[TEST] ========== TEST DONATION ==========');
    
    const { donatorName, amount, message, platform } = req.body;
    
    const result = await sendToRoblox({
        platform: platform || 'test',
        donatorName: donatorName || 'Test User',
        amount: Number(amount) || 10000,
        message: message || 'Test donation'
    });
    
    res.json({ success: true, platform: 'test', roblox: result });
});

// ============================================
// STATUS ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platforms: ['saweria', 'sociabuzz', 'bagibagi'],
        mode: 'direct-send (no queue)'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Multi-Platform Donation Server',
        version: '2.1.0',
        description: 'Saweria, Sociabuzz, BagiBagi → Roblox MessagingService (Direct Send)',
        endpoints: {
            webhooks: {
                saweria: 'POST /webhook/saweria',
                sociabuzz: 'POST /webhook/sociabuzz',
                bagibagi: 'POST /webhook/bagibagi',
                universal: 'POST /webhook (auto-detect)'
            },
            test: 'POST /test',
            health: 'GET /health'
        },
        config: {
            topic: CONFIG.MESSAGING_TOPIC,
            universeId: CONFIG.UNIVERSE_ID
        }
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ===============================================');
    console.log('🚀 Multi-Platform Donation Server v2.1');
    console.log('🚀 Mode: Direct Send (No Queue)');
    console.log('🚀 ===============================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log('');
    console.log('📋 Webhook Endpoints:');
    console.log('   • Saweria:    POST /webhook/saweria');
    console.log('   • Sociabuzz:  POST /webhook/sociabuzz');
    console.log('   • BagiBagi:   POST /webhook/bagibagi');
    console.log('   • Universal:  POST /webhook');
    console.log('   • Test:       POST /test');
    console.log('');
    console.log('🎮 Roblox MessagingService:');
    console.log(`   • Topic: ${CONFIG.MESSAGING_TOPIC}`);
    console.log(`   • Universe ID: ${CONFIG.UNIVERSE_ID}`);
    console.log('');
    console.log('✅ Ready to receive donations!');
    console.log('🚀 ===============================================');
});
