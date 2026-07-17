import React from "react";
import { render } from "ink";
import App from "./App.jsx";
import { loadConfig } from "./config.js";
import { createConvexClient } from "./convex.js";

const config = loadConfig();
const convex = createConvexClient(config.convexUrl);

const { waitUntilExit } = render(
  <App convex={convex} config={config} me={config.personName} />
);

await waitUntilExit();
await convex.close();
process.exit(0);
