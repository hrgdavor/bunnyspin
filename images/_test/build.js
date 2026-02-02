import { $ } from "bun";
import { buildDocker } from "../../src/buildDocker.js";

const step = parseInt(process.argv[2] || "1");
const prev = step-1
const PROVISION_SCRIPT = `test${step}.js`;
const BASE_IMAGE = step === 1 ? 'hrg-server:latest':`my-fun-base:${prev}`
const NEXT_IMAGE = `my-fun-base:${step}`

buildDocker(BASE_IMAGE, PROVISION_SCRIPT, NEXT_IMAGE)
