# Neat idea, low priority, likely unnecessary

Bun was chosen, as it is actively developed and used a lot. So it is tested in the use-cases we need it too.
Lighter compact bun without nodejs stuff would be efficient and compact, just there is not enought time ATM to chase this.
As an idea it is worth at least contempalting and exploring a bit. Bun also does sanitation for shell exec, so making a copy of its functionality is less attractive while bun is actively developed. The 100MB bun file size for now is an acceptable compromise for using and actively developed and mature tool.


## Initial proposal

**Bun-light (bunl) or ZJS (Zig-JS Shell)**

**Objective:** 
- < 5MB single-binary runner 
- implements Bun’s Shell API (`$`) and essential provisioning tools 
- using `quickjs-ng` and Zig.
- goal is reliability and parity with bun behavior
- lightweight more important than performace
- when insufficient should be trivial to switch to bun
- when buggy, fall-back to Bun
- if abanoned as project, fall-back to using Bun
- if direct bun parity is too complex, consider a shim (that handles simpler impl here and Bun variant)
- 100 MB bun might be an ok compromise if leaner implementation becomes a burden to maintain

------

Phase 1: Core Engine & Bridge

The foundation involves embedding `quickjs-ng` into a Zig project to handle the JS lifecycle.

1. **Integrate `quickjs-ng`:** Use `zig-quickjs-ng` as a build dependency.
2. **Synchronous Event Loop:** Unlike Node/Bun, prioritize a synchronous loop for provisioning.
3. **Global Injection:** Implement a `zjs` namespace and inject a global `$` function into the JS context during initialization.

Phase 2: The Bun Shell API Implementation

Bun's shell is actually its own DSL/Parser. You can mimic its behavior by wrapping Linux syscalls.

- **Extraction from Bun:** Bun’s shell is written in Zig. You can reference the Bun repository specifically for their **ANSI handling** and **Path resolution** logic.
  - *Note:* You cannot easily copy-paste their shell because it is highly integrated with Bun's internal memory allocator, but their **Lexer** logic is a great reference.
- **Implementation steps for `$ `:**
  1. Implement a Tagged Template Literal parser in Zig.
  2. Use `posix_spawn` or `fork/exec` for command execution.
  3. Return an object containing `stdout`, `stderr`, and `exitCode` (Status).

Phase 3: The "Stub" & Bytecode Linker

This addresses your goal of creating a "compiler" without a C toolchain.

1. **The Stub:** Build a version of `zjs` that checks for a magic byte sequence (e.g., `ZJS_BLOB_START`) at the end of its own binary.
2. **The Bundler (`zjs build`):**
   - Parse the input JS script.
   - Call `JS_WriteObject` (quickjs-ng) to generate bytecode.
   - Create a new file: `[Stub Binary] + [Bytecode Blob] + [Footer with Offset]`.
3. **Cross-Compilation:** Since Zig can cross-compile to any target, your build tool can ship pre-compiled stubs for `x86_64-linux`, `aarch64-linux`, etc.

------

Proposed Roadmap & Milestones

| Step  | Task                   | Deliverable                                                  |
| ----- | ---------------------- | ------------------------------------------------------------ |
| **1** | **Hello Shell**        | A Zig binary that executes `await $`ls`` using `quickjs-ng`. |
| **2** | **FS & OS Extras**     | Sync versions of `mkdir`, `cp`, `rm`, and `env` globals.     |
| **3** | **Bytecode Injection** | A `zjs --compile script.js` command that outputs a standalone exe. |
| **4** | **Bun Parity**         | Implementation of `$.text()`, `$.json()`, and `$.quiet()`.   |

------

Critical Tests to Add

To ensure this is reliable for provisioning, your test suite must cover:

1. **Process Isolation:** Verify that environment variables passed to `$` do not leak into the parent process unless intended.
2. **Bytecode Portability:** Compile bytecode on one Linux distro (e.g., Ubuntu) and ensure it runs on another (e.g., Alpine/musl) using your stub.
3. **Error Propagation:** Ensure a non-zero exit code in a shell command correctly throws a JS Exception (matching Bun/JavaScript behavior).
4. **Memory Pressure:** Run a provisioning loop of 1,000 shell commands to ensure the Zig-to-C-to-JS bridge isn't leaking file descriptors or memory.

Leveraging the Bun Codebase

You can "mine" the Bun source for these specific high-value components:

