/* Woodtally web calculators. Plain JS, no libraries, no storage, no network.
 * Sources (see research/standards.md in the app repo):
 *  - Doyle: BF = (D - 4)^2 * L / 16 (Purdue FNR-191 p. 1). 0 for D <= 4.
 *  - International 1/4: Clark 4-ft section BF = 0.22 D^2 - 0.71 D (1/8-in kerf),
 *    D grows 1/2 in per 4 ft, odd 1-3 ft remainder = fraction of the next section,
 *    times 0.905 for the 1/4-in kerf, rounded to the nearest 5 bf (Freese 1973; FNR-191 p. 2).
 *  - Huber: V = pi/4 * d^2 * L, d in m (RVR 2020 Anlage VI-b; OGM practice).
 *  - Firewood: 1 Fm = 1.4 Rm round (1 m), 1.6 Rm split (1 m), 2.1 SRm loose (33 cm) (LWF Merkblatt 20).
 *  - Turkey: diameter in whole cm, fractions dropped; broadleaf -2 cm bark; 1 ster = 0.75 m3 (OGM 310/312).
 *  - Sawn lumber: BF = T(in) * W(in) * L(ft) / 12; 1 bf = 0.00235973722 m3.
 */
(function () {
  "use strict";

  var NB = " ";
  var lang = (document.documentElement.lang || "en").slice(0, 2);
  var locale = { en: "en-US", de: "de-DE", tr: "tr-TR" }[lang] || "en-US";

  var T = {
    en: {
      bad: "Enter a number in the range shown.",
      diaRange: "Diameter: 6 to 60 inches.",
      lenRange: "Length: 4 to 20 feet. Scale longer logs as two logs.",
      scaledAt: function (d, l) { return "Scaled at " + d + NB + "in × " + l + NB + "ft (fractions dropped)."; },
      gapUp: function (p, b) { return "International ¼ scales " + p + NB + "% higher than Doyle (" + b + NB + "bf more)."; },
      gapDown: function (p, b) { return "Doyle scales " + p + NB + "% higher than International ¼ (" + b + NB + "bf more)."; },
      gapNone: "Both rules give the same figure here.",
      gapZero: "Doyle gives 0 bf at this diameter.",
      money: function (m, p) { return m + " between the two rules at " + p + " per MBF."; },
      moneyHint: "Add a price per MBF to see the gap in dollars.",
      lbRange: "Enter thickness, width and length above 0."
    },
    de: {
      bad: "Bitte eine Zahl im angegebenen Bereich eingeben.",
      dRange: "Durchmesser: 5 bis 150 cm.",
      lRange: "Länge: 0,5 bis 40 m.",
      qRange: "Menge größer als 0 eingeben.",
      cls: function (c, d) { return "Stärkeklasse " + c + " (bei " + d + NB + "cm, abgerundet)"; }
    },
    tr: {
      bad: "Lütfen belirtilen aralıkta bir sayı girin.",
      dRange: "Çap: 5 ile 150 cm arası.",
      lRange: "Boy: 0,5 ile 40 m arası.",
      qRange: "0'dan büyük bir miktar girin.",
      bark: "Yapraklı: kabuk payı 2" + NB + "cm düşüldü.",
      noBark: "İğne yapraklı: kabuksuz ölçüldü, düşüm yok.",
      floored: function (d) { return "Küsurat atıldı: " + d + NB + "cm."; },
      krRange: "Kalınlık, en ve boy 0'dan büyük olmalı."
    }
  }[lang] || {};

  function $(id) { return document.getElementById(id); }

  function num(id) {
    var el = $(id);
    if (!el) return NaN;
    var s = String(el.value).trim().replace(/\s/g, "").replace(",", ".");
    if (s === "") return NaN;
    if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function fmt(x, min, max) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max === undefined ? min : max
    }).format(x);
  }

  function set(id, text) { var el = $(id); if (el) el.textContent = text; }

  function flag(id, bad) { var el = $(id); if (el) el.setAttribute("aria-invalid", bad ? "true" : "false"); }

  function on(formId, fn) {
    var f = $(formId);
    if (!f) return;
    f.addEventListener("input", fn);
    f.addEventListener("change", fn);
    f.addEventListener("submit", function (e) { e.preventDefault(); fn(); });
    fn();
  }

  /* ---------- Board-foot log rules ---------- */

  function doyle(d, l) { return d <= 4 ? 0 : (d - 4) * (d - 4) * l / 16; }

  function clarkSection(d) { return Math.max(0, 0.22 * d * d - 0.71 * d); }

  function international14(d, l) {
    var sum = 0, dia = d, rest = l;
    while (rest >= 4) { sum += clarkSection(dia); dia += 0.5; rest -= 4; }
    if (rest > 0) sum += clarkSection(dia) * rest / 4;
    return sum * 0.905;
  }

  function round5(x) { return Math.round(x / 5) * 5; }

  // Exposed for checking in the browser console: Woodtally.doyle(16, 16) etc.
  window.Woodtally = {
    doyle: function (d, l) { return Math.round(doyle(d, l)); },
    international14: function (d, l) { return round5(international14(d, l)); },
    huber: function (dCm, lM) { return Math.PI / 4 * Math.pow(dCm / 100, 2) * lM; }
  };

  function boardFeet() {
    var dIn = num("bf-d"), lIn = num("bf-l"), n = num("bf-n"), price = num("bf-p");
    var d = Math.floor(dIn), l = Math.floor(lIn);
    if (!(n >= 1)) n = 1; n = Math.floor(n);
    var badD = !(dIn >= 6 && dIn <= 60), badL = !(lIn >= 4 && lIn <= 20);
    flag("bf-d", badD); flag("bf-l", badL);
    if (badD || badL) {
      set("bf-doyle", "–"); set("bf-intl", "–"); set("bf-gap", "–"); set("bf-money", "");
      set("bf-msg", badD ? T.diaRange : T.lenRange);
      return;
    }
    var dy = Math.round(doyle(d, l)), it = round5(international14(d, l));
    set("bf-doyle", fmt(dy * n, 0) + NB + "bf");
    set("bf-intl", fmt(it * n, 0) + NB + "bf");
    set("bf-msg", T.scaledAt(d, l));
    var diff = (it - dy) * n;
    if (dy === 0) {
      set("bf-gap", T.gapZero);
    } else if (diff === 0) {
      set("bf-gap", T.gapNone);
    } else {
      var pct = Math.abs((it - dy) / dy * 100);
      set("bf-gap", diff > 0 ? T.gapUp(fmt(pct, 0), fmt(diff, 0)) : T.gapDown(fmt(Math.abs((dy - it) / it * 100), 0), fmt(-diff, 0)));
    }
    if (price > 0 && diff !== 0) {
      var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
      set("bf-money", T.money(money.format(Math.abs(diff) * price / 1000), money.format(price)));
    } else {
      set("bf-money", T.moneyHint);
    }
    var body = $("bf-table");
    if (body) {
      set("bf-table-len", fmt(l, 0));
      var rows = "";
      [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40].forEach(function (dd) {
        var a = Math.round(doyle(dd, l)), b = round5(international14(dd, l));
        var g = a > 0 ? Math.round((b - a) / a * 100) : null;
        var gs = g === null ? "–" : (g > 0 ? "+" : g < 0 ? "−" : "") + fmt(Math.abs(g), 0) + NB + "%";
        rows += "<tr" + (dd === d ? ' class="here"' : "") + "><td>" + dd + NB + "in</td><td>" + fmt(a, 0) +
          "</td><td>" + fmt(b, 0) + "</td><td" + (g !== null && g < 0 ? ' class="neg"' : "") + ">" + gs + "</td></tr>";
      });
      body.innerHTML = rows;
    }
  }

  function lumber() {
    var t = num("lb-t"), w = num("lb-w"), l = num("lb-l"), n = num("lb-n");
    if (!(n >= 1)) n = 1; n = Math.floor(n);
    var bad = !(t > 0 && w > 0 && l > 0);
    flag("lb-t", !(t > 0)); flag("lb-w", !(w > 0)); flag("lb-l", !(l > 0));
    if (bad) { set("lb-bf", "–"); set("lb-m3", "–"); set("lb-msg", T.lbRange); return; }
    var bf = t * w * l / 12 * n;
    set("lb-bf", fmt(bf, 2) + NB + "bf");
    set("lb-m3", fmt(bf * 0.00235973722, 4) + NB + "m³");
    set("lb-msg", "");
  }

  /* ---------- German Festmeter ---------- */

  function rvrClass(d) {
    var c = [[9, "D0"], [14, "D1a"], [19, "D1b"], [24, "D2a"], [29, "D2b"], [34, "D3a"], [39, "D3b"], [49, "D4"], [59, "D5"], [69, "D6"], [79, "D7"]];
    for (var i = 0; i < c.length; i++) if (d <= c[i][0]) return c[i][1];
    return "D8";
  }

  function festmeter() {
    var d = num("fm-d"), l = num("fm-l"), n = num("fm-n");
    if (!(n >= 1)) n = 1; n = Math.floor(n);
    var badD = !(d >= 5 && d <= 150), badL = !(l >= 0.5 && l <= 40);
    flag("fm-d", badD); flag("fm-l", badL);
    if (badD || badL) { set("fm-v", "–"); set("fm-total", "–"); set("fm-class", ""); set("fm-msg", badD ? T.dRange : T.lRange); return; }
    var v = Math.PI / 4 * Math.pow(d / 100, 2) * l;
    set("fm-v", fmt(v, 3) + NB + "Fm");
    set("fm-total", fmt(v * n, 3) + NB + "Fm");
    set("fm-class", T.cls(rvrClass(Math.floor(d)), Math.floor(d)));
    set("fm-msg", "");
  }

  var STACK = { fm: 1, rmr: 1.4, rms: 1.6, srm: 2.1 };

  function raummeter() {
    var q = num("rm-q"), u = ($("rm-u") || {}).value || "rm";
    var bad = !(q > 0);
    flag("rm-q", bad);
    if (bad) { ["rm-fm", "rm-rmr", "rm-rms", "rm-srm"].forEach(function (id) { set(id, "–"); }); set("rm-msg", T.qRange); return; }
    var fm = q / STACK[u];
    set("rm-fm", fmt(fm, 2) + NB + "Fm");
    set("rm-rmr", fmt(fm * STACK.rmr, 2) + NB + "Rm");
    set("rm-rms", fmt(fm * STACK.rms, 2) + NB + "Rm");
    set("rm-srm", fmt(fm * STACK.srm, 2) + NB + "SRm");
    set("rm-msg", "");
  }

  /* ---------- Turkish kübaj ---------- */

  function kubaj() {
    var dIn = num("kb-d"), l = num("kb-l"), n = num("kb-n");
    if (!(n >= 1)) n = 1; n = Math.floor(n);
    var broad = !!document.querySelector('input[name="kb-t"][value="yaprakli"]:checked');
    var badD = !(dIn >= 5 && dIn <= 150), badL = !(l >= 0.5 && l <= 40);
    flag("kb-d", badD); flag("kb-l", badL);
    if (badD || badL) { set("kb-dc", "–"); set("kb-v", "–"); set("kb-total", "–"); set("kb-msg", badD ? T.dRange : T.lRange); return; }
    var d = Math.floor(dIn) - (broad ? 2 : 0);
    var v = Math.PI / 4 * Math.pow(d / 100, 2) * l;
    set("kb-dc", d + NB + "cm");
    set("kb-v", fmt(v, 3) + NB + "m³");
    set("kb-total", fmt(v * n, 3) + NB + "m³");
    var parts = [];
    if (dIn !== Math.floor(dIn)) parts.push(T.floored(Math.floor(dIn)));
    parts.push(broad ? T.bark : T.noBark);
    set("kb-msg", parts.join(" "));
  }

  function ster() {
    var q = num("st-q"), u = ($("st-u") || {}).value || "ster";
    var bad = !(q > 0);
    flag("st-q", bad);
    if (bad) { set("st-ster", "–"); set("st-m3", "–"); set("st-msg", T.qRange); return; }
    var m3 = u === "ster" ? q * 0.75 : q, st = u === "ster" ? q : q / 0.75;
    set("st-ster", fmt(st, 2) + NB + "ster");
    set("st-m3", fmt(m3, 2) + NB + "m³");
    set("st-msg", "");
  }

  function kereste() {
    var t = num("kr-t"), w = num("kr-w"), l = num("kr-l"), n = num("kr-n");
    if (!(n >= 1)) n = 1; n = Math.floor(n);
    flag("kr-t", !(t > 0)); flag("kr-w", !(w > 0)); flag("kr-l", !(l > 0));
    if (!(t > 0 && w > 0 && l > 0)) { set("kr-v", "–"); set("kr-msg", T.krRange); return; }
    set("kr-v", fmt(t / 100 * w / 100 * l * n, 4) + NB + "m³");
    set("kr-msg", "");
  }

  on("bf-form", boardFeet);
  on("lb-form", lumber);
  on("fm-form", festmeter);
  on("rm-form", raummeter);
  on("kb-form", kubaj);
  on("st-form", ster);
  on("kr-form", kereste);
})();
