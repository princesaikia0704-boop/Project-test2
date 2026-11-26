(function () {
  var ALLOWED_ACCENTS = {
    indigo: true,
    emerald: true,
    amber: true,
    rose: true,
    sky: true,
    slate: true,
    custom: true,
  };

  try {
    var root = document.documentElement;
    var theme = localStorage.getItem("app_theme");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (
      theme === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    var brandColor = localStorage.getItem("app_primary_color");
    if (brandColor && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(brandColor)) {
      var clean = brandColor.slice(1);
      if (clean.length === 3) {
        clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
      }
      var bi = parseInt(clean, 16);
      if (!isNaN(bi)) {
        var rgb = ((bi >> 16) & 255) + " " + ((bi >> 8) & 255) + " " + (bi & 255);
        root.style.setProperty("--accent-500", rgb);
        root.style.setProperty("--accent-600", rgb);
        root.style.setProperty("--accent-700", rgb);
        root.setAttribute("data-accent", "custom");
      }
    } else {
      var rawAccent = localStorage.getItem("app_accent") || "indigo";
      var accent = ALLOWED_ACCENTS[rawAccent] ? rawAccent : "indigo";
      root.setAttribute("data-accent", accent);
    }

    var brandName = localStorage.getItem("app_company_name");
    if (brandName) {
      var safeName = brandName.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
      if (safeName) {
        document.title = safeName + " \u2014 Corporate Supply Management";
      }
    }

    var compact = localStorage.getItem("app_compact");
    if (compact === "true") {
      root.setAttribute("data-compact", "true");
    } else {
      root.removeAttribute("data-compact");
    }
  } catch (_) {
    // Ignore storage access errors in restricted browsing contexts.
  }
})();