1. **`src/shell/`**: Look at how they handle glob expansion (`*.js`). This is complex in C/Zig but already solved in Bun.
2. **`src/bun.js/node-fs`**: If you want Node.js compatibility, their `fs` wrappers are the gold standard for performance.
3. **`src/io/`:** Reference their use of `io_uring` for Linux if you decide to make your shell asynchronous later.

------

Testing the Shell API (`$`) with Bun

The patterns below show how to verify each `$` behavior using Bun's test runner (`bun:test`) before implementing Zig/QuickJS parity. Copy them into `src/shell.test.js` and run with `bun test`.

## 1. Basic stdout capture

```js
import { test, expect } from "bun:test";

test("$ returns stdout as a string when accessed", async () => {
  const result = $`echo hello`;
  expect(result.stdout.toString()).toContain("hello");
});
```

When building `zjs`, verify that invoking a command captures stdout identically — i.e., the returned object's `stdout` contains the raw bytes produced by the child process.

## 2. Stderr capture

```js
import { test, expect } from "bun:test";

test("$ captures stderr separately", async () => {
  const result = $`sh -c 'echo err >&2; echo out'`;
  expect(result.stdout.toString().trim()).toBe("out");
  expect(result.stderr.toString().trim()).toBe("err");
});
```

Your Zig bridge must also keep stdout and stderr on **separate buffers** (do not merge them). Verify that `stderr` does not leak into `stdout`.

## 3. Exit code propagation

```js
import { test, expect } from "bun:test";

test("$ throws on non-zero exit code", async () => {
  await expect($`sh -c 'exit 42'`).rejects.toThrow();
});

test("$.quiet() suppresses the throw", async () => {
  const result = await $`sh -c 'exit 42'`.quiet();
  expect(result.exitCode).toBe(42);
});
```

When implementing feature parity, the `$` function must throw on non-zero exit codes by default, but support `.quiet()` to suppress the throw. The `zjs` stub must replicate this contract.

## 4. Environment variable injection

```js
import { test, expect } from "bun:test";

test("$ passes env to child process", async () => {
  const result = $`sh -c 'echo $MYVAR'`, { env: { MYVAR: "secret" } };
  expect(result.stdout.toString().trim()).toBe("secret");
});
```

Verify that an object passed as the second argument merges into the child's environment **without** polluting the parent process.

## 5. Glob expansion

