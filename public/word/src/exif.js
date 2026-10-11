/* Citește data fotografierii (EXIF DateTimeOriginal) din JPEG, fără dependențe. */
(function (root) {
  "use strict";
  function parseTiff(v, t) {
    var le = v.getUint16(t) === 0x4949;
    function u16(o) { return v.getUint16(t + o, le); }
    function u32(o) { return v.getUint32(t + o, le); }
    function readStr(e) {
      var cnt = u32(e + 4), off = cnt > 4 ? u32(e + 8) : e + 8, s = "";
      for (var i = 0; i < cnt - 1 && i < 32; i++) s += String.fromCharCode(v.getUint8(t + off + i));
      return s;
    }
    function readIfd(o, cb) {
      var n = u16(o);
      for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; cb(u16(e), e); }
    }
    var exifPtr = null, dt = null, dtOrig = null;
    readIfd(u32(4), function (tag, e) {
      if (tag === 0x8769) exifPtr = u32(e + 8);
      if (tag === 0x0132) dt = readStr(e);
    });
    if (exifPtr) readIfd(exifPtr, function (tag, e) {
      if (tag === 0x9003) dtOrig = readStr(e);
    });
    var s = dtOrig || dt;
    if (!s) return null;
    var m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
  }

  function readExifDate(file) {
    if (!/\.jpe?g$/i.test(file.name) && file.type !== "image/jpeg") return Promise.resolve(null);
    return file.slice(0, 256 * 1024).arrayBuffer().then(function (buf) {
      try {
        var v = new DataView(buf);
        if (v.getUint16(0) !== 0xFFD8) return null;
        var off = 2;
        while (off + 4 < v.byteLength) {
          var marker = v.getUint16(off); off += 2;
          if ((marker & 0xFF00) !== 0xFF00) return null;
          var size = v.getUint16(off);
          if (marker === 0xFFE1 && v.getUint32(off + 2) === 0x45786966) return parseTiff(v, off + 8);
          if (marker === 0xFFDA) return null;
          off += size;
        }
      } catch (e) { /* ignorăm EXIF corupt */ }
      return null;
    }).catch(function () { return null; });
  }

  root.readExifDate = readExifDate;
})(typeof self !== "undefined" ? self : this);
