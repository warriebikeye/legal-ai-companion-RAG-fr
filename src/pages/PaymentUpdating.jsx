import './PaymentUpdating.css';

import { useEffect, useState } from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import gptLogo from '../assets/DeeBees.svg';

console.log(
  'REACT_APP_BASEURL:',
  process.env.REACT_APP_BASEURL
);

const API_BASE_URL =
  process.env.REACT_APP_BASEURL;

function PaymentUpdating() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const [statusMessage, setStatusMessage] =
    useState(
      'Verifying your payment...'
    );

  const [isError, setIsError] =
    useState(false);

  useEffect(() => {
    console.log(
      '\n========================================'
    );

    console.log(
      'PAYMENT UPDATING PAGE LOADED'
    );

    console.log(
      'CURRENT URL:',
      window.location.href
    );

    console.log(
      'API BASE URL:',
      API_BASE_URL
    );

    const verifyPayment =
      async () => {
        try {
          console.log(
            'STARTING PAYMENT VERIFICATION FLOW...'
          );

          /* =========================================
             GET URL PARAMS
          ========================================= */

          const status =
            searchParams.get(
              'status'
            );

          const transactionId =
            searchParams.get(
              'transaction_id'
            );

          const txRef =
            searchParams.get(
              'tx_ref'
            );

          console.log(
            'RAW SEARCH PARAMS:',
            window.location.search
          );

          console.log(
            'FLUTTERWAVE URL PARAMS:',
            {
              status,
              transactionId,
              txRef,
            }
          );

          /* =========================================
             VALIDATE STATUS
          ========================================= */

          console.log(
            'VALIDATING PAYMENT STATUS...'
          );

          if (
            !status ||
            status !== 'completed'
          ) {
            console.log(
              'PAYMENT STATUS INVALID OR FAILED'
            );

            console.log(
              'RECEIVED STATUS:',
              status
            );

            setIsError(true);

            setStatusMessage(
              'Payment was not successful.'
            );

            console.log(
              'REDIRECTING USER IN 3 SECONDS...'
            );

            setTimeout(() => {
              navigate('/');
            }, 3000);

            return;
          }

          console.log(
            'PAYMENT STATUS VALID'
          );

          /* =========================================
             VERIFY PAYMENT WITH BACKEND
          ========================================= */

          console.log(
            'CALLING BACKEND VERIFY ENDPOINT...'
          );

          console.log(
            'REQUEST URL:',
            `${API_BASE_URL}/payments/verify`
          );

          console.log(
            'REQUEST PAYLOAD:',
            {
              transactionId,
              txRef,
            }
          );

          const response =
            await fetch(
              `${API_BASE_URL}/payments/verify`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                credentials:
                  'include',

                body: JSON.stringify({
                  transactionId,
                  txRef,
                }),
              }
            );

          console.log(
            'BACKEND RESPONSE RECEIVED'
          );

          console.log(
            'RESPONSE STATUS:',
            response.status
          );

          console.log(
            'RESPONSE OK:',
            response.ok
          );

          const data =
            await response.json();

          console.log(
            'FULL BACKEND RESPONSE DATA:',
            data
          );

          /* =========================================
             HANDLE FAILED RESPONSE
          ========================================= */

          if (!response.ok) {
            console.log(
              'BACKEND VERIFICATION FAILED'
            );

            console.log(
              'ERROR MESSAGE:',
              data.message
            );

            throw new Error(
              data.message ||
                'Payment verification failed.'
            );
          }

          console.log(
            'PAYMENT VERIFIED SUCCESSFULLY'
          );

          /* =========================================
             SUCCESS FLOW
          ========================================= */

          console.log(
            'UPDATING SUCCESS UI...'
          );

          setStatusMessage(
            'Payment verified successfully. Redirecting...'
          );

          console.log(
            'REDIRECTING USER IN 2.5 SECONDS...'
          );

          setTimeout(() => {
            console.log(
              'NAVIGATING TO HOME PAGE...'
            );

            navigate('/');

            console.log(
              'RELOADING WINDOW...'
            );

            window.location.reload();
          }, 2500);
        } catch (error) {
          console.error(
            '\nPAYMENT VERIFICATION ERROR OCCURRED'
          );

          console.error(
            'ERROR MESSAGE:',
            error.message
          );

          console.error(
            'FULL ERROR:',
            error
          );

          setIsError(true);

          console.log(
            'SETTING ERROR UI STATE...'
          );

          setStatusMessage(
            error.message ||
              'Something went wrong.'
          );

          console.log(
            'REDIRECTING USER IN 4 SECONDS...'
          );

          setTimeout(() => {
            navigate('/');
          }, 4000);
        } finally {
          console.log(
            'PAYMENT VERIFICATION FLOW FINISHED'
          );

          console.log(
            '========================================\n'
          );
        }
      };

    verifyPayment();
  }, [navigate, searchParams]);

  return (
    <div className="paymentPage">
      <div className="paymentCard">
        <img
          src={gptLogo}
          alt="Logo"
          className="paymentLogo"
        />

        <div className="spinner"></div>

        <h1>
          {isError
            ? 'Payment Failed'
            : 'Activating Pro'}
        </h1>

        <p>{statusMessage}</p>
      </div>
    </div>
  );
}

export default PaymentUpdating;