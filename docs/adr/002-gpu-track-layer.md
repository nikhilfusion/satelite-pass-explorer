# ADR-002: Custom WebGL layer for tracks

- Status: accepted

## Context

Requirement: satellite-subset and time-range changes must refresh quasi instantly over ~100k segments.
Measured: MapLibre `setFilter` over a 100k-feature GeoJSON source takes seconds (re-tiling in a worker).

## Decision

Fetch tracks once as a columnar payload and upload them to the GPU as instance buffers.
A custom MapLibre layer (`TrackLayer`) draws instanced quads. Visibility is evaluated in the vertex shader from
uniforms (time range, satellite bitmask, opacity). Filtering = updating uniforms + one repaint.
Projection reuses MapLibre's `projectTile` prelude so globe and mercator both work.
A CPU grid index (`TrackIndex`) serves hover tooltips.

## Consequences

- Filter changes are O(1) CPU, one frame.
- Server never re-queried for filtering; payload ETag-cached.

* Own shader code to maintain; depends on MapLibre's custom-layer/shaderData API (pinned version).
* Max 16 satellites (bitmask); asserted at load.
* WebGL cannot be unit-tested in jsdom: map code is excluded from coverage and covered by Playwright e2e.
