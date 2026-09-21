# Feature 15: Loyalty & Referral Program — Integration Guide

## 📦 Overview

A complete loyalty and referral system with:
- ✅ Unique referral codes per user
- ✅ Tracking and conversion recording
- ✅ Discount application (10-15% for referred bookings)
- ✅ Loyalty points earning and redemption
- ✅ Tier-based rewards (Bronze → Silver → Gold → Platinum)
- ✅ Leaderboard of top referrers
- ✅ Telegram integration for referrer notifications
- ✅ Analytics dashboard

---

## 🔧 Implementation Steps

### STEP 1: Add Loyalty Imports to `index.js`

```javascript
// Add at the top with other imports:
import {
  generateReferralCode,
  createReferralCode,
  getUserReferralCode,
  applyReferralCode,
  recordReferralConversion,
  addLoyaltyPoints,
  getLoyaltyPoints,
  redeemLoyaltyPoints,
  getUserReferralStats,
  getLeaderboard
} from "./loyalty.js";

import {
  handleGenerateReferralCode,
  handleGetReferralCode,
  handleApplyReferralCode,
  handleAddLoyaltyPoints,
  handleGetLoyaltyPoints,
  handleRedeemLoyaltyPoints,
  handleGetReferralStats,
  handleGetLeaderboard,
  handleGetTiers,
  handleValidateReferralCode,
  handleGetPublicReferrerInfo
} from "./loyalty-api.js";
```

### STEP 2: Add Loyalty Routes to `index.js`

In the `handleFetch` function, add these routes:

```javascript
// Loyalty & Referral Routes
if (path === "/api/loyalty/referral-code/generate" && method === "POST") {
  return handleGenerateReferralCode(request, env);
}

if (path === "/api/loyalty/referral-code" && method === "GET") {
  const email = new URL(request.url).searchParams.get("email");
  return handleGetReferralCode(request, env, email);
}

if (path === "/api/loyalty/apply-code" && method === "POST") {
  return handleApplyReferralCode(request, env);
}

if (path === "/api/loyalty/points/add" && method === "POST") {
  return handleAddLoyaltyPoints(request, env);
}

if (path === "/api/loyalty/points/" && method === "GET") {
  const email = new URL(request.url).searchParams.get("email");
  return handleGetLoyaltyPoints(request, env, email);
}

if (path.startsWith("/api/loyalty/points/") && method === "GET") {
  const email = path.split("/").pop();
  return handleGetLoyaltyPoints(request, env, email);
}

if (path === "/api/loyalty/points/redeem" && method === "POST") {
  return handleRedeemLoyaltyPoints(request, env);
}

if (path.startsWith("/api/loyalty/stats/")) {
  const email = path.split("/").pop();
  return handleGetReferralStats(request, env, email);
}

if (path === "/api/loyalty/leaderboard" && method === "GET") {
  return handleGetLeaderboard(request, env);
}

if (path === "/api/loyalty/tiers" && method === "GET") {
  return handleGetTiers(request, env);
}

if (path === "/api/loyalty/validate-code" && method === "POST") {
  return handleValidateReferralCode(request, env);
}

if (path.startsWith("/api/loyalty/public/referrer-info/")) {
  const code = path.split("/").pop();
  return handleGetPublicReferrerInfo(request, env, code);
}
```

### STEP 3: Integrate with Booking Flow

In `booking.js`, after a booking is confirmed:

```javascript
// When booking is confirmed (in handleConfirmBooking):
if (booking.referralCode) {
  // Record referral conversion
  await recordReferralConversion(
    env,
    booking.referralCode,
    bookingId,
    booking.totalAmount,
    booking.appliedDiscount || 0,
    booking.visitorEmail
  );
}

// Add loyalty points to visitor
await addLoyaltyPoints(
  env,
  booking.visitorEmail,
  Math.round(booking.totalAmount * 0.05), // 5% points
  "booking_confirmed"
);
```

### STEP 4: Add Referral Code to Booking Form

In your booking form (`app.js` in each tour page):

```javascript
// When initializing form, check for referral parameter
const urlParams = new URLSearchParams(window.location.search);
const referralCode = urlParams.get('ref');

if (referralCode) {
  // Auto-populate referral code
  document.getElementById('referralCode').value = referralCode;
  
  // Validate and show discount
  fetch('/api/loyalty/apply-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referralCode,
      bookingAmount: calculateTotal(),
      email: document.getElementById('email').value
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      document.getElementById('discountDisplay').innerHTML = 
        `💰 Referral Discount: ${data.discountPercent}% off (₹${data.discountAmount.toFixed(2)})`;
      updateTotal();
    }
  });
}
```

