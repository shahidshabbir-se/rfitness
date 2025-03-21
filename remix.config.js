/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "esm",
  serverMinify: false,
  tailwind: true,
  postcss: true,
  watchPaths: ["./tailwind.config.ts"],
  dev: {
    port: 3000,
    host: "0.0.0.0"
  }
}; 
