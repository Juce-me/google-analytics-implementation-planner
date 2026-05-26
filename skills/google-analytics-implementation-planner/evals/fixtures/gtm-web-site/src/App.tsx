import { subscribe } from "./checkout";

type DataLayerEvent = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

function pushAnalyticsEvent(event: DataLayerEvent) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

export function App() {
  function trackPage(logicalPage: string) {
    pushAnalyticsEvent({
      event: "ga4_page_view",
      logical_page: logicalPage,
      page_title: document.title,
      page_location: window.location.href
    });
  }

  function signup(method: "password" | "google") {
    pushAnalyticsEvent({
      event: "ga4_user_event",
      ga4_event_name: "sign_up",
      event_group: "auth",
      method
    });
  }

  function login(method: "password" | "sso") {
    pushAnalyticsEvent({
      event: "ga4_user_event",
      ga4_event_name: "login",
      event_group: "auth",
      method
    });
  }

  function contactSales() {
    pushAnalyticsEvent({
      event: "ga4_user_event",
      ga4_event_name: "generate_lead",
      event_group: "lead",
      lead_source: "pricing"
    });
  }

  return (
    <main>
      <button onClick={() => trackPage("pricing")}>Pricing</button>
      <button onClick={() => signup("password")}>Create account</button>
      <button onClick={() => login("sso")}>Log in</button>
      <button onClick={contactSales}>Contact sales</button>
      <button onClick={() => subscribe("price_team_monthly")}>Subscribe</button>
    </main>
  );
}