### STEP 5: Add Loyalty Dashboard Link to Nav

In `index.html` navbar:

```html
<nav>
  <!-- existing links -->
  <a href="/my-booking.html">My Bookings</a>
  <a href="/loyalty.html" class="loyalty-link">💎 Loyalty Program</a>
  <!-- existing links -->
</nav>
```

### STEP 6: Wire Up Telegram Notifications (Optional)

In `telegram-bot.js`, add referrer notification:

```javascript
// When recording referral conversion
async function notifyReferrerOfConversion(env, referrerTelegramId, referralCount, earnings) {
  const message = `
🎉 *New Referral Converted!*

You now have: ${referralCount} referrals
Earnings: ₹${earnings.toFixed(2)}

Keep sharing to reach the next tier!
  `;
  
  await env.BOOKINGS.put(
    `telegram-notification:${referrerTelegramId}`,
    JSON.stringify({ type: 'referral_conversion', message })
  );
}
```

---

## 📊 API Endpoints Reference

### Authentication
All endpoints except public ones require email in query/body

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/loyalty/referral-code/generate` | Generate new referral code |
| GET | `/api/loyalty/referral-code?email=...` | Get user's referral code |
| POST | `/api/loyalty/apply-code` | Apply code to booking |
| POST | `/api/loyalty/points/add` | Add loyalty points |
| GET | `/api/loyalty/points/:email` | Get loyalty points |
| POST | `/api/loyalty/points/redeem` | Redeem points for discount |
| GET | `/api/loyalty/stats/:email` | Get referral statistics |
| GET | `/api/loyalty/leaderboard` | Get top referrers |
| GET | `/api/loyalty/tiers` | Get tier information |
| POST | `/api/loyalty/validate-code` | Validate referral code |
| GET | `/api/loyalty/public/referrer-info/:code` | Get public referrer info (no auth) |

---

## 💾 KV Key Schema

```
referral-code:{code}                    → Code metadata
referral-user:{email}                   → User referral stats
loyalty-points:{email}                  → Points and transaction history
referral-tracking:{code}:{bookingId}    → Conversion tracking
referrer-leaderboard:monthly             → Cached leaderboard data
referral-email-sent:{code}:{email}      → Email notification deduplication
```

---

## 🎯 Loyalty Program Rules

### Points System
- **Booking Points:** 5% of booking amount
- **Referral Bonus:** 20% of referred customer's discount
- **First Booking:** +50 bonus points
- **Redemption:** 1 point = ₹0.50 discount

### Discount Tiers
| Tier | Min Referrals | Referrer Discount | Referred Customer Discount |
|------|---------------|-------------------|---------------------------|
| Bronze | 0 | 10% | 10% |
| Silver | 5 | 12% | 12% |
| Gold | 10 | 15% | 15% |
| Platinum | 20 | 20% | 20% |

### Referral Rules
- No self-referrals allowed
- Discount applies on confirmed bookings only
- Max 50% discount using points
- Referrals tracked in perpetuity

---

## 🎨 Frontend Setup

### Add to `index.html`

```html
<script src="./loyalty.js"></script>

<style>
  .loyalty-badge {
    display: inline-block;
    padding: 4px 8px;
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    color: #000;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 5px;
  }
