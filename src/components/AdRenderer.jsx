import AdsterraBanner from './AdsterraBanner';
import AdBanner from './AdBanner';

const PROVIDER = process.env.REACT_APP_AD_PROVIDER; // "adsense" | "adsterra"

/**
 * AdRenderer — single switch point between ad providers.
 *
 * `position` drives BOTH the Adsterra variant mapping AND which
 * AdSense slot ID to use, so callers never branch on provider —
 * they just say where the ad sits in the response.
 *
 * If REACT_APP_AD_PROVIDER is unset or misconfigured, renders null.
 * A broken/undefined ad call (e.g. client=undefined) is worse than
 * no ad — it can itself read as a low-quality ad unit on review.
 */

const ADSENSE_SLOTS = {
  top: process.env.REACT_APP_ADSENSE_SLOT_TOP,
  middle: process.env.REACT_APP_ADSENSE_SLOT_MIDDLE,
  bottom: process.env.REACT_APP_ADSENSE_SLOT_BOTTOM,
};

const ADSTERRA_VARIANTS = {
  top: 'native',
  middle: 'social-bar',
  bottom: 'banner',
};

export default function AdRenderer({ position, className, height, width, adHeight }) {
  if (PROVIDER === 'adsense') {
    const adSlot = ADSENSE_SLOTS[position];
    if (!adSlot) return null; // slot not configured for this position — don't render broken unit
    return <AdBanner adSlot={adSlot} height={height} className={className} />;
  }

  if (PROVIDER === 'adsterra') {
    return (
      <AdsterraBanner
        variant={ADSTERRA_VARIANTS[position]}
        width={width}
        adHeight={adHeight}
        height={height}
        className={className}
      />
    );
  }

  return null;
}