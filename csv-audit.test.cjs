const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, auditCsv, reportCsv } = require('./csv-audit.js');

test('parses BOM, CRLF, quoted commas, escaped quotes and embedded newlines', () => {
  const rows = parseCsv('\uFEFFsku,name\r\n001,"Mug, blue"\r\n002,"Line 1\nLine ""2"""\r\n');
  assert.deepEqual(rows, [
    ['sku', 'name'],
    ['001', 'Mug, blue'],
    ['002', 'Line 1\nLine "2"'],
  ]);
});

test('rejects malformed quoting instead of silently changing cell boundaries', () => {
  assert.throws(() => parseCsv('sku,name\n001,"unfinished'), /未結束的引號/);
  assert.throws(() => parseCsv('sku,name\n001,un"quoted'), /未加引號的欄位/);
  assert.throws(() => parseCsv('sku,name\n001,"closed"tail'), /引號結束後/);
});

test('keeps text identifiers and reports duplicates, blanks and invalid prices', () => {
  const result = auditCsv(
    'sku,name,price,image\n001,A,10.00,a.jpg\n001,B,12,b.jpg\n002,,bad,\n',
    { sku: 'sku', name: 'name', price: 'price', image: 'image' },
  );
  assert.equal(result.total, 3);
  assert.equal(result.clean, 1);
  assert.equal(result.issues[0].sku, '001');
  assert.match(result.issues[0].findings.join(' '), /重複/);
  assert.deepEqual(result.issues[1].findings, ['商品名稱空白', '售價空白或格式錯誤', '圖片欄位空白']);
});

test('flags uneven rows and duplicate header names', () => {
  const mapping = { sku: 'sku', name: '', price: '', image: '' };
  const result = auditCsv('sku,name\n001,Book,extra\n', mapping);
  assert.match(result.issues[0].findings[0], /欄位數 3，應為 2/);
  assert.throws(() => auditCsv('sku,sku\n001,002\n', mapping), /重複欄名/);
});

test('escapes spreadsheet formulas in downloadable issue reports', () => {
  const report = reportCsv({ issues: [{ record: 1, sku: '=1+1', name: '@bad', findings: ['檢查'] }] });
  assert.match(report, /^\uFEFF資料筆數/);
  assert.ok(report.includes('"\'=1+1"'));
  assert.ok(report.includes('"\'@bad"'));
});
