# Magneetar — 2-Week Plan to Get 10 Real Users

**Goal:** 10 Nigerians installing the APK and using it for 7+ consecutive days  
**Start date:** Next Monday  
**Success metric:** 10 devices sending location pings daily by Day 14

---

## Pre-Work (This Weekend)

- [ ] **Ensure the APK installs cleanly** on 3 different Android phones (Samsung, Xiaomi, Tecno/Infinix)
- [ ] **Verify FCM push notifications work** end-to-end (send a test theft alert)
- [ ] **Create a 60-second screen recording** showing: install → register → see device on map → lock device → see lock screen
- [ ] **Write a WhatsApp message** (in English + Pidgin) that explains Magneetar in 3 lines

---

## Week 1: The Inner Circle (Days 1-7)

**Strategy:** Start with people who already trust you. Cold outreach fails. Warm intros convert.

### Day 1-2: Recruit from your existing network
- [ ] **Send the WhatsApp message** to 20 people you know personally:
  - University friends (OAU classmates)
  - Family members (parents, siblings, cousins)
  - Church/mosque community members
  - Work/study group contacts

**The message (adapt as needed):**
> "Hey [name], I built an app that protects your phone from theft. If someone steals it, you can lock it, track it, and even take photos of the thief remotely. I need 10 beta testers — can I install it on your phone? It's free, takes 5 minutes, and you'd be helping me test it. 🙏"

### Day 3-4: Install on first 5 devices
- [ ] **For each tester:**
  1. Install the APK (use `adb install` or share the download link)
  2. Help them register an account
  3. Set up geofence around their home/school
  4. Show them how to lock their phone from the dashboard
  5. Leave the app running (explain battery optimization exemption)

### Day 5-7: Recruit 5 more via referrals
- [ ] **Ask each of the first 5:** "Do you know anyone else who'd want this? A parent, a sibling, someone who travels a lot?"
- [ ] **Offer an incentive:** "For every person you get to test this, I'll give you a free 3-month premium subscription when we launch"
- [ ] **Goal:** 10 active devices by Day 7

---

## Week 2: Validate and Iterate (Days 8-14)

### Day 8-10: Daily check-ins
- [ ] **Check the dashboard every morning:**
  - Are all 10 devices still sending pings?
  - Are any devices showing "last seen" > 24 hours ago?
  - Are there any errors in the error log?
- [ ] **Message each tester:** "Is the app still running? Any issues?"
- [ ] **Fix any bugs immediately** (this is the whole point of beta testing)

### Day 11-12: Simulate a theft scenario
- [ ] **Ask 2-3 testers to help you test:**
  1. Lock their phone from the dashboard
  2. Trigger the siren alarm
  3. Capture a photo from the front camera
  4. Export the evidence PDF
- [ ] **Document what works and what breaks**

### Day 13-14: Collect feedback
- [ ] **Ask each tester these 3 questions:**
  1. "Would you pay ₦1,500/month for this? Why or why not?"
  2. "What's the one feature you wish it had?"
  3. "Would you recommend this to a friend?"
- [ ] **Write down every answer** (honestly, not what you want to hear)

---

## Success Criteria

By Day 14, you should have:

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Active devices** | 10 | Proof the app works on real phones |
| **Daily pings** | 90%+ of devices | Background service survival |
| **Bugs found** | Documented | Real-world issues the tests missed |
| **Willingness to pay** | 3+ "yes" | Validates the business model |
| **Feature requests** | Prioritized list | What to build next |

---

## What to Do With the Results

### If 8+ devices are still active:
- You have proof the product works. Proceed to Play Store submission.
- The feedback tells you what to build next.

### If 5-7 devices are active:
- Investigate why devices dropped off (OEM battery killing? App crash? User uninstalled?)
- Fix the top issue, recruit 5 more testers.

### If <5 devices are active:
- The product doesn't work reliably on real hardware yet.
- Don't build more features. Fix the background survival problem first.

---

## Budget

| Item | Cost | Notes |
|------|------|-------|
| APK download hosting | ₦0 | Already on magneetar.me |
| WhatsApp messages | ₦0 | Already have data |
| Tester incentive | ₦0 | Free premium subscription (future) |
| Your time | ~20 hours | Installations, check-ins, bug fixes |

**Total: ₦0 + 20 hours of your time.**

---

## Anti-Patterns to Avoid

1. **Don't recruit strangers on Twitter/X** — they'll install, use once, and never open it again
2. **Don't ask "would you use this?"** — everyone says yes. Ask "can I install it on your phone right now?"
3. **Don't build new features during these 2 weeks** — your only job is getting the APK on phones and fixing what breaks
4. **Don't give up after 3 testers say no** — you need 10, not 100% conversion
5. **Don't skip the feedback interview** — the answers are more valuable than the code
