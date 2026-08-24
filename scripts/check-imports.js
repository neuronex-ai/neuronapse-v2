
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesToCheck = [
    'src/pages/Notes.tsx',
    'src/pages/patients-view/PatientDetail.tsx'
];

const aliasSub = (p) => p.replace('@/', 'src/');

filesToCheck.forEach(file => {
    console.log(`Checking ${file}...`);
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(`[CRITICAL] File ${file} not found!`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /import .* from ["'](.*)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];
        let fullImportPath;

        if (importPath.startsWith('@/')) {
            fullImportPath = path.join(rootDir, aliasSub(importPath));
        } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
            fullImportPath = path.resolve(path.dirname(filePath), importPath);
        } else {
            // Node module, skip
            continue;
        }

        // Try adding extensions
        const extensions = ['', '.tsx', '.ts', '.js', '.jsx', '/index.tsx', '/index.ts'];
        let found = false;
        for (const ext of extensions) {
            const p = fullImportPath + ext;
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
                found = true;
                break;
            }
        }

        if (!found) {
            console.error(`[ERROR] In ${file}: Could not resolve ${match[1]} (resolved to ${fullImportPath})`);
        }
    }
});
