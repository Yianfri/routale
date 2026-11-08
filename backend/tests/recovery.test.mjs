import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, resolve, dirname } from "node:path";
import { Recovery, readConfiguration } from "../../deploy/recovery.mjs";
import { demoBackup } from "../../frontend/tools/demo-data.mjs";

const execute = promisify(execFile);
const image = process.env.ROUTALE_RECOVERY_IMAGE;
const resticBinary = process.env.RESTIC_BINARY;

async function docker(args, input) {
  if (input === undefined) {
    try {
      return (await execute("docker", args, { windowsHide: true })).stdout;
    } catch {
      throw new Error(
        "Falló un comando Docker del ensayo con datos ficticios.",
      );
    }
  }
  const child = spawn("docker", args, {
    windowsHide: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
  const result = new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? done() : reject(new Error("No se creó la cuenta ficticia.")),
    );
  });
  child.stdin.end(input);
  await result;
}
async function ready(base) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {
      /* API del ensayo. */
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("La API de prueba no respondió.");
}
async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
class Client {
  cookies = new Map();
  token = "";
  constructor(base) {
    this.base = base;
  }
  async request(path, { method = "GET", body, headers = {} } = {}) {
    const response = await fetch(this.base + path, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(this.token ? { "X-CSRF-TOKEN": this.token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0],
        index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
}

test(
  "respaldo cifrado y recuperación completa en un volumen nuevo",
  {
    skip:
      !image || !resticBinary
        ? "Requiere ROUTALE_RECOVERY_IMAGE y RESTIC_BINARY para Docker local."
        : false,
    timeout: 180_000,
  },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "routale-recovery-"));
    const suffix = randomUUID();
    const source = "routale-recovery-source-" + suffix;
    const sourcePort = await freePort();
    const restored = "routale-recovery-restored-" + suffix;
    const reader = "routale-recovery-reader-" + suffix;
    const sourceVolume = "routale_recovery_source_" + suffix;
    const restoredVolume = "routale_recovery_restored_" + suffix;
    const password = randomBytes(32).toString("base64url");
    const passwordFile = join(directory, "repository-password");
    const configFile = join(directory, "configuration.json");
    const config = {
      repository: join(directory, "encrypted-repository"),
      passwordFile,
      resticBinary,
      container: source,
    };
    await writeFile(passwordFile, randomBytes(32).toString("base64url"), {
      mode: 0o600,
    });
    await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
    const recovery = new Recovery(await readConfiguration(configFile));
    const gateway = JSON.parse(
      await docker(["network", "inspect", "bridge"]),
    )[0].IPAM.Config[0].Gateway;
    const volumeOptions = [
      "--mount",
      `type=volume,source=${sourceVolume},target=/data`,
    ];
    const environment = [
      "--env",
      "ASPNETCORE_ENVIRONMENT=Development",
      "--env",
      `ReverseProxy__KnownProxies=${gateway}`,
    ];
    const containers = [source, restored, reader];
    let snapshot;
    try {
      await docker([
        "volume",
        "create",
        "--label",
        `routale.test=${suffix}`,
        sourceVolume,
      ]);
      await docker(["run", "--rm", ...volumeOptions, image, "migrate"]);
      await docker(
        [
          "run",
          "--rm",
          "--interactive",
          ...volumeOptions,
          image,
          "create-user",
        ],
        `recovery.example\n${password}\n${password}\n`,
      );
      await docker([
        "run",
        "--detach",
        "--name",
        source,
        "--label",
        "com.docker.compose.service=api",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=64m",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--publish",
        `127.0.0.1:${sourcePort}:8080`,
        ...volumeOptions,
        ...environment,
        image,
      ]);
      const inspected = JSON.parse(await docker(["inspect", source]))[0];
      const port = inspected.NetworkSettings.Ports["8080/tcp"][0].HostPort;
      const base = `http://127.0.0.1:${port}`;
      await ready(base);
      const client = new Client(base);
      client.token = (
        await (await client.request("/api/auth/csrf")).json()
      ).token;
      assert.equal(
        (
          await client.request("/api/auth/login", {
            method: "POST",
            body: { username: "recovery.example", password },
          })
        ).status,
        200,
      );
      client.token = (
        await (await client.request("/api/auth/csrf")).json()
      ).token;
      const fixture = demoBackup();
      fixture.customMetadata = {
        preserved: "Restauración ficticia, café y ñ",
        unknown: null,
      };
      const route = "/api/trips/" + fixture.data.trip.id;
      assert.equal(
        (
          await client.request(route, {
            method: "PUT",
            body: fixture,
            headers: { "If-None-Match": "*" },
          })
        ).status,
        201,
      );

      await t.test("cifra base y claves juntas y reanuda la API", async () => {
        await recovery.initialize();
        snapshot = await recovery.backup();
        assert.match(snapshot, /^[a-f0-9]{64}$/);
        await recovery.check();
        assert.equal((await client.request("/api/auth/me")).status, 200);
        assert.equal((await recovery.snapshots()).length, 1);
      });
      await t.test(
        "una contraseña incorrecta falla antes de detener la API",
        async () => {
          const wrongFile = join(directory, "wrong-password");
          await writeFile(wrongFile, randomBytes(32).toString("hex"), {
            mode: 0o600,
          });
          await assert.rejects(
            new Recovery({ ...config, passwordFile: wrongFile }).backup(),
          );
          assert.equal((await client.request("/api/auth/me")).status, 200);
        },
      );
      await t.test(
        "un productor fallido no publica una copia parcial y reanuda la API",
        async () => {
          class BrokenCopy extends Recovery {
            transport(args) {
              return args[0] === "cp"
                ? { command: process.execPath, args: ["-e", "process.exit(7)"] }
                : super.transport(args);
            }
          }
          await assert.rejects(new BrokenCopy(config).backup());
          assert.equal((await client.request("/api/auth/me")).status, 200);
          assert.equal((await recovery.snapshots()).length, 1);
        },
      );
      await t.test(
        "una interrupción durante la transferencia reanuda la API",
        async () => {
          let producing = false;
          class SlowCopy extends Recovery {
            transport(args) {
              if (args[0] !== "cp") return super.transport(args);
              producing = true;
              return {
                command: process.execPath,
                args: ["-e", "setTimeout(()=>process.exit(7), 5000)"],
              };
            }
          }
          const interrupted = new SlowCopy(config);
          const result = assert.rejects(interrupted.backup());
          for (let attempt = 0; attempt < 600 && !producing; attempt++)
            await new Promise((done) => setTimeout(done, 100));
          assert.equal(producing, true);
          interrupted.cancel();
          await result;
          assert.equal((await client.request("/api/auth/me")).status, 200);
          assert.equal((await recovery.snapshots()).length, 1);
        },
      );
      await t.test("rechaza otro contenedor que monte el volumen", async () => {
        await docker([
          "run",
          "--detach",
          "--name",
          reader,
          ...volumeOptions,
          "--network",
          "none",
          "--entrypoint",
          "sleep",
          image,
          "120",
        ]);
        try {
          await assert.rejects(recovery.backup(), /Otro contenedor/);
        } finally {
          await docker(["rm", "--force", reader]);
        }
        assert.equal((await client.request("/api/auth/me")).status, 200);
      });
      await t.test("no reemplaza un volumen existente", async () => {
        await assert.rejects(
          recovery.restore(snapshot, sourceVolume),
          /ya existe/,
        );
        assert.deepEqual(await (await client.request(route)).json(), fixture);
      });
      await t.test(
        "restaura esquema, relaciones, contenido y una sesión ya emitida",
        async () => {
          const result = await recovery.restore(snapshot, restoredVolume);
          assert.equal(result.volume, restoredVolume);
          await docker([
            "run",
            "--detach",
            "--name",
            restored,
            "--publish",
            "127.0.0.1::8080",
            "--mount",
            `type=volume,source=${restoredVolume},target=/data`,
            ...environment,
            result.image,
          ]);
          const restoredPort = JSON.parse(
            await docker(["inspect", restored]),
          )[0].NetworkSettings.Ports["8080/tcp"][0].HostPort;
          const restoredBase = `http://127.0.0.1:${restoredPort}`;
          await ready(restoredBase);
          const recoveredClient = new Client(restoredBase);
          recoveredClient.cookies = new Map(client.cookies);
          assert.equal(
            (await recoveredClient.request("/api/auth/me")).status,
            200,
          );
          assert.deepEqual(
            await (await recoveredClient.request(route)).json(),
            fixture,
          );
        },
      );
    } finally {
      for (const container of containers) {
        try {
          await docker(["rm", "--force", container]);
        } catch {
          /* Solo nombres creados por este ensayo. */
        }
      }
      for (const volume of [sourceVolume, restoredVolume]) {
        try {
          await docker(["volume", "rm", volume]);
        } catch {
          /* Nunca buscar ni eliminar otros volúmenes. */
        }
      }
      if (
        dirname(directory) !== resolve(tmpdir()) ||
        !directory.startsWith(join(resolve(tmpdir()), "routale-recovery-"))
      )
        throw new Error("No se elimina un directorio temporal no reconocido.");
      await rm(directory, { recursive: true, force: true });
    }
  },
);
