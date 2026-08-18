/**
 * Utility functions for handling global pricing and currency conversion
 */

const EXCHANGE_RATE_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with actual key in production
const EXCHANGE_RATE_API_URL = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/`;

/**
 * Fetches the latest exchange rates for a given base currency.
 * Caches the result in sessionStorage to avoid hitting the API rate limit.
 * 
 * @param {string} baseCurrency - The 3-letter currency code (e.g., 'ZMW', 'USD')
 * @returns {Promise<Object>} - An object containing exchange rates
 */
async function fetchExchangeRates(baseCurrency = 'ZMW') {
    // 1. Check if rates are already cached for this base currency
    const cacheKey = `exchange_rates_${baseCurrency}`;
    const cachedRates = sessionStorage.getItem(cacheKey);

    if (cachedRates) {
        const { timestamp, rates } = JSON.parse(cachedRates);
        // Refresh cache if older than 24 hours (86400000 ms)
        if (Date.now() - timestamp < 86400000) {
            return rates;
        }
    }

    try {
        // 2. Fetch fresh rates from the API
        // NOTE: Since we don't have a real API key yet, we'll mock the response
        // if the API call fails or if the key is not set.
        if (EXCHANGE_RATE_API_KEY === 'YOUR_API_KEY_HERE') {
            return mockExchangeRates(baseCurrency);
        }

        const response = await fetch(`${EXCHANGE_RATE_API_URL}${baseCurrency}`);
        if (!response.ok) throw new Error('Failed to fetch exchange rates');

        const data = await response.json();
        const rates = data.conversion_rates;

        // 3. Cache the new rates
        sessionStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            rates: rates
        }));

        return rates;
    } catch (error) {
        console.error("Exchange rate fetch error, falling back to mock data:", error);
        return mockExchangeRates(baseCurrency);
    }
}

/**
 * Converts an amount from one currency to another using live (or cached) rates.
 * 
 * @param {number} amount - The amount to convert
 * @param {string} fromCurrency - The base currency code (e.g., 'ZMW')
 * @param {string} toCurrency - The target currency code (e.g., 'USD')
 * @returns {Promise<number>} - The converted amount
 */
async function convertPrice(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;

    const rates = await fetchExchangeRates(fromCurrency);
    const rate = rates[toCurrency] || 1; // Default to 1 if conversion rate not found

    return amount * rate;
}

/**
 * Formats a number as a localized currency string.
 * 
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - The ISO currency code
 * @param {string} locale - The user's locale (e.g., 'en-US')
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, currencyCode, locale = 'en-US') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0, // Don't show .00 for whole numbers if possible
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Detects the user's location and preferred currency based on their IP address.
 * 
 * @returns {Promise<{country: string, current: string}>}
 */
async function detectUserCurrency() {
    try {
        // Abort after 3 seconds to keep UI snappy
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('IP lookup failed');
        const data = await response.json();

        return {
            country: data.country_name,
            code: data.country_code,
            currency: data.currency
        };
    } catch (error) {
        console.error("Currency detection fallback:", error);
        return { country: 'Zambia', code: 'ZM', currency: 'ZMW' };
    }
}

/**
 * Initializes all Smart Price Tags on the page.
 * Finds all elements with the class 'smart-price' and converts their inner text.
 */
async function initializeSmartPricing() {
    const priceTags = document.querySelectorAll('.smart-price');
    if (priceTags.length === 0) return;

    // Detect user's current location/currency
    const userLocation = await detectUserCurrency();
    const targetCurrency = userLocation.currency;

    for (const tag of priceTags) {
        const basePrice = parseFloat(tag.getAttribute('data-base-price'));
        const baseCurrency = tag.getAttribute('data-base-currency');

        if (isNaN(basePrice) || !baseCurrency) continue;

        try {
            // Convert the price to the user's currency
            const convertedAmount = await convertPrice(basePrice, baseCurrency, targetCurrency);

            // Format and update the DOM
            tag.innerHTML = formatCurrency(convertedAmount, targetCurrency);

            // Add a small tooltip indicating the original price
            tag.setAttribute('title', `Original Price: ${formatCurrency(basePrice, baseCurrency)}`);
            tag.classList.add('transition-opacity', 'duration-500', 'opacity-100');
        } catch (error) {
            console.error(`Failed to convert price for element:`, tag, error);
            // Fallback to displaying base price
            tag.innerHTML = formatCurrency(basePrice, baseCurrency);
        }
    }
}

// ----- MOCK DATA FALLBACK -----
function mockExchangeRates(base) {
    // Rough mock exchange rates relative to heavily used currencies
    const mockRates = {
        'ZMW': { 'USD': 0.038, 'GBP': 0.030, 'ZAR': 0.72, 'NGN': 58.50, 'KES': 5.05 },
        'USD': { 'ZMW': 26.50, 'GBP': 0.79, 'ZAR': 18.90, 'NGN': 1500.00, 'KES': 132.50 },
        'NGN': { 'USD': 0.00067, 'GBP': 0.00053, 'ZMW': 0.017, 'ZAR': 0.013, 'KES': 0.088 }
    };

    return mockRates[base] || { [base]: 1 };
}

// Export for module usage, but attach to window for static HTML integration
if (typeof window !== 'undefined') {
    window.PricingModule = {
        convertPrice,
        formatCurrency,
        detectUserCurrency,
        initializeSmartPricing
    };
}
