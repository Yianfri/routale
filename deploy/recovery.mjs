import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, lstat, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const format = "routale-storage-v1";
const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const imagePattern = /^sha256:[a-f0-9]{64}$/;
const snapshotPattern = /^[a-f0-9]{64}$/;
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      "Configuración o respuesta JSON inválida; no se registró su contenido.",
    );
  }
}

function requireName(value) {
  if (typeof value !== "string" || !namePattern.test(value))
    throw new Error("Nombre Docker o alias SSH inválido.");
  return value;
}
function inside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}
function quote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
export async function readConfiguration(path) {
  const value = parseJson(await readFile(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configuración de recuperación inválida.");
  for (const field of ["repository", "passwordFile"]) {
    if (typeof value[field] !== "string" || !isAbsolute(value[field]))
      throw new Error(
        "Repositorio y archivo de contraseña necesitan rutas absolutas.",
      );
  }
  if (inside(value.repository, value.passwordFile))
    throw new Error(
      "La contraseña debe permanecer fuera del repositorio cifrado.",
    );
  for (const path of [value.repository, value.passwordFile]) {
    if (
      inside(projectRoot, path) &&
      !inside(resolve(projectRoot, ".data"), path)
    )
      throw new Error(
        "Los datos privados deben quedar fuera del proyecto o en .data.",
      );
  }
  const password = await lstat(value.passwordFile);
  if (!password.isFile() || password.size === 0 || password.size > 4096)
    throw new Error("Archivo de contraseña no válido.");
  if (process.platform !== "win32" && (password.mode & 0o077) !== 0)
    throw new Error("El archivo de contraseña requiere permisos 0600.");
  const container = requireName(value.container);
  const sshAlias =
    value.sshAlias === undefined ? undefined : requireName(value.sshAlias);
  if (
    value.resticBinary !== undefined &&
    typeof value.resticBinary !== "string"
  )
    throw new Error("Ruta de restic inválida.");
  return {
    repository: resolve(value.repository),
    passwordFile: resolve(value.passwordFile),
    resticBinary: value.resticBinary ?? "restic",
    container,
    sshAlias,
  };
}

export class Recovery {
  constructor(config) {
    this.config = config;
    // El destino explícito no debe heredar otro repositorio o comando de secretos.
    this.environment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("RESTIC_")),
    );
    this.resticOptions = [
      "--repo",
      config.repository,
      "--password-file",
      config.passwordFile,
    ];
    this.children = new Set();
    this.cancelled = false;
    this.cleaningUp = false;
  }
  cancel() {
    this.cancelled = true;
    if (!this.cleaningUp) for (const child of this.children) child.kill();
  }
  transport(args) {
    if (!this.config.sshAlias) return { command: "docker", args };
    return {
      command: "ssh",
      args: [
        "-T",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "ConnectTimeout=10",
        this.config.sshAlias,
        ["docker", ...args].map(quote).join(" "),
      ],
    };
  }
  async command(binary, args, timeout = 120_000) {
    if (this.cancelled && !this.cleaningUp)
      throw new Error("Operación interrumpida.");
    let pending;
    try {
      pending = execute(binary, args, {
        windowsHide: true,
        timeout,
        maxBuffer: 16 * 1024 * 1024,
        env: this.environment,
      });
      this.children.add(pending.child);
      return (await pending).stdout;
    } catch {
      // Las salidas de los procesos pueden contener rutas, claves o datos privados.
      throw new Error(
        "Falló una operación de recuperación; no se registraron sus datos privados.",
      );
    } finally {
      if (pending) this.children.delete(pending.child);
    }
  }
  async docker(args) {
    const target = this.transport(args);
    return this.command(target.command, target.args);
  }
  async restic(args, timeout) {
    return this.command(
      this.config.resticBinary,
      [...this.resticOptions, ...args],
      timeout,
    );
  }
  async initialize() {
    await mkdir(this.config.repository, { recursive: true, mode: 0o700 });
    await this.restic(["init", "--repository-version", "2"]);
  }
  async check() {
    await this.restic(["check", "--read-data"], 24 * 60 * 60 * 1000);
  }
  async snapshots() {
    const snapshots = parseJson(
      await this.restic(["snapshots", "--json", "--tag", format]),
    );
    if (!Array.isArray(snapshots))
      throw new Error("Respuesta de restic inválida.");
    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      time: snapshot.time,
    }));
  }
  async inspect(id = this.config.container) {
    const inspected = parseJson(await this.docker(["inspect", id]));
    if (!Array.isArray(inspected) || inspected.length !== 1)
      throw new Error("No se encontró una única API.");
    const container = inspected[0];
    const mounts = container.Mounts?.filter(
      (mount) => mount.Destination === "/data",
    );
    if (
      container.Config?.Labels?.["com.docker.compose.service"] !== "api" ||
      !imagePattern.test(container.Image) ||
      !mounts ||
      mounts.length !== 1 ||
      mounts[0].Type !== "volume" ||
      !mounts[0].RW ||
      container.Config.Env?.some(
        (item) =>
          item.startsWith("Storage__Directory=") &&
          item !== "Storage__Directory=/data",
      )
    )
      throw new Error(
        "Se necesita la API aprobada con un único volumen Docker en /data.",
      );
    return {
      id: container.Id,
      image: container.Image,
      volume: requireName(mounts[0].Name),
      running: container.State.Running,
      paused: container.State.Paused,
      status: container.State.Status,
      health: container.State.Health?.Status,
    };
  }
  async requireExclusiveVolume(source, stopped) {
    const ids = (
      await this.docker([
        "ps",
        "--quiet",
        "--no-trunc",
        "--filter",
        `volume=${source.volume}`,
      ])
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (ids.some((id) => stopped || id !== source.id))
      throw new Error(
        "Otro contenedor usa el volumen; no se puede copiar con escritores activos.",
      );
  }
  async resume(source) {
    if (!source.running) return;
    const current = await this.inspect(source.id);
    if (current.image !== source.image || current.volume !== source.volume)
      throw new Error(
        "La API cambió durante el respaldo; revisar el registro privado de recuperación.",
      );
    if (!current.running) await this.docker(["start", source.id]);
    for (let attempt = 0; attempt < 120; attempt++) {
      const state = await this.inspect(source.id);
      if (
        state.running &&
        (state.health === undefined || state.health === "healthy")
      )
        return;
      await new Promise((done) => setTimeout(done, 500));
    }
    throw new Error("No se confirmó la salud de la API después del respaldo.");
  }
  async backup() {
    // Validar destino y contraseña antes de causar indisponibilidad.
    await this.snapshots();
    const source = await this.inspect();
    if (
      source.paused ||
      !["running", "exited", "created"].includes(source.status)
    )
      throw new Error("La API debe estar estable antes de respaldar.");
    await this.requireExclusiveVolume(source, false);
    const lockPath = this.config.repository + ".routale-lock";
    let lock;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch {
      throw new Error(
        "Hay otro respaldo o una recuperación pendiente; revisar el archivo de bloqueo privado.",
      );
    }
    let resumed = false;
    try {
      await lock.writeFile(
        JSON.stringify({
          format,
          container: source.id,
          image: source.image,
          volume: source.volume,
          restart: source.running,
        }),
      );
      if (source.running)
        await this.docker(["stop", "--time", "30", source.id]);
      if ((await this.inspect(source.id)).running)
        throw new Error("La API no se detuvo.");
      await this.requireExclusiveVolume(source, true);
      await this.verify(source.volume, source.image);
      const producer = this.transport(["cp", `${source.id}:/data/.`, "-"]);
      // restic no crea una copia válida cuando falla el comando productor.
      const output = await this.restic(
        [
          "backup",
          "--json",
          "--quiet",
          "--host",
          "routale",
          "--tag",
          format,
          "--tag",
          `api-image:${source.image}`,
          "--stdin-filename",
          "routale-storage.tar",
          "--stdin-from-command",
          "--",
          producer.command,
          ...producer.args,
        ],
        24 * 60 * 60 * 1000,
      );
      const summary = output
        .trim()
        .split(/\r?\n/)
        .map((line) => parseJson(line))
        .findLast((item) => item.message_type === "summary");
      if (!summary || !snapshotPattern.test(summary.snapshot_id))
        throw new Error(
          "No se confirmó el identificador del respaldo cifrado.",
        );
      return summary.snapshot_id;
    } finally {
      this.cleaningUp = true;
      try {
        await this.resume(source);
        resumed = true;
      } finally {
        try {
          await lock.close();
          if (resumed) await unlink(lockPath);
        } finally {
          this.cleaningUp = false;
        }
      }
    }
  }
  async verify(volume, image) {
    await this.docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--mount",
      `type=volume,source=${volume},target=/data,readonly`,
      image,
      "verify-storage",
    ]);
  }
  async restore(snapshotId, volume) {
    if (!snapshotPattern.test(snapshotId))
      throw new Error("Indicar el ID completo de un snapshot.");
    requireName(volume);
    const snapshot = parseJson(
      await this.restic(["cat", "snapshot", snapshotId]),
    );
    const images =
      snapshot.tags?.filter((tag) => tag.startsWith("api-image:")) ?? [];
    if (
      !snapshot.tags?.includes(format) ||
      images.length !== 1 ||
      !imagePattern.test(images[0].slice("api-image:".length))
    )
      throw new Error(
        "El snapshot no corresponde al formato de recuperación esperado.",
      );
    const image = images[0].slice("api-image:".length);
    await this.docker(["image", "inspect", image]);
    const volumes = (
      await this.docker(["volume", "ls", "--format", "{{.Name}}"])
    )
      .trim()
      .split(/\r?\n/);
    if (volumes.includes(volume))
      throw new Error("El volumen destino ya existe; nunca se reemplaza.");
    const label = `routale.recovery=${randomUUID()}`;
    await this.docker(["volume", "create", "--label", label, volume]);
    const container = "routale-recovery-" + randomUUID();
    await this.docker([
      "create",
      "--name",
      container,
      "--label",
      label,
      "--interactive",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--mount",
      `type=volume,source=${volume},target=/data`,
      "--entrypoint",
      "tar",
      image,
      "-xpf",
      "-",
      "-C",
      "/data",
    ]);
    try {
      await this.restoreStream(snapshotId, container);
      await this.verify(volume, image);
    } finally {
      this.cleaningUp = true;
      // Solo el ayudante creado aquí; el volumen restaurado se conserva incluso al fallar.
      try {
        await this.docker(["rm", "--force", container]);
      } finally {
        this.cleaningUp = false;
      }
    }
    return { volume, image };
  }
  async restoreStream(snapshot, container) {
    const target = this.transport([
      "start",
      "--attach",
      "--interactive",
      container,
    ]);
    const consumer = spawn(target.command, target.args, {
      windowsHide: true,
      env: this.environment,
      stdio: ["pipe", "ignore", "ignore"],
    });
    const producer = spawn(
      this.config.resticBinary,
      [...this.resticOptions, "dump", snapshot, "/routale-storage.tar"],
      {
        windowsHide: true,
        env: this.environment,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    this.children.add(consumer);
    this.children.add(producer);
    const completed = (child) =>
      new Promise((done, reject) => {
        child.once("error", reject);
        child.once("exit", (code) =>
          code === 0
            ? done()
            : reject(new Error("La transferencia de recuperación falló.")),
        );
      });
    producer.stdout.pipe(consumer.stdin);
    consumer.stdin.on("error", () => producer.kill());
    try {
      await Promise.all([completed(producer), completed(consumer)]);
    } catch {
      producer.kill();
      consumer.kill();
      throw new Error(
        "No se confirmó la copia restaurada; el volumen queda aislado.",
      );
    } finally {
      this.children.delete(producer);
      this.children.delete(consumer);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [operation, configuration, snapshot, volume] = process.argv.slice(2);
    if (
      !["init", "backup", "restore", "check", "snapshots"].includes(
        operation,
      ) ||
      !configuration
    )
      throw new Error(
        "Uso: node deploy/recovery.mjs init|backup|check|snapshots CONFIG; restore CONFIG SNAPSHOT VOLUMEN_NUEVO",
      );
    const recovery = new Recovery(await readConfiguration(configuration));
    const interrupt = () => recovery.cancel();
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    try {
      if (operation === "restore")
        console.log(JSON.stringify(await recovery.restore(snapshot, volume)));
      else {
        const result = await recovery[operation]();
        console.log(
          result === undefined
            ? "Operación completada."
            : JSON.stringify(result),
        );
      }
    } finally {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "La operación no pudo completarse.",
    );
    process.exitCode = 1;
  }
}
