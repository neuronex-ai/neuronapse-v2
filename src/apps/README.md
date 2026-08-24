# NeuroNex frontend surfaces

This directory is the boundary between product surfaces.

## `professional-mobile`

Mobile-only pages and UI components. They may import:

- domain/data hooks;
- Supabase clients and typed service adapters;
- authentication and subscription contexts;
- neutral UI primitives from `components/ui`;
- tokens and utilities.

They must not import desktop pages or desktop business components.

## `professional-desktop`

Desktop/tablet-only pages and UI components. Existing desktop code stays unchanged during the mobile MVP. It must not import from `professional-mobile`.

## `public`

Public pages remain adaptive and may select a mobile or desktop presentation at runtime.

## Shared code

Only data, domain rules, schemas, types, authentication, service adapters and neutral primitives are shared. Pages, layouts, complex forms, navigation and operational modals are surface-specific.
