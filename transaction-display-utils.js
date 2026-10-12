(() => {
  "use strict";

  const ORDER = ["RECEIVED", "SENT", "DISCARD"];

  function canonicalMovement(value) {
    const movement = String(value || "").trim().toUpperCase();
    if (["RECEIVED","INBOUND","IN","RECEIVE"].includes(movement)) return "RECEIVED";
    if (["SENT","OUTBOUND","OUT","SEND"].includes(movement)) return "SENT";
    if (["DISCARDED","DISCARD"].includes(movement)) return "DISCARD";
    return movement || "OTHER";
  }

  function movementLabel(value) {
    const movement = canonicalMovement(value);
    return movement === "RECEIVED" ? "Received" : movement === "SENT" ? "Sent" : movement === "DISCARD" ? "Discarded" : String(value || "Other");
  }

  function movementClass(value) {
    const movement = canonicalMovement(value);
    return movement === "RECEIVED" ? "movement-received" : movement === "SENT" ? "movement-sent" : movement === "DISCARD" ? "movement-discard" : "movement-other";
  }

  function timestampMs(value) {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct.getTime();
    const text = String(value || "").trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      const serial = Number(text);
      if (serial > 20000 && serial < 80000) return Math.round((serial - 25569) * 86400000);
    }
    const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/);
    if (dmy) {
      const ms = Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] || 0), Number(dmy[5] || 0), Number(dmy[6] || 0), Number(String(dmy[7] || "0").slice(0,3).padEnd(3,"0")));
      return Number.isFinite(ms) ? ms : NaN;
    }
    return NaN;
  }

  function timeKey(value) {
    const ms = timestampMs(value);
    return Number.isFinite(ms) ? `date:${ms}` : `raw:${String(value || "").trim()}`;
  }

  // Registration comments are normally entered first, sometimes with a short
  // label such as "Vehicle Reg:". Match complete, familiar UK and European
  // plate formats from the beginning of the comment to avoid guessing from
  // unrelated words later in a note.
  function extractVehicleRegistration(comment) {
    let text = String(comment || "").normalize("NFKC").trim().toUpperCase();
    if (!text) return "";
    text = text.replace(/^(?:(?:VEHICLE\s*)?(?:REG(?:ISTRATION)?|VRM|PLATE|NUMBER\s*PLATE)\s*[:#=-]?\s*)+/i, "");
    text = text.replace(/^[\s:;,|()[\]{}]+/, "");
    if (!text) return "";

    const patterns = [
      // Great Britain current plates, plus common older and dateless styles.
      /^[A-Z]{2}\s?\d{2}\s?[A-Z]{3}(?=\b|$)/,
      /^[A-Z]\s?\d{1,3}\s?[A-Z]{3}(?=\b|$)/,
      /^[A-Z]{3}\s?\d{1,3}\s?[A-Z](?=\b|$)/,
      /^(?:[A-Z]{3}\s?\d{3,4}|\d{1,4}\s?[A-Z]{3})(?=\b|$)/,
      // Ireland.
      /^\d{2,3}[- ]?[A-Z]{1,2}[- ]?\d{1,6}(?=\b|$)/,
      // France, Italy and Spain.
      /^[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}(?=\b|$)/,
      /^\d{4}[- ]?[BCDFGHJKLMNPRSTVWXYZ]{3}(?=\b|$)/,
      // Portugal and common Dutch series.
      /^\d{2}[- ]?[A-Z]{2}[- ]?\d{2}(?=\b|$)/,
      /^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{2,3}(?=\b|$)/,
      /^[A-Z]{2}[- ]?\d{3}[- ]?[A-Z](?=\b|$)/,
      /^\d[- ]?[A-Z]{3}[- ]?\d{2}(?=\b|$)/,
      /^\d{2}[- ]?[A-Z]{3}[- ]?\d(?=\b|$)/,
      /^[A-Z]{3}[- ]?\d{2}[- ]?[A-Z](?=\b|$)/,
      // Germany, Austria and several central/eastern European formats.
      /^[A-ZÄÖÜ]{1,3}[- ]+[A-Z]{1,2}[- ]?\d{1,4}(?=\b|$)/,
      /^[A-Z]{2,3}\s?\d[A-Z0-9]{4,5}(?=\b|$)/,
      /^[A-Z]{3}[- ]?\d{3}(?=\b|$)/,
      /^\d[A-Z]\d\s?\d{4}(?=\b|$)/,
      /^[A-Z]{4}[- ]?\d{3}(?=\b|$)/,
      /^[A-Z]{3}[- ]?\d{4}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{2}\s?[A-Z]{3}(?=\b|$)/,
      /^[A-Z]{1,2}\s?\d{4}\s?[A-Z]{1,2}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{3,4}\s?[A-Z]{1,2}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{3}[A-Z]{2}(?=\b|$)/,
      /^\d[- ]?[A-Z]{3}[- ]?\d{3}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{5}(?=\b|$)/,
      // Additional EU country series: Latvia, Estonia, Romania, Slovenia,
      // Austria and Luxembourg. These are checked before broad legacy UK
      // formats so their trailing letters/numbers are not lost.
      /^[A-Z]{2}[- ]?\d{4}(?=\b|$)/,
      /^\d{3}[- ]?[A-Z]{3}(?=\b|$)/,
      /^[A-Z]{1,2}[- ]?\d{1,5}[A-Z]{1,2}(?=\b|$)/,
      /^[A-Z]{2}[- ]?[A-Z]{2}[- ]?\d{3,4}(?=\b|$)/,
      /^[A-Z]{2}\s?\d{2}\s?[A-Z]{3}(?=\b|$)/,
      /^\d{1,4}[- ]?[A-Z]{1,2}(?=\b|$)/,
      // Northern Ireland / other legacy UK plates. Requiring 3-4 digits
      // avoids treating short notes such as "HSC 10 pallets" as a plate.
      /^[A-Z]{1,3}\s+\d{3,4}(?=\b|$)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0].replace(/\s+/g, " ").trim();
    }
    return "";
  }

  function groupTransactions(transactions = []) {
    const groups = new Map();
    (transactions || []).forEach((item, index) => {
      const client = String(item?.client || "Unknown client").trim() || "Unknown client";
      const key = `${String(client).toLowerCase()}\u0000${timeKey(item?.timestamp)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          client,
          timestamp: item?.timestamp || "",
          items: [],
          movements: { RECEIVED: [], SENT: [], DISCARD: [], OTHER: [] },
          totalLines: 0,
          totalQuantity: 0,
          image: "",
          comment: "",
          vehicleReg: "",
          originalIndexes: [],
          lastIndex: index,
          sortTimestamp: timestampMs(item?.timestamp)
        });
      }
      const group = groups.get(key);
      const movement = canonicalMovement(item?.movement);
      const quantity = Number(item?.quantity) || 0;
      group.items.push(item);
      group.originalIndexes.push(index);
      group.lastIndex = index;
      if (!Number.isFinite(group.sortTimestamp)) group.sortTimestamp = timestampMs(item?.timestamp);
      group.totalLines += 1;
      group.totalQuantity += quantity;
      if (!group.image && item?.image) group.image = item.image;
      if (!group.comment && item?.comment) group.comment = item.comment;
      if (!group.vehicleReg) group.vehicleReg = extractVehicleRegistration(item?.comment);
      if (!group.movements[movement]) group.movements[movement] = [];
      group.movements[movement].push({
        asset: String(item?.asset || "Unknown asset").trim() || "Unknown asset",
        quantity,
        raw: item
      });
    });

    return [...groups.values()].sort((a, b) => {
      const da = a.sortTimestamp;
      const db = b.sortTimestamp;
      if (Number.isFinite(db) && Number.isFinite(da) && db !== da) return db - da;
      if (Number.isFinite(db) !== Number.isFinite(da)) return Number.isFinite(db) ? -1 : 1;
      return (b.lastIndex || 0) - (a.lastIndex || 0);
    });
  }


  function movementSections(group, options = {}) {
    const includeEmpty = Boolean(options.includeEmpty);
    const sections = [];
    const addSection = movement => {
      const items = Array.isArray(group?.movements?.[movement]) ? group.movements[movement] : [];
      if (!items.length && !includeEmpty) return;
      const totalQuantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
      sections.push({
        movement,
        key: movement,
        label: movementLabel(movement),
        items,
        totalQuantity
      });
    };
    ORDER.forEach(addSection);
    addSection("OTHER");
    return sections;
  }

  function aggregateAssets(items = []) {
    const totals = new Map();
    items.forEach(item => {
      const asset = String(item.asset || "Unknown asset").trim() || "Unknown asset";
      totals.set(asset, (totals.get(asset) || 0) + (Number(item.quantity) || 0));
    });
    return [...totals.entries()].map(([asset, quantity]) => ({asset, quantity})).sort((a,b) => a.asset.localeCompare(b.asset));
  }

  function cardClass(group) {
    const movements = movementSections(group).map(section => section.movement);
    if (movements.length === 1) return `movement-card-${String(movements[0] ?? "other").toLowerCase()}`;
    if (movements.length > 1) return "movement-card-mixed";
    return "movement-card-other";
  }

  function movementLabels(group) {
    return movementSections(group).map(section => movementLabel(section.movement));
  }

  function assetSummary(group) {
    const assets = aggregateAssets(group?.items || []);
    return assets.map(item => item.asset).join(", ");
  }

  function formatLineCount(group) {
    const count = Number(group?.totalLines || 0);
    return `${count.toLocaleString()} ledger line${count === 1 ? "" : "s"}`;
  }

  window.FM_TRANSACTION_DISPLAY = {
    canonicalMovement,
    extractVehicleRegistration,
    movementLabel,
    movementClass,
    groupTransactions,
    movementSections,
    aggregateAssets,
    cardClass,
    movementLabels,
    assetSummary,
    formatLineCount
  };
})();
