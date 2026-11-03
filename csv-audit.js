(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CsvAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseCsv(text) {
    const input = String(text).replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false, closedQuote = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { quoted = false; closedQuote = true; }
        else field += ch;
      } else if (ch === ',' || ch === '\n' || ch === '\r') {
        row.push(field);
        field = ''; closedQuote = false;
        if (ch !== ',') {
          if (ch === '\r' && input[i + 1] === '\n') i++;
          if (row.some(value => value !== '')) rows.push(row);
          row = [];
        }
      } else if (ch === '"' && field === '' && !closedQuote) {
        quoted = true;
      } else if (closedQuote && ch !== ' ' && ch !== '\t') {
        throw new Error('引號結束後出現其他文字，請檢查 CSV 格式。');
      } else if (ch === '"' && !closedQuote) {
        throw new Error('未加引號的欄位含有引號，請檢查 CSV 格式。');
      } else if (!closedQuote) {
        field += ch;
      }
    }
    if (quoted) throw new Error('CSV 有未結束的引號。');
    if (field !== '' || row.length) {
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
    }
    return rows;
  }

  function auditCsv(text, mapping) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('CSV 至少需要標題列與一筆資料。');
    const headers = rows[0].map(value => value.trim());
    if (new Set(headers).size !== headers.length) throw new Error('標題列有重複欄名，請先確認欄位。');
    const keys = ['sku', 'name', 'price', 'image'];
    const indexes = {};
    for (const key of keys) {
      const chosen = mapping[key];
      indexes[key] = chosen === '' || chosen == null ? -1 : headers.indexOf(chosen);
      if (chosen && indexes[key] < 0) throw new Error(`找不到欄位：${chosen}`);
    }
    if (indexes.sku < 0 && indexes.name < 0 && indexes.price < 0 && indexes.image < 0) {
      throw new Error('請至少選擇一個要檢查的欄位。');
    }
    const seen = new Map(), issues = [];
    let clean = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i], findings = [], value = key => indexes[key] < 0 ? '' : (row[indexes[key]] || '').trim();
      if (row.length !== headers.length) findings.push(`欄位數 ${row.length}，應為 ${headers.length}`);
      if (indexes.sku >= 0) {
        const sku = value('sku');
        if (!sku) findings.push('商品編號空白');
        else if (seen.has(sku)) findings.push(`商品編號重複（首次在第 ${seen.get(sku)} 筆）`);
        else seen.set(sku, i);
      }
      if (indexes.name >= 0 && !value('name')) findings.push('商品名稱空白');
      if (indexes.price >= 0) {
        const price = value('price').replace(/,/g, '');
        if (!/^\d+(?:\.\d{1,2})?$/.test(price)) findings.push('售價空白或格式錯誤');
      }
      if (indexes.image >= 0 && !value('image')) findings.push('圖片欄位空白');
      if (findings.length) issues.push({record:i, sku:value('sku'), name:value('name'), findings});
      else clean++;
    }
    return {headers, total:rows.length - 1, clean, issues};
  }

  function reportCsv(result) {
    const quote = value => {
      const safe = /^[\s]*[=+\-@]/.test(String(value)) ? `'${value}` : String(value);
      return `"${safe.replace(/"/g, '""')}"`;
    };
    return '\uFEFF' + ['資料筆數,商品編號,商品名稱,待確認事項',
      ...result.issues.map(item => [item.record, item.sku, item.name, item.findings.join('；')].map(quote).join(','))
    ].join('\r\n');
  }

  return {parseCsv, auditCsv, reportCsv};
});
