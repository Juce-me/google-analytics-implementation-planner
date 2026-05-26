class Ga4PurchaseJob < ApplicationJob
  queue_as :analytics

  def perform(order_id, ga_client_id, ga_session_id)
    order = Order.find(order_id)
    # Sends Measurement Protocol purchase after Stripe confirms payment.
  end
end
