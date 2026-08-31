# Deploying Dental Vertical to Production

This guide covers deploying the new dental vertical (services, staff, appointments, kiosk) to production.

## Prerequisites

- Both `apps/web` (Vercel) and `apps/api` (Railway) already deployed
- Access to Vercel and Railway dashboards
- Git repository synced with main branch

## Deployment Checklist

### 1. Backend (Railway)

#### Database Migrations
```bash
# Run the dental scheduling migration on production Supabase
supabase db push --linked

# This applies 00032_dental_scheduling.sql which creates:
# - dental_services table
# - dental_staff table
# - dental_staff_services junction table
# - dental_staff_hours table
# - dental_appointments table
# - RLS policies for all tables
```

#### Deploy API
```bash
# Push to Railway (auto-deploys on git push to main)
git push origin main

# Or manually redeploy in Railway dashboard:
# 1. Go to railway.app
# 2. Select VOAS API project
# 3. Click "Deploy"

# Verify deployment:
# curl https://api.voas.ai/v1/health
```

#### Test Dental Endpoints
```bash
# List services (should be empty for new workspace)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://api.voas.ai/v1/workspaces/{workspace_id}/dental/services

# Verify vertical gating works
# A restaurant workspace should get INVALID_VERTICAL error:
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://api.voas.ai/v1/workspaces/{restaurant_workspace_id}/dental/services
# Expected: {"error": {"code": "INVALID_VERTICAL", ...}}
```

### 2. Frontend (Vercel)

#### Deploy
```bash
# Already auto-deployed when you pushed to main
# Or manually redeploy in Vercel dashboard:
# 1. Go to vercel.com
# 2. Select voas-ai project
# 3. Click "Deployments" → find main branch
# 4. Click "Redeploy" if needed
```

#### Verify Deployment
1. Visit https://voas.ai/dashboard
2. Create a dental workspace or switch to existing one
3. Navigate to Services → should see "Dental" eyebrow and Beta badge
4. Try adding a service — should POST to `/v1/workspaces/{id}/dental/services`
5. Visit the kiosk at `https://voas.ai/kiosk/{workspace_id}` → should load

### 3. Voice Integration (Vapi)

No changes needed — Vapi already routes dental through booking tools (same as salon).

**Verify:**
- Create a dental workspace with services + staff
- Call the workspace's phone number
- Voice agent should offer appointment booking

### 4. WhatsApp Integration

No changes needed — WhatsApp AI already injects dental context.

**Verify:**
- Send a WhatsApp message to workspace's number
- AI should respond with available appointments (if configured)

### 5. Smoke Tests

Run critical user journeys:

#### Journey 1: Dental Practice Owner
1. Sign up → creates workspace with vertical = "dental"
2. Navigate to Services → add "Cleaning" (30 min, $100)
3. Navigate to Staff → add "Dr. Smith"
4. Should see Dental/Staff/Services in sidebar (not Orders/Knowledge-Base)

#### Journey 2: Kiosk Check-in
1. Book an appointment (via API or coming UI)
2. Share kiosk link with patient
3. Patient enters phone → finds appointment → checks in ✓

#### Journey 3: Voice Booking
1. Call dental workspace's phone
2. Say "I need a cleaning appointment"
3. Agent: "We have cleaning available at 2pm tomorrow with Dr. Smith. Would you like to book that?"
4. Say "yes"
5. Appointment created ✓

## Known Limitations (v1)

- **Staff → Service linking:** Staff must manually be linked to services via dashboard UI (coming in v1.1)
- **Google Calendar sync:** Not yet implemented for dental (coming in v1.2)
- **SMS reminders:** Not yet implemented (coming in v2)
- **No patient portal:** Appointments booked only via voice/WhatsApp/kiosk
- **No recurring services:** All procedures are one-time bookings

## Rollback

If issues occur:

```bash
# Rollback API to previous commit
git revert HEAD
git push origin main
# Railway auto-redeploys

# Rollback frontend to previous deployment
# In Vercel dashboard: Deployments → select previous → click "Promote to Production"

# Rollback database (if migration broke)
# In Supabase dashboard: SQL Editor → run inverse migration
# Or restore from backup: Database → Backups → Restore
```

## Monitoring

### Sentry
- Watch for `INVALID_VERTICAL` errors (should not happen in v1)
- Watch for appointment conflicts (re-booking same slot)

### PostHog
- Track: "dental_appointment_booked"
- Track: "dental_service_created"
- Track: "kiosk_checkin_completed"

### Logs (Railway)
```
# Look for errors:
docker logs railway-api | grep -i dental

# Key events to watch:
- "dental_vertical" (service layer checks)
- "appointment_conflict" (booking engine)
- "staff_unavailable" (availability computation)
```

## Post-Deployment

1. **Notify team:**
   - Slack: "🦷 Dental vertical shipped to production"
   - Add to #releases channel

2. **Update docs:**
   - Add dental to README.md features list
   - Add dental to user onboarding tour

3. **Customer outreach:**
   - Email early adopters: "Dental practices can now use VOAS AI"
   - Include: quick-start guide, kiosk URL format, support link

4. **Plan v1.1:**
   - Staff ↔ service many-to-many UI in dashboard
   - Google Calendar sync for dentists
   - Bulk import staff from CSV

---

## Support

For issues during/after deployment:
- Check Sentry error tracking
- Review Railway logs for backend errors
- Check Vercel deployment logs for frontend errors
- Reach out to @founder or #engineering Slack
