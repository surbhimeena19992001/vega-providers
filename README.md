# Vega Providers — MultiMovies

Community provider for Vega App and Vega Desktop.

## Install

1. Open Vega's provider settings.
2. Add repository URL: `https://github.com/surbhimeena19992001/vega-providers`
3. Refresh the provider list after the build workflow finishes.
4. Select **MultiMovies**.

## Development

    npm install
    npm run build
    npm test

## Desktop Compatibility

- Series use `episodesLink: <seriesBase>?season=N` and `getEpisodes` parses the season grid.
- `type` is `"series"` for shows and `"movie"` for films.
- Only standard JS is used — QuickJS-safe.
