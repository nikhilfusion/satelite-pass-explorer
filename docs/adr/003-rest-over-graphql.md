# ADR-003: REST over GraphQL

- Status: accepted

## Context

Three read-only operations: metadata, bulk tracks, accesses query.

## Decision

REST with zod-validated query strings, shared zod schemas in `packages/contract`, a uniform error envelope,
ETag + Cache-Control on immutable data.

## Why

- `/api/tracks` is one large, cacheable, columnar blob; GraphQL would add parsing overhead and defeat HTTP caching.
- No client-driven field selection need; the shape is fixed.
- Shared schemas give end-to-end type safety without a codegen step.

## Consequences

Adding flexible querying later would justify GraphQL; the service layer is transport-agnostic so it can be added beside REST.
