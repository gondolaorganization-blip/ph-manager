function parsePage(query, defaultLimit = 20) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Wraps a Prisma findMany + count into a pagination envelope.
// modelFns: { findMany, count } — typically a Prisma model delegate
async function paginar(modelFns, { where, include, orderBy, select }, query, defaultLimit = 20) {
  const { page, limit, skip } = parsePage(query, defaultLimit);
  const [data, total] = await Promise.all([
    modelFns.findMany({ where, include, orderBy, select, skip, take: limit }),
    modelFns.count({ where }),
  ]);
  return { data, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

module.exports = { parsePage, paginar };
