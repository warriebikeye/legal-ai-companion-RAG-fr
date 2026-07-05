// src/pages/PaymentUpdating.jsx
import './PaymentUpdating.css';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import gptLogo from '../assets/DeeBees.svg';

const API_BASE_URL = process.env.REACT_APP_BASEURL;

function PaymentUpdating() {
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Verifying your payment...');
  const [isError, setIsError]             = useState(false);
  const [walletInfo, setWalletInfo]       = useState(null);

  useEffect(() => {
    async function verifyPayment() {
      try {
        const status        = searchParams.get('status');
        const transactionId = searchParams.get('transaction_id');
        const txRef         = searchParams.get('tx_ref');
        const bundleId      = searchParams.get('bundle'); // ← Option 2: read bundle from URL

        console.log('[PaymentUpdating] Params:', { status, transactionId, txRef, bundleId });

        /* ─── Validate Flutterwave status ─── */
        if (!status || status !== 'completed') {
          setIsError(true);
          setStatusMessage('Payment was not completed.');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (!bundleId) {
          setIsError(true);
          setStatusMessage('Bundle information missing. Please contact support.');
          setTimeout(() => navigate('/'), 4000);
          return;
        }

        /* ─── Call backend verify ─── */
        const response = await fetch(`${API_BASE_URL}/payments/verify`, {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            transactionId,
            txRef,
            bundleId, // ← send bundleId to backend
          }),
        });

        const data = await response.json();
        console.log('[PaymentUpdating] Backend response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Payment verification failed.');
        }

        /* ─── Success ─── */
        setWalletInfo({
          bundle: data.bundle,
          tokens: data.tokens,
          wallet: data.wallet,
        });

        setStatusMessage('Wallet topped up successfully! Redirecting...');

        setTimeout(() => {
          navigate('/');
          window.location.reload();
        }, 3000);

      } catch (error) {
        console.error('[PaymentUpdating] Error:', error.message);
        setIsError(true);
        setStatusMessage(error.message || 'Something went wrong.');
        setTimeout(() => navigate('/'), 4000);
      }
    }

    verifyPayment();
  }, [navigate, searchParams]);

  return (
    <div className="paymentPage">
      <div className="paymentCard">
        <img src={gptLogo} alt="Clauzify" className="paymentLogo" />

        <div className="spinner"></div>

        <h1>
          {isError ? 'Payment Failed' : 'Topping Up Wallet'}
        </h1>

        <p>{statusMessage}</p>

        {/* Show wallet summary on success */}
        {walletInfo && (
          <div className="walletSummary">
            <p><strong>{walletInfo.bundle}</strong> bundle activated</p>
            <p>+{walletInfo.tokens} tokens added</p>
            <p>New balance: {walletInfo.wallet} tokens</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentUpdating;