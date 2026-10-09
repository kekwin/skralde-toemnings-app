import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { createVestfor } from "./vestfor.ts";

const port = Number(process.env.PORT) || 3100;
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const staticDir = process.env.STATIC_DIR || fileURLToPath(new URL("../dist/", import.meta.url));

createApp({ vestfor: createVestfor(), dataDir, staticDir, homeAddress: process.env.HOME_ADDRESS ?? "" }).listen(port, () => {
  console.log(`\n  Skraldetømningsapp kører på  http://localhost:${port}\n`);
});
