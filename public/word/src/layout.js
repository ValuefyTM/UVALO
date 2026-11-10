/* UVALO pentru Word – Anexă foto: motor de layout și generare OOXML (fără dependențe). */
(function (root) {
  "use strict";

  var CM_TWIP = 566.929;
  var CM_EMU = 360000;
  var PT_CM = 0.03528;

  var GRIDS = {
    1: [1, 1], 2: [1, 2], 3: [1, 3], 4: [2, 2],
    6: [2, 3], 8: [2, 4], 9: [3, 3], 12: [3, 4]
  };

  function ratioVal(r) {
    var p = String(r || "4:3").split(":").map(Number);
    return p[0] / p[1];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // caractere de control invalide în XML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }

  function tw(cm) { return Math.round(cm * CM_TWIP); }
  function emu(cm) { return Math.round(cm * CM_EMU); }

  /** Calculează geometria paginii pentru setările date. */
  function computeLayout(s, opt) {
    var g = GRIDS[s.perPage] || GRIDS[6];
    var cols = g[0], rows = g[1];
    var W = +s.page.wCm, H = +s.page.hCm;
    var gap = Math.max(0, +s.gapMm || 0) / 10;

    var titleOn = !!(s.title.enabled && String(s.title.text || "").trim());
    var titleH = titleOn ? (s.title.fontSize * PT_CM * 1.35 + s.title.spaceAfterPt * PT_CM + 0.05) : 0;

    var capOn = !!s.caption.enabled;
    var capLines = capOn ? Math.max(1, +s.caption.lines || 1) : 0;
    var capH = capOn ? (capLines * s.caption.fontSize * PT_CM * 1.2 + s.caption.spaceBeforePt * PT_CM) : 0;

    // rezervă pentru paragraful de după tabel / saltul de pagină
    var safety = 0.8;

    var imgW = (W - gap * (cols - 1)) / cols;
    var dt = s.docTitle || {};
    var docTitleH = (opt && opt.docTitle) ? ((dt.fontSize || 11) * PT_CM * 1.35 * (dt.lines || 1) + (dt.spaceAfterPt || 6) * PT_CM + 0.05) : 0;
    var boxH = (H - titleH - docTitleH - safety - rows * capH - gap * (rows - 1)) / rows;

    var colW = [];
    for (var i = 0; i < cols; i++) {
      colW.push(imgW + (i > 0 ? gap / 2 : 0) + (i < cols - 1 ? gap / 2 : 0));
    }

    return {
      cols: cols, rows: rows, perPage: cols * rows,
      W: W, H: H, gap: gap, imgW: imgW, boxH: Math.max(1, boxH),
      colW: colW, titleOn: titleOn, titleH: titleH, capOn: capOn, capH: capH, docTitleH: docTitleH
    };
  }

  /**
   * Dimensiunea afișată (cm) și decupajul (fracții 0..1) pentru o imagine
   * cu dimensiunile w×h (deja rotită).
   */
  function displaySize(L, s, w, h) {
    if (s.fit === "crop") {
      var r = ratioVal(s.ratio);
      if (s.ratioFollowOrientation && h > w && r > 1) r = 1 / r;
      if (s.ratioFollowOrientation && w > h && r < 1) r = 1 / r;
      var bw = L.imgW, bh = bw / r;
      if (bh > L.boxH) { bh = L.boxH; bw = bh * r; }
      var ir = w / h, crop;
      if (ir > r) { var cw = r / ir; crop = { x: (1 - cw) / 2, y: 0, w: cw, h: 1 }; }
      else { var ch = ir / r; crop = { x: 0, y: (1 - ch) / 2, w: 1, h: ch }; }
      return { wCm: bw, hCm: bh, crop: crop };
    }
    var sc = Math.min(L.imgW / w, L.boxH / h);
    return { wCm: w * sc, hCm: h * sc, crop: { x: 0, y: 0, w: 1, h: 1 } };
  }

  function captionText(s, n, desc) {
    var parts = [];
    var pre = String(s.caption.prefix || "").trim();
    var head = s.caption.numbering ? (pre ? pre + " " + n : String(n)) : pre;
    var d = String(desc || "").trim();
    return { head: head, desc: d };
  }

  function runProps(s, sizePt, bold) {
    var f = String(s.fontName || "").trim();
    var x = "<w:rPr>";
    if (f) x += '<w:rFonts w:ascii="' + esc(f) + '" w:hAnsi="' + esc(f) + '" w:cs="' + esc(f) + '"/>';
    if (bold) x += "<w:b/><w:bCs/>";
    x += '<w:sz w:val="' + Math.round(sizePt * 2) + '"/><w:szCs w:val="' + Math.round(sizePt * 2) + '"/>';
    return x + "</w:rPr>";
  }

  var P_RESET = '<w:ind w:left="0" w:right="0" w:firstLine="0"/>';

  function pPr(jc, before, after, extra) {
    return "<w:pPr>" + (extra || "") +
      '<w:spacing w:before="' + Math.round(before) + '" w:after="' + Math.round(after) + '" w:line="240" w:lineRule="auto"/>' +
      P_RESET + '<w:jc w:val="' + jc + '"/></w:pPr>';
  }

  function titleXml(s) {
    var align = s.title.align || "center";
    return "<w:p>" + pPr(align, 0, s.title.spaceAfterPt * 20, '<w:keepNext/>') +
      "<w:r>" + runProps(s, s.title.fontSize, true) +
      '<w:t xml:space="preserve">' + esc(s.title.text) + "</w:t></w:r></w:p>";
  }

  function pageBreakXml() {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' + P_RESET +
      '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>';
  }

  function drawingXml(s, it) {
    var cx = emu(it.wCm), cy = emu(it.hCm);
    var lnW = s.border === "thin" ? 6350 : (s.border === "medium" ? 12700 : 0);
    var ee = lnW ? Math.round(lnW / 2) : 0;
    var ln = lnW ? '<a:ln w="' + lnW + '"><a:solidFill><a:srgbClr val="' + (s.borderColor || "7F7F7F").replace("#", "") + '"/></a:solidFill></a:ln>' : "";
    var name = esc(it.name || ("Foto " + it.docPrId));
    return '<w:r><w:rPr><w:noProof/><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:effectExtent l="' + ee + '" t="' + ee + '" r="' + ee + '" b="' + ee + '"/>' +
      '<wp:docPr id="' + it.docPrId + '" name="' + name + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic><pic:nvPicPr><pic:cNvPr id="' + it.docPrId + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + it.rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + ln + '</pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }

  function cellXml(L, s, col, isLastRow, it) {
    var gap = L.gap;
    var mar = '<w:tcMar><w:top w:w="0" w:type="dxa"/>' +
      '<w:left w:w="' + tw(col > 0 ? gap / 2 : 0) + '" w:type="dxa"/>' +
      '<w:bottom w:w="' + tw(isLastRow ? 0 : gap) + '" w:type="dxa"/>' +
      '<w:right w:w="' + tw(col < L.cols - 1 ? gap / 2 : 0) + '" w:type="dxa"/></w:tcMar>';
    var x = '<w:tc><w:tcPr><w:tcW w:w="' + tw(L.colW[col]) + '" w:type="dxa"/>' + mar +
      '<w:vAlign w:val="' + (s.fit === "crop" ? "top" : "center") + '"/></w:tcPr>';
    if (!it) {
      return x + "<w:p>" + pPr("center", 0, 0) + "</w:p></w:tc>";
    }
    x += "<w:p>" + pPr("center", 0, 0, L.capOn ? "<w:keepNext/>" : "") +
      drawingXml(s, it) + "</w:p>";
    if (L.capOn) {
      var c = it.caption || { head: "", desc: "" };
      x += "<w:p>" + pPr("center", s.caption.spaceBeforePt * 20, 0);
      if (c.head) {
        x += "<w:r>" + runProps(s, s.caption.fontSize, !!s.caption.boldPrefix) +
          '<w:t xml:space="preserve">' + esc(c.head) + (c.desc ? (s.caption.separator || " – ") : "") + "</w:t></w:r>";
      }
      if (c.desc) {
        x += "<w:r>" + runProps(s, s.caption.fontSize, false) +
          '<w:t xml:space="preserve">' + esc(c.desc) + "</w:t></w:r>";
      }
      x += "</w:p>";
    }
    return x + "</w:tc>";
  }

  /** XML pentru o pagină (tabel). items: [{rid, wCm, hCm, docPrId, name, caption}] */
  function docTitleXml(s, text) {
    var dt = s.docTitle || {};
    return "<w:p>" + pPr(dt.align || "left", 0, (dt.spaceAfterPt || 6) * 20, "<w:keepNext/>") +
      "<w:r>" + runProps(s, dt.fontSize || 11, dt.bold !== false) +
      '<w:t xml:space="preserve">' + esc(text) + "</w:t></w:r></w:p>";
  }

  function pageXml(L, s, items, pageIndex, opt) {
    var out = "";
    if (pageIndex > 0 || s.startNewPage) out += pageBreakXml();
    if (L.titleOn && (pageIndex === 0 || s.title.repeat)) {
      var t = s.title.text;
      if (pageIndex > 0 && s.title.repeatSuffix) t += s.title.repeatSuffix;
      out += titleXml(Object.assign({}, s, { title: Object.assign({}, s.title, { text: t }) }));
    }
    if (opt && opt.docTitle) out += docTitleXml(s, opt.docTitle);
    var W = L.colW.reduce(function (a, b) { return a + b; }, 0);
    var nb = ["top", "left", "bottom", "right", "insideH", "insideV"].map(function (k) {
      return "<w:" + k + ' w:val="nil"/>';
    }).join("");
    out += '<w:tbl><w:tblPr><w:tblW w:w="' + tw(W) + '" w:type="dxa"/><w:jc w:val="center"/>' +
      "<w:tblBorders>" + nb + "</w:tblBorders>" +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>';
    L.colW.forEach(function (c) { out += '<w:gridCol w:w="' + tw(c) + '"/>'; });
    out += "</w:tblGrid>";
    var nRows = Math.ceil(items.length / L.cols);
    for (var r = 0; r < nRows; r++) {
      out += '<w:tr><w:trPr><w:cantSplit/><w:jc w:val="center"/></w:trPr>';
      for (var c = 0; c < L.cols; c++) {
        out += cellXml(L, s, c, r === nRows - 1, items[r * L.cols + c]);
      }
      out += "</w:tr>";
    }
    out += "</w:tbl>";
    return out;
  }

  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  /** Împachetează corpul + imaginile în formatul Flat OPC acceptat de insertOoxml. */
  function wrapPackage(bodyXml, media) {
    var rels = media.map(function (m) {
      return '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.file + '"/>';
    }).join("");
    var x = '<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">' +
      '<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships></pkg:xmlData></pkg:part>" +
      '<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships></pkg:xmlData></pkg:part>" +
      '<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData>' +
      "<w:document " + NS + "><w:body>" + bodyXml + "</w:body></w:document></pkg:xmlData></pkg:part>";
    media.forEach(function (m) {
      x += '<pkg:part pkg:name="/word/media/' + m.file + '" pkg:contentType="' + m.mime + '" pkg:compression="store"><pkg:binaryData>' +
        m.b64 + "</pkg:binaryData></pkg:part>";
    });
    return x + "</pkg:package>";
  }

  var api = {
    GRIDS: GRIDS, computeLayout: computeLayout, displaySize: displaySize,
    captionText: captionText, pageXml: pageXml, wrapPackage: wrapPackage, NS: NS,
    ratioVal: ratioVal
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AnexaLayout = api;
})(typeof self !== "undefined" ? self : this);
