const addresses = require('../contracts/addresses.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: `/nft/${addresses[80001].Proposal.address}/:slug`,
        destination: `/proposal/:slug`,
        permanent: false,
      },
      {
        source: `/nft/${addresses[80001].GeoDocument.address}/:slug`,
        destination: `/token/:slug`,
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
