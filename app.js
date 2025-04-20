const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const moment = require("moment-timezone");
const cron = require("node-cron");
const fsExtra = require("fs-extra");
require("dotenv").config();

// === CONFIGURATION ===
const config = {
  containerApp: "ojs_app_journal",
  containerDB: "ojs_db_journal",
  dbUser: "ojs",
  dbPass: "setYourPass",
  dbName: "stimi",
  folderFiles: "/var/www/files",
  folderPublic: "/var/www/html/public",
  backupRoot: path.join(__dirname, process.env.BACKUP_ROOT),
  ojsBackupPath: path.join(__dirname, process.env.OJS_BACKUP_PATH),
  mongoBackupPath: path.join(__dirname, process.env.MONGO_BACKUP_PATH),
  mongoUri: process.env.DB_URI || "mongodb://localhost:27017/siakad-prod",
  maxBackupKeep: process.env.PRODUCTION ? parseInt(process.env.BACK_UP_DATA_WITHIN || "30") : 5,
  production: process.env.PRODUCTION || false,
};

function createBackupDirectories(directories) {
  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// === MAIN BACKUP FUNCTION ===
async function runBackup() {
  const timestamp = moment().tz("Asia/Makassar").format("YYYY-MM-DD_HH-mm-ss");
  console.log(`\n⏳ [${timestamp}] Starting full backup...`);

  // Ensure all necessary directories exist
  createBackupDirectories([config.ojsBackupPath, config.mongoBackupPath]);

  try {
    await backupOJS(timestamp);
    await backupMongoDB(timestamp);
    cleanOldBackups();
    console.log("✅ All backup processes completed.\n");
  } catch (error) {
    console.error("❌ Backup process failed:", error.message);
  }
}

// === OJS BACKUP FUNCTIONS ===
async function backupOJS(timestamp) {
  const tempFolder = path.join(config.backupRoot, "temp_ojs", `temp_${timestamp}`);
  const zipOutput = path.join(config.ojsBackupPath, `${timestamp}.zip`);

  createSubfolders(tempFolder, ["files", "public", "database"]);

  await copyFromContainer(config.containerApp, config.folderFiles, path.join(tempFolder, "files"));
  await copyFromContainer(config.containerApp, config.folderPublic, path.join(tempFolder, "public"));

  await backupOJSDatabase(path.join(tempFolder, "database", "database.sql"));
  await createZip(tempFolder, zipOutput);
  
  fsExtra.removeSync(path.join(config.backupRoot, "temp_ojs"));
  console.log("🧹 Cleaning file temp successfully.");
}

function createSubfolders(base, subfolders) {
  subfolders.forEach((sub) => {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  });
}

function copyFromContainer(container, source, destination) {
  return new Promise((resolve, reject) => {
    console.log(`📁 Preparing data: ${container} - ${source}`);
    const result = spawnSync("docker", ["cp", `${container}:${source}/.`, destination]);

    if (result.status !== 0) {
      return reject(new Error(`Failed to copy ${source}: ${result.stderr.toString()}`));
    }
    resolve();
  });
}

function backupOJSDatabase(outputPath) {
  return new Promise((resolve, reject) => {
    console.log("🛢 Backing up OJS database...");

    const outStream = fs.createWriteStream(outputPath);
    const dump = spawn("docker", [
      "exec",
      config.containerDB,
      "/usr/bin/mariadb-dump",
      `-u${config.dbUser}`,
      `-p${config.dbPass}`,
      config.dbName,
    ]);

    dump.stdout.pipe(outStream);

    dump.stderr.on("data", (data) => {
      console.error("❌ OJS DB Error:", data.toString());
    });

    dump.on("close", (code) => {
      if (code === 0) {
        console.log("✅ OJS database backup completed.");
        resolve();
      } else {
        reject(new Error(`❌ OJS database dump failed with code ${code}`));
      }
    });
  });
}

function createZip(source, output) {
  return new Promise((resolve, reject) => {
    console.log("🗜 Creating ZIP archive for OJS...");
  
    const outputStream = fs.createWriteStream(output);
    const archive = archiver("zip", { zlib: { level: 9 } });

    outputStream.on("close", () => {
      console.log(`✅ ZIP created (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on("error", (err) => {
      console.error("❌ ZIP error:", err.message);
      reject(err);
    });

    archive.pipe(outputStream);
    archive.directory(source, false);
    archive.finalize();
  });
}

// === MONGODB BACKUP FUNCTION ===
function backupMongoDB(timestamp) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(config.mongoBackupPath, `${timestamp}.gzip`);
    console.log("📦 Backing up MongoDB...");

    const dump = spawn("mongodump", [
      `--uri=${config.mongoUri}`,
      `--archive=${outputFile}`,
      "--gzip",
    ]);

    dump.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ MongoDB backup successful: ${path.basename(outputFile)}`);
        resolve();
      } else {
        reject(new Error("❌ MongoDB backup failed."));
      }
    });
  });
}

// async function uploadToAWS_S3(filePath) {
//   try {
//     // const fileName = path.basename(filePath);

//     // fs.readFile(filePath, async (err, data) => {
//     //   try {
//     //     if (err) {
//     //       throw new Error("Error reading file:", err);
//     //     }

//     //     const result = await uploadPrivateFile(data, fileName);
//     //     console.log("File uploaded successfully:", result);
//     //   } catch (err) {
//     //     console.error("Error reading file:", err);
//     //   }
//     // });
//     const res = await getPrivateFile(filePath);
//     // const res = await getBackupDatabse();
//     console.log("\n\n Files in backup-database", { getBackupDatabse: res });
//   } catch (error) {
//     console.error("Error listing files:", error);
//   }
// }

// === BACKUP CLEANING FUNCTION ===const fs = require("fs");
function getTimestampFromFilename(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
  return match ? new Date(match[1].replace(/_/g, ' ').replace(/-/g, ':').replace(' ', 'T')).getTime() : 0;
}

// Fungsi utama
function cleanOldBackups() {
  const backupDirs = [
    { dirPath: config.ojsBackupPath, ext: ".zip" },
    { dirPath: config.mongoBackupPath, ext: ".gzip" },
  ];

  backupDirs.forEach(({ dirPath, ext }) => {
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        console.error(`❌ Gagal membaca folder ${dirPath}:`, err.message);
        return;
      }

      const backupFiles = files
        .filter((file) => file.endsWith(ext))
        .sort((a, b) => {
          const aTime = getTimestampFromFilename(a);
          const bTime = getTimestampFromFilename(b);
          return aTime - bTime;
        });

      if (backupFiles.length > config.maxBackupKeep) {
        const filesToDelete = backupFiles.slice(0, backupFiles.length - config.maxBackupKeep);
        filesToDelete.forEach((file) => {
          const filePath = path.join(dirPath, file);
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`❌ Gagal menghapus file ${file}:`, err.message);
            } else {
              console.log(`🗑️ File lama dihapus: ${file}`);
            }
          });
        });
      }
    });
  });
}

// === CRON JOB (Every 10 Minutes) ===
if (process.env.PRODUCTION === "true") {
  cron.schedule("0 22 * * *", () => {
    console.log("Running daily backup at 21:00 WITA (production mode)");
    runBackup();
  }),
  {
    timezone: "Asia/Makassar",
  };
} else{
  cron.schedule("*/10 * * * *", () => {
    runBackup();
  }),
  {
    timezone: "Asia/Makassar",
  };
}

runBackup();