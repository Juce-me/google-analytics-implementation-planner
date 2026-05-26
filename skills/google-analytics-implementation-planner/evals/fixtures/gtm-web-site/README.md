# GTM web site fixture

React marketing and signup site. Marketing owns the existing GTM web
container because it also manages Meta and LinkedIn pixels. Engineering
wants to emit GA4 events through a stable dataLayer contract without
requesting a GTM change for every product event.

Surfaces:
- home and pricing page views
- signup and login submissions
- contact sales form submission
- Stripe subscription checkout success
