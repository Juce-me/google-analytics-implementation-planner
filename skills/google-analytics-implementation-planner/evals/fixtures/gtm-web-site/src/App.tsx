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
      event: "userevent",
      trigger: "userevent",
      event_type: "pageview",
      feature_name: "marketing",
      screen_name: logicalPage,
      userParams: {
        page_name: logicalPage
      }
    });
  }

  function signup(method: "password" | "google") {
    pushAnalyticsEvent({
      event: "userevent",
      trigger: "userevent",
      event_type: "event",
      event_name: "sign_up",
      feature_name: "auth",
      screen_name: "signup",
      userParams: {
        page_name: "signup"
      },
      eventParams: { method }
    });
  }

  function login(method: "password" | "sso") {
    pushAnalyticsEvent({
      event: "userevent",
      trigger: "userevent",
      event_type: "event",
      event_name: "login",
      feature_name: "auth",
      screen_name: "login",
      userParams: {
        page_name: "login"
      },
      eventParams: { method }
    });
  }

  function contactSales() {
    pushAnalyticsEvent({
      event: "userevent",
      trigger: "userevent",
      event_type: "event",
      event_name: "generate_lead",
      feature_name: "lead",
      screen_name: "pricing",
      userParams: {
        page_name: "pricing"
      },
      eventParams: { lead_source: "pricing" }
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
