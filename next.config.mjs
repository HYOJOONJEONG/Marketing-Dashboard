import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["127.0.0.1:3002", "localhost:3002", "http://127.0.0.1:3002", "http://localhost:3002"],
}

export default nextConfig
