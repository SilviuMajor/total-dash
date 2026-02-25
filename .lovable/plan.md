
## Remove Client Sign-Up Form

Three files need changes. Admin login is already sign-in only — nothing to do there.

---

### `src/pages/Auth.tsx` — Client login (sign-in only)

**Remove:**
- `isSignUp` state and all conditional branches on it
- `fullName` state and the Full Name input field
- The `if (isSignUp)` block in `handleSubmit` that calls `signUp()`
- The toggle link button at the bottom ("Don't have an account? Sign up")
- The `signUp` import from `@/lib/auth`

**Update:**
- `CardTitle` → always "Welcome Back"
- `CardDescription` → always "Enter your credentials to access your dashboard"
- Submit button → always "Sign In"
- Password field moves outside the `{!isSignUp && ...}` conditional — it's always shown

The simplified component retains: email input, password input with ForgotPasswordDialog, loading state, and redirect logic.

---

### `src/pages/SlugBasedAuth.tsx` — Already delegates to `Auth.tsx`

This file is just a wrapper that loads agency context into `sessionStorage` and renders `<Auth />`. Since `Auth.tsx` is being made sign-in only, `SlugBasedAuth.tsx` automatically benefits. No changes needed.

---

### `src/pages/agency/AgencyLogin.tsx` — Agency login (sign-in only)

This file currently has a full two-tab UI: **Sign Up** tab (with name, agency name, phone, email, password, trial creation) and **Sign In** tab.

**Remove:**
- All sign-up state variables: `firstName`, `lastName`, `agencyName`, `phoneNumber`
- The `handleSignup` function (entire 110-line function)
- The `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` structure
- The sign-up `TabsContent` block with all its form fields
- Unused imports: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `PhoneNumberInput`, `isValidPhoneNumber`
- The `emailError` + `validateEmail` logic can be simplified or kept (keep it — it's used in the login form too)

**Update:**
- `CardDescription` → "Sign in to access your agency portal"
- The sign-in form moves out of `TabsContent` and becomes the direct `CardContent` child (same as AdminLogin structure)
- The `defaultValue="signup"` tab default is removed along with the tabs

**Result:** A clean single-form sign-in page matching the AdminLogin structure, with email, password (+ ForgotPasswordDialog), and a Sign In button.

---

### `src/pages/admin/AdminLogin.tsx` — No changes

Already sign-in only. No sign-up form present. No changes needed.

---

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Remove sign-up state, form, toggle, and import |
| `src/pages/agency/AgencyLogin.tsx` | Remove tabs, sign-up form, `handleSignup`, unused state and imports |
| `src/pages/SlugBasedAuth.tsx` | No changes needed |
| `src/pages/admin/AdminLogin.tsx` | No changes needed |
| `src/lib/auth.ts` | No changes (keep `signUp` for edge function usage) |
