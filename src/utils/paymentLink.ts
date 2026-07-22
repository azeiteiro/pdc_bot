const sanitizeName = (name: string): string => {
  const withoutDiacritics = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const withUnderscores = withoutDiacritics.trim().replace(/\s+/g, '_');
  const alphanumericOnly = withUnderscores.replace(/[^A-Za-z0-9_]/g, '');
  const collapsed = alphanumericOnly.replace(/_+/g, '_').replace(/^_|_$/g, '');

  return collapsed || 'user';
};

/**
 * Build a pre-filled Revolut deep link with currency, amount, and a reference note.
 */
export const buildRevolutPaymentLink = (
  name: string,
  amountEuros: number,
  noteLabel: string = 'PDC_2026',
): string => {
  const note = `${sanitizeName(noteLabel)}_${sanitizeName(name)}`;
  const cents = Math.round(amountEuros * 100);

  return `https://revolut.me/azeiteiro?currency=EUR&amount=${cents}&note=${encodeURIComponent(note)}`;
};

/**
 * Build a pre-filled PayPal.me deep link with a 2-decimal EUR amount.
 */
export const buildPaypalPaymentLink = (paypalUsername: string, amountEuros: number): string => {
  const formattedAmount = amountEuros.toFixed(2);

  return `https://paypal.me/${paypalUsername}/${formattedAmount}EUR`;
};
