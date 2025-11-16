# Upload Bucket Only Configuration

## Change Summary

**Date:** 2025-11-01  
**Change:** All UUIDs now use UPLOAD_BUCKET exclusively

## New Behavior

### All UUIDs → UPLOAD_BUCKET

Previously, the system distinguished between:
- **Simple UUIDs** → `STATIC_SITES` bucket
- **Compound UUIDs** (with version) → `UPLOAD_BUCKET` bucket

Now, **ALL UUIDs** use `UPLOAD_BUCKET` (my-storybooks-production) exclusively.

## UUID Resolution Patterns

### Pattern 1: UUID with Version (e.g., design-system-v1-0-1)

**URL:** `https://view.scrymore.com/design-system-v1-0-1/`

**Resolves to:**
- Project: `design-system`
- Version: `v1.0.1`
- Bucket: `UPLOAD_BUCKET` (my-storybooks-production)
- ZIP Path: `design-system/v1.0.1/storybook.zip`

### Pattern 2: UUID without Version (e.g., my-project)

**URL:** `https://view.scrymore.com/my-project/`

**Resolves to:**
- Project: `my-project`
- Version: (empty)
- Bucket: `UPLOAD_BUCKET` (my-storybooks-production)
- ZIP Path: `my-project/storybook.zip`

### Pattern 3: UUID with Numeric Parts (e.g., 3KZmzDwWam6N5a0fpvao-0-0-3)

**URL:** `https://view.scrymore.com/3KZmzDwWam6N5a0fpvao-0-0-3/`

**Resolves to:**
- Project: `3KZmzDwWam6N5a0fpvao-0-0-3`
- Version: (empty - no 'v' prefix, so not detected as version)
- Bucket: `UPLOAD_BUCKET` (my-storybooks-production)
- ZIP Path: `3KZmzDwWam6N5a0fpvao-0-0-3/storybook.zip`

## Upload Service Integration

All Storybook uploads should follow these patterns in the UPLOAD_BUCKET:

### With Version (Recommended)
```
my-storybooks-production/
  ├── design-system/
  │   ├── v1.0.0/storybook.zip
  │   ├── v1.0.1/storybook.zip
  │   └── v2.0.0/storybook.zip
  ├── component-library/
  │   └── v1.5.0/storybook.zip
```

**Viewer URLs:**
- `https://view.scrymore.com/design-system-v1-0-0/`
- `https://view.scrymore.com/design-system-v1-0-1/`
- `https://view.scrymore.com/design-system-v2-0-0/`
- `https://view.scrymore.com/component-library-v1-5-0/`

### Without Version (Simple Projects)
```
my-storybooks-production/
  ├── my-app/storybook.zip
  ├── docs-site/storybook.zip
```

**Viewer URLs:**
- `https://view.scrymore.com/my-app/`
- `https://view.scrymore.com/docs-site/`

## Version Detection Rules

A UUID is considered to have a version if it contains a part matching the pattern `v\d+`:

- ✅ `design-system-v1-0-0` → Has version `v1.0.0`
- ✅ `my-app-v2-1-5` → Has version `v2.1.5`
- ❌ `my-project-1-0-0` → No version (missing 'v' prefix)
- ❌ `simple-uuid` → No version
- ❌ `3KZmzDwWam6N5a0fpvao-0-0-3` → No version (numbers don't start with 'v')

## Migration Notes

### STATIC_SITES Bucket No Longer Used

The `STATIC_SITES` (scry-static-sites) bucket is still bound to the worker but is no longer used for serving files. 

**If you have files in STATIC_SITES:**
- Option 1: Migrate them to UPLOAD_BUCKET following the patterns above
- Option 2: Keep them for legacy purposes (they won't be accessible via the viewer)

### Code Changes

Modified [`src/utils/path-resolver.ts`](src/utils/path-resolver.ts):
- `detectUUIDType()` - Always returns 'compound'
- `parseCompoundUUID()` - Handles UUIDs with and without versions
- `resolveUUID()` - Always uses UPLOAD_BUCKET

## Testing

All new uploads to UPLOAD_BUCKET will be immediately viewable:

```bash
# Upload with version
npx wrangler r2 object put my-storybooks-production/project/v1.0.0/storybook.zip \
  --file=storybook.zip

# View at:
# https://view.scrymore.com/project-v1-0-0/

# Upload without version
npx wrangler r2 object put my-storybooks-production/project/storybook.zip \
  --file=storybook.zip

# View at:
# https://view.scrymore.com/project/
```

## ZIP Structure Requirements

Files MUST be at the root of the ZIP, not in a subdirectory:

### ✅ Correct Structure
```
storybook.zip
├── index.html
├── assets/
│   └── style.css
└── ...
```

### ❌ Incorrect Structure
```
storybook.zip
└── storybook-static/  ← Don't nest in subdirectory
    ├── index.html
    └── assets/
```

## Production URLs

All current working URLs:
- ✅ `https://view.scrymore.com/design-system-v1-0-0/` (old, works)
- ✅ `https://view.scrymore.com/design-system-v1-0-1/` (new, fixed structure)

## Support

View logs: `npx wrangler tail --env production`

Deployment version: `ffc9b18a-9a93-424a-997d-13778dc5ab05`