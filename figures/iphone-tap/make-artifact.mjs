import { readFileSync, writeFileSync } from "node:fs";
const [src, out] = process.argv.slice(2);
const html = readFileSync(src, "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace("html{color-scheme:dark}", "").replace('body[data-theme="light"]{color-scheme:light}', "").replace(/body\{margin:0;background:var\(--anatomy-page\);/, "body{margin:0;background:var(--page);");
const main = html.match(/<main class="iso-page">[\s\S]*?<\/main>/)[0];
const script = html.match(/<script type="module">([\s\S]*)<\/script><\/body>/)[1];
const tokens = `
:root{--page:#f2f2ef;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--page:#0b0b0b;color-scheme:dark}}
:root[data-theme="dark"]{--page:#0b0b0b;color-scheme:dark}
body{background:var(--page)}
.iso-page{margin:40px auto 64px}
`;
const pick = `
const isoRoot = document.getElementById("iso-root");
const dark = matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => { const forced = document.documentElement.getAttribute("data-theme"); isoRoot.setAttribute("data-theme", forced === "light" || forced === "dark" ? forced : dark.matches ? "dark" : "light"); };
applyTheme(); dark.addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
`;
writeFileSync(out, `<title>Glass to Pixel</title>\n<style>${tokens}${style}</style>\n<div class="iso" id="iso-root" data-theme="light">${main}</div>\n<script>${pick}</script>\n<script type="module">${script}</script>\n`);
console.log("wrote", out);
