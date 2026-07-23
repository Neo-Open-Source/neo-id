import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
    globals: true,
    alias: {
      "@neo-id/db": path.resolve(__dirname, "tests/__mocks__/db.ts"),
    },
    env: {
      JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCf+TlGVs56h/O7ncWK/WKcrgPw2NLCvtaDt1JSwwfHQ7896EjOq3ZvybreLtR6qPgNyb4+0p/2/yEc2RwURA7U0/l4sSjPUBOA3xyFq0o1AX79ZfRu1rJkIHlxJLaCbID/G1BjGjCNKnyLJQ+h0wUd199A2yQQc2tPyy2gk2ytd3bWcEYgwMye3zovZXfip9wdVFr1d3/t30xYnDdNtq3P/Dw7TQAkXPPMa3hVlP/ugTwlFZ3Lu2Qi8ELAVq07BiXd4W6AXdpVc7MRMUuvzmL4pXFAgMBAAECggEABsHxtoAYT0El37TZmxbQx4twPac9dJgB5XhEvNc3oEbF81GIMeg9/cokhfgkQ/c5F3sPw0+hHTjte26ONiuded8OQlqdWpY36m3P8xvWHjahP2iqoNHdSWkMZMLoRGuIJyottEQ35HcmGKB960HjRiuKnXjui5RaVgle9X37s7eDmTmcUkT5KZA2167D0VqJ7B/AQBHSXpWc085kIpKtZ5Qss6SGq/6JcIgTG8GEFQ5ZIQyA4RGR4gfCuW7Tre3U8cfbsCw3o1Tdj/uP9OnHNAeRsvUm7Ax/E3h+ZljvkG/6RF8f6oMG5IWvTubvqFV+X951wojrJ7lQ48xl1vCUOQKBgQDhzhE3SHXV+rUkeAGXfLHeRdabrde2xPK9jaCEr6vy8c+lGpXWMqbgM6WoOHApqi67dILgbDAeiFNMSSi4WxEuj2mu4vVKBYt5ypfN7J17vCG30m3qu6+yrO7qlfZYdata0ZFohiHxxytjPpbj6AHNSzDFDnVj9qoN55Mi1YppbQKBgQDb/XDikmalnRh2ixzPT4D3SWX2B/0CVIjMFuOO9JIgAPOocOdmdBQoACmuerhXuothlQjwY+Hnz7KbjOWkcbf3M6OswnQbmvY79a/l+sQvHQe5yh2PMGkd+VXpZm3WjmZSRaojwAx0QRtr5Yz+4hXeaomxZYSVUVkeyEf/KiQ+uQKBgAIhGVR2IHZWGOMxJoKxMFQyQGXTa9dTYB6deUgHCA4Qba7W41bTv3MZyZQehCBAdJRb8uf+3S1Mh8yOXA3w/eZ8f7igd0OtbbVGTcwpUQrbqU28dEDkaDG9I7uekmYfJfCDTWW47hUDlcsnyfB4PZwb+2fATScWKmBbMK4BaX65AoGAOBIg857dCtk/ovdSIITjGiRbGJpwomdpdpte5NDxbbbQY95jHHn5qThhZ1dgJPwnCngyDxNmQO9vVrZS0dcqTJec4Cuv7FlS6XV1n+iKmHeNwI0De7ubD0i93P9+f3FMIywecX5Brl/p3VZk2ZJGgKom7lAxut1BGddyglb7ZgECgYEAnfl4bH2grQBpk1RJp58LYoiPuIqEK4UKUlOoq2JlZoSFCs+TO2Me+Na0fwxRnX0aSZyuWiPaed7hUbBswW1hU37j0M23ZyoMTaMChqaYFpALqw0n2IbFZ09CCJkhI5vbhWgOiCsa0zAEiXo4ukVVNWpP6Kh34aKzxfBJRxRGCvY=\n-----END PRIVATE KEY-----",
      JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwgrU80803QQ8xvMs4EPplb9+As1O1sq/nss12IvmWN5Ks3ZRoH7eqZjxtLX7BUxrPdCGgVvwXreGaJNjymNZjoPR4PjiTfC+7se64ADa/yiVI5jhK32+UDO1Y41e2CF9TgrapgHBomchqeO3lJ0odXYGKM+Y3Y87IGwPMbjO43fbytM1CTDBiDLHci96jr/prBI9pRThWFZ/GHrZpIB5JfEGWwronpaghk8WhbvtpX6aQhBufcfG+1cf9+yrY5qrPtIv+mZaV9GIFTbatz/w8O00AJFzzzGt4VZT/7oE8JRWdy7tkIvBCwFatOwYl3eFugF3aVXOzETFLr85i+KVxQIDAQAB\n-----END PUBLIC KEY-----",
      JWT_ISSUER: "https://test.neome.uk",
    },
  },
});
