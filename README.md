# Birthday surprise builder

Static HTML/CSS/vanilla JS. No build step, no dependencies, no API keys.

## Run locally
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8080` and visit `http://localhost:8080`.
(Opening via `file://` works, but share links will start with `file://`, so test links through a server or Netlify.)

## Deploy to Netlify (free)
1. Go to app.netlify.com/drop.
2. Drag the whole `birthday-site` folder onto the page.
3. Netlify gives you a URL such as `https://your-site.netlify.app`.

## Create and test a shared link
1. Open your site, fill in the form, add photos if you like, press **Preview the experience** to check it.
2. Use **Edit details** to change anything, then **Get share link** (or **Share** on the final screen).
3. Send the link to your phone or another device and open it there. It starts with a gift screen; tap **Open the gift** so sound can begin.
4. Test a broken link: open `https://your-site.netlify.app/#draft=abc` and you should see the “can’t be opened” screen.

## How links work (Stage A)
Your details are saved as JSON, encoded with Base64URL and placed after `#draft=`. The fragment is never sent to the server. The decoder validates every field, trims lengths, accepts only JPEG data for photos, and rejects links over 100,000 characters.
- **Not encrypted.** Anyone with the link can read it. Don’t put secrets in it.
- **Photos are shrunk** to about 300 px so they fit in a link. Five photos make a long link (roughly 50 to 100 KB), which some chat apps may cut off. If that happens, use fewer photos or send the link in a note or email.
- **Custom music** is a local file for the preview and does not travel in the link. Shared links use the built-in synthesized music.
- Nothing is stored in LocalStorage.

## Stage B: persistent gifts with Supabase (design, not built)
Keep Stage A as the fallback; add this only when you need full-size photos or short links.
- **Table** `gifts(id uuid primary key default gen_random_uuid(), config jsonb, expires_at timestamptz default now() + interval '30 days')`. The random UUID in the URL is the unguessable ID.
- **Row Level Security on, with no anonymous select or insert policy.** Expose a `get_gift(p_id uuid)` function (security definer) that returns `config` only when `expires_at > now()`.
- **Creating a gift** goes through an Edge Function that checks size and shape, inserts the row, and returns signed upload URLs for up to 5 photos. The service-role key lives only in the function’s secrets, never in frontend code.
- **Storage** bucket `gift-photos`, path `<gift-id>/<n>.jpg`, limited to `image/jpeg` and about 500 KB per file.
- **Expiry and deletion**: a daily `pg_cron` job deletes expired rows and their files; the creator gets a delete token (stored hashed) for early removal.
- **Frontend** calls `get_gift` with the anon key (safe to expose) from `/g/<id>` or `#id=<id>`.
- Free-tier limits change, so check supabase.com/pricing for current database, storage and bandwidth caps before launch.
