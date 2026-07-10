---
name: Express 5 params typing
description: req.params values inferred as string | string[] in Express 5 with @types/express; causes Drizzle type errors.
---

In Express 5 with current `@types/express`, route handler `req.params` values are typed as `string | string[]` rather than `string`. This causes TypeScript errors when passing them to Drizzle `eq()` or `inArray()` which expect `string`.

**Fix:** Always cast explicitly:
```typescript
const id = req.params.id as string;
const memberId = req.params.memberId as string;
```

Never destructure directly: `const { id } = req.params` — that gives `string | string[]`.

**Why:** The `@types/express` ParamsDictionary declaration allows array values even though Express runtime always provides strings for named route params.

**How to apply:** Any time a new route handler uses `req.params.X` in a Drizzle query, add `as string` cast.
