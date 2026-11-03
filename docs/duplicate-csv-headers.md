# A duplicate CSV header can silently replace a product ID

**Reproducible Python note.** Drafted with AI assistance; the examples below were run with Python 3.12.3. This is a synthetic example, not a customer incident.

A product import can appear to succeed while using the wrong SKU. One way this happens is a duplicate CSV header. Python's `csv.DictReader` turns each row into a dictionary, and a dictionary has only one value per key. If the input has two columns named `sku`, the second value wins without an error.

Here is the entire failure:

```python
import csv
import io

source = "sku,sku,price\nA-100,B-999,12.00\n"
row = next(csv.DictReader(io.StringIO(source)))
print(row)
```

On Python 3.12.3 this prints:

```text
{'sku': 'B-999', 'price': '12.00'}
```

`A-100` has disappeared. The CSV parser did parse three fields; the loss happens when those fields are mapped to two dictionary keys. This is especially easy to miss when a spreadsheet merge, export setting, or hand edit creates a second column with the same label. The file is still readable, so a pipeline that checks only for parser exceptions will report success.

## Reject ambiguous headers before reading data rows

I use a header check immediately after constructing `DictReader`. Accessing `fieldnames` reads the header; no data row has been processed yet.

```python
import csv
import io


def validate_headers(fieldnames):
    if not fieldnames:
        raise ValueError("CSV has no header")

    seen = {}
    for position, raw in enumerate(fieldnames, start=1):
        key = raw.strip().casefold()
        if not key:
            raise ValueError(f"column {position} has a blank header")
        if key in seen:
            raise ValueError(
                f"columns {seen[key]} and {position} both map to {key!r}"
            )
        seen[key] = position


source = "sku,sku,price\nA-100,B-999,12.00\n"
reader = csv.DictReader(io.StringIO(source))
validate_headers(reader.fieldnames)
for row in reader:
    print(row)
```

For the example above, the check raises `ValueError: columns 1 and 2 both map to 'sku'`. It also catches `sku, sku ,price`, where the names differ to Python but may become identical later if an application trims whitespace. `casefold()` catches casing differences under this import policy. If your schema deliberately distinguishes `ID` from `id`, use its exact naming policy instead of this normalization.

For a real file, replace `io.StringIO(source)` with a file opened using `open("products.csv", newline="", encoding="utf-8-sig")` inside a `with` block. The `utf-8-sig` encoding strips a leading UTF-8 byte order mark, so the first header is compared as `sku` rather than `\ufeffsku`. It has no effect on a normal UTF-8 file. Passing `newline=""` follows the [`csv` module's file handling guidance](https://docs.python.org/3/library/csv.html#csv.reader).

## What this check does not prove

Unique headers do not guarantee valid rows. A row with more fields than the header can put extras under `None` in `DictReader`; missing fields receive `None` unless a different `restval` is specified. A production importer should separately check required columns, row widths, field types, and duplicate SKU values. The header check addresses one specific failure: silently choosing one of two columns with the same meaning.

For order and catalog data, I would reject the ambiguous file and ask the exporter which SKU column is authoritative. Automatically renaming it to `sku_2` preserves bytes but does not answer that business question.

The key behavior is visible in Python's [`csv.DictReader` documentation](https://docs.python.org/3/library/csv.html#csv.DictReader); the small example above makes its consequence for a product import concrete.
