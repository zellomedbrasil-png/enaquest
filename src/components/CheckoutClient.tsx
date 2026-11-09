"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useMemo, useState } from "react";
import { checkoutAction } from "@/app/actions";

export function CheckoutClient({ publishableKey }: { publishableKey: string }) {
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const result = await checkoutAction();
    if (!result.ok) {
      setError(result.message);
      throw new Error(result.message);
    }
    return result.data;
  }, []);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div id="checkout" className="card" style={{ padding: 8 }}>
      <EmbeddedCheckoutProvider stripe={stripe} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
