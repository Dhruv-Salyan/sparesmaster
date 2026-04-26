// src/services/optimizationEngine.js
// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTORY OPTIMIZATION ENGINE
//  Provides 6 intelligent features on top of raw item data.
//  All functions are PURE — they receive data, return results, touch no DB.
//  This makes them easy to test and explain in a viva.
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 1 — AUTO REORDER SUGGESTION
//  Rule: if quantity < minLevel  →  suggest a reorder
//  Returns one suggestion object per qualifying item.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check every item and return reorder suggestions for those below minimum.
 *
 * @param  {object[]} items  - Full items array from DB
 * @returns {object[]}       - Array of suggestion objects
 *
 * Logic (viva explanation):
 *   We compare current stock (quantity) against the safety threshold (minLevel).
 *   If stock has dropped below that line the machine may break down before the
 *   part arrives, so we flag it immediately.
 */
function getReorderSuggestions(items) {
  return items
    .filter(item => item.quantity < item.minLevel)
    .map(item => {
      const suggestedQty = computeSuggestedReorderQty(item);
      const urgency      = classifyUrgency(item);

      return {
        itemId:        item.id,
        name:          item.name,
        partNumber:    item.partNumber,
        category:      item.category,
        supplier:      item.supplier,
        unit:          item.unit,
        currentQty:    item.quantity,
        minLevel:      item.minLevel,
        deficit:       item.minLevel - item.quantity,   // how many short we are
        suggestedQty,
        estimatedCost: suggestedQty * (item.unitCost || 0),
        urgency,                                        // 'critical' | 'high' | 'medium'
        reason:        buildReorderReason(item, urgency),
      };
    })
    .sort((a, b) => {
      // Sort: critical → high → medium, then by deficit descending
      const urgencyRank = { critical: 0, high: 1, medium: 2 };
      const rankDiff    = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      return rankDiff !== 0 ? rankDiff : b.deficit - a.deficit;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 2 — SUGGESTED REORDER QUANTITY
//  Formula: max(item.reorderQty, minLevel * 2 - currentQty)
//           i.e. at least the stored reorder amount, but always enough
//           to bring stock up to twice the safety level.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How many units should be ordered?
 *
 * Formula breakdown (viva explanation):
 *   targetStock   = minLevel × 2      (buffer: double the safety threshold)
 *   needed        = targetStock − qty (how many to reach that buffer)
 *   suggestedQty  = max(reorderQty, needed)
 *                 → always at least the stored reorder qty, often more
 *
 * @param  {object} item
 * @returns {number}
 */
function computeSuggestedReorderQty(item) {
  const targetStock = item.minLevel * 2;              // aim for 2× safety stock
  const needed      = Math.max(0, targetStock - item.quantity); // gap to fill
  const baseQty     = item.reorderQty || 10;          // stored reorder qty

  // Take the larger of: stored reorder qty  OR  what's needed to hit target
  return Math.max(baseQty, needed);
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 3 — STATUS LABELS  (already in DB, enriched here with metadata)
//  in_stock | low_stock | out_of_stock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a rich status descriptor for a single item.
 *
 * The DB stores a plain string ('in_stock' etc.).
 * This function adds the display label, colour hint, and icon name
 * so the frontend never has to hard-code those again.
 *
 * @param  {string} status
 * @returns {{ label, color, icon, description }}
 */
function getStatusMeta(status) {
  const map = {
    in_stock: {
      label:       'In Stock',
      color:       'green',
      icon:        'check-circle',
      description: 'Stock level is above the minimum threshold.',
    },
    low_stock: {
      label:       'Low Stock',
      color:       'amber',
      icon:        'alert-triangle',
      description: 'Stock has fallen below the reorder point. Order soon.',
    },
    out_of_stock: {
      label:       'Out of Stock',
      color:       'red',
      icon:        'x-circle',
      description: 'Zero units remaining. Immediate action required.',
    },
  };
  return map[status] || map.in_stock;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 4 — CRITICALITY RANKING
//  Ranks items from most to least critical using a weighted score.
//
//  Score formula (viva explanation):
//    Each factor contributes a weight (0–40 pts):
//      stockoutRisk (40) — is qty 0? Most dangerous.
//      shortfallRatio (30) — how far below minLevel, proportionally?
//      valueLoss (20) — expensive item × low qty = high risk in ₹
//      ageScore (10) — item not updated recently suggests neglect
//
//  Total max = 100 pts.  Higher = more critical.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rank all items by criticality score.
 *
 * @param  {object[]} items
 * @returns {object[]} sorted by score descending
 */
function rankByCriticality(items) {
  const ranked = items.map(item => {
    const score  = computeCriticalityScore(item);
    const label  = score >= 70 ? 'Critical'
                 : score >= 40 ? 'High'
                 : score >= 15 ? 'Medium'
                 :               'Low';

    return {
      rank:        0,         // filled in after sort
      itemId:      item.id,
      name:        item.name,
      category:    item.category,
      quantity:    item.quantity,
      minLevel:    item.minLevel,
      unitCost:    item.unitCost,
      status:      item.status,
      score:       Math.round(score),
      label,
      scoreBreakdown: computeScoreBreakdown(item), // for transparency
    };
  });

  // Sort highest score first, assign rank numbers
  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => { r.rank = i + 1; });

  return ranked;
}

/** Weighted criticality score 0–100 for one item. */
function computeCriticalityScore(item) {
  // Factor 1: Stockout risk (40 pts max)
  // Out of stock = 40, low stock proportional to deficit ratio
  let stockoutRisk = 0;
  if (item.quantity === 0) {
    stockoutRisk = 40;
  } else if (item.quantity < item.minLevel && item.minLevel > 0) {
    // deficit ratio: (minLevel - qty) / minLevel, scaled to 40
    stockoutRisk = ((item.minLevel - item.quantity) / item.minLevel) * 40;
  }

  // Factor 2: Shortfall ratio (30 pts max)
  // How far below minimum, as a ratio
  let shortfall = 0;
  if (item.minLevel > 0 && item.quantity < item.minLevel) {
    shortfall = Math.min(1, (item.minLevel - item.quantity) / item.minLevel) * 30;
  }

  // Factor 3: Value at risk (20 pts max)
  // High unit cost × low stock = expensive gap
  const maxCost = 2000;  // normalisation anchor (₹2000 = full 20 pts)
  const valueFactor = Math.min(1, (item.unitCost || 0) / maxCost);
  const stockFactor = item.minLevel > 0
    ? 1 - Math.min(1, item.quantity / item.minLevel)
    : 0;
  const valueRisk = valueFactor * stockFactor * 20;

  // Factor 4: Recency (10 pts max)
  // Item not updated in >30 days gets up to 10 pts (neglected stock)
  let ageScore = 0;
  if (item.updatedAt) {
    const daysSince = (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000;
    ageScore = Math.min(10, (daysSince / 30) * 10);
  }

  return stockoutRisk + shortfall + valueRisk + ageScore;
}

/** Break down the score into readable components for the UI. */
function computeScoreBreakdown(item) {
  const stockoutRisk = item.quantity === 0 ? 40
    : item.quantity < item.minLevel && item.minLevel > 0
      ? Math.round(((item.minLevel - item.quantity) / item.minLevel) * 40)
      : 0;

  const shortfall = item.minLevel > 0 && item.quantity < item.minLevel
    ? Math.round(Math.min(1, (item.minLevel - item.quantity) / item.minLevel) * 30)
    : 0;

  const valueFactor = Math.min(1, (item.unitCost || 0) / 2000);
  const stockFactor = item.minLevel > 0 ? 1 - Math.min(1, item.quantity / item.minLevel) : 0;
  const valueRisk   = Math.round(valueFactor * stockFactor * 20);

  let ageScore = 0;
  if (item.updatedAt) {
    const days = (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000;
    ageScore   = Math.round(Math.min(10, (days / 30) * 10));
  }

  return {
    stockoutRisk: { pts: stockoutRisk, max: 40, label: 'Stockout Risk'  },
    shortfall:    { pts: shortfall,    max: 30, label: 'Shortfall Ratio' },
    valueRisk:    { pts: valueRisk,    max: 20, label: 'Value at Risk'   },
    ageScore:     { pts: ageScore,     max: 10, label: 'Recency'         },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 5 — DEMAND ESTIMATION (from update history)
//  Uses the updatedAt timestamp and quantity changes stored in the DB.
//
//  Approach (viva explanation):
//    We don't have a separate transactions table, so we infer consumption:
//      • If quantity < reorderQty it means stock was used since last reorder
//      • We approximate average daily consumption based on:
//          consumption = max(0, reorderQty - quantity)
//          days active = days since item was created
//          avgDaily    = consumption / max(1, daysActive)
//      • daysToStockout = quantity / max(0.01, avgDaily)
//
//    This is a conservative, practical estimate suitable for a viva.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate future demand for each item.
 *
 * @param  {object[]} items
 * @returns {object[]}
 */
function estimateDemand(items) {
  return items.map(item => {
    const daysActive = Math.max(1,
      (Date.now() - new Date(item.createdAt || item.updatedAt).getTime()) / 86_400_000
    );

    // Inferred consumption: how much below the reorder qty we are
    const consumed    = Math.max(0, (item.reorderQty || 10) - item.quantity);
    const avgDaily    = consumed / daysActive;        // units per day
    const avgMonthly  = avgDaily * 30;                // units per month

    // Days until we run out at this consumption rate
    const daysToStockout = avgDaily > 0
      ? Math.round(item.quantity / avgDaily)
      : null;   // null = consumption too low to estimate

    // When should we order? Order when stock will last only as long as lead time
    // We assume a 7-day lead time (configurable)
    const LEAD_TIME_DAYS = 7;
    const orderByDate = daysToStockout !== null
      ? new Date(Date.now() + (daysToStockout - LEAD_TIME_DAYS) * 86_400_000)
        .toISOString().slice(0, 10)
      : null;

    const trend = avgDaily < 0.1 ? 'slow'
                : avgDaily < 0.5 ? 'moderate'
                :                  'fast';

    return {
      itemId:          item.id,
      name:            item.name,
      category:        item.category,
      quantity:        item.quantity,
      unit:            item.unit,
      avgDailyUsage:   parseFloat(avgDaily.toFixed(3)),
      avgMonthlyUsage: parseFloat(avgMonthly.toFixed(1)),
      daysToStockout,
      orderByDate,
      trend,
      confidence: consumed > 0 ? 'estimated' : 'insufficient_data',
      note: consumed > 0
        ? `Uses ~${avgMonthly.toFixed(1)} ${item.unit}/month`
        : 'No consumption detected yet',
    };
  })
  .sort((a, b) => {
    // Items about to run out first (soonest daysToStockout) float to top
    if (a.daysToStockout === null && b.daysToStockout === null) return 0;
    if (a.daysToStockout === null) return 1;
    if (b.daysToStockout === null) return -1;
    return a.daysToStockout - b.daysToStockout;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 6 — DASHBOARD WARNINGS
//  Produces actionable warning messages grouped by severity.
//  Called once per dashboard load; zero DB queries (uses already-loaded items).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate dashboard warning messages for each category of risk.
 *
 * @param  {object[]} items
 * @returns {{ critical: object[], warning: object[], info: object[] }}
 */
function getDashboardWarnings(items) {
  const critical = [];
  const warning  = [];
  const info     = [];

  // ── Out of stock items ──────────────────────────────────────────────────
  const outItems = items.filter(i => i.quantity === 0);
  outItems.forEach(i => {
    critical.push({
      type:    'out_of_stock',
      icon:    'x-circle',
      title:   `${i.name} is OUT OF STOCK`,
      detail:  `Part No: ${i.partNumber || '—'} · Supplier: ${i.supplier || '—'}`,
      action:  `Order ${computeSuggestedReorderQty(i)} ${i.unit} immediately`,
      itemId:  i.id,
    });
  });

  // ── Critically low (qty ≤ 25% of minLevel) ─────────────────────────────
  const critLow = items.filter(i => i.quantity > 0 &&
                                    i.minLevel > 0 &&
                                    i.quantity <= i.minLevel * 0.25);
  critLow.forEach(i => {
    critical.push({
      type:    'critical_low',
      icon:    'alert-triangle',
      title:   `${i.name} is critically low`,
      detail:  `Only ${i.quantity} ${i.unit} left — min level is ${i.minLevel}`,
      action:  `Order ${computeSuggestedReorderQty(i)} ${i.unit} from ${i.supplier || 'supplier'}`,
      itemId:  i.id,
    });
  });

  // ── Low stock items (qty < minLevel, not already in critical) ──────────
  const lowItems = items.filter(i => i.quantity > 0 &&
                                     i.quantity < i.minLevel &&
                                     i.quantity > i.minLevel * 0.25);
  lowItems.forEach(i => {
    warning.push({
      type:    'low_stock',
      icon:    'alert-triangle',
      title:   `${i.name} is below minimum`,
      detail:  `${i.quantity} ${i.unit} in stock · min is ${i.minLevel}`,
      action:  `Schedule reorder of ${computeSuggestedReorderQty(i)} ${i.unit}`,
      itemId:  i.id,
    });
  });

  // ── High-value items at low stock (extra financial risk) ───────────────
  const highValue = items.filter(i => (i.unitCost || 0) >= 500 &&
                                       i.quantity < i.minLevel &&
                                       i.quantity > 0);
  highValue.forEach(i => {
    if (!warning.find(w => w.itemId === i.id)) {  // don't duplicate
      warning.push({
        type:   'high_value_low',
        icon:   'dollar-sign',
        title:  `High-value item ${i.name} running low`,
        detail: `Unit cost ₹${i.unitCost.toLocaleString('en-IN')} — reorder quickly to avoid downtime cost`,
        action: `Order ${computeSuggestedReorderQty(i)} ${i.unit}`,
        itemId: i.id,
      });
    }
  });

  // ── No supplier recorded ───────────────────────────────────────────────
  const noSupplier = items.filter(i => !i.supplier && i.quantity < i.minLevel);
  noSupplier.forEach(i => {
    info.push({
      type:   'missing_supplier',
      icon:   'info',
      title:  `${i.name} has no supplier recorded`,
      detail: 'Cannot auto-generate a purchase order without supplier information.',
      action: 'Edit item and add supplier name',
      itemId: i.id,
    });
  });

  // ── Summary info block ─────────────────────────────────────────────────
  const totalReorder = items.filter(i => i.quantity < i.minLevel).length;
  if (totalReorder > 0) {
    const totalCost = getReorderSuggestions(items)
      .reduce((sum, s) => sum + s.estimatedCost, 0);
    info.push({
      type:   'reorder_summary',
      icon:   'shopping-cart',
      title:  `${totalReorder} item${totalReorder > 1 ? 's' : ''} need reordering`,
      detail: `Estimated total purchase cost: ₹${totalCost.toLocaleString('en-IN')}`,
      action: 'Review the Optimization page for a full reorder plan',
      itemId: null,
    });
  }

  return {
    critical,
    warning,
    info,
    counts: {
      critical: critical.length,
      warning:  warning.length,
      info:     info.length,
      total:    critical.length + warning.length + info.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Classify urgency for a reorder suggestion. */
function classifyUrgency(item) {
  if (item.quantity === 0)                        return 'critical';
  if (item.quantity <= item.minLevel * 0.25)      return 'critical';
  if (item.quantity <= item.minLevel * 0.5)       return 'high';
  return 'medium';
}

/** Human-readable reason sentence. */
function buildReorderReason(item, urgency) {
  if (item.quantity === 0)
    return `Zero stock remaining — machine downtime risk is immediate.`;
  const pct = Math.round((item.quantity / item.minLevel) * 100);
  return `Stock is at ${pct}% of minimum level (${item.quantity}/${item.minLevel} ${item.unit}). ${
    urgency === 'critical' ? 'Order immediately.' :
    urgency === 'high'     ? 'Order within 2–3 days.' :
                             'Plan reorder this week.'
  }`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMBINED INTELLIGENCE REPORT
//  Single function that runs all 6 features and returns everything at once.
//  Used by the /api/items/optimize endpoint.
// ─────────────────────────────────────────────────────────────────────────────

function runOptimization(items) {
  const reorderSuggestions = getReorderSuggestions(items);
  const criticalityRanking = rankByCriticality(items);
  const demandEstimates    = estimateDemand(items);
  const dashboardWarnings  = getDashboardWarnings(items);

  const totalReorderCost   = reorderSuggestions
    .reduce((s, r) => s + r.estimatedCost, 0);

  return {
    generatedAt:      new Date().toISOString(),
    itemCount:        items.length,
    reorderSuggestions,
    criticalityRanking,
    demandEstimates,
    dashboardWarnings,
    summary: {
      itemsNeedingReorder:  reorderSuggestions.length,
      criticalItems:        reorderSuggestions.filter(r => r.urgency === 'critical').length,
      estimatedReorderCost: Math.round(totalReorderCost),
      totalWarnings:        dashboardWarnings.counts.total,
    },
  };
}

module.exports = {
  runOptimization,
  getReorderSuggestions,
  computeSuggestedReorderQty,
  getStatusMeta,
  rankByCriticality,
  estimateDemand,
  getDashboardWarnings,
};