</style>
```

### Create `loyalty-widget.js`

```javascript
class LoyaltyWidget {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api/loyalty';
    this.userEmail = options.userEmail || localStorage.getItem('userEmail');
  }
  
  async getStats() {
    const res = await fetch(`${this.apiBase}/stats/${this.userEmail}`);
    return res.json();
  }
  
  async applyReferralCode(code, amount) {
    const res = await fetch(`${this.apiBase}/apply-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCode: code,
        bookingAmount: amount,
        email: this.userEmail
      })
    });
    return res.json();
  }
  
  async renderWidget(containerId) {
    const stats = await this.getStats();
    if (!stats.ok) return;
    
    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="loyalty-mini-widget">
        <span class="loyalty-badge">${stats.stats.tier}</span>
        <span>${stats.stats.loyaltyPoints} points</span>
      </div>
    `;
  }
}
```

---

## 🧪 Testing Checklist

- [ ] Generate referral code (POST `/api/loyalty/referral-code/generate`)
- [ ] Get referral code (GET `/api/loyalty/referral-code`)
- [ ] Apply valid code to booking (POST `/api/loyalty/apply-code`)
- [ ] Apply invalid code (should fail)
- [ ] Apply own code (should fail)
- [ ] Add loyalty points (POST `/api/loyalty/points/add`)
- [ ] Get loyalty points (GET `/api/loyalty/points/{email}`)
- [ ] Redeem points (POST `/api/loyalty/points/redeem`)
- [ ] Get referral stats (GET `/api/loyalty/stats/{email}`)
- [ ] Get leaderboard (GET `/api/loyalty/leaderboard`)
- [ ] Verify tier calculation
- [ ] Verify discount calculation
- [ ] Test Telegram notifications (if enabled)
- [ ] Test referral link parameters

---

## 📈 Metrics to Track

1. **Referral Conversion Rate** = conversions / code shares
2. **Average Points per User** = total points / users
3. **Tier Distribution** = users per tier
4. **Referral Value** = avg earnings per referrer
5. **Points Redemption Rate** = points redeemed / points earned

---

## 🔒 Security Considerations

1. **Referral Code Validation:**
   - Never allow self-referrals
   - Validate code format
   - Check code exists in KV

2. **Points Security:**
   - Verify user owns loyalty account
   - Log all point transactions
   - Validate redemption amounts

3. **Rate Limiting:**
   - Limit code generation to 1/day per user
   - Limit point redemption to 1/hour per user
   - Implement IP-based rate limiting

---

## 🚀 Deployment Checklist

- [ ] All loyalty imports added to index.js
- [ ] All routes added to handleFetch()
- [ ] Booking.js integration complete
- [ ] Frontend forms updated
- [ ] loyalty.html accessible
- [ ] Wrangler.toml updated (if using Durable Objects for leaderboard)
- [ ] Environment variables set
- [ ] KV namespace verified
- [ ] Testing passed
- [ ] Error handling validated
- [ ] Telegram bot integration (optional)
- [ ] Analytics logging configured

---

## 📝 Code Examples

### Generate Code in Booking
```javascript
const email = document.getElementById('email').value;
const response = await fetch('/api/loyalty/referral-code/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
});
const data = await response.json();
console.log(`Your code: ${data.code}`);
console.log(`Share link: ${data.shareLink}`);
```

### Apply Code on Checkout
```javascript
const result = await fetch('/api/loyalty/apply-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    referralCode: 'REF_abc123_def456',
    bookingAmount: 5000,
    email: 'user@example.com'
  })
});
const data = await result.json();
if (data.ok) {
  console.log(`Discount: ₹${data.discountAmount}`);
  console.log(`Final amount: ₹${data.finalAmount}`);
}
```

### Redeem Points
```javascript
const result = await fetch('/api/loyalty/points/redeem', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    points: 100,
    bookingAmount: 5000
  })
});
const data = await result.json();
// data.discountAmount = 50
// data.finalAmount = 4950
```

---

## 📞 Support & Troubleshooting

### Issues & Solutions

**Problem:** Referral code not validating
- Check format: should be `REF_*`
- Verify code exists in KV
- Check user email matches

**Problem:** Points not adding
- Verify booking confirmation worked
- Check KV write succeeded
- Review points calculation logic

**Problem:** Tier not updating
- Tier updates on referral conversion
- Check if conversion recorded properly
- Verify referralCount in KV

**Problem:** Leaderboard showing nothing
- Check if any referrals exist
- Verify caching isn't stale
- Rebuild leaderboard manually if needed

---

## 🎁 Future Enhancements

1. **Seasonal Bonuses** - 2x points during holidays
2. **Team Referrals** - Group rewards for referrer networks
3. **Gamification** - Achievements and badges
4. **Social Sharing** - Native share to Facebook, Twitter
5. **Email Campaigns** - Auto-email referrer when conversion happens
6. **Analytics** - Deep referral analytics dashboard
7. **Custom Tiers** - Different tier systems per destination
8. **Expiring Points** - Points expire after 1 year
9. **Point Transfers** - Allow gifting points to friends
10. **Corporate Referrals** - B2B referral program

---

**Status:** ✅ Feature 15 Complete and Ready for Integration
**Last Updated:** 2026-09-21
**Version:** 1.0
