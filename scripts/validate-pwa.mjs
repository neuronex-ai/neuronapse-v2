import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");
const errors = [];

const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

const fileExists = async (relativePath) => {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
};

const manifest = JSON.parse(await readFile(path.join(publicDir, "manifest.json"), "utf8"));
const mainSource = await readFile(path.join(projectRoot, "src/main.tsx"), "utf8");
const pushSource = await readFile(path.join(projectRoot, "src/lib/push-notifications.ts"), "utf8");
const pwaSource = await readFile(path.join(projectRoot, "src/lib/pwa-integrations.ts"), "utf8");
const workerSource = await readFile(path.join(publicDir, "firebase-messaging-sw.js"), "utf8");
const indexSource = await readFile(path.join(projectRoot, "index.html"), "utf8");

requireValue(manifest.id === "/", "O manifesto precisa declarar id como '/'.");
requireValue(Boolean(manifest.name && manifest.short_name), "O manifesto precisa de name e short_name.");
requireValue(manifest.name.startsWith("NeuroNex AI"), "O manifesto precisa usar NeuroNex AI como nome principal.");
requireValue(manifest.short_name === "NeuroNex AI", "O short_name do manifesto precisa ser NeuroNex AI.");
requireValue(manifest.start_url === "/", "O start_url precisa permanecer na raiz.");
requireValue(manifest.scope === "/", "O scope precisa permanecer na raiz.");
requireValue(Boolean(manifest.display || manifest.display_override), "O manifesto precisa de display.");
requireValue(Array.isArray(manifest.display_override) && manifest.display_override.includes("window-controls-overlay"), "O manifesto precisa habilitar Window Controls Overlay.");
requireValue(manifest.orientation !== "portrait-primary", "A PWA desktop nao pode ficar bloqueada em retrato.");
requireValue(manifest.theme_color === "#0A0A0B", "A cor do tema deve seguir a identidade escura do NeuroNex AI.");
requireValue(manifest.prefer_related_applications !== true, "prefer_related_applications nao pode ser true.");
requireValue(Array.isArray(manifest.icons), "O manifesto precisa de um array icons.");
requireValue(Array.isArray(manifest.screenshots), "O manifesto precisa de screenshots para a instalacao enriquecida.");
requireValue(manifest.lang === "pt-BR", "O idioma principal deve permanecer pt-BR.");

const declaredSizes = new Set();

