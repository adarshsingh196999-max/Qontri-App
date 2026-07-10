---
name: GET /groups payload index-order mismatch
description: Critical bug where groups got each other's members/expenses because payloads were matched by array index instead of group ID.
---

## The Bug

In `artifacts/api-server/src/routes/groups.ts`, the `GET /groups` handler did:

```typescript
const groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds));
const payloads = await buildGroupPayloads(groupIds);
const result = groups.map((g, i) => ({ ...payloads[i] })); // WRONG — index-based match
```

`buildGroupPayloads(groupIds)` returns payloads in the order of `groupIds` (derived from `group_members` rows). But `db.select().where(inArray(...))` returns rows in **database/internal order**, which is NOT guaranteed to match `groupIds` order. So `payloads[i]` for group at index `i` was actually the payload for a completely different group.

**Result**: Groups were served each other's members, expenses, and settlements. A group with 4 real members would show 2 members from a different group. Settlement calculations were completely wrong.

## The Fix

Build a map keyed by groupId:

```typescript
const payloadMap = new Map(groupIds.map((gid, i) => [gid, payloads[i]]));
const result = groups.map((g) => ({
  id: g.id,
  ...
  ...payloadMap.get(g.id), // correct — ID-based match
}));
```

**Why:** SQL `WHERE id IN (...)` does not preserve the order of the IN list. Always use ID-based matching when joining query results to avoid order-dependent bugs.

**How to apply:** Any time you query a set of records with `inArray` and then match them to another array positionally, use a Map instead of index-based access.
