type PurchaseItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export async function subscribe(priceId: string) {
  const response = await fetch("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ priceId })
  });
  const checkout = await response.json();

  const items: PurchaseItem[] = checkout.items;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "ga4_ecommerce",
    event_name: "purchase",
    transaction_id: checkout.sessionId,
    currency: "USD",
    value: checkout.subtotal,
    items
  });
}