for (const icon of manifest.icons || []) {
  requireValue(typeof icon.src === "string", "Todo icone precisa de src.");
  requireValue(typeof icon.sizes === "string", `O icone ${icon.src || "sem src"} precisa de sizes.`);
  requireValue(icon.type === "image/png", `O icone ${icon.src || "sem src"} deve ser PNG.`);
  requireValue(icon.purpose !== "any maskable", `Separe os propositos do icone ${icon.src || "sem src"}; nao use 'any maskable'.`);

  if (!icon.src || !icon.sizes) continue;

  requireValue(
    await fileExists(path.join("public", icon.src.replace(/^\//, ""))),
    `Arquivo de icone ausente: ${icon.src}`,
  );

  for (const size of icon.sizes.split(/\s+/)) declaredSizes.add(size);
}

requireValue(declaredSizes.has("192x192"), "E obrigatorio declarar um icone 192x192.");
requireValue(declaredSizes.has("512x512"), "E obrigatorio declarar um icone 512x512.");

const screenshots = manifest.screenshots || [];
const wideScreenshot = screenshots.find((item) => item.form_factor === "wide");
const narrowScreenshot = screenshots.find((item) => item.form_factor !== "wide");

requireValue(Boolean(wideScreenshot), "Inclua ao menos um screenshot com form_factor 'wide'.");
requireValue(Boolean(narrowScreenshot), "Inclua ao menos um screenshot mobile/narrow.");

for (const screenshot of screenshots) {
  requireValue(typeof screenshot.src === "string", "Todo screenshot precisa de src.");
  requireValue(typeof screenshot.sizes === "string", `O screenshot ${screenshot.src || "sem src"} precisa de sizes.`);

  if (screenshot.src) {
    requireValue(
      await fileExists(path.join("public", screenshot.src.replace(/^\//, ""))),
      `Arquivo de screenshot ausente: ${screenshot.src}`,
    );
  }
}

requireValue(await fileExists("public/firebase-messaging-sw.js"), "Worker unificado ausente em public/firebase-messaging-sw.js.");
requireValue(await fileExists("public/offline.html"), "Fallback offline ausente em public/offline.html.");
requireValue(await fileExists("public/widgets/clinic-overview-template.json"), "Template de widget ausente.");
requireValue(await fileExists("public/widgets/clinic-overview-data.json"), "Dados privacy-safe do widget ausentes.");
requireValue(mainSource.includes("firebase-messaging-sw.js"), "src/main.tsx precisa registrar o worker unificado.");
requireValue(mainSource.includes("registerPwaLaunchHandlers"), "src/main.tsx precisa registrar launch handlers da PWA.");
requireValue(mainSource.includes("registerPwaBackgroundCapabilities"), "src/main.tsx precisa registrar capacidades de fundo da PWA.");
requireValue(pushSource.includes("firebase-messaging-sw.js"), "As notificacoes precisam usar o worker unificado.");
requireValue(workerSource.includes("onBackgroundMessage"), "O worker unificado precisa preservar Firebase Messaging.");
requireValue(workerSource.includes("addEventListener('fetch'"), "O worker unificado precisa preservar o comportamento PWA.");
requireValue(workerSource.includes("addEventListener('push'"), "O worker unificado precisa expor handler de push.");
requireValue(workerSource.includes("addEventListener('sync'"), "O worker unificado precisa expor Background Sync.");
requireValue(workerSource.includes("addEventListener('periodicsync'"), "O worker unificado precisa expor Periodic Sync.");
requireValue(workerSource.includes("addEventListener('widgetclick'"), "O worker unificado precisa tratar acoes de widget.");
requireValue(workerSource.includes("setAppBadge") && workerSource.includes("clearAppBadge"), "O worker precisa preservar badges nativos.");
requireValue(pwaSource.includes("indexedDB") && pwaSource.includes("queuePwaIntent"), "A PWA precisa enfileirar intents offline em IndexedDB.");
requireValue(pwaSource.includes("windowControlsOverlay"), "A PWA precisa reagir ao Window Controls Overlay.");
requireValue(indexSource.includes('rel="manifest" href="/manifest.json"'), "index.html precisa apontar para /manifest.json.");
requireValue(indexSource.includes("NeuroNex AI"), "index.html precisa expor a marca NeuroNex AI.");

requireValue(manifest.share_target?.action === "/pwa-intent", "Share Target precisa apontar para /pwa-intent.");
requireValue(manifest.share_target?.method === "GET", "Share Target precisa usar GET para texto/link.");
requireValue(manifest.share_target?.enctype === "application/x-www-form-urlencoded", "Share Target precisa declarar enctype application/x-www-form-urlencoded.");
requireValue(Boolean(manifest.file_handlers?.length), "File handlers de anotacoes precisam estar configurados.");
requireValue(Boolean(manifest.shortcuts?.some((shortcut) => shortcut.url === "/pwa-intent?mode=new-note")), "Atalho de nova nota ausente.");

const widgets = Array.isArray(manifest.widgets) ? manifest.widgets : [];
const safeWidget = widgets.find((widget) => widget.tag === "neuronex-ai-safe-overview");
requireValue(Boolean(safeWidget), "Widget privacy-safe do NeuroNex AI ausente.");
requireValue(safeWidget?.ms_ac_template === "/widgets/clinic-overview-template.json", "Widget precisa apontar para o template Adaptive Card.");
requireValue(safeWidget?.data === "/widgets/clinic-overview-data.json", "Widget precisa apontar para dados privacy-safe.");

if (errors.length > 0) {
  console.error("\nNeuroNex AI PWA: validacao falhou\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("NeuroNex AI PWA: manifesto, Store metadata, worker unificado, widgets, sync, share target e fallback offline validados.");
