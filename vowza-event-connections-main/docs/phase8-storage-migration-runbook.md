# §8 Temporary Storage Migration Runbook

This runbook is for the operator only. The functions are temporary migration tools, not application endpoints. Do not deploy them until `provider-media` has been changed to `public = false` in Step 1. Do not run any of these commands against a different project.

## 1. Deploy temporarily

Deploy both functions with JWT verification enabled and the project ref supplied explicitly:

```sh
supabase functions deploy migrate-provider-media --project-ref vavfeataqwwbpjonknne
supabase functions deploy migrate-provider-portfolio --project-ref vavfeataqwwbpjonknne
```

The function configuration in `supabase/config.toml` sets `verify_jwt = true`. The caller must authenticate as an admin. No client-facing route should call either function.

## 2. Dry run first

Call the document function with an empty JSON object or `{"delete_sources":false}`. Call the portfolio function with an empty JSON object or `{"dry_run":true}`. The responses contain counts only. Save the counts in the review record; do not paste URLs, object paths, provider rows, or document metadata.

```sh
curl -X POST "https://vavfeataqwwbpjonknne.supabase.co/functions/v1/migrate-provider-media" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"delete_sources":false}'

curl -X POST "https://vavfeataqwwbpjonknne.supabase.co/functions/v1/migrate-provider-portfolio" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"dry_run":true}'
```

The first function must report the expected number of existing document-bearing providers before a write run. The second must report the legacy portfolio-reference workload across `provider_profiles.gallery_urls`, `provider_profiles.cover_image_url`, and `portfolio_items.media_url`.

## 3. Execute and verify

Run the document function with `delete_sources` still false first. It copies each object, re-downloads the destination, verifies size and SHA-256 hash, and updates the existing provider metadata to path-only keys. Only after the returned counts are reviewed should the operator run the portfolio function with `dry_run=false`. Portfolio migration rewrites existing URLs to the public provider-portfolio bucket and never deletes provider-media objects, because provider-media may still contain legacy documents.

```sh
curl -X POST "https://vavfeataqwwbpjonknne.supabase.co/functions/v1/migrate-provider-media" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"delete_sources":false}'

curl -X POST "https://vavfeataqwwbpjonknne.supabase.co/functions/v1/migrate-provider-portfolio" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"dry_run":false}'
```

After both count responses are reviewed, the operator must run the count-only verification queries supplied in the implementation report. The queries must confirm zero legacy provider-media URL references in the rewritten portfolio columns and zero legacy document URL keys before any source-document deletion is requested.

## 4. Delete legacy document sources only after verification

Source deletion is a separate explicit action. It is permitted only after the document function has reported successful destination verification, provider metadata has been updated, and the operator has confirmed the count-only checks. Then run:

```sh
curl -X POST "https://vavfeataqwwbpjonknne.supabase.co/functions/v1/migrate-provider-media" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"delete_sources":true}'
```

The function deletes only the source objects it copied and verified in that invocation. It returns counts only. If any provider-level failure occurs, do not repeat with deletion enabled until the failure is understood.

## 5. Remove the temporary functions

After the final count-only verification is complete, remove both deployed functions immediately and remove their temporary configuration entries and source directories in a follow-up repository commit. The functions must not remain deployed as permanent APIs:

```sh
supabase functions delete migrate-provider-media --project-ref vavfeataqwwbpjonknne
supabase functions delete migrate-provider-portfolio --project-ref vavfeataqwwbpjonknne
```

The application must continue using direct authenticated Storage operations for new uploads and short-lived signed URLs for private reads. No application code should call either migration function after this runbook is complete.
