var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
// Custom plugin: load .md scripts as raw text with HMR support
function rawMarkdownPlugin() {
    return {
        name: 'raw-markdown',
        enforce: 'pre',
        transform: function (code, id) {
            if (id.endsWith('.md?raw')) {
                return null;
            }
            return null;
        },
        handleHotUpdate: function (ctx) {
            if (ctx.file.endsWith('.md')) {
                ctx.server.ws.send({ type: 'custom', event: 'script-changed', data: { path: ctx.file } });
            }
        },
    };
}
// Dev-only plugin: expose POST /dev/patch-text to overwrite text in a script file.
// Only active during `vite dev`; not included in production builds.
function patchTextPlugin() {
    return {
        name: 'patch-text',
        apply: 'serve',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use('/dev/patch-text', function (req, res) {
                res.setHeader('Access-Control-Allow-Origin', '*');
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end();
                    return;
                }
                var body = '';
                req.on('data', function (chunk) { body += chunk.toString(); });
                req.on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                    var _a, filePath, from, to, absolutePath, content, updated, e_1;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 3, , 4]);
                                _a = JSON.parse(body), filePath = _a.filePath, from = _a.from, to = _a.to;
                                absolutePath = path.join(server.config.root, filePath);
                                return [4 /*yield*/, fs.promises.readFile(absolutePath, 'utf8')];
                            case 1:
                                content = _b.sent();
                                content = content.replace(/\r\n/g, '\n');
                                if (!content.includes(from)) {
                                    res.statusCode = 422;
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ error: 'Text not found in file' }));
                                    return [2 /*return*/];
                                }
                                updated = content.replace(from, to);
                                return [4 /*yield*/, fs.promises.writeFile(absolutePath, updated, 'utf8')];
                            case 2:
                                _b.sent();
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ ok: true }));
                                return [3 /*break*/, 4];
                            case 3:
                                e_1 = _b.sent();
                                res.statusCode = 500;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ error: String(e_1) }));
                                return [3 /*break*/, 4];
                            case 4: return [2 /*return*/];
                        }
                    });
                }); });
            });
        },
    };
}
export default defineConfig({
    plugins: [react(), rawMarkdownPlugin(), patchTextPlugin()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@scripts': path.resolve(__dirname, 'scripts'),
            '@assets': path.resolve(__dirname, 'public/assets'),
        },
    },
    server: {
        port: 4519,
        strictPort: true,
        host: true,
        fs: {
            // allow serving files from one level up so we can access the original scripts via symlink/copy
            allow: ['..'],
        },
    },
    build: {
        target: 'es2022',
        sourcemap: true,
    },
});
