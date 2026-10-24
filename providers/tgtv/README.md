# TG TV (HLS-only)

This Vega provider integrates the TG TV public API's 24/7 channel list and playback endpoints.

- Uses `/api/public/v2/channels` and `/api/public/v2/channels/{id}`.
- Supports direct HTTP(S) HLS `.m3u8` links only.
- Does not process encrypted DASH, extract DRM keys, or proxy/decrypt protected streams.
- Use streams only where you have permission to access and redistribute them.

The upstream API documentation is available at https://livetgtv.lovable.app/docs.
