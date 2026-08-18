/* eslint-disable security/detect-non-literal-fs-filename -- 仅移动测试创建的系统临时目录到系统 Trash */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function getSystemTrashDirectory(): string {
  if (process.platform === "darwin") return path.join(os.homedir(), ".Trash");
  if (process.platform === "linux") {
    return path.join(os.homedir(), ".local/share/Trash/files");
  }
  throw new Error(`Unsupported system Trash platform: ${process.platform}`);
}

export function moveOwnedTempDirectoryToTrash(
  directory: string,
  expectedPrefix: string,
): void {
  if (!fs.existsSync(directory)) return;

  const realTempRoot = fs.realpathSync(os.tmpdir());
  const realDirectory = fs.realpathSync(directory);
  if (
    path.dirname(realDirectory) !== realTempRoot ||
    !path.basename(realDirectory).startsWith(expectedPrefix)
  ) {
    throw new Error(`Refusing to trash unowned temp directory: ${directory}`);
  }

  const trashDirectory = getSystemTrashDirectory();
  fs.mkdirSync(trashDirectory, { recursive: true });
  fs.renameSync(
    realDirectory,
    path.join(
      trashDirectory,
      `${path.basename(realDirectory)}-${process.pid}-${Date.now()}`,
    ),
  );
}
