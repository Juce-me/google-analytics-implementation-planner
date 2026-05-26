class CheckoutController < ApplicationController
  def complete
    order = Order.find_by!(stripe_session_id: params[:session_id])
    Ga4PurchaseJob.perform_later(order.id, params[:ga_client_id], params[:ga_session_id])
    redirect_to order_path(order)
  end
end
