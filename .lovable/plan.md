
User reports black screen when entering the platform. Looking at the flow:

1. After Google login, user is redirected to `/welcome` (per recent change)
2. `/welcome` is wrapped in `ProtectedRoute` only
3. From `/welcome`, after filling form, user goes to `/account`
4. To reach `/` (studio), user needs `RequireSubscription` which requires active subscription

Let me check Welcome.tsx and the auth flow more carefully.