```js
import { test, expect } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

test("$ expands globs before executing", async () => {
  mkdirSync("/tmp/globtest", { recursive: true });
  writeFileSync("/tmp/globtest/a.txt", "a");
  writeFileSync("/tmp/globtest/b.txt", "b");
  const result = $`cat /tmp/globtest/*.txt`;
  expect(result.stdout.toString()).toContain("a");
  expect(result.stdout.toString()).toContain("b");
  rmSync("/tmp/globtest", { recursive: true, force: true });
});
```

Bun's shell expands globs before executing the command. This is a **high-value** test because glob expansion is complex. Your `zjs` implementation must either replicate this logic or delegate to a POSIX shell (`sh -c`) with glob expansion enabled.

## 6. Tagged template interpolation

```js
import { test, expect } from "bun:test";

test("$ interpolates variables correctly", async () => {
  const file = "test.txt";
  const result = $`ls "${file}"`;
  expect(result.exitCode).toBe(0);
});

test("$ prevents injection by quoting interpolations", async () => {
  const malicious = "'; rm -rf /; echo'";
  // The command should execute literally, not as injected shell code
  const result = $`echo ${malicious}`;
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("'; rm -rf /; echo");
});
```

Bun's `$` **sanitises interpolated values** by quoting them. This is the most important parity check — if `zjs` naively concatenates strings, it will be vulnerable to shell injection.

## 7. `.text()` and `.json()` helpers

```js
import { test, expect } from "bun:test";

test("$.json() parses response body", async () => {
  const result = await $`echo '{\"a\":1}'`.json();
  expect(result).toEqual({ a: 1 });
});

test("$.text() returns the string body", async () => {
  const result = await $`echo hello`.text();
  expect(result).toBe("hello\n");
});
```

These convenience methods return parsed output directly. The `zjs` stub should expose the same helpers.

## 8. Memory pressure / fd leak test

```js
import { test } from "bun:test";

test("repeated $ calls do not leak file descriptors", async () => {
  for (let i = 0; i < 1000; i++) {
    await $`echo test`;
  }
  // If this test completes without hitting OS fd limits, we're good.
  // In CI you can also check /proc/self/fd before/after and assert the count matches.
});
```

This is a regression test for memory/fd leaks in your Zig-to-JS bridge. Run it in CI with `ulimit -n` set low (e.g., 2048) to fail fast if descriptors leak.

## Summary: parity checklist

| Feature              | Bun behavior                          | zjs target                    |
| -------------------- | ------------------------------------- | ----------------------------- |
| `$` returns object   | `{ stdout, stderr, exitCode, ... }`  | same object shape             |
| Non-zero exit        | throws                                | same                          |
| `.quiet()`           | suppresses throw                      | same                          |
| `.text()` / `.json()`| parse helpers                         | same                          |
| Glob expansion       | expands `*`, `**` before exec         | replicate or use `sh -c`      |
| Interpolation safety | quotes interpolated values            | **critical** — no injection   |
| Env injection        | merges child env, parent untouched    | same                          |
| fd / memory stability| no leaks across thousands of invocations | verify with loop test above |

These tests should live alongside your source files (e.g. `src/shell.test.js`) so they run with `bun test` during development. Once ported to your Zig project, translate each pattern to the equivalent test framework assertion. For bytecode tests, compile on one host, copy the `.bin` to another, and execute it to confirm cross-distro portability.

------

# Addon (Compiler & Bundler)

Addon: The ZJS Unified Toolchain (Compiler & Bundler)

This addon transforms the `zjs` runner into a self-contained distribution tool. It eliminates the need for a C compiler on target machines by using a **"Pre-compiled Stub"** architecture.

------

1. Unified CLI Functionality

The single `zjs` binary will operate in three modes based on input:

- **Compiler Mode (`zjs --compile <file.js>`):** Transforms high-level JS into a versioned QuickJS bytecode blob.
- **Interpreter Mode (`zjs <file.js | file.bin>`):** Detects if the input is source code or bytecode and executes it instantly.
- **Bundler Mode (`zjs --bundle <file.js> --output <name>`):** Generates a standalone, redistributable executable.
- Implementation Details

**A. Bytecode Generation & Version Guarding**

To prevent crashes caused by engine mismatches, ZJS implements a **Header Guard**:

- **Compilation:** When generating bytecode via `JS_WriteObject`, ZJS prepends a custom **16-byte header**.
- **Header Content:** Includes a `ZJS` magic string, the engine version (e.g., `qjs-ng-2024.12`), and a target architecture flag.
- **Validation:** Upon execution, the runner checks this header. If the version or architecture doesn't match the internal engine, it throws a clear error: *"Bytecode version mismatch: Expected v1.2, found v1.1"*.

**B. The "Self-Appending" Standalone Binary**

ZJS achieves "compilation" to a standalone binary through **Binary Injection**:

1. **The Stub:** The standard `zjs` binary is built with a "Seeker" entry point.

2. **Detection:** On startup, the binary checks its own file size against a hardcoded "Original Size" value.

3. **Extraction:** If the current file is larger than the original size, the runner knows a payload has been appended. It seeks to the `Original Size` offset and reads the bytecode directly into memory.

4. **Bundling Logic:**

   bash

   ```
   # Conceptual "zjs --bundle" logic:
   cp /usr/bin/zjs ./my-tool
   zjs --compile my-script.js >> ./my-tool
   chmod +x ./my-tool
   ```

   Use code with caution.

   

**C. Zero-Dependency Portability**

- **Static Linking:** The binary is statically linked against `musl` (on Linux), ensuring it runs on any distribution (Ubuntu, Alpine, CentOS) without requiring specific shared libraries.
- **Architecture Agnostic Bundling:** Because the "Linker" is just a file-append operation, a Linux machine can bundle a Windows-stub with bytecode to "cross-compile" a Windows `.exe` without needing a Windows build environment.

------

Summary Table: Distribution Workflow

| Stage          | Input         | Action                       | Result                            |
| -------------- | ------------- | ---------------------------- | --------------------------------- |
| **Develop**    | `.js` files   | Run with `zjs` (interpreter) | Rapid iteration                   |
| **Protect**    | `.js` files   | `zjs --compile`              | `.bin` bytecode (obfuscated)      |
| **Distribute** | `.bin` + Stub | `zjs --bundle`               | **Standalone Executable** (< 5MB) |
