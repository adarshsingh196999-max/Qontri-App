---
name: Qontri QR invite format
description: The canonical QR code format for group invites and how the scanner handles them.
---

QR codes for group invites encode this JSON:
```json
{"q": "qontri", "tag": "#1001"}
```

- `q` = "qontri" (discriminator, must match exactly)
- `tag` = the group's `tagNumber` field (e.g. "#1001")

**Scanner flow** (index.tsx):
1. Parse QR data as JSON
2. Check `parsed.q === "qontri"` and `parsed.tag` exists
3. Show confirmation alert
4. On confirm: call `joinGroup(parsed.tag)` (async, returns `Promise<Group | null>`)
5. On success: navigate to `/group/${group.id}`

**QR generation** (new.tsx, group/[id].tsx):
- `new.tsx`: `JSON.stringify({q:"qontri", tag: group.tagNumber})` — shown after createGroup resolves
- `[id].tsx`: same format, only rendered if `group.tagNumber` is set

**Why:** The old format embedded full group data in the QR (`{q:1, id, n, e, d, m:[...]}`). The new format sends only the tag so the app fetches fresh data from the API on join, ensuring up-to-date member lists and group info.
