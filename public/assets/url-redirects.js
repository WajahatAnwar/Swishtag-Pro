(function () {
  const REDIRECTS = Object.freeze({
    "/contact-us/": "/book-demo/",
    "/services/": "/solutions/custom-software-automation/",
    "/shopify-migration-service/": "/solutions/custom-software-automation/",
    "/shopify-development-agency-swishtag/": "/solutions/custom-software-automation/",
    "/ui-ux-design-services/": "/solutions/custom-software-automation/",
    "/shopify-agency-new-york/": "/solutions/custom-software-automation/",
    "/shopify-theme-development/": "/solutions/custom-software-automation/",
    "/shopify-ecommerce-solutions-for-promotional-product-distributors/": "/shopify-company-store/",
    "/shopify-customer-migration/": "/solutions/custom-software-automation/",
    "/rocket-apps/": "/shopify-apps-for-promotional-products/",
    "/rocket-gift-card-and-discount-shopify-app/": "/shopify-apps-for-promotional-products/",
    "/platform/punchout/": "/punchout-central/",
    "/product/punchout/": "/punchout-central/",
    "/platform/purchase-orders/": "/punchout-central/",
    "/platform/invoices/": "/punchout-central/",
    "/platform/multi-store/": "/platform/",
    "/platform/transactions/": "/platform/",
    "/integrations/": "/platform/",
    "/integrations/cxml/": "/punchout-central/",
    "/integrations/jaggaer/": "/punchout-central/",
    "/integrations/sap-ariba/": "/punchout-central/",
    "/integrations/coupa/": "/punchout-central/",
    "/integrations/oci/": "/punchout-central/",
    "/integrations/oracle/": "/punchout-central/",
    "/integrations/workday/": "/punchout-central/",
    "/industries/promotional-print-uniforms/": "/promotional-products-distributors/",
    "/industries/industrial-mro/": "/industries/",
    "/industries/lab-scientific/": "/industries/",
    "/project/pickpack/": "/xecutor/",
    "/manufacturing-execution-system/": "/xecutor/",
    "/project/mes/": "/xecutor/"
  });

  const TRUSTED_HOSTS = new Set(["swishtag.com", "www.swishtag.com"]);

  function normalizePath(pathname) {
    if (!pathname) return "/";

    let value = String(pathname).trim();
    try {
      value = decodeURIComponent(value);
    } catch (error) {}

    value = value.replace(/\/{2,}/g, "/").toLowerCase();
    if (!value.startsWith("/")) value = `/${value}`;
    if (!value.endsWith("/")) value = `${value}/`;
    return value;
  }

  function isTrustedHost(url) {
    return url.hostname === window.location.hostname || TRUSTED_HOSTS.has(url.hostname);
  }

  function withOriginalSuffix(target, sourceUrl) {
    try {
      const targetUrl = new URL(target, window.location.origin);
      if (!targetUrl.search && sourceUrl.search) targetUrl.search = sourceUrl.search;
      if (!targetUrl.hash && sourceUrl.hash) targetUrl.hash = sourceUrl.hash;
      return targetUrl.origin === window.location.origin
        ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        : targetUrl.href;
    } catch (error) {
      return target;
    }
  }

  function resolve(value, base = window.location.href) {
    if (!value) return "";

    try {
      const url = new URL(value, base);
      if (!isTrustedHost(url)) return "";

      const target = REDIRECTS[normalizePath(url.pathname)];
      return target ? withOriginalSuffix(target, url) : "";
    } catch (error) {
      return "";
    }
  }

  window.SwishtagUrlRedirects = {
    redirects: REDIRECTS,
    normalizePath,
    resolve
  };

  const currentTarget = resolve(window.location.href);
  if (currentTarget) {
    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(currentTarget, window.location.origin);
    if (targetUrl.href !== currentUrl.href) window.location.replace(targetUrl.href);
  }
})();
