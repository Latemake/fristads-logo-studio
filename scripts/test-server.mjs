import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.PORT = process.env.PORT || "3100";
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "fristads-tests-"));
await import("../server/index.js");
