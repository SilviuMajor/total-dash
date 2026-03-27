

## Change default notification sounds

Update `src/lib/notificationSounds.ts` to change the default sound preferences:

- Change `handoverRequestSound` default from `"chime"` to `"triple-beep"`
- Change `newMessageSound` default from `"pop"` to `"double-pop"`

Two locations to update in `getSoundPreferences()`:
1. The fallback values in the parsed branch (lines ~133, ~137)
2. The default return object (lines ~145, ~149)

