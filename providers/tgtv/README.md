# TG TV — HLS-only provider

This provider uses the public TG TV v2 API for 24/7 channels.

- Lists channels from `/api/public/v2/channels`.
- Resolves playback servers from `/api/public/v2/channels/{id}`.
- Returns HTTP(S) relay URLs as HLS (`m3u8`) sources.
- Does not handle encrypted DASH or DRM keys.

Use only streams you are authorized to access. Upstream availability and playback may change independently of Vega.
