import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  redirects: {
    '/services': '/solutions/custom-software-automation/',
    '/shopify-migration-service': '/solutions/custom-software-automation/',
    '/shopify-development-agency-swishtag': '/solutions/custom-software-automation/',
    '/ui-ux-design-services': '/solutions/custom-software-automation/',
    '/shopify-agency-new-york': '/solutions/custom-software-automation/',
    '/shopify-theme-development': '/solutions/custom-software-automation/',
    '/shopify-ecommerce-solutions-for-promotional-product-distributors': '/shopify-company-store/',
    '/shopify-customer-migration': '/solutions/custom-software-automation/',
    '/rocket-gift-card-and-discount-shopify-app': '/shopify-apps-for-promotional-products/',
    '/platform/punchout': '/punchout-central/',
    '/product/punchout': '/punchout-central/',
    '/platform/purchase-orders': '/punchout-central/',
    '/platform/invoices': '/punchout-central/',
    '/platform/multi-store': '/platform/',
    '/platform/transactions': '/platform/',
    '/integrations': '/platform/',
    '/integrations/cxml': '/punchout-central/',
    '/integrations/jaggaer': '/punchout-central/',
    '/integrations/sap-ariba': '/punchout-central/',
    '/integrations/coupa': '/punchout-central/',
    '/integrations/oci': '/punchout-central/',
    '/integrations/oracle': '/punchout-central/',
    '/integrations/workday': '/punchout-central/',
    '/industries/promotional-print-uniforms': '/promotional-products-distributors/',
    '/industries/industrial-mro': '/industries/',
    '/industries/lab-scientific': '/industries/',
    '/manufacturing-execution-system': '/xecutor/',
  },
});
