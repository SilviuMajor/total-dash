
## Plan: Department Management Overhaul + Settings Route + Agency Toggle

**Files:** 4 modified, types regenerated

---

### 1. Regenerate `src/integrations/supabase/types.ts`
Update to reflect actual DB schema: new columns on `departments`, `conversations`, `client_users`, `client_settings`, `agents`, and new tables `handover_sessions`, `conversation_tags`, `conversation_read_status`, `conversation_status_history`, `client_roles`, `role_permission_templates`, `client_user_departments`.

---

### 2. Replace `src/components/client-management/DepartmentManagement.tsx`

**Interface** — full Department with all new fields.

**Query** — `.is('deleted_at', null).order('is_global', { ascending: false }).order('name')`

**List rows:**
- Left: 16px color circle + name (font-medium) + optional "Global" Badge + code in monospace text-xs + copy icon button (ghost)
- Right: `{timeout}s` text-xs, timezone text-xs, green/red open-status dot, edit pencil, delete trash (hidden for global)

**`isDepartmentOpen()`** — timezone-aware Intl.DateTimeFormat logic, handles `simple` and `advanced`.

**Add/Edit Dialog — tabbed into two tabs:**

Tab 1: **Basic**
- Name Input (required) — auto-generates code on change when creating
- Routing Code — editable + auto-populated when creating; read-only + Lock icon + Tooltip when editing ("Code cannot be changed after creation")
- Color picker Input type="color"
- Description Textarea (optional)
- Fallback to Global Switch — hidden when editing Global dept
- Fallback when closed Switch — hidden when editing Global dept

Tab 2: **Hours & Timeout**
- Timeout Slider (30–300, default 60) with live `{value} seconds` display
- Timezone Select (UTC, Europe/London, Europe/Paris, Europe/Berlin, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, Asia/Tokyo, Asia/Shanghai, Asia/Dubai, Australia/Sydney)
- Opening Hours Type RadioGroup: Simple / Advanced
- Simple: two `<input type="time">` — "Opens at" / "Closes at"
- Advanced: 7 rows (Mon–Sun), each with day label + Switch + two time inputs (greyed when switch off)

**Save:**
- Create: `insert()` all fields, `is_global: false`
- Edit: `update()` all fields except `code`
- Toast + dialog close + reload

**Delete:**
- Soft delete: `update({ deleted_at: new Date().toISOString() })`
- AlertDialog: "Delete {name}? Users assigned to this department will need to be reassigned."
- Global → no delete button

---

### 3. `src/App.tsx` — add `/settings` route
In the client `<Routes>` block (line 188, before the `*` catch-all):
```tsx
<Route path="/settings" element={<Settings />} />
```
`Settings` is already imported at line 42.

---

### 4. `src/components/Sidebar.tsx` — Settings nav item + capability check

**Add to `clientNavigation`** after "Agent Settings":
```ts
{ name: "Settings", href: "/settings", icon: Settings, permissionKey: "settings_page" }
```
`Settings` icon is already imported.

**New state:** `const [clientSettingsPageEnabled, setClientSettingsPageEnabled] = useState(false);`

**New effect** — load `admin_capabilities.settings_page_enabled` from `client_settings`:
- For preview mode (`isClientPreviewMode` with `previewClient`): use `previewClient.id`, always show (default `true` in preview)
- For regular client users: fetch `client_id` from `client_users` where `user_id = auth.uid()`, then fetch `client_settings`

**Filter logic** — in both the preview branch and regular client branch, add before `return selectedAgentPermissions?.[item.permissionKey] === true`:
```ts
if (item.permissionKey === 'settings_page') {
  return isClientPreviewMode ? true : clientSettingsPageEnabled;
}
```

The Settings page is client-scoped (no agent context needed), so no provider filter applies to it.

---

### 5. `src/pages/agency/AgencyClientDetails.tsx` — agency toggle

**New state:** `settingsPageEnabled: boolean`, loaded from `client_settings.admin_capabilities.settings_page_enabled`

**Load on mount** (when `client` is set):
```ts
const { data } = await supabase.from('client_settings')
  .select('admin_capabilities').eq('client_id', client.id).single();
setSettingsPageEnabled(data?.admin_capabilities?.settings_page_enabled === true);
```

**Toggle handler:**
```ts
// Upsert, spreading existing admin_capabilities keys
await supabase.from('client_settings').upsert({
  client_id: client.id,
  admin_capabilities: { ...existingCapabilities, settings_page_enabled: newValue }
}, { onConflict: 'client_id' });
```

**UI — add above `<ClientSettings>` inside `<TabsContent value="settings">`:**
```tsx
<Card className="p-4 border-border/50">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium">Enable Settings Page for Clients</p>
      <p className="text-xs text-muted-foreground">
        Allow clients to view and manage departments, users, and permissions
      </p>
    </div>
    <Switch checked={settingsPageEnabled} onCheckedChange={handleToggleSettingsPage} />
  </div>
</Card>
```

---

### Summary of file changes

| File | Action |
|---|---|
| `src/integrations/supabase/types.ts` | Update types for new columns + tables |
| `src/components/client-management/DepartmentManagement.tsx` | Full replacement with all handover fields, tabbed dialog |
| `src/App.tsx` | Add `/settings` route (1 line) |
| `src/components/Sidebar.tsx` | Add Settings nav item + capability loading + filter logic |
| `src/pages/agency/AgencyClientDetails.tsx` | Add settings page toggle in settings tab |
