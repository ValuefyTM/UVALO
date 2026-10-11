// Server-only: UVALO pentru Word — the add-in that runs inside Word (Anexă foto, Anexă documente, Instrumente).
// No Microsoft store: Word loads the panes from this app (/word/*), the person signs in with the UVALO account in the
// pane, and access follows the firm's plan (module "word"). Installed per computer with /word/instaleaza.cmd (registers
// the manifest for the current Windows user) or for a whole firm from the Microsoft 365 admin center (Integrated apps).

/** The add-in's id in Word. Never change it: Word would see a new add-in and keep the old one. */
export const ADDIN_ID = "0f7fa373-18aa-4d09-a7ce-0b54909593a7";
/** The add-in made before UVALO (VALUEFY Anexe, served from a local server); the installer replaces it. */
export const OLD_ADDIN_ID = "0a337985-8af2-4761-aa29-222a89928350";
/** Raise it when the manifest changes (new button, new texts), so Word reloads it. */
export const MANIFEST_VERSION = "1.0.0.0";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** The add-in manifest, with the URLs of this deployment (production, staging or local). */
export function manifest(origin: string) {
  const o = esc(origin);
  const btn = (id: string, label: string, tip: string, icon: string, pane: string, url: string) => `
                <Control xsi:type="Button" id="Uvalo.${id}">
                  <Label resid="${id}.Label" />
                  <Supertip><Title resid="${id}.Label" /><Description resid="${id}.Tip" /></Supertip>
                  <Icon><bt:Image size="16" resid="${icon}.16" /><bt:Image size="32" resid="${icon}.32" /><bt:Image size="80" resid="${icon}.80" /></Icon>
                  <Action xsi:type="ShowTaskpane"><TaskpaneId>${pane}</TaskpaneId><SourceLocation resid="${url}" /></Action>
                </Control>`;
  const icons = ["Icon", "Foto", "Doc", "Tools"].flatMap((k) => [16, 32, 80].map((s) =>
    `        <bt:Image id="${k}.${s}" DefaultValue="${o}/word/assets/${k.toLowerCase()}-${s}.png" />`)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
           xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
           xsi:type="TaskPaneApp">
  <Id>${ADDIN_ID}</Id>
  <Version>${MANIFEST_VERSION}</Version>
  <ProviderName>UVALO</ProviderName>
  <DefaultLocale>ro-RO</DefaultLocale>
  <DisplayName DefaultValue="UVALO" />
  <Description DefaultValue="Instrumentele UVALO pentru rapoartele de evaluare: anexa foto și anexa cu documente PDF, direct în Word." />
  <IconUrl DefaultValue="${o}/word/assets/icon-32.png" />
  <HighResolutionIconUrl DefaultValue="${o}/word/assets/icon-64.png" />
  <SupportUrl DefaultValue="${o}/word" />
  <AppDomains>
    <AppDomain>${o}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Document" />
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="WordApi" MinVersion="1.1" />
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${o}/word/anexe?mode=photo" />
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title" />
            <Description resid="GetStarted.Description" />
            <LearnMoreUrl resid="GetStarted.Url" />
          </GetStarted>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <CustomTab id="Uvalo.Tab">
              <Group id="Uvalo.Anexe">
                <Label resid="Anexe.Label" />
                <Icon><bt:Image size="16" resid="Foto.16" /><bt:Image size="32" resid="Foto.32" /><bt:Image size="80" resid="Foto.80" /></Icon>${btn("Foto", "Anexă foto", "Pozele de la inspecție: alegi folderul, ordonezi, pui legende și câte poze pe pagină.", "Foto", "UvaloAnexaFoto", "Foto.Url")}${btn("Doc", "Anexă documente", "Documente PDF (extras CF, releveu, autorizații): sortezi, elimini pagini, pui titlu pe fiecare document.", "Doc", "UvaloAnexaDoc", "Doc.Url")}
              </Group>
              <Group id="Uvalo.Cont">
                <Label resid="Cont.Label" />
                <Icon><bt:Image size="16" resid="Tools.16" /><bt:Image size="32" resid="Tools.32" /><bt:Image size="80" resid="Tools.80" /></Icon>${btn("Tools", "Instrumente UVALO", "Toate instrumentele UVALO și contul tău.", "Tools", "UvaloInstrumente", "Tools.Url")}
              </Group>
              <Label resid="Tab.Label" />
            </CustomTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
${icons}
      </bt:Images>
      <bt:Urls>
        <bt:Url id="GetStarted.Url" DefaultValue="${o}/word" />
        <bt:Url id="Foto.Url" DefaultValue="${o}/word/anexe?mode=photo" />
        <bt:Url id="Doc.Url" DefaultValue="${o}/word/anexe?mode=pdf" />
        <bt:Url id="Tools.Url" DefaultValue="${o}/word/instrumente" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="GetStarted.Title" DefaultValue="UVALO e gata în Word" />
        <bt:String id="Tab.Label" DefaultValue="UVALO" />
        <bt:String id="Anexe.Label" DefaultValue="Anexe" />
        <bt:String id="Cont.Label" DefaultValue="UVALO" />
        <bt:String id="Foto.Label" DefaultValue="Anexă foto" />
        <bt:String id="Doc.Label" DefaultValue="Anexă documente" />
        <bt:String id="Tools.Label" DefaultValue="Instrumente" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="GetStarted.Description" DefaultValue="Deschide tab-ul UVALO: Anexă foto, Anexă documente și celelalte instrumente." />
        <bt:String id="Foto.Tip" DefaultValue="Pozele de la inspecție: alegi folderul, ordonezi, pui legende și câte poze pe pagină." />
        <bt:String id="Doc.Tip" DefaultValue="Documente PDF (extras CF, releveu, autorizații): sortezi, elimini pagini, pui titlu pe fiecare document." />
        <bt:String id="Tools.Tip" DefaultValue="Toate instrumentele UVALO și contul tău." />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;
}

/**
 * Windows installer for the current user (no admin rights, no Node, no local server): downloads the manifest to
 * %LOCALAPPDATA%\UVALO\Word and registers it in Word; removes the old VALUEFY Anexe add-in and its local server.
 * A .cmd that runs the PowerShell part written after the #PS# line.
 */
export function installer(origin: string) {
  const ps = `
$ErrorActionPreference = "Stop"
Write-Host "== UVALO pentru Word - instalare ==" -ForegroundColor Yellow
if (Get-Process WINWORD -ErrorAction SilentlyContinue) {
  Write-Host "Word este deschis. Salveaza documentele si inchide Word, apoi apasa Enter." -ForegroundColor Yellow
  Read-Host | Out-Null
  Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep 2
}
$dir = Join-Path $env:LOCALAPPDATA "UVALO\\Word"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$manifest = Join-Path $dir "manifest.xml"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -UseBasicParsing -Uri "${origin}/word/manifest.xml" -OutFile $manifest
$key = "HKCU:\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer"
if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
Set-ItemProperty -Path $key -Name "${ADDIN_ID}" -Value $manifest
Write-Host "[OK] UVALO inregistrat in Word" -ForegroundColor Green
# add-in-ul vechi VALUEFY Anexe (server local pe portul 3001)
if ((Get-ItemProperty -Path $key -ErrorAction SilentlyContinue)."${OLD_ADDIN_ID}") {
  Remove-ItemProperty -Path $key -Name "${OLD_ADDIN_ID}" -ErrorAction SilentlyContinue
  Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "VALUEFY Anexa foto.lnk") -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*server.js*" -and $_.CommandLine -like "*anexa*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Host "[OK] Add-in-ul vechi VALUEFY Anexe a fost scos" -ForegroundColor Green
}
$wef = Join-Path $env:LOCALAPPDATA "Microsoft\\Office\\16.0\\Wef"
if (Test-Path $wef) { Get-ChildItem $wef | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host ""
Write-Host "GATA. Deschide Word: tab-ul UVALO -> Anexa foto / Anexa documente." -ForegroundColor Green
Write-Host "La prima folosire te conectezi cu contul UVALO, in panoul din dreapta."
`;
  return cmd(ps);
}

export function uninstaller() {
  const ps = `
$key = "HKCU:\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer"
Remove-ItemProperty -Path $key -Name "${ADDIN_ID}" -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA "UVALO\\Word") -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "UVALO a fost scos din Word. Reporneste Word." -ForegroundColor Green
`;
  return cmd(ps);
}

// Windows wants CRLF in .cmd files; the batch part only starts PowerShell on the text after #PS#.
function cmd(ps: string) {
  const bat = `@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Raw; Invoke-Expression ($s.Substring($s.IndexOf('#PS' + '#') + 4))"\r\necho.\r\npause\r\nexit /b\r\n#PS#\r\n`;
  return bat + ps.trim().replace(/\r?\n/g, "\r\n") + "\r\n";
}

/** A small page for the Word pane (signed out, no access, the tools list): same look as the pane. */
export function panePage(title: string, body: string, script = "") {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · UVALO</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f6f3ed;color:#141414;font:12px/1.55 Verdana,Geneva,sans-serif;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#141414;color:#d6d6d6}.top img{height:20px;display:block}.top span{padding-left:10px;border-left:1px solid rgba(255,255,255,.22)}
main{padding:16px 14px;display:flex;flex-direction:column;gap:12px}
h1{margin:0;font-size:16px}p{margin:0;color:#4a4a4a}
.card{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e6dfcf;border-radius:12px;padding:12px;color:inherit;text-decoration:none}
a.card:hover{border-color:#E0AD4F}.card b{display:block;font-size:12.5px;margin-bottom:2px}.card small{display:block;color:#6b6b6b;font-size:11px;line-height:1.45}
.ico{flex:none;width:36px;height:36px;border-radius:10px;background:#141414;display:grid;place-items:center}.ico svg{width:20px;height:20px;fill:none;stroke:#E0AD4F;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.btn{display:flex;align-items:center;justify-content:center;height:42px;border-radius:10px;border:0;background:#E0AD4F;color:#141414;font:700 12.5px Verdana,sans-serif;text-decoration:none;cursor:pointer}
.btn.ghost{background:#fff;border:1px solid #cfc6b3;font-weight:400}
.sec{font-size:10.5px;font-weight:700;color:#6b6b6b;letter-spacing:.5px;text-transform:uppercase;margin-top:4px}
.me{font-size:11px;color:#6b6b6b;border-top:1px solid #e6dfcf;padding-top:10px}.me a{color:#9A5F00}
</style></head><body>
<header class="top"><img src="/uvalo-lockup.svg" alt="UVALO"><span>${esc(title)}</span></header>
<main>${body}</main>${script}</body></html>`;
}

export const paneHeaders = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
